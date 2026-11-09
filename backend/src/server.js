require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('./db');
const { sign, auth } = require('./auth');
const ai = require('./ai');

const app = express();
app.set('trust proxy', 1); // behind Render/Railway/Fly, so rate limits see the real client IP
app.use(cors());

// Express 4 ignores promises rejected inside async handlers, which can crash Node. Forward them to the error handler.
for (const m of ['get', 'post', 'put', 'patch', 'delete']) {
  const orig = app[m].bind(app);
  app[m] = (path, ...handlers) =>
    handlers.length
      ? orig(path, ...handlers.map((h) => (h.constructor.name === 'AsyncFunction' ? (req, res, next) => h(req, res, next).catch(next) : h)))
      : orig(path);
}

/** Tiny in-memory rate limiter, enough to stop a public URL from burning the AI key. */
function limit({ windowMs, max, by = 'ip' }) {
  const hits = new Map();
  setInterval(() => hits.clear(), windowMs).unref();
  return (req, res, next) => {
    const key = by === 'user' ? `u${req.uid}` : req.ip;
    const n = (hits.get(key) || 0) + 1;
    hits.set(key, n);
    if (n > max) return res.status(429).json({ error: 'Too many requests. Take a breath and try again in a few minutes.' });
    next();
  };
}
const authLimit = limit({ windowMs: 10 * 60 * 1000, max: 30 });
const aiLimit = limit({ windowMs: 10 * 60 * 1000, max: 60, by: 'user' });
app.use(express.json({ limit: '1mb' }));

// The app sends Date.getTimezoneOffset() so "today" and streaks follow the user's local day, not UTC.
app.use((req, _res, next) => {
  const off = Number(req.headers['x-tz-offset']);
  req.tzMin = Number.isInteger(off) && Math.abs(off) <= 840 ? -off : 0;
  next();
});

const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  goals: JSON.parse(u.goals || '[]'),
  memoryEnabled: !!u.memory_enabled,
});
const getUser = (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id);

app.get('/health', (_req, res) => res.json({ ok: true, ai: !!ai.client, provider: ai.provider }));

// ---------- Auth ----------
/** Creates the account plus its default reminders. Shared by email signup and Google sign-in. */
function createUser({ email, passwordHash, name }) {
  const info = db.prepare('INSERT INTO users (email, password_hash, name, goals) VALUES (?, ?, ?, ?)').run(email, passwordHash, name, '[]');
  const user = getUser(info.lastInsertRowid);
  const ins = db.prepare('INSERT INTO reminders (user_id, kind, label, hour, minute, enabled) VALUES (?,?,?,?,?,?)');
  ins.run(user.id, 'checkin', 'Daily mood check-in', 9, 0, 1);
  ins.run(user.id, 'affirmation', 'Morning affirmation', 8, 30, 0);
  ins.run(user.id, 'breathing', 'Breathing break', 15, 0, 0);
  ins.run(user.id, 'selfcare', 'Evening wind-down', 21, 0, 0);
  return user;
}

/** Stores the "about you" answers: goals, how they have been feeling, and when to nudge them. */
function applySetup(userId, { goals, feeling, checkinTime, remind } = {}) {
  if (Array.isArray(goals)) {
    const clean = goals.filter((g) => typeof g === 'string').map((g) => g.slice(0, 60)).slice(0, 12);
    db.prepare('UPDATE users SET goals = ? WHERE id = ?').run(JSON.stringify(clean), userId);
  }
  const okTime = checkinTime && Number.isInteger(checkinTime.hour) && Number.isInteger(checkinTime.minute) &&
    checkinTime.hour >= 0 && checkinTime.hour < 24 && checkinTime.minute >= 0 && checkinTime.minute < 60;
  if (okTime || remind !== undefined) {
    db.prepare("UPDATE reminders SET hour = COALESCE(?, hour), minute = COALESCE(?, minute), enabled = ? WHERE user_id = ? AND kind = 'checkin'")
      .run(okTime ? checkinTime.hour : null, okTime ? checkinTime.minute : null, remind === false ? 0 : 1, userId);
  }
  // How they said they've been feeling lately becomes Sunny's first memory, so the very first chat already feels personal.
  if (typeof feeling === 'string' && feeling.trim() && feeling.length < 80) {
    db.prepare('INSERT INTO memories (user_id, fact) VALUES (?, ?)').run(userId, `When joining, said they have been feeling "${feeling.trim()}" lately`);
  }
}

