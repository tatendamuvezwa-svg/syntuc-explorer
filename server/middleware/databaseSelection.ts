import type { Request, Response, NextFunction } from 'express';
import { getDocById, getDefaultFirestoreDatabaseId, runWithFirestoreDatabase, SUPPORTED_FIRESTORE_DATABASES } from '../lib/firestore.ts';
import { verifyStaffAuthToken } from './auth.ts';

export async function selectedDatabaseContext(req: Request, res: Response, next: NextFunction): Promise<void> {
  const requested = req.header('x-syntuc-database-id');
  if (!requested) { next(); return; }
  const supported = requested === getDefaultFirestoreDatabaseId() || SUPPORTED_FIRESTORE_DATABASES.some((db) => db.id === requested);
  if (!supported) { res.status(400).json({ error: 'UNSUPPORTED_DATABASE_SELECTION' }); return; }
  const authorization = req.header('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const tokenResult = verifyStaffAuthToken(token);
  if (!tokenResult.valid || !tokenResult.userId) { res.status(401).json({ error: 'AUTHENTICATION_REQUIRED' }); return; }
  try {
    const staff = await runWithFirestoreDatabase(getDefaultFirestoreDatabaseId(), () => getDocById<any>('users', tokenResult.userId!));
    if (!staff || !staff.isActive || staff.role !== 'admin') { res.status(403).json({ error: 'ADMIN_REQUIRED_FOR_DATABASE_SWITCH' }); return; }
    runWithFirestoreDatabase(requested, () => next());
  } catch (error) {
    console.error('[Database selector] Authorization failed:', error);
    res.status(503).json({ error: 'DATABASE_SELECTION_UNAVAILABLE' });
  }
}
