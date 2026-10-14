import assert from 'node:assert/strict';
import { deleteReservationById } from '../lib/reservation-deletion.ts';

type Query = { field: string; operator: string; value: string };
type FakeDoc = { id: string; [key: string]: unknown };

function createDeps(options: { reservationExists?: boolean; failDeleteId?: string } = {}) {
  const calls: string[] = [];
  const deleted: string[] = [];
  const tombstones: string[] = [];
  const lookups: Array<[string, string]> = [];
  const fixtures: Record<string, FakeDoc[]> = {
    reservation_items: [
      { id: 'item-owned', reservationRequestId: 'res-1' },
      { id: 'item-other', reservationRequestId: 'res-2' },
    ],
    guest_access_tokens: [
      { id: 'token-owned', reservationRequestId: 'res-1' },
      { id: 'token-other', reservationRequestId: 'res-2' },
    ],
    guest_messages: [
      { id: 'message-owned', reservationRequestId: 'res-1' },
      { id: 'message-other', reservationRequestId: 'res-2' },
    ],
    coordinator_notes: [
      { id: 'note-owned', targetId: 'res-1', targetType: 'reservation' },
      { id: 'note-other-type', targetId: 'res-1', targetType: 'lead' },
      { id: 'note-other-reservation', targetId: 'res-2', targetType: 'reservation' },
      { id: 'note-legacy-unknown-type', targetId: 'res-1' },
    ],
  };

  const deps = {
    getDocById: async (collection: string, id: string) => {
      calls.push(`read:${collection}:${id}`);
      lookups.push([collection, id]);
      return options.reservationExists === false ? null : { id, referenceNumber: 'TEST-1' };
    },
    getCollectionDocs: async (collection: string, query?: Query) => {
      calls.push(`query:${collection}:${query?.field ?? 'all'}:${query?.value ?? ''}`);
      const docs = fixtures[collection] ?? [];
      if (!query) return docs;
      return docs.filter((doc) => doc[query.field] === query.value);
    },
    where: (field: string, operator: string, value: string) => ({ field, operator, value }),
    deleteDocById: async (collection: string, id: string) => {
      calls.push(`delete:${collection}:${id}`);
      if (options.failDeleteId === id) throw new Error('simulated cleanup failure');
      deleted.push(`${collection}:${id}`);
    },
    recordTombstone: async (collection: string, id: string) => {
      calls.push(`tombstone:${collection}:${id}`);
      tombstones.push(`${collection}:${id}`);
    },
  };

  return { deps: deps as any, calls, deleted, tombstones, lookups };
}

const activeAdmin = { id: 'staff-admin', role: 'admin', isActive: true };
const activeCoordinator = { id: 'staff-coordinator', role: 'reservations_coordinator', isActive: true };
let count = 0;

async function test(name: string, run: () => Promise<void>) {
  await run();
  count += 1;
  console.log(`PASS ${count}: ${name}`);
}

await test('active admin deletes one reservation and tombstones it', async () => {
  const mock = createDeps();
  const result = await deleteReservationById(activeAdmin, 'res-1', mock.deps);
  assert.equal(result.success, true);
  assert.deepEqual(mock.lookups, [['reservation_requests', 'res-1']]);
  assert.deepEqual(mock.tombstones, ['reservation_requests:res-1']);
  assert.ok(mock.deleted.includes('reservation_requests:res-1'));
  assert.ok(mock.calls.indexOf('tombstone:reservation_requests:res-1') < mock.calls.indexOf('delete:reservation_requests:res-1'));
});

await test('reservations coordinator receives 403 with no Firestore access', async () => {
  const mock = createDeps();
  await assert.rejects(
    deleteReservationById(activeCoordinator, 'res-1', mock.deps),
    (error: any) => error.status === 403 && error.code === 'ADMIN_REQUIRED'
  );
  assert.deepEqual(mock.calls, []);
});

await test('inactive admin receives 401 with no Firestore access', async () => {
  const mock = createDeps();
  await assert.rejects(
    deleteReservationById({ ...activeAdmin, isActive: false }, 'res-1', mock.deps),
    (error: any) => error.status === 401 && error.code === 'STAFF_INACTIVE'
  );
  assert.deepEqual(mock.calls, []);
});

await test('missing staff identity receives 401 with no Firestore access', async () => {
  const mock = createDeps();
  await assert.rejects(
    deleteReservationById(null, 'res-1', mock.deps),
    (error: any) => error.status === 401 && error.code === 'AUTHENTICATION_REQUIRED'
  );
  assert.deepEqual(mock.calls, []);
});

await test('missing reservation returns 404 without mutation', async () => {
  const mock = createDeps({ reservationExists: false });
  await assert.rejects(
    deleteReservationById(activeAdmin, 'missing', mock.deps),
    (error: any) => error.status === 404 && error.code === 'RESERVATION_NOT_FOUND'
  );
  assert.deepEqual(mock.deleted, []);
  assert.deepEqual(mock.tombstones, []);
});

await test('cleanup is restricted to records belonging to this reservation', async () => {
  const mock = createDeps();
  await deleteReservationById(activeAdmin, 'res-1', mock.deps);
  assert.deepEqual(mock.deleted.sort(), [
    'coordinator_notes:note-owned',
    'guest_access_tokens:token-owned',
    'guest_messages:message-owned',
    'reservation_items:item-owned',
    'reservation_requests:res-1',
  ].sort());
  assert.ok(!mock.deleted.some((id) => id.includes('other') || id.includes('legacy')));
});

await test('cleanup failure is surfaced and does not tombstone or delete the parent', async () => {
  const mock = createDeps({ failDeleteId: 'item-owned' });
  await assert.rejects(
    deleteReservationById(activeAdmin, 'res-1', mock.deps),
    /simulated cleanup failure/
  );
  assert.deepEqual(mock.tombstones, []);
  assert.ok(!mock.deleted.includes('reservation_requests:res-1'));
});

console.log(`Reservation deletion unit tests: ${count}/${count} passed`);