app.post('/auth/signup', authLimit, (req, res) => {
  const { email, password, name, goals, feeling, checkinTime, remind } = req.body || {};
  if (!email || !password || !name) return res.status(400).json({ error: 'Name, email and password are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const clean = email.trim().toLowerCase();
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(clean)) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }
  const user = createUser({ email: clean, passwordHash: bcrypt.hashSync(password, 10), name: name.trim() });
  applySetup(user.id, { goals, feeling, checkinTime, remind });
  res.json({ token: sign(getUser(user.id)), user: publicUser(getUser(user.id)) });
});

// Sign in with Google: the app sends the ID token Google issued; we verify it with Google and match or create the account.
const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
async function verifyGoogleToken(idToken) {
  const allowed = (process.env.GOOGLE_CLIENT_IDS || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (!idToken || !allowed.length) return null;
  try {
    const url = `${process.env.GOOGLE_TOKENINFO_URL || 'https://oauth2.googleapis.com/tokeninfo'}?id_token=${encodeURIComponent(idToken)}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const info = await r.json();
    const verified = info.email_verified === true || info.email_verified === 'true';
    if (!allowed.includes(info.aud) || !GOOGLE_ISSUERS.includes(info.iss) || !verified || !info.email) return null;
    const email = String(info.email).toLowerCase();
    return { email, name: String(info.given_name || info.name || email.split('@')[0]).slice(0, 60) };
  } catch {
    return null;
  }
}

app.post('/auth/google', authLimit, async (req, res) => {
  const g = await verifyGoogleToken(String(req.body?.idToken || ''));
  if (!g) return res.status(401).json({ error: "Google sign-in didn't work. Please try again, or use your email." });
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(g.email);
  const isNew = !user;
  if (isNew) user = createUser({ email: g.email, passwordHash: bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10), name: g.name });
  res.json({ token: sign(user), user: publicUser(user), isNew });
});

app.post('/me/setup', auth, (req, res) => {
  applySetup(req.uid, req.body || {});
  res.json({ user: publicUser(getUser(req.uid)) });
});

// Lets the app tell people their email is taken on the very first signup step, not after three screens.
app.post('/auth/check-email', authLimit, (req, res) => {
  const clean = String(req.body?.email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(clean)) return res.status(400).json({ error: 'Please enter a valid email address' });
  res.json({ available: !db.prepare('SELECT 1 FROM users WHERE email = ?').get(clean) });
});

app.post('/auth/login', authLimit, (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get((email || '').trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }
  res.json({ token: sign(user), user: publicUser(user) });
});

app.get('/me', auth, (req, res) => res.json({ user: publicUser(getUser(req.uid)) }));

app.patch('/me', auth, (req, res) => {
  const { name, goals, memoryEnabled } = req.body || {};
  const u = getUser(req.uid);
  db.prepare('UPDATE users SET name = ?, goals = ?, memory_enabled = ? WHERE id = ?').run(
    name ?? u.name,
    goals ? JSON.stringify(goals) : u.goals,
    memoryEnabled === undefined ? u.memory_enabled : memoryEnabled ? 1 : 0,
    u.id
  );
  res.json({ user: publicUser(getUser(u.id)) });
});

// ---------- Conversations ----------
const ownsConv = (uid, id) => db.prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?').get(id, uid);

app.get('/conversations', auth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT c.id, c.title, c.updated_at,
        (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS preview
       FROM conversations c WHERE c.user_id = ? ORDER BY c.updated_at DESC`
    )
    .all(req.uid);
  res.json({ conversations: rows });
});

app.post('/conversations', auth, (req, res) => {
  const info = db.prepare('INSERT INTO conversations (user_id) VALUES (?)').run(req.uid);
  res.json({ conversation: db.prepare('SELECT * FROM conversations WHERE id = ?').get(info.lastInsertRowid) });
});

