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

type DeletionError = Error & { status: number; code: string };

function deletionError(status: number, code: string, message = code): DeletionError {
  return Object.assign(new Error(message), { status, code });
}

/**
 * Delete a reservation and its associated records.
 * Authorization is checked before any Firestore access.
 * Related records are removed before the tombstone and parent document so a
 * failed cleanup leaves the reservation available for a safe retry.
 */
export async function deleteReservationById(
  staffUser: StaffUser | undefined | null,
  reservationId: string,
  deps: FirestoreDeps = {}
) {
  const {
    getDocById: readById = getDocById,
    deleteDocById: deleteById = deleteDocById,
    getCollectionDocs: readCollection = getCollectionDocs,
    recordTombstone: tombstone = recordTombstone,
    where: makeWhere = where,
  } = deps;

  if (!staffUser) {
    throw deletionError(401, 'AUTHENTICATION_REQUIRED', 'Authentication required');
  }
  if (!staffUser.isActive) {
    throw deletionError(401, 'STAFF_INACTIVE', 'Active staff account required');
  }
  if (staffUser.role !== 'admin') {
    throw deletionError(403, 'ADMIN_REQUIRED', 'Administrator authorization required to delete reservations');
  }
  if (!reservationId) {
    throw deletionError(400, 'RESERVATION_ID_REQUIRED', 'Reservation id is required');
  }

  // The single authoritative lookup happens only after authorization.
  const existing = await readById<any>('reservation_requests', reservationId);
  if (!existing) {
    throw deletionError(404, 'RESERVATION_NOT_FOUND', 'Reservation not found');
  }

  // Resolve all associated records before making mutations.
  const [items, tokens, messages, queriedNotes] = await Promise.all([
    readCollection<any>('reservation_items', makeWhere('reservationRequestId', '==', reservationId)),
    readCollection<any>('guest_access_tokens', makeWhere('reservationRequestId', '==', reservationId)),
    readCollection<any>('guest_messages', makeWhere('reservationRequestId', '==', reservationId)),
    readCollection<any>('coordinator_notes', makeWhere('targetId', '==', reservationId)),
  ]);

  // Only explicitly reservation-targeted notes belong to this deletion.
  const notes = queriedNotes.filter((note) => note.targetType === 'reservation');
  const childRecords: Array<{ collection: string; id: string }> = [
    ...items.map((item) => ({ collection: 'reservation_items', id: item.id })),
    ...tokens.map((token) => ({ collection: 'guest_access_tokens', id: token.id })),
    ...messages.map((message) => ({ collection: 'guest_messages', id: message.id })),
    ...notes.map((note) => ({ collection: 'coordinator_notes', id: note.id })),
  ];

  // Wait for all child deletes to settle; if any fails, keep the parent so the
  // operation can be retried without falsely reporting success.
  const cleanupResults = await Promise.allSettled(
    childRecords.map((record) => deleteById(record.collection, record.id))
  );
  const failedCleanup = cleanupResults.find((result) => result.status === 'rejected');
  if (failedCleanup?.status === 'rejected') {
    throw failedCleanup.reason;
  }

  // Tombstone first, then delete the parent. If either operation fails, the
  // still-existing parent lets an administrator retry the cleanup.
  await tombstone('reservation_requests', reservationId);
  await deleteById('reservation_requests', reservationId);

  return {
    success: true,
    message: `Reservation ${reservationId} permanently deleted and deletion tombstoned.`,
  };
}
