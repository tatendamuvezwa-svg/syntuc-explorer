import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { initializeDatabase } from './server/db/index.ts';
import { seedMasterReferenceData, seedBootstrapCatalog, seedFallbackMediaAssets } from './server/db/seed.ts';
import catalogRoutes from './server/routes/catalog.ts';
import sessionRoutes from './server/routes/session.ts';
import reservationRoutes from './server/routes/reservation.ts';
import coordinatorRoutes from './server/routes/coordinator.ts';
import mediaRoutes from './server/routes/media.ts';
import schoolTripRoutes from './server/routes/schoolTrips.ts';
import assistantRoutes from './server/routes/assistant.ts';
import analyticsRoutes from './server/routes/analytics.ts';
import { runR2SecuritySuite } from './server/tests/r2-security.ts';
import {
  getDeletedTombstones,
  ensureCanonicalCloudSeed,
  hydrateFromFirestore,
  syncUnpersistedLocalMedia,
  reconcileAuthoritativeMediaAndPrimaries,
} from './server/services/firestoreSync.ts';

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
    version: '2.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Run R2 Security & Regression Tests endpoint
app.get('/api/tests/r2', async (req, res) => {
  try {
    const report = await runR2SecuritySuite();
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: 'R2_TESTS_EXECUTION_FAILED', message: err.message });
  }
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

// Database initialization and server startup
async function startServer() {
  try {
    console.log('[Syntuc Server] Initializing PostgreSQL database...');
    await initializeDatabase();

    // 1. Retrieve active deletion tombstones first
    const tombstones = await getDeletedTombstones();
    console.log(`[Syntuc Server] Active deletion tombstones loaded: ${tombstones.size}`);

    // 2. Initialize master reference tables (operators, properties, users, categories)
    // so all foreign keys exist in the relational engine before any catalog or operational records
    console.log('[Syntuc Server] Initializing master reference data (operators, properties, users)...');
    await seedMasterReferenceData();

    // 3. Seed baseline bootstrap catalog templates (products, rooms, packages) with strict non-overwrite
    // This ensures all catalog product IDs exist in PGlite so reservation item FKs succeed
    console.log('[Syntuc Server] Seeding bootstrap catalog fallback templates (non-overwriting)...');
    await seedBootstrapCatalog(tombstones);

    // 4. HYDRATE AUTHORITATIVE OPERATIONS FROM CLOUD FIRESTORE
    // FIRESTORE PRODUCTION STATE TAKES 100% PRECEDENCE OVER SEED/BOOTSTRAP DATA
    console.log('[Syntuc Server] Hydrating authoritative operational records from Cloud Firestore...');
    const { productsRestored, mediaRestored, reservationsRestored, hydratedMediaIds } = await hydrateFromFirestore(tombstones);
    console.log(`[Syntuc Server] Firestore hydration complete: ${productsRestored} products, ${mediaRestored} media assets, ${reservationsRestored} reservations.`);

    // 5. Seed fallback media assets ONLY for products with zero media assets and no deletion tombstones
    console.log('[Syntuc Server] Seeding fallback media assets for products with zero images...');
    await seedFallbackMediaAssets(tombstones);

    // 6. Ensure canonical cloud seed (Sophia Al-Mansoor) if not tombstoned
    console.log('[Syntuc Server] Ensuring Cloud Firestore persistence sync...');
    await ensureCanonicalCloudSeed(tombstones);

    // 7. Reconcile custom local media assets with Cloud Firestore
    console.log('[Syntuc Server] Reconciling custom local media assets with Cloud Firestore...');
    await syncUnpersistedLocalMedia(tombstones, hydratedMediaIds);

    // 8. Final media & primary image reconciliation: Custom media always takes 100% precedence over seed
    console.log('[Syntuc Server] Reconciling primary media and catalog associations...');
    await reconcileAuthoritativeMediaAndPrimaries(tombstones);

    console.log('[Syntuc Server] Database and Cloud Persistence ready.');

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

    // Run security tests verification in background after port opens
    runR2SecuritySuite()
      .then((securityCheck) => {
        console.log(
          `[Syntuc Server] R2 Security Suite: ${securityCheck.passedCount}/${securityCheck.total} tests PASSED.`
        );
      })
      .catch((err) => {
        console.error('[Syntuc Server] R2 Security Suite check error:', err);
      });
  } catch (error) {
    console.error('[Syntuc Server] Fatal startup error:', error);
    process.exit(1);
  }
}

startServer();