app.get('/conversations/:id/messages', auth, (req, res) => {
  const conv = ownsConv(req.uid, req.params.id);
  if (!conv) return res.status(404).json({ error: 'Not found' });
  const messages = db
    .prepare('SELECT id, role, content, mood, suggestion, created_at FROM messages WHERE conversation_id = ? ORDER BY id')
    .all(conv.id)
    .map((m) => ({ ...m, suggestion: m.suggestion ? JSON.parse(m.suggestion) : null }));
  res.json({ conversation: conv, messages });
});

app.delete('/conversations/:id', auth, (req, res) => {
  const conv = ownsConv(req.uid, req.params.id);
  if (!conv) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM conversations WHERE id = ?').run(conv.id);
  res.json({ ok: true });
});

app.post('/conversations/:id/messages', auth, aiLimit, async (req, res) => {
  const conv = ownsConv(req.uid, req.params.id);
  if (!conv) return res.status(404).json({ error: 'Not found' });
  const text = String(req.body?.content || '').trim().slice(0, 4000);
  if (!text) return res.status(400).json({ error: 'Message is empty' });

  const user = getUser(req.uid);
  const history = db
    .prepare('SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 30')
    .all(conv.id)
    .reverse();
  const isFirst = history.length === 0;

  db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?,?,?)').run(conv.id, 'user', text);
  const out = await ai.chat(user, history, text);
  const info = db
    .prepare('INSERT INTO messages (conversation_id, role, content, mood, suggestion) VALUES (?,?,?,?,?)')
    .run(conv.id, 'assistant', out.reply, out.mood, out.suggestion ? JSON.stringify(out.suggestion) : null);

  if (isFirst) {
    const title = await ai.makeTitle(text);
    db.prepare('UPDATE conversations SET title = ? WHERE id = ?').run(title, conv.id);
  }
  db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(conv.id);

  ai.extractMemories(user, text, out.reply); // fire and forget

  res.json({
    message: { id: info.lastInsertRowid, role: 'assistant', content: out.reply, mood: out.mood, suggestion: out.suggestion },
  });
});

// ---------- Memory (user control) ----------
app.get('/memories', auth, (req, res) =>
  res.json({ memories: db.prepare('SELECT id, fact, created_at FROM memories WHERE user_id = ? ORDER BY id DESC').all(req.uid) })
);
app.delete('/memories/:id', auth, (req, res) => {
  db.prepare('DELETE FROM memories WHERE id = ? AND user_id = ?').run(req.params.id, req.uid);
  res.json({ ok: true });
});
app.delete('/memories', auth, (req, res) => {
  db.prepare('DELETE FROM memories WHERE user_id = ?').run(req.uid);
  res.json({ ok: true });
});

// ---------- XP & levels ----------
const XP = {
  checkin: 25,
  breathing: 20,
  affirmation: 10,
  reflection: 15,
  gratitude: 15,
  grounding: 15,
  selfcare: 10,
  walk: 10,
  water: 10,
  stretch: 10,
  resource_step: 2,
  challenge: 15,
};
const LEVELS = ['Seed', 'First Sprout', 'Budding', 'Blooming', 'Flourishing', 'Evergreen'];
const tzMod = (m) => `${m >= 0 ? '+' : ''}${m} minutes`;
const totalXp = (uid) => db.prepare('SELECT COALESCE(SUM(xp),0) n FROM activity_log WHERE user_id = ?').get(uid).n;

function levelInfo(xp) {
  const level = Math.floor(xp / 100) + 1;
  return {
    xp,
    level,
    levelName: LEVELS[Math.min(level - 1, LEVELS.length - 1)],
    xpInLevel: xp % 100,
    xpForNext: 100,
  };
}

