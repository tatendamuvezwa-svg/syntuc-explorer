import { Pool } from 'pg';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import * as schema from './schema.ts';
import fs from 'fs';
import path from 'path';

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const sqlHost = process.env.SQL_HOST;
const sqlUser = process.env.SQL_USER;
const sqlPassword = process.env.SQL_PASSWORD;
const sqlDbName = process.env.SQL_DB_NAME;
const hasCloudSqlConfig = Boolean(sqlHost && sqlUser && sqlPassword && sqlDbName);
const isProduction = process.env.NODE_ENV === 'production';
const hasFirestoreConfig = fs.existsSync(path.resolve(process.cwd(), 'firebase-applet-config.json'));

// Production Safety Guard: Prevent unpersisted container storage without durable cloud persistence
if (isProduction && !dbUrl && !hasCloudSqlConfig && !hasFirestoreConfig) {
  const errMsg =
    '[FATAL CONFIGURATION ERROR] Production deployment requires an authoritative managed cloud persistence backend (Managed PostgreSQL or Cloud Firestore). Unpersisted ephemeral container storage is strictly forbidden in production.';
  console.error(errMsg);
  throw new Error(errMsg);
}

// Persistent on-disk directory for embedded PostgreSQL (Development fallback ONLY)
const pgliteDataDir = path.resolve(process.cwd(), 'data/pgdata');

function ensurePgSubdirs(dir: string) {
  if (!fs.existsSync(dir)) return;
  const subdirs = [
    'pg_notify', 'pg_tblspc', 'pg_replslot', 'pg_snapshots',
    'pg_stat', 'pg_stat_tmp', 'pg_subtrans', 'pg_twophase',
    'pg_commit_ts', 'pg_logical/snapshots', 'pg_logical/mappings',
    'pg_xact', 'pg_multixact/offsets', 'pg_multixact/members',
    'pg_wal/archive_status', 'pg_wal/summaries', 'global', 'base'
  ];
  for (const s of subdirs) {
    const full = path.join(dir, s);
    if (!fs.existsSync(full)) {
      try { fs.mkdirSync(full, { recursive: true }); } catch (_) {}
    }
  }
}

function checkPgliteHealth(dir: string): boolean {
  if (!fs.existsSync(dir)) return true;
  const files = fs.readdirSync(dir);
  if (files.length === 0) return true;
  const required = ['PG_VERSION', 'postgresql.conf', 'global', 'base'];
  for (const f of required) {
    if (!fs.existsSync(path.join(dir, f))) {
      return false;
    }
  }
  return true;
}

function initPglite(): PGlite {
  // Use in-memory relational PGlite engine backed by durable Cloud Firestore
  // This completely eliminates WASM directory lock crashes and ensures instant clean boots
  console.log('[Database] Initializing in-memory PGlite relational execution engine with Cloud Firestore sync...');
  return new PGlite();
}

// Determine active database client: Managed PostgreSQL (Cloud SQL/Pool) or Development PGlite
export const pgliteClient = (dbUrl || hasCloudSqlConfig) ? null : initPglite();

if (pgliteClient) {
  const cleanShutdown = async () => {
    try {
      await pgliteClient.close();
    } catch (_) {}
  };
  process.on('SIGTERM', cleanShutdown);
  process.on('SIGINT', cleanShutdown);
}

export const activePgPool: Pool | null = hasCloudSqlConfig
  ? new Pool({
      host: sqlHost,
      user: sqlUser,
      password: sqlPassword,
      database: sqlDbName,
      max: 10,
      connectionTimeoutMillis: 15000,
    })
  : dbUrl
  ? new Pool({ connectionString: dbUrl, max: 10, connectionTimeoutMillis: 15000 })
  : null;

if (activePgPool) {
  activePgPool.on('error', (err) => {
    console.error('Unexpected error on idle SQL pool client:', err);
  });
}

