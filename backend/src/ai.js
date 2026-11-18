const llm = require('./llm');
const db = require('./db');

const ACTIVITIES = ['breathing', 'affirmation', 'reflection', 'gratitude', 'walk', 'water', 'stretch', 'grounding'];

// Safety first: a message that signals self-harm is answered by the server itself, before any model is called.
const CRISIS_RE = /(suicid|kill myself|killing myself|end my life|take my own life|want to die|wanna die|don'?t want to (live|be here)|no reason to live|better off dead|self[- ]?harm|hurt myself|harm myself|cut myself)/i;

function crisisReply(user) {
  return {
    reply: `${user.name}, I'm really glad you told me, and I'm taking it seriously. You don't have to carry this alone. Please reach out to someone you trust right now, or call Tele-MANAS at 14416 (free, 24x7). If you are in danger, call 112 (in the US, call or text 988). I'm here with you too.`,
    mood: 'sad',
    suggestion: null,
    crisis: true,
  };
}

function systemPrompt(user, memories, recentMoods, checks = []) {
  const memBlock = memories.length
    ? memories.map((m) => `- ${m.fact}`).join('\n')
    : '(nothing yet)';
  const moodBlock = recentMoods.length
    ? recentMoods.map((m) => `${m.created_at.slice(0, 10)}: ${m.score}/5${m.note ? ` (${m.note})` : ''}`).join('\n')
    : '(no check-ins yet)';

  const checkBlock = checks.length
    ? checks.map((c) => `${c.created_at.slice(0, 10)}: ${c.type} check "${c.label}" (${c.score}/12)`).join('\n')
    : '(none yet)';

  return `You are Sunny, the warm companion inside Solace, a wellness app. You talk with ${user.name}.

Personality: gentle, curious, a little playful, never preachy. You sound like a thoughtful friend, not a therapist or a motivational poster. Short replies (2-5 sentences). Reflect what the person actually said, in specifics, before offering anything. Ask at most one question. No clichés like "everything happens for a reason", no lists, no emoji spam (one at most).

What you know about ${user.name} (use only when it genuinely helps, never recite it):
${memBlock}

Recent mood check-ins (1 low to 5 great):
${moodBlock}

Recent self check-ins (gentle screenings, never diagnoses; for "selflove" a higher score means kinder self-talk, for "mood" and "anxiety" higher means heavier):
${checkBlock}

You are not a clinician and don't diagnose. If the person mentions wanting to die, harming themselves, or being in danger: respond with calm, direct care, encourage reaching out to someone they trust now, and mention that in India they can call Tele-MANAS at 14416 or 1-800-891-4416 (free, 24x7), or local emergency services at 112 (in the US, call or text 988). Do not suggest an activity in that case.

Respond with ONLY a JSON object, no other text:
{"reply": string, "mood": one of "joyful"|"calm"|"neutral"|"anxious"|"sad"|"angry"|"overwhelmed"|"tired", "suggestion": null or {"kind": one of ${JSON.stringify(ACTIVITIES)}, "why": short string in your voice}}
Only include a suggestion when it would truly help right now, not on every turn.`;
}

function parseJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('no json');
  return JSON.parse(text.slice(start, end + 1));
}

async function chat(user, history, userText) {
  if (CRISIS_RE.test(userText)) return crisisReply(user);
  const memories = user.memory_enabled
    ? db.prepare('SELECT fact FROM memories WHERE user_id = ? ORDER BY id DESC LIMIT 25').all(user.id)
    : [];
  const moods = user.memory_enabled
    ? db.prepare('SELECT score, note, created_at FROM moods WHERE user_id = ? ORDER BY id DESC LIMIT 7').all(user.id)
    : [];

  const checks = user.memory_enabled
    ? db.prepare('SELECT type, score, label, created_at FROM assessments WHERE user_id = ? ORDER BY id DESC LIMIT 3').all(user.id)
    : [];

  if (!llm.enabled) return offlineReply(user, userText);

  const messages = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userText },
  ];

  try {
    const text = await llm.complete({
      system: systemPrompt(user, memories, moods, checks),
      messages,
      maxTokens: 700,
      json: true,
    });
    const out = parseJson(text);
    if (out.suggestion && !ACTIVITIES.includes(out.suggestion.kind)) out.suggestion = null;
    return { reply: String(out.reply), mood: out.mood || 'neutral', suggestion: out.suggestion || null };
  } catch (err) {
    console.error('chat error', err.message);
    return offlineReply(user, userText);
  }
}

