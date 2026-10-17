import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import catalogRoutes from './server/routes/catalog.ts';
import sessionRoutes from './server/routes/session.ts';
import reservationRoutes from './server/routes/reservation.ts';
import coordinatorRoutes from './server/routes/coordinator.ts';
import mediaRoutes from './server/routes/media.ts';
import schoolTripRoutes from './server/routes/schoolTrips.ts';
import assistantRoutes from './server/routes/assistant.ts';
import analyticsRoutes from './server/routes/analytics.ts';
import marketingRoutes from './server/routes/marketing.ts';
import reviewsRoutes from './server/routes/reviews.ts';
import { getFirestoreDb } from './server/lib/firestore.ts';

dotenv.config();

// Ensure AI Studio platform environment from /app/.dev.env.json is loaded
try {
  const devEnvPath = '/app/.dev.env.json';
  if (fs.existsSync(devEnvPath)) {
    const devEnv = JSON.parse(fs.readFileSync(devEnvPath, 'utf-8'));
    for (const [k, v] of Object.entries(devEnv)) {
      if (!process.env[k] && typeof v === 'string') {
        process.env[k] = v;
      }
    }
  }
} catch (_) {}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// AI Studio dev server runs on port 3000 behind nginx proxy (port 8080)
const portArgIndex = process.argv.indexOf('--port');
const cliPort = portArgIndex !== -1 ? parseInt(process.argv[portArgIndex + 1], 10) : undefined;
const PORT = cliPort || (process.env.NODE_ENV === 'production' && process.env.PORT ? parseInt(process.env.PORT, 10) : 3000);
const isProduction = process.env.NODE_ENV === 'production';

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static uploaded media files from /data/uploads
const uploadsDir = path.resolve(__dirname, 'data/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// System Health & Diagnostics
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    product: 'Syntuc Explorer',
    brand: 'SAINTECH',
    database: 'Cloud Firestore (Authoritative Native)',
    version: '3.0.0',
    timestamp: new Date().toISOString(),
  });
});


// Mount Modular API Routes
app.use('/api/catalog', catalogRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/reservation', reservationRoutes);
app.use('/api/coordinator', coordinatorRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/school-trips', schoolTripRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/marketing', marketingRoutes);
app.use('/api/reviews', reviewsRoutes);

// Server startup with direct authoritative Cloud Firestore
async function startServer() {
  try {
    console.log('[Syntuc Server] Initializing Authoritative Cloud Firestore client...');
    const fdb = getFirestoreDb();
    if (!fdb) {
      throw new Error('Could not initialize Cloud Firestore connection.');
    }
    console.log('[Syntuc Server] Authoritative Cloud Firestore database active.');

    // Setup Vite in development or static dist in production
    if (!isProduction) {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distDir = path.resolve(__dirname, 'dist');
      app.use(express.static(distDir));
      app.get('*', (req, res) => {
        res.sendFile(path.resolve(distDir, 'index.html'));
      });
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Syntuc Explorer] Server active on http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error('[Syntuc Server] Fatal startup error:', error);
    process.exit(1);
  }
}

startServer();
