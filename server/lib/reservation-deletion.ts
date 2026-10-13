import crypto from 'crypto';
import {
  getDocById,
  deleteDocById,
  getCollectionDocs,
  where,
  recordTombstone,
} from '../lib/firestore.ts';

export interface StaffUser {
  id: string;
  email?: string;
  name?: string;
  role: string;
  isActive?: boolean;
}

export type FirestoreDeps = {
  getDocById?: typeof getDocById;
  deleteDocById?: typeof deleteDocById;
  getCollectionDocs?: typeof getCollectionDocs;
  recordTombstone?: typeof recordTombstone;
  where?: typeof where;
};

/**
 * Delete a reservation and its associated records.
 *
 * This function enforces admin-only authorization before any reads or mutations.
 * It performs a single authoritative lookup for the reservation and then deletes
 * only reservation-scoped records. It records a tombstone for the reservation id.
 *
 * Errors are thrown with `status` and `code` properties to allow HTTP mapping.
 */
export async function deleteReservationById(
  staffUser: StaffUser | undefined | null,
  reservationId: string,
  deps: FirestoreDeps = {}
) {
  const {
    getDocById: _getDocById = getDocById,
    deleteDocById: _deleteDocById = deleteDocById,
    getCollectionDocs: _getCollectionDocs = getCollectionDocs,
    recordTombstone: _recordTombstone = recordTombstone,
    where: _where = where,
  } = deps;

  // Authorize before reading or mutating reservation data.
  if (!staffUser) {
    const e: any = new Error('AUTHENTICATION_REQUIRED');
    e.status = 401;
    e.code = 'AUTHENTICATION_REQUIRED';
    throw e;
  }

  if (!staffUser.isActive) {
    const e: any = new Error('STAFF_INACTIVE');
    e.status = 401;
    e.code = 'STAFF_INACTIVE';
    throw e;
  }

  if (staffUser.role !== 'admin') {
    const e: any = new Error('ADMIN_REQUIRED');
    e.status = 403;
    e.code = 'ADMIN_REQUIRED';
    throw e;
  }

  if (!reservationId) {
    const e: any = new Error('RESERVATION_ID_REQUIRED');
    e.status = 400;
    e.code = 'RESERVATION_ID_REQUIRED';
    throw e;
  }

  // Single authoritative lookup
  const existing = await _getDocById<any>('reservation_requests', reservationId);
  if (!existing) {
    const e: any = new Error('RESERVATION_NOT_FOUND');
    e.status = 404;
    e.code = 'RESERVATION_NOT_FOUND';
    throw e;
  }

  // Proceed with deletion of reservation-scoped records only.
  // 1. Record durable deletion tombstone
  await _recordTombstone('reservation_requests', reservationId);

  // 2. Delete reservation itself
  await _deleteDocById('reservation_requests', reservationId);

  // 3. Delete reservation_items
  try {
    const items = await _getCollectionDocs<any>('reservation_items', _where('reservationRequestId', '==', reservationId));
    await Promise.all(items.map((i) => _deleteDocById('reservation_items', i.id)));
  } catch (e) {
    // Log and continue; do not abort whole operation if optional cleanup fails
    console.error('Error deleting reservation_items during reservation delete:', e);
  }

  // 4. Delete guest_access_tokens
  try {
    const tokens = await _getCollectionDocs<any>('guest_access_tokens', _where('reservationRequestId', '==', reservationId));
    await Promise.all(tokens.map((t) => _deleteDocById('guest_access_tokens', t.id)));
  } catch (e) {
    console.error('Error deleting guest_access_tokens during reservation delete:', e);
  }

  // 5. Delete guest_messages
  try {
    const messages = await _getCollectionDocs<any>('guest_messages', _where('reservationRequestId', '==', reservationId));
    await Promise.all(messages.map((m) => _deleteDocById('guest_messages', m.id)));
  } catch (e) {
    console.error('Error deleting guest_messages during reservation delete:', e);
  }

  // 6. Delete coordinator_notes targeted at this reservation
  try {
    const notes = await _getCollectionDocs<any>('coordinator_notes', _where('targetId', '==', reservationId));
    // Only delete notes that are reservation-targeted (if a targetType field exists, respect it)
    const notesToDelete = notes.filter((n) => !n.targetType || n.targetType === 'reservation');
    await Promise.all(notesToDelete.map((n) => _deleteDocById('coordinator_notes', n.id)));
  } catch (e) {
    console.error('Error deleting coordinator_notes during reservation delete:', e);
  }

  return { success: true, message: `Reservation ${reservationId} permanently deleted and deletion tombstoned.` };
}
