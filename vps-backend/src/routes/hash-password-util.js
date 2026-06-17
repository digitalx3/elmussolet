import bcrypt from 'bcryptjs';
import { requireAuth, requireAdmin } from '../lib/auth.js';

/**
 * POST /functions/hash-password-util
 * Body: { password }
 * Returns: { hash }
 * Admin-only.
 */
export default [
  requireAuth,
  requireAdmin,
  (req, res) => {
    const { password } = req.body || {};
    if (!password) return res.status(400).json({ error: 'Password required' });
    const hash = bcrypt.hashSync(password, 10);
    res.json({ hash });
  },
];
