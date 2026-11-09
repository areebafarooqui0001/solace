const jwt = require('jsonwebtoken');

const db = require('./db');

const hosted = process.env.NODE_ENV === 'production' || process.env.RENDER || process.env.RAILWAY_ENVIRONMENT || process.env.FLY_APP_NAME;
const WEAK = !process.env.JWT_SECRET || ['change-me', 'dev-secret-change-me'].includes(process.env.JWT_SECRET);
if (WEAK && hosted) {
  console.error('JWT_SECRET is missing or still the example value. Set a long random JWT_SECRET before deploying.');
  process.exit(1);
}
if (WEAK) console.warn('Warning: using the development JWT secret. Fine on your laptop, never on a public server.');
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

const sign = (user) => jwt.sign({ uid: user.id }, SECRET, { expiresIn: '30d' });

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const uid = jwt.verify(token, SECRET).uid;
    // A token is only good while its account exists (e.g. not after the user deleted it).
    if (!db.prepare('SELECT 1 FROM users WHERE id = ?').get(uid)) return res.status(401).json({ error: 'Account not found' });
    req.uid = uid;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { sign, auth };
