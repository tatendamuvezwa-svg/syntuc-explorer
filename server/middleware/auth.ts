import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getDocById, getCollectionDocs, where } from '../lib/firestore.ts';

export interface AuthenticatedStaffRequest extends Request {
  staffUser?: {
    id: string;
    email: string;
    name: string;
    role: string;
    isActive: boolean;
  };
}

export interface GuestSessionRequest extends Request {
  guestSession?: {
    id: string;
    guestId: string | null;
    sessionSecret: string;
  };
}

// Generate secure session token and secret
export function createSessionCredentials() {
  const sessionId = 'ses_' + crypto.randomBytes(16).toString('hex');
  const sessionSecret = crypto.randomBytes(32).toString('hex');
  return { sessionId, sessionSecret };
}

// Compute HMAC signature for session validation
export function signSessionId(sessionId: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(sessionId).digest('hex');
}

/**
 * Server-authoritative secret for signing coordinator tokens.
 * Derived from environment or fallback constant with high entropy.
 */
const DEVELOPMENT_STAFF_AUTH_SECRET = crypto.randomBytes(32).toString('hex');

function requireStaffAuthSecret(): string {
  // Read at call time so dotenv/runtime environment initialization is respected.
  const configured = process.env.STAFF_AUTH_SECRET || process.env.SESSION_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('STAFF_AUTH_SECRET must be configured in production; refusing to use a predictable fallback.');
  }
  return DEVELOPMENT_STAFF_AUTH_SECRET;
}

/**
 * Verify plaintext password against stored hash in Firestore.
 * Supports:
 * 1. Standard scrypt hash format: "scrypt$<salt>$<hash>"
 * 2. SHA-256 hash format: "sha256$<salt>$<hash>" or hex-64
 * 3. Constant-time secure comparison for existing account records
 */
export function verifyPassword(password: string, storedHash: unknown): boolean {
  if (!password || typeof storedHash !== 'string' || !storedHash) return false;

  // Format 1: scrypt
  if (storedHash.startsWith('scrypt$')) {
    const parts = storedHash.split('$');
    if (parts.length === 3) {
      const salt = parts[1];
      const hash = parts[2];
      const derived = crypto.scryptSync(password, salt, 64).toString('hex');
      const hashBuf = Buffer.from(hash, 'hex');
      const derivedBuf = Buffer.from(derived, 'hex');
      return hashBuf.length === derivedBuf.length && crypto.timingSafeEqual(hashBuf, derivedBuf);
    }
  }

  // Format 2: sha256 with salt
  if (storedHash.startsWith('sha256$')) {
    const parts = storedHash.split('$');
    if (parts.length === 3) {
      const salt = parts[1];
      const hash = parts[2];
      const derived = crypto.createHmac('sha256', salt).update(password).digest('hex');
      const hashBuf = Buffer.from(hash, 'hex');
      const derivedBuf = Buffer.from(derived, 'hex');
      return hashBuf.length === derivedBuf.length && crypto.timingSafeEqual(hashBuf, derivedBuf);
    }
  }

  // Format 3: Raw SHA-256 hex string (64 characters)
  if (/^[a-f0-9]{64}$/i.test(storedHash)) {
    const derived = crypto.createHash('sha256').update(password).digest('hex');
    const hashBuf = Buffer.from(storedHash, 'hex');
    const derivedBuf = Buffer.from(derived, 'hex');
    return crypto.timingSafeEqual(hashBuf, derivedBuf);
  }

  // Format 4: Legacy password stored in existing account records
  // Compare using constant-time digest buffer comparison to prevent timing side-channel attacks
  const passBuf = crypto.createHash('sha256').update(password).digest();
  const storedBuf = crypto.createHash('sha256').update(storedHash).digest();
  return crypto.timingSafeEqual(passBuf, storedBuf);
}

/**
 * Hash password with scrypt for secure storage
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

/**
 * Generate a cryptographically secure, signed coordinator auth token.
 * Token format: "stafftok.<base64url(payload)>.<signature>"
 * Payload: { userId, expiresAt }
 * Payload is protected against tampering and spoofing by HMAC-SHA256 signature.
 */
export function createStaffAuthToken(userId: string, expiresInHours = 24): string {
  const expiresAt = Date.now() + expiresInHours * 60 * 60 * 1000;
  const payloadObj = { userId, expiresAt };
  const payloadStr = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const sig = crypto.createHmac('sha256', requireStaffAuthSecret()).update(payloadStr).digest('hex');
  return `stafftok.${payloadStr}.${sig}`;
}

/**
 * Verify cryptographically signed staff token.
 * Validates format, signature integrity, and expiration.
 * Explicitly rejects predictable tokens like "staff_<userId>" or raw user IDs.
 */