/** Logs an activity and grants XP, at most once a day per kind+detail (breathing: 3 times) so it can't be farmed. */
function award(uid, kind, detail, tzMin, xpOverride) {
  const before = totalXp(uid);
  const limit = kind === 'breathing' ? 3 : 1;
  const done = db
    .prepare(
      `SELECT COUNT(*) n FROM activity_log
       WHERE user_id = ? AND kind = ? AND COALESCE(detail,'') = COALESCE(?, '') AND xp > 0
         AND date(created_at, ?) = date('now', ?)`
    )
    .get(uid, kind, detail ?? null, tzMod(tzMin), tzMod(tzMin)).n;
  const gained = done >= limit ? 0 : xpOverride ?? XP[kind] ?? 0;
  db.prepare('INSERT INTO activity_log (user_id, kind, detail, xp) VALUES (?,?,?,?)').run(uid, kind, detail ?? null, gained);
  const after = levelInfo(before + gained);
  return {
    gained,
    totalXp: after.xp,
    level: after.level,
    levelName: after.levelName,
    xpInLevel: after.xpInLevel,
    leveledUp: after.level > levelInfo(before).level,
  };
}

// ---------- Moods ----------
app.post('/moods', auth, (req, res) => {
  const { score, tags = [], note = null } = req.body || {};
  if (!Number.isInteger(score) || score < 1 || score > 5) return res.status(400).json({ error: 'Score must be 1-5' });
  db.prepare('INSERT INTO moods (user_id, score, tags, note) VALUES (?,?,?,?)').run(req.uid, score, JSON.stringify(tags), note);
  res.json({ ok: true, award: award(req.uid, 'checkin', null, req.tzMin) });
});

app.get('/moods', auth, (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 365);
  const rows = db
    .prepare(`SELECT id, score, tags, note, created_at FROM moods WHERE user_id = ? AND created_at >= datetime('now', ?) ORDER BY id`)
    .all(req.uid, `-${days} days`)
    .map((m) => ({ ...m, tags: JSON.parse(m.tags || '[]') }));
  res.json({ moods: rows });
});

// ---------- Activities & progress ----------
app.post('/activities', auth, (req, res) => {
  const { kind, detail = null } = req.body || {};
  if (!kind) return res.status(400).json({ error: 'kind required' });
  res.json({ ok: true, award: award(req.uid, String(kind).slice(0, 40), detail ? String(detail).slice(0, 80) : null, req.tzMin) });
});