function offlineReply(user, text) {
  const lower = text.toLowerCase();
  // Even when the AI is unavailable (or a provider blocks the message), never answer self-harm with a generic line.
  if (CRISIS_RE.test(text)) return crisisReply(user);
  const anxious = /(anxious|worried|panic|stress|nervous|overwhelm)/.test(lower);
  return {
    reply: anxious
      ? `That sounds like a lot to carry, ${user.name}. Let's slow things down together for a moment. What feels the heaviest right now?`
      : `I'm here, ${user.name}. Tell me a little more about how today has been.`,
    mood: anxious ? 'anxious' : 'neutral',
    suggestion: anxious ? { kind: 'breathing', why: 'A few slow breaths can take the edge off.' } : null,
  };
}

// Pulls durable facts from a finished exchange; runs in the background.
async function extractMemories(user, userText, reply) {
  if (!llm.enabled || !user.memory_enabled) return;
  try {
    const existing = db.prepare('SELECT fact FROM memories WHERE user_id = ?').all(user.id).map((m) => m.fact);
    const text = await llm.complete({
      fast: true,
      maxTokens: 300,
      system:
        'Extract durable, useful facts about the user from their message (people, routines, stressors, goals, what helps them). ' +
        'Skip passing moods, anything already known, and sensitive details like health diagnoses or self-harm. ' +
        'Return ONLY a JSON array of short strings (max 2), or [] if nothing is worth keeping.',
      messages: [{ role: 'user', content: `Already known: ${JSON.stringify(existing)}\n\nUser said: ${userText}` }],
    });
    const arr = JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1));
    const insert = db.prepare('INSERT INTO memories (user_id, fact) VALUES (?, ?)');
    for (const fact of arr.slice(0, 2)) if (typeof fact === 'string' && fact.length < 200) insert.run(user.id, fact);
  } catch (err) {
    console.error('memory extraction failed', err.message);
  }
}

async function makeTitle(userText) {
  if (!llm.enabled) return userText.slice(0, 40);
  try {
    const text = await llm.complete({
      fast: true,
      maxTokens: 30,
      system: 'Write a 2-4 word title for a conversation that opens with this message. Output only the title.',
      messages: [{ role: 'user', content: userText }],
    });
    return text.trim().replace(/["."]/g, '') || userText.slice(0, 40);
  } catch {
    return userText.slice(0, 40);
  }
}

// ---------- Daily note: one short, personal message + affirmation + suggested activity ----------
const FALLBACK_AFFIRMATIONS = [
  'I can take this one small step at a time.',
  'My feelings are allowed to be here, and they will pass.',
  'I am doing better than I give myself credit for.',
  'Rest is part of the work, not a break from it.',
  'I deserve the same kindness I give to others.',
  'I do not have to solve everything today.',
  'Progress can be quiet and still be real.',
];

function fallbackNote(user, score, dayNumber) {
  const first = user.name.split(' ')[0];
  const affirmation = FALLBACK_AFFIRMATIONS[dayNumber % FALLBACK_AFFIRMATIONS.length];
  if (score && score <= 2) {
    return { affirmation, note: `${first}, today looks heavy, and checking in anyway took something. Let's keep the next hour small and soft.`, suggestion: { kind: 'breathing', why: 'One minute of slow breathing is a gentle place to start.' } };
  }
  if (score && score >= 4) {
    return { affirmation, note: `Good to see you doing well, ${first}. Notice what's working today so it's easier to find again.`, suggestion: { kind: 'gratitude', why: 'Name three good things while they are fresh.' } };
  }
  return { affirmation, note: `Hi ${first}. No pressure to feel any particular way today. A small check-in is enough.`, suggestion: { kind: 'reflection', why: 'A two-minute reflection can show you what you need.' } };
}

