import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db } from '../db/index.ts';
import * as schema from '../db/schema.ts';
import { eq } from 'drizzle-orm';

export interface AuthenticatedStaffRequest extends Request {
  staffUser?: {
    id: string;
    email: string;
    name: string;
    role: string;
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

// Verify guest session from headers
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
    const sessionRecords = await db
      .select()
      .from(schema.guestSessions)
      .where(eq(schema.guestSessions.id, sessionId));

    if (sessionRecords.length === 0) {
      res.status(401).json({ error: 'INVALID_SESSION', message: 'Guest session not found or expired' });
      return;
    }

    const session = sessionRecords[0];

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
      guestId: session.guestId,
      sessionSecret: session.sessionSecret,
    };

    next();
  } catch (err) {
    console.error('Session middleware error:', err);
    res.status(500).json({ error: 'SESSION_VERIFICATION_FAILED' });
  }
}

// Staff / Coordinator Authentication
export async function requireCoordinatorAuth(
  req: AuthenticatedStaffRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'AUTHENTICATION_REQUIRED',
      message: 'Bearer token authorization required for Reservations Desk access'
    });
    return;
  }

  const token = authHeader.replace('Bearer ', '').trim();

  // Explicitly reject known mock / bypass tokens
  if (['mock-token', 'bypass', 'admin-bypass', 'dev-token', 'test'].includes(token.toLowerCase())) {
    res.status(403).json({
      error: 'MOCK_TOKEN_REJECTED',
      message: 'Mock or bypass authentication tokens are strictly prohibited.'
    });
    return;
  }

  try {
    // Authenticate token against registered staff users
    // Token can be staffId or apiKey associated with active staff
    const staffRecords = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.isActive, true));

    // Match by registered staff token format (staff_{id}) or staff ID
    const staff = staffRecords.find(
      u => token === `staff_${u.id}` || u.id === token
    );

    if (!staff) {
      res.status(401).json({
        error: 'INVALID_COORDINATOR_CREDENTIALS',
        message: 'Invalid staff credentials or session expired'
      });
      return;
    }

    if (staff.role !== 'admin' && staff.role !== 'reservations_coordinator') {
      res.status(403).json({
        error: 'INSUFFICIENT_ROLE_PERMISSIONS',
        message: 'User does not possess reservations coordinator authorization'
      });
      return;
    }

    req.staffUser = {
      id: staff.id,
      email: staff.email,
      name: staff.name,
      role: staff.role,
    };

    next();
  } catch (err) {
    console.error('Coordinator auth error:', err);
    res.status(500).json({ error: 'AUTH_VERIFICATION_FAILED' });
  }
}
