import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../lib/auth.js';

/**
 * POST /functions/verify-list-access
 * Body: { listCode, password }
 * Reimplementation of supabase/functions/verify-list-access.
 */
export default async function verifyListAccess(req, res) {
  const { listCode, password } = req.body || {};
  if (!listCode || !password) {
    return res.status(400).json({ error: 'Codi i contrasenya requerits' });
  }

  const { data: list, error } = await supabaseAdmin
    .from('birth_lists')
    .select('id, list_code, baby_name, expected_date, password_hash, status')
    .eq('list_code', String(listCode).trim().toUpperCase())
    .single();

  if (error || !list) return res.status(401).json({ error: 'invalid_credentials' });
  if (list.status !== 'active') return res.status(403).json({ error: 'list_not_active' });

  const valid = bcrypt.compareSync(password, list.password_hash);
  if (!valid) return res.status(401).json({ error: 'invalid_credentials' });

  const { data: owners } = await supabaseAdmin
    .from('list_owners')
    .select('first_name, last_name')
    .eq('list_id', list.id);

  const token = Buffer.from(
    JSON.stringify({ listId: list.id, listCode: list.list_code, ts: Date.now() }),
  ).toString('base64');

  res.json({
    token,
    listId: list.id,
    listCode: list.list_code,
    babyName: list.baby_name,
    expectedDate: list.expected_date,
    owners: owners || [],
  });
}