export function verifyStaffAuthToken(token: string): { valid: boolean; userId: string | null } {
  if (!token) {
    return { valid: false, userId: null };
  }

  // Support base64url format: stafftok.<payload>.<sig>
  if (token.startsWith('stafftok.')) {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, userId: null };
    }

    const [, payloadStr, sig] = parts;
    let expectedSig: string;
    try {
      expectedSig = crypto.createHmac('sha256', requireStaffAuthSecret()).update(payloadStr).digest('hex');
    } catch {
      return { valid: false, userId: null };
    }
    const sigBuf = Buffer.from(sig);
    const expectedSigBuf = Buffer.from(expectedSig);

    if (sigBuf.length !== expectedSigBuf.length || !crypto.timingSafeEqual(sigBuf, expectedSigBuf)) {
      return { valid: false, userId: null };
    }

    try {
      const parsed = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
      if (!parsed.userId || !parsed.expiresAt || typeof parsed.expiresAt !== 'number') {
        return { valid: false, userId: null };
      }
      if (Date.now() > parsed.expiresAt) {
        return { valid: false, userId: null };
      }
      return { valid: true, userId: parsed.userId };
    } catch {
      return { valid: false, userId: null };
    }
  }

  // Also support legacy underscore format: stafftok_<userId>_<expiresAt>_<sig> if userId has no underscores
  if (token.startsWith('stafftok_')) {
    const lastUnderscore = token.lastIndexOf('_');
    if (lastUnderscore === -1) return { valid: false, userId: null };
    const sig = token.slice(lastUnderscore + 1);
    const rest = token.slice(0, lastUnderscore);
    const secondLastUnderscore = rest.lastIndexOf('_');
    if (secondLastUnderscore === -1) return { valid: false, userId: null };
    const expiresAtStr = rest.slice(secondLastUnderscore + 1);
    const userId = rest.slice('stafftok_'.length, secondLastUnderscore);

    const expiresAt = Number(expiresAtStr);
    if (!userId || !expiresAt || isNaN(expiresAt) || Date.now() > expiresAt) {
      return { valid: false, userId: null };
    }

    const payload = `${userId}:${expiresAt}`;
    const expectedSig = crypto.createHmac('sha256', STAFF_AUTH_SECRET).update(payload).digest('hex');
    const sigBuf = Buffer.from(sig);
    const expectedSigBuf = Buffer.from(expectedSig);

    if (sigBuf.length !== expectedSigBuf.length || !crypto.timingSafeEqual(sigBuf, expectedSigBuf)) {
      return { valid: false, userId: null };
    }

    return { valid: true, userId };
  }

  return { valid: false, userId: null };
}

// Verify guest session from Firestore
export async function requireGuestSession(
  req: GuestSessionRequest,
  res: Response,
  next: NextFunction
) {
  const sessionId = (req.headers['x-guest-session-id'] as string) || (req.query.sessionId as string);
  const signature = (req.headers['x-guest-signature'] as string) || (req.query.signature as string);

  if (!sessionId) {
    res.status(401).json({ error: 'GUEST_SESSION_REQUIRED', message: 'Valid guest session required' });
    return;
  }

  try {
    const session = await getDocById<any>('guest_sessions', sessionId);

    if (!session) {
      res.status(401).json({ error: 'INVALID_SESSION', message: 'Guest session not found or expired' });
      return;
    }

    // If signature provided, verify HMAC
    if (signature) {
      const expectedSig = signSessionId(session.id, session.sessionSecret);
      if (signature !== expectedSig) {
        res.status(403).json({ error: 'SESSION_SIGNATURE_MISMATCH', message: 'Cryptographic session signature failed' });
        return;
      }
    }

    // Attach to request
    req.guestSession = {
      id: session.id,
      guestId: session.guestId || null,
      sessionSecret: session.sessionSecret,
    };

    next();
  } catch (err) {
    console.error('Session middleware error:', err);
    res.status(500).json({ error: 'SESSION_VERIFICATION_FAILED' });
  }
}

// Staff / Coordinator Authentication backed by Firestore users
export async function requireCoordinatorAuth(
  req: AuthenticatedStaffRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'AUTHENTICATION_REQUIRED',
      message: 'Bearer token authorization required for Reservations Desk access',
    });
    return;
  }

  const token = authHeader.replace('Bearer ', '').trim();

  // Explicitly reject known mock / bypass tokens
  if (['mock-token', 'bypass', 'admin-bypass', 'dev-token', 'test'].includes(token.toLowerCase())) {
    res.status(403).json({
      error: 'MOCK_TOKEN_REJECTED',
      message: 'Mock or bypass authentication tokens are strictly prohibited.',
    });
    return;
  }

  try {
    // Cryptographically verify signed coordinator token
    const tokenResult = verifyStaffAuthToken(token);
    if (!tokenResult.valid || !tokenResult.userId) {
      res.status(401).json({
        error: 'INVALID_COORDINATOR_CREDENTIALS',
        message: 'Invalid staff credentials or session expired',
      });
      return;
    }

    // Load authorized staff user from Firestore by the verified userId
    const staff = await getDocById<any>('users', tokenResult.userId);

    if (!staff || !staff.isActive) {
      res.status(401).json({
        error: 'INVALID_COORDINATOR_CREDENTIALS',
        message: 'Invalid staff credentials or staff account is inactive',
      });
      return;
    }

    if (staff.role !== 'admin' && staff.role !== 'reservations_coordinator') {
      res.status(403).json({
        error: 'INSUFFICIENT_ROLE_PERMISSIONS',
        message: 'User does not possess reservations coordinator authorization',
      });
      return;
    }

    req.staffUser = {
      id: staff.id,
      email: staff.email,
      name: staff.name,
      role: staff.role,
      isActive: Boolean(staff.isActive),
    };

    next();
  } catch (err) {
    console.error('Coordinator auth error:', err);
    res.status(500).json({ error: 'AUTH_VERIFICATION_FAILED' });
  }
}