async function dailyNote(user, tzMin) {
  const local = new Date(Date.now() + tzMin * 60000);
  const day = local.toISOString().slice(0, 10);
  const hour = local.getUTCHours();
  const dayNumber = Math.floor(local.getTime() / 86400000);
  const part = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  const modifier = `${tzMin >= 0 ? '+' : ''}${tzMin} minutes`;
  const todayMood = db
    .prepare("SELECT score FROM moods WHERE user_id = ? AND date(created_at, ?) = ? ORDER BY id DESC LIMIT 1")
    .get(user.id, modifier, day);
  const score = todayMood ? todayMood.score : null;

  const cached = db.prepare('SELECT * FROM daily_notes WHERE user_id = ? AND day = ?').get(user.id, day);
  if (cached && (cached.mood_score ?? null) === score) {
    return { affirmation: cached.affirmation, note: cached.note, suggestion: cached.suggestion ? JSON.parse(cached.suggestion) : null, personalised: true };
  }

  if (!llm.enabled) return { ...fallbackNote(user, score, dayNumber), personalised: false };

  // Respect the memory switch: with memory off, Sunny only knows the name, goals and today's mood.
  const mem = user.memory_enabled;
  const memories = mem ? db.prepare('SELECT fact FROM memories WHERE user_id = ? ORDER BY id DESC LIMIT 12').all(user.id) : [];
  const moods = mem ? db.prepare('SELECT score, tags, note, created_at FROM moods WHERE user_id = ? ORDER BY id DESC LIMIT 5').all(user.id) : [];
  const checks = mem ? db.prepare('SELECT type, score, label, created_at FROM assessments WHERE user_id = ? ORDER BY id DESC LIMIT 2').all(user.id) : [];
  const goals = JSON.parse(user.goals || '[]');

  const system = `You are Sunny, the warm companion inside Solace. Write today's short note for ${user.name}.
Voice: a thoughtful friend, not a therapist or a poster. Specific, gentle, a little playful. No clichés, no lists, no exclamation marks, at most one emoji.
It is ${part}. ${score ? `Today they checked in feeling ${score}/5 (1 low, 5 great).` : 'They have not checked in yet today.'}
Goals they chose: ${goals.join(', ') || '(none)'}
What you know about them: ${memories.map((m) => m.fact).join('; ') || '(nothing yet)'}
Recent check-ins: ${moods.map((m) => `${m.created_at.slice(0, 10)} ${m.score}/5${m.note ? ' (' + m.note + ')' : ''}`).join('; ') || '(none)'}
Recent self check-ins (gentle screenings, never diagnoses): ${checks.map((c) => `${c.type} "${c.label}"`).join('; ') || '(none)'}
Use what you know only when it truly fits, and never recite it. Do not diagnose.
Return ONLY JSON: {"affirmation": first-person, under 14 words, specific to them or their day, not a stock phrase,
"note": 2 short sentences speaking to them directly,
"suggestion": {"kind": one of ${JSON.stringify(ACTIVITIES)}, "why": under 12 words in your voice}}`;

  try {
    const text = await llm.complete({ system, messages: [{ role: 'user', content: 'Write today\'s note.' }], maxTokens: 400, json: true, fast: true });
    const out = parseJson(text);
    const suggestion = out.suggestion && ACTIVITIES.includes(out.suggestion.kind) ? { kind: out.suggestion.kind, why: String(out.suggestion.why || '') } : null;
    const result = { affirmation: String(out.affirmation).slice(0, 140), note: String(out.note).slice(0, 400), suggestion };
    db.prepare('INSERT OR REPLACE INTO daily_notes (user_id, day, mood_score, affirmation, note, suggestion) VALUES (?,?,?,?,?,?)')
      .run(user.id, day, score, result.affirmation, result.note, suggestion ? JSON.stringify(suggestion) : null);
    return { ...result, personalised: true };
  } catch (err) {
    console.error('daily note error', err.message);
    return { ...fallbackNote(user, score, dayNumber), personalised: false };
  }
}