function computeStreak(uid, tzMin = 0) {
  const days = db
    .prepare(
      `SELECT DISTINCT date(created_at, ?) d FROM (
         SELECT created_at FROM moods WHERE user_id = ?
         UNION ALL SELECT created_at FROM activity_log WHERE user_id = ?
       ) ORDER BY d DESC`
    )
    .all(tzMod(tzMin), uid, uid)
    .map((r) => r.d);
  const fmt = (d) => d.toISOString().slice(0, 10);
  let cursor = new Date(Date.now() + tzMin * 60000);
  if (!days.includes(fmt(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while (days.includes(fmt(cursor))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return { streak, days };
}

app.get('/progress', auth, (req, res) => {
  const { streak, days } = computeStreak(req.uid, req.tzMin);
  const count = (sql) => db.prepare(sql).get(req.uid).n;
  const stats = {
    checkins: count('SELECT COUNT(*) n FROM moods WHERE user_id = ?'),
    breathing: count("SELECT COUNT(*) n FROM activity_log WHERE user_id = ? AND kind = 'breathing'"),
    conversations: count('SELECT COUNT(*) n FROM conversations WHERE user_id = ?'),
    challenges: count('SELECT COUNT(*) n FROM challenges WHERE user_id = ? AND done = 1'),
  };
  const avg = db
    .prepare("SELECT AVG(score) a FROM moods WHERE user_id = ? AND created_at >= datetime('now','-7 days')")
    .get(req.uid).a;
  const badges = [
    { id: 'first', label: 'First step', earned: stats.checkins >= 1 },
    { id: 'streak3', label: '3-day streak', earned: streak >= 3 },
    { id: 'streak7', label: 'Week of care', earned: streak >= 7 },
    { id: 'breath10', label: '10 calm breaths', earned: stats.breathing >= 10 },
    { id: 'talk', label: 'Opened up', earned: stats.conversations >= 1 },
    { id: 'wins3', label: '3 small wins', earned: stats.challenges >= 3 },
  ];
  res.json({
    streak,
    activeDays: days.slice(0, 60),
    stats,
    weekAvg: avg ? Number(avg.toFixed(1)) : null,
    badges,
    ...levelInfo(totalXp(req.uid)),
  });
});

// ---------- Self check-ins (gentle screenings, not diagnoses) ----------
const ASSESSMENT_TYPES = ['mood', 'anxiety', 'selflove'];

app.post('/assessments', auth, (req, res) => {
  const { type, answers, label = '' } = req.body || {};
  const valid =
    ASSESSMENT_TYPES.includes(type) &&
    Array.isArray(answers) &&
    answers.length === 4 &&
    answers.every((n) => Number.isInteger(n) && n >= 0 && n <= 3);
  if (!valid) return res.status(400).json({ error: 'Invalid check-in' });
  const score = answers.reduce((s, n) => s + n, 0);
  db.prepare('INSERT INTO assessments (user_id, type, score, label, answers) VALUES (?,?,?,?,?)').run(
    req.uid,
    type,
    score,
    String(label).slice(0, 60),
    JSON.stringify(answers)
  );
  // +2 XP per question and a +40 bonus, once per type per day
  res.json({ score, award: award(req.uid, 'assessment', type, req.tzMin, answers.length * 2 + 40) });
});

app.get('/assessments', auth, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 5, 50);
  res.json({
    assessments: db
      .prepare('SELECT id, type, score, label, created_at FROM assessments WHERE user_id = ? ORDER BY id DESC LIMIT ?')
      .all(req.uid, limit),
  });
});

// ---------- Reminders ----------
app.get('/reminders', auth, (req, res) =>
  res.json({ reminders: db.prepare('SELECT * FROM reminders WHERE user_id = ? ORDER BY hour, minute').all(req.uid) })
);
app.post('/reminders', auth, (req, res) => {
  const { kind = 'custom', label, hour, minute = 0 } = req.body || {};
  if (!label || !Number.isInteger(hour)) return res.status(400).json({ error: 'label and hour required' });
  const info = db
    .prepare('INSERT INTO reminders (user_id, kind, label, hour, minute, enabled) VALUES (?,?,?,?,?,1)')
    .run(req.uid, kind, label, hour, minute);
  res.json({ reminder: db.prepare('SELECT * FROM reminders WHERE id = ?').get(info.lastInsertRowid) });
});
app.patch('/reminders/:id', auth, (req, res) => {
  const r = db.prepare('SELECT * FROM reminders WHERE id = ? AND user_id = ?').get(req.params.id, req.uid);
  if (!r) return res.status(404).json({ error: 'Not found' });
  const { label, hour, minute, enabled } = req.body || {};
  db.prepare('UPDATE reminders SET label = ?, hour = ?, minute = ?, enabled = ? WHERE id = ?').run(
    label ?? r.label,
    hour ?? r.hour,
    minute ?? r.minute,
    enabled === undefined ? r.enabled : enabled ? 1 : 0,
    r.id
  );
  res.json({ reminder: db.prepare('SELECT * FROM reminders WHERE id = ?').get(r.id) });
});
app.delete('/reminders/:id', auth, (req, res) => {
  db.prepare('DELETE FROM reminders WHERE id = ? AND user_id = ?').run(req.params.id, req.uid);
  res.json({ ok: true });
});

// ---------- Daily content ----------
const AFFIRMATIONS = [
  'I can take this one small step at a time.',
  'My feelings are allowed to be here, and they will pass.',
  'I am doing better than I give myself credit for.',
  'Rest is part of the work, not a break from it.',
  'I deserve the same kindness I give to others.',
  'I do not have to solve everything today.',
  'Progress can be quiet and still be real.',
];
app.get('/daily/note', auth, aiLimit, async (req, res) => {
  res.json(await ai.dailyNote(getUser(req.uid), req.tzMin));
});
app.get('/daily/challenge', auth, aiLimit, async (req, res) => {
  res.json({ ...(await ai.dailyChallenge(getUser(req.uid), req.tzMin)), xp: XP.challenge });
});
app.post('/daily/challenge/complete', auth, async (req, res) => {
  const ch = await ai.dailyChallenge(getUser(req.uid), req.tzMin);
  const day = new Date(Date.now() + req.tzMin * 60000).toISOString().slice(0, 10);
  if (ch.done) return res.json({ ...ch, award: award(req.uid, 'challenge', null, req.tzMin) });
  db.prepare('UPDATE challenges SET done = 1 WHERE user_id = ? AND day = ?').run(req.uid, day);
  res.json({ ...ch, done: true, award: award(req.uid, 'challenge', null, req.tzMin) });
});
app.get('/daily', auth, (req, res) => {
  const day = Math.floor(Date.now() / 86400000);
  res.json({ affirmation: AFFIRMATIONS[day % AFFIRMATIONS.length] });
});

// ---------- Account ----------
// Deletes the account and, through ON DELETE CASCADE, every chat, memory, check-in, reminder and note.
app.delete('/auth/account', auth, (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(req.uid);
  res.json({ ok: true });
});

// Anything that slips through becomes a calm JSON error instead of a dead server.
app.use((err, req, res, _next) => {
  console.error(`${req.method} ${req.path} failed:`, err.message);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Something went off-balance. Please try again.' });
});
process.on('unhandledRejection', (e) => console.error('unhandled rejection:', e && e.message));

// ---------- Demo account ----------
// Optional. With DEMO_EMAIL and DEMO_PASSWORD set, a lived-in account is (re)created at startup whenever it is missing.
// That keeps a shareable login working on free hosting, where the database is wiped each time the server sleeps or redeploys.
function seedDemo() {
  const email = (process.env.DEMO_EMAIL || '').trim().toLowerCase();
  const password = process.env.DEMO_PASSWORD || '';
  if (!email || password.length < 6) return;
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return;

  const user = createUser({ email, passwordHash: bcrypt.hashSync(password, 10), name: 'Alex' });
  applySetup(user.id, { goals: ['Feel calmer', 'Sleep better', 'Manage stress'], feeling: 'Stressed', checkinTime: { hour: 20, minute: 0 }, remind: true });

  const mem = db.prepare('INSERT INTO memories (user_id, fact) VALUES (?, ?)');
  mem.run(user.id, 'Has exams coming up and tends to worry about them at night');
  mem.run(user.id, 'A short evening walk helps them unwind');
  mem.run(user.id, 'Likes being reminded that small steps count');

  // Six days of check-ins ending yesterday, so streak, level, badges and the weekly chart all have something to show.
  const days = [
    { score: 3, tags: ['Work'], note: 'Busy day, a bit scattered' },
    { score: 2, tags: ['Sleep', 'Stress'], note: 'Barely slept' },
    { score: 3, tags: ['Study'], note: null },
    { score: 4, tags: ['Friends'], note: 'Nice dinner with friends' },
    { score: 3, tags: ['Study'], note: null },
    { score: 4, tags: ['Exercise'], note: 'Walked after class' },
  ];
  const mood = db.prepare("INSERT INTO moods (user_id, score, tags, note, created_at) VALUES (?,?,?,?,datetime('now', ?))");
  const log = db.prepare("INSERT INTO activity_log (user_id, kind, detail, xp, created_at) VALUES (?,?,?,?,datetime('now', ?))");
  days.forEach((d, i) => {
    const ago = `-${days.length - i} days`;
    mood.run(user.id, d.score, JSON.stringify(d.tags), d.note, ago);
    log.run(user.id, 'checkin', null, XP.checkin, ago);
  });
  log.run(user.id, 'breathing', '4 cycles', XP.breathing, '-3 days');
  log.run(user.id, 'breathing', '4 cycles', XP.breathing, '-1 days');

  const conv = db.prepare("INSERT INTO conversations (user_id, title, created_at, updated_at) VALUES (?,?,datetime('now','-2 days'),datetime('now','-2 days'))").run(user.id, 'Exam worries at night');
  const msg = db.prepare("INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?,?,?,datetime('now','-2 days'))");
  msg.run(conv.lastInsertRowid, 'user', "I can't stop thinking about my exams. It gets worse when I try to sleep.");
  msg.run(conv.lastInsertRowid, 'assistant', "That sounds exhausting, Alex. The worry gets louder when everything goes quiet. What does it say to you at night, the loudest thought?");
}
seedDemo();

const port = process.env.PORT || 4000;
app.listen(port, '0.0.0.0', () => console.log(`Solace API on :${port} (AI ${ai.client ? ai.provider : 'offline fallback'})`));
