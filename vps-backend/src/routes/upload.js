import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { requireAuth, requireAdmin } from '../lib/auth.js';

const router = express.Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/var/www/elmussolet/media';
const MEDIA_BASE_URL = (process.env.MEDIA_BASE_URL || '').replace(/\/+$/, '');

// Allowed buckets — mirror Supabase Storage buckets.
const ALLOWED_BUCKETS = new Set(['product-images', 'brand-logos', 'site-assets']);

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

function safeName(originalName) {
  const ext = path.extname(originalName).toLowerCase().slice(0, 10);
  const hash = crypto.randomBytes(8).toString('hex');
  return `${Date.now()}-${hash}${ext}`;
}

/**
 * POST /upload/:bucket
 * Form-data: file=<binary>, path=<optional subfolder>
 * Auth: admin only.
 * Returns: { url, path, bucket }
 */
router.post('/:bucket', requireAuth, requireAdmin, upload.single('file'), async (req, res) => {
  const { bucket } = req.params;
  if (!ALLOWED_BUCKETS.has(bucket)) {
    return res.status(400).json({ error: 'invalid_bucket' });
  }
  if (!req.file) return res.status(400).json({ error: 'no_file' });

  const subfolder = (req.body.path || '').replace(/[^\w\-/]/g, '');
  const filename = safeName(req.file.originalname);
  const relPath = path.posix.join(bucket, subfolder, filename);
  const absPath = path.join(UPLOAD_DIR, relPath);

  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, req.file.buffer);

  res.json({
    bucket,
    path: relPath,
    url: `${MEDIA_BASE_URL}/${relPath}`,
  });
});

/**
 * DELETE /upload/:bucket/*
 * Auth: admin only.
 */
router.delete('/:bucket/*', requireAuth, requireAdmin, async (req, res) => {
  const { bucket } = req.params;
  if (!ALLOWED_BUCKETS.has(bucket)) {
    return res.status(400).json({ error: 'invalid_bucket' });
  }
  const sub = req.params[0].replace(/\.\./g, '');
  const absPath = path.join(UPLOAD_DIR, bucket, sub);
  try {
    await fs.unlink(absPath);
    res.json({ ok: true });
  } catch (e) {
    res.status(404).json({ error: 'not_found' });
  }
});

export default router;