// ---------- Daily small challenge: one tiny, doable thing, chosen for today ----------
const CHALLENGE_POOL = {
  low: [
    ['Drink a glass of water', 'Slowly, sitting down. That is the whole challenge.'],
    ['Open a window for 2 minutes', 'Let some fresh air and daylight in.'],
    ['Text one person "thinking of you"', 'No reply needed. Just reach out once.'],
    ['Make your space 1% softer', 'Tidy one surface, or put on a lamp instead of the big light.'],
  ],
  mid: [
    ['Take a 5-minute walk', 'Around the block or the room. Phone in your pocket.'],
    ['Write down one thing that went okay', 'Small counts. A warm cup of tea counts.'],
    ['Stretch your shoulders and neck', 'Roll them slowly for one minute.'],
    ['Put your phone away for 20 minutes', 'Do one thing with your full attention.'],
  ],
  high: [
    ['Tell someone something you appreciate', 'A message or in person, one honest sentence.'],
    ['Do something just because you enjoy it', 'Ten minutes, no productivity attached.'],
    ['Savor one moment today', 'Pause for 30 seconds and notice how it feels.'],
    ['Help someone in a tiny way', 'Hold a door, send a useful link, share a laugh.'],
  ],
};

async function dailyChallenge(user, tzMin) {
  const local = new Date(Date.now() + tzMin * 60000);
  const day = local.toISOString().slice(0, 10);
  const row = db.prepare('SELECT * FROM challenges WHERE user_id = ? AND day = ?').get(user.id, day);
  if (row) return { title: row.title, detail: row.detail, done: !!row.done };

  const modifier = `${tzMin >= 0 ? '+' : ''}${tzMin} minutes`;
  const todayMood = db
    .prepare('SELECT score FROM moods WHERE user_id = ? AND date(created_at, ?) = ? ORDER BY id DESC LIMIT 1')
    .get(user.id, modifier, day);
  const score = todayMood ? todayMood.score : null;
  const bucket = score && score <= 2 ? 'low' : score && score >= 4 ? 'high' : 'mid';
  const recent = db.prepare('SELECT title FROM challenges WHERE user_id = ? ORDER BY day DESC LIMIT 7').all(user.id).map((r) => r.title);

  const pick = () => {
    const pool = CHALLENGE_POOL[bucket].filter(([t]) => !recent.includes(t));
    const list = pool.length ? pool : CHALLENGE_POOL[bucket];
    const [title, detail] = list[Math.floor(local.getTime() / 86400000) % list.length];
    return { title, detail };
  };

  let result = null;
  if (llm.enabled) {
    const mem = user.memory_enabled;
    const memories = mem ? db.prepare('SELECT fact FROM memories WHERE user_id = ? ORDER BY id DESC LIMIT 8').all(user.id) : [];
    const goals = JSON.parse(user.goals || '[]');
    try {
      const text = await llm.complete({
        fast: true,
        json: true,
        maxTokens: 200,
        system: `You pick ONE tiny wellbeing challenge for ${user.name} to do today. It must take under 10 minutes, need no equipment or spending, and feel kind rather than demanding.
${score ? `They checked in feeling ${score}/5 today (1 low, 5 great). When low, make it very gentle.` : 'They have not checked in yet today.'}
Goals: ${goals.join(', ') || '(none)'}. What you know: ${memories.map((m) => m.fact).join('; ') || '(nothing yet)'}.
Do not repeat these recent ones: ${recent.join('; ') || '(none)'}.
No diet, weight, medication, fasting, cold exposure or anything physically risky. No guilt language.
Return ONLY JSON: {"title": under 7 words, an action starting with a verb, "detail": one short sentence, warm and concrete}`,
        messages: [{ role: 'user', content: 'Pick today\'s challenge.' }],
      });
      const out = parseJson(text);
      if (out.title && out.detail) result = { title: String(out.title).slice(0, 70), detail: String(out.detail).slice(0, 160) };
    } catch (err) {
      console.error('challenge error', err.message);
    }
  }
  if (!result) result = pick();
  db.prepare('INSERT OR IGNORE INTO challenges (user_id, day, title, detail) VALUES (?,?,?,?)').run(user.id, day, result.title, result.detail);
  const saved = db.prepare('SELECT * FROM challenges WHERE user_id = ? AND day = ?').get(user.id, day);
  return { title: saved.title, detail: saved.detail, done: !!saved.done };
}

module.exports = { chat, extractMemories, makeTitle, dailyNote, dailyChallenge, client: llm.enabled, provider: llm.provider };
