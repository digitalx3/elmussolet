import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import uploadRoute from './routes/upload.js';
import verifyListAccessRoute from './routes/verify-list-access.js';
import hashPasswordRoute from './routes/hash-password-util.js';
import sendOrderStatusEmailRoute from './routes/send-order-status-email.js';

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return cb(null, true);
      }
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// Migrated edge functions
app.post('/functions/verify-list-access', verifyListAccessRoute);
app.post('/functions/hash-password-util', hashPasswordRoute);
app.post('/functions/send-order-status-email', sendOrderStatusEmailRoute);

// File uploads (replaces supabase.storage.upload)
app.use('/upload', uploadRoute);

// 404
app.use((_req, res) => res.status(404).json({ error: 'not_found' }));

// Error handler
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ error: 'server_error', message: err.message });
});

const PORT = Number(process.env.PORT) || 8080;
app.listen(PORT, () => {
  console.log(`[vps-backend] listening on :${PORT}`);
});