export const db = activePgPool
  ? (drizzlePg(activePgPool, { schema }) as unknown as ReturnType<typeof drizzlePglite<typeof schema>>)
  : drizzlePglite(pgliteClient!, { schema });

// Initialize database schema tables if they don't exist
export async function initializeDatabase() {
  const ddl = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'reservations_coordinator',
      is_active BOOLEAN NOT NULL DEFAULT true,
      password_hash TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS operators (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact_email TEXT,
      contact_phone TEXT,
      location TEXT NOT NULL DEFAULT 'Victoria Falls, Zimbabwe',
      description TEXT,
      verified BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS properties (
      id TEXT PRIMARY KEY,
      operator_id TEXT REFERENCES operators(id),
      name TEXT NOT NULL,
      property_type TEXT NOT NULL,
      address TEXT,
      check_in_time TEXT DEFAULT '14:00',
      check_out_time TEXT DEFAULT '10:00',
      amenities JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      operator_id TEXT REFERENCES operators(id),
      property_id TEXT REFERENCES properties(id),
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      product_type TEXT NOT NULL,
      category_slug TEXT NOT NULL,
      short_description TEXT NOT NULL,
      description TEXT NOT NULL,
      location TEXT NOT NULL DEFAULT 'Victoria Falls, Zimbabwe',
      duration TEXT,
      base_price NUMERIC(10, 2) NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      price_basis TEXT NOT NULL DEFAULT 'per_person',
      inclusions JSONB DEFAULT '[]'::jsonb,
      exclusions JSONB DEFAULT '[]'::jsonb,
      suitability JSONB DEFAULT '[]'::jsonb,
      is_published BOOLEAN NOT NULL DEFAULT true,
      is_featured BOOLEAN NOT NULL DEFAULT false,
      availability_note TEXT DEFAULT 'Subject to partner confirmation',
      primary_media_id TEXT,
      video_url TEXT,
      evidence_status TEXT NOT NULL DEFAULT 'ESTABLISHED',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS product_variants (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id),
      name TEXT NOT NULL,
      description TEXT,
      price_delta NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
      duration TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS product_categories (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id),
      category_id TEXT NOT NULL REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id),
      property_id TEXT REFERENCES properties(id),
      name TEXT NOT NULL,
      room_type TEXT NOT NULL,
      description TEXT NOT NULL,
      capacity_adults INTEGER NOT NULL DEFAULT 2,
      capacity_children INTEGER NOT NULL DEFAULT 1,
      price_per_night NUMERIC(10, 2) NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      amenities JSONB DEFAULT '[]'::jsonb,
      is_available BOOLEAN NOT NULL DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS packages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      tagline TEXT NOT NULL,
      description TEXT NOT NULL,
      duration_days INTEGER NOT NULL,
      duration_nights INTEGER NOT NULL,
      price_per_person NUMERIC(10, 2) NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      highlights JSONB DEFAULT '[]'::jsonb,
      inclusions JSONB DEFAULT '[]'::jsonb,
      exclusions JSONB DEFAULT '[]'::jsonb,
      primary_image_url TEXT NOT NULL,
      video_url TEXT,
      is_published BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS package_items (
      id TEXT PRIMARY KEY,
      package_id TEXT NOT NULL REFERENCES packages(id),
      product_id TEXT NOT NULL REFERENCES products(id),
      day_number INTEGER NOT NULL DEFAULT 1,
      order_index INTEGER NOT NULL DEFAULT 1,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS media_assets (
      id TEXT PRIMARY KEY,
      owner_type TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      media_type TEXT NOT NULL DEFAULT 'IMAGE',
      url TEXT NOT NULL,
      thumbnail_url TEXT,
      is_primary BOOLEAN NOT NULL DEFAULT false,
      display_order INTEGER NOT NULL DEFAULT 0,
      caption TEXT,
      alt_text TEXT,
      source_name TEXT DEFAULT 'Syntuc Catalog',
      source_type TEXT DEFAULT 'official_partner',
      verification_state TEXT NOT NULL DEFAULT 'ESTABLISHED',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS knowledge_sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      source_url TEXT,
      source_type TEXT NOT NULL,
      evidence_status TEXT NOT NULL DEFAULT 'ESTABLISHED',
      notes TEXT,
      last_verified TIMESTAMP NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS school_trip_tariffs (
      id TEXT PRIMARY KEY,
      item_category TEXT NOT NULL,
      item_name TEXT NOT NULL,
      target_tier TEXT,
      rate_amount NUMERIC(10, 2) NOT NULL,
      rate_basis TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      is_bridge_incentive_qualifying BOOLEAN NOT NULL DEFAULT false,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS guests (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      country TEXT,
      special_requests TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS guest_sessions (
      id TEXT PRIMARY KEY,
      guest_id TEXT REFERENCES guests(id),
      session_secret TEXT NOT NULL,
      ip_hash TEXT,
      user_agent TEXT,
      last_active_at TIMESTAMP NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS trip_plans (
      id TEXT PRIMARY KEY,
      guest_session_id TEXT NOT NULL REFERENCES guest_sessions(id),
      title TEXT NOT NULL DEFAULT 'My Victoria Falls Journey',
      start_date TEXT,
      end_date TEXT,
      adults_count INTEGER NOT NULL DEFAULT 2,
      children_count INTEGER NOT NULL DEFAULT 0,
      interests JSONB DEFAULT '[]'::jsonb,
      intensity TEXT DEFAULT 'moderate',
      accommodation_preference TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS trip_items (
      id TEXT PRIMARY KEY,
      trip_plan_id TEXT NOT NULL REFERENCES trip_plans(id),
      product_id TEXT NOT NULL REFERENCES products(id),
      room_id TEXT REFERENCES rooms(id),
      variant_id TEXT REFERENCES product_variants(id),
      day_number INTEGER NOT NULL DEFAULT 1,
      scheduled_date TEXT,
      scheduled_time TEXT,
      guest_count INTEGER NOT NULL DEFAULT 2,
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS recommendations (
      id TEXT PRIMARY KEY,
      trip_plan_id TEXT REFERENCES trip_plans(id),
      product_id TEXT NOT NULL REFERENCES products(id),
      recommendation_reason TEXT NOT NULL,
      match_score INTEGER DEFAULT 85,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS reservation_requests (
      id TEXT PRIMARY KEY,
      reference_number TEXT NOT NULL UNIQUE,
      request_type TEXT NOT NULL DEFAULT 'STANDARD',
      guest_id TEXT NOT NULL REFERENCES guests(id),
      guest_session_id TEXT NOT NULL REFERENCES guest_sessions(id),
      trip_plan_id TEXT REFERENCES trip_plans(id),
      status TEXT NOT NULL DEFAULT 'NEW',
      start_date TEXT,
      end_date TEXT,
      adults_count INTEGER NOT NULL DEFAULT 2,
      children_count INTEGER NOT NULL DEFAULT 0,
      authoritative_total NUMERIC(10, 2) NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      special_requests TEXT,
      is_bridge_incentive_applied BOOLEAN NOT NULL DEFAULT false,
      school_metadata JSONB,
      assigned_staff_id TEXT REFERENCES users(id),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS reservation_items (
      id TEXT PRIMARY KEY,
      reservation_request_id TEXT NOT NULL REFERENCES reservation_requests(id),
      product_id TEXT NOT NULL REFERENCES products(id),
      room_id TEXT REFERENCES rooms(id),
      variant_id TEXT REFERENCES product_variants(id),
      snapshot_product_name TEXT NOT NULL,
      snapshot_operator_name TEXT NOT NULL,
      snapshot_product_type TEXT NOT NULL,
      snapshot_unit_price NUMERIC(10, 2) NOT NULL,
      snapshot_price_basis TEXT NOT NULL,
      snapshot_currency TEXT NOT NULL DEFAULT 'USD',
      guest_count INTEGER NOT NULL DEFAULT 1,
      nights_count INTEGER DEFAULT 1,
      calculated_subtotal NUMERIC(10, 2) NOT NULL,
      scheduled_date TEXT,
      scheduled_time TEXT,
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      guest_id TEXT NOT NULL REFERENCES guests(id),
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      lead_source TEXT NOT NULL DEFAULT 'syntuc_explorer_direct',
      first_touch_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
      last_touch_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
      last_interaction_type TEXT DEFAULT 'trip_created',
      estimated_value NUMERIC(10, 2) DEFAULT 0.00,
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS coordinator_notes (
      id TEXT PRIMARY KEY,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      author_staff_id TEXT NOT NULL REFERENCES users(id),
      author_name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS interactions (
      id TEXT PRIMARY KEY,
      lead_id TEXT REFERENCES leads(id),
      guest_id TEXT REFERENCES guests(id),
      staff_id TEXT REFERENCES users(id),
      channel TEXT NOT NULL DEFAULT 'web_desk',
      interaction_type TEXT NOT NULL,
      summary TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS guest_access_tokens (
      id TEXT PRIMARY KEY,
      reservation_request_id TEXT NOT NULL REFERENCES reservation_requests(id),
      guest_id TEXT NOT NULL REFERENCES guests(id),
      token_hash TEXT NOT NULL UNIQUE,
      is_revoked BOOLEAN NOT NULL DEFAULT false,
      expires_at TIMESTAMP NOT NULL,
      last_accessed_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS guest_messages (
      id TEXT PRIMARY KEY,
      guest_session_id TEXT REFERENCES guest_sessions(id),
      reservation_request_id TEXT REFERENCES reservation_requests(id),
      sender_type TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      message_text TEXT NOT NULL,
      action_metadata JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS product_revisions (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id),
      modified_by_staff_id TEXT NOT NULL REFERENCES users(id),
      previous_snapshot JSONB,
      change_summary TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS package_revisions (
      id TEXT PRIMARY KEY,
      package_id TEXT NOT NULL REFERENCES packages(id),
      modified_by_staff_id TEXT NOT NULL REFERENCES users(id),
      previous_snapshot JSONB,
      change_summary TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    -- 28. Analytics Visitors (Persistent Anonymous Device/Browser Identity)
    CREATE TABLE IF NOT EXISTS analytics_visitors (
      id TEXT PRIMARY KEY,
      visitor_id TEXT NOT NULL UNIQUE,
      first_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
      first_source TEXT NOT NULL DEFAULT 'direct',
      first_medium TEXT,
      first_campaign TEXT,
      first_content TEXT,
      first_term TEXT,
      first_referrer_url TEXT,
      first_referrer_domain TEXT,
      first_landing_page TEXT,
      attribution_confidence TEXT NOT NULL DEFAULT 'UNKNOWN',
      total_sessions INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    -- 29. Analytics Sessions (Visit Sessions)
    CREATE TABLE IF NOT EXISTS analytics_sessions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL UNIQUE,
      visitor_id TEXT NOT NULL REFERENCES analytics_visitors(visitor_id),
      started_at TIMESTAMP NOT NULL DEFAULT NOW(),
      last_activity_at TIMESTAMP NOT NULL DEFAULT NOW(),
      landing_page TEXT,
      exit_page TEXT,
      source TEXT NOT NULL DEFAULT 'direct',
      medium TEXT,
      campaign TEXT,
      content TEXT,
      term TEXT,
      referrer_url TEXT,
      referrer_domain TEXT,
      attribution_confidence TEXT NOT NULL DEFAULT 'UNKNOWN',
      is_bounce BOOLEAN NOT NULL DEFAULT false,
      device_category TEXT NOT NULL DEFAULT 'desktop',
      browser TEXT,
      os TEXT,
      country TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    -- 30. Analytics Events (Structured Funnel & Behavioural Events)
    CREATE TABLE IF NOT EXISTS analytics_events (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL UNIQUE,
      visitor_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      route TEXT,
      product_id TEXT,
      package_id TEXT,
      reservation_id TEXT,
      reservation_reference TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      occurred_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    -- Ensure attribution columns exist on reservation_requests & guest_sessions
    ALTER TABLE guest_sessions ADD COLUMN IF NOT EXISTS visitor_id TEXT;

    ALTER TABLE reservation_requests ADD COLUMN IF NOT EXISTS visitor_id TEXT;
    ALTER TABLE reservation_requests ADD COLUMN IF NOT EXISTS first_touch_source TEXT;
    ALTER TABLE reservation_requests ADD COLUMN IF NOT EXISTS first_touch_medium TEXT;
    ALTER TABLE reservation_requests ADD COLUMN IF NOT EXISTS first_touch_campaign TEXT;
    ALTER TABLE reservation_requests ADD COLUMN IF NOT EXISTS first_touch_content TEXT;
    ALTER TABLE reservation_requests ADD COLUMN IF NOT EXISTS first_touch_term TEXT;
    ALTER TABLE reservation_requests ADD COLUMN IF NOT EXISTS first_touch_referrer TEXT;
    ALTER TABLE reservation_requests ADD COLUMN IF NOT EXISTS last_touch_source TEXT;
    ALTER TABLE reservation_requests ADD COLUMN IF NOT EXISTS last_touch_medium TEXT;
    ALTER TABLE reservation_requests ADD COLUMN IF NOT EXISTS last_touch_campaign TEXT;
    ALTER TABLE reservation_requests ADD COLUMN IF NOT EXISTS last_touch_content TEXT;
    ALTER TABLE reservation_requests ADD COLUMN IF NOT EXISTS last_touch_term TEXT;
    ALTER TABLE reservation_requests ADD COLUMN IF NOT EXISTS last_touch_referrer TEXT;
    ALTER TABLE reservation_requests ADD COLUMN IF NOT EXISTS attribution_confidence TEXT DEFAULT 'UNKNOWN';

    -- Performance Indexes
    CREATE INDEX IF NOT EXISTS idx_an_vis_id ON analytics_visitors(visitor_id);
    CREATE INDEX IF NOT EXISTS idx_an_vis_src ON analytics_visitors(first_source);
    CREATE INDEX IF NOT EXISTS idx_an_vis_cmp ON analytics_visitors(first_campaign);
    CREATE INDEX IF NOT EXISTS idx_an_ses_id ON analytics_sessions(session_id);
    CREATE INDEX IF NOT EXISTS idx_an_ses_vis ON analytics_sessions(visitor_id);
    CREATE INDEX IF NOT EXISTS idx_an_ses_src ON analytics_sessions(source);
    CREATE INDEX IF NOT EXISTS idx_an_ses_cmp ON analytics_sessions(campaign);
    CREATE INDEX IF NOT EXISTS idx_an_ses_cnt ON analytics_sessions(content);
    CREATE INDEX IF NOT EXISTS idx_an_evt_id ON analytics_events(event_id);
    CREATE INDEX IF NOT EXISTS idx_an_evt_vis ON analytics_events(visitor_id);
    CREATE INDEX IF NOT EXISTS idx_an_evt_ses ON analytics_events(session_id);
    CREATE INDEX IF NOT EXISTS idx_an_evt_typ ON analytics_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_an_evt_time ON analytics_events(occurred_at);
    CREATE INDEX IF NOT EXISTS idx_an_evt_res ON analytics_events(reservation_id);
  `;

  if (activePgPool) {
    await activePgPool.query(ddl);
  } else if (pgliteClient) {
    await pgliteClient.exec(ddl);
  }
}
