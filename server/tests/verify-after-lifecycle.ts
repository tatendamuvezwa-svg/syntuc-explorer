import http from 'http';

function get(path: string, headers: Record<string, string> = {}): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path,
        method: 'GET',
        headers,
      },
      (res) => {
        let text = '';
        res.on('data', (c) => (text += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode || 0, body: JSON.parse(text) });
          } catch (_) {
            resolve({ status: res.statusCode || 0, body: text });
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

function post(path: string, data: any, headers: Record<string, string> = {}): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...headers,
        },
      },
      (res) => {
        let text = '';
        res.on('data', (c) => (text += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode || 0, body: JSON.parse(text) });
          } catch (_) {
            resolve({ status: res.statusCode || 0, body: text });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function verifyAfterLifecycle() {
  console.log('=== VERIFYING PERSISTENCE AFTER CONTAINER LIFECYCLE INTERRUPTION ===');

  // 1. Authenticate to Reservations Desk
  console.log('[Check 1] Authenticating Reservations Desk...');
  const loginRes = await post('/api/coordinator/login', {
    email: 'reservations@syntuc.com',
    password: 'syntuc2026!secure',
  });
  const token = loginRes.body.token;
  const staffAuth = { Authorization: 'Bearer ' + token };
  console.log('-> Staff Logged In Successfully');

  // 2. Fetch All Reservations from Reservations Desk
  console.log('[Check 2] Querying All Reservations from Desk...');
  const listRes = await get('/api/coordinator/reservations', staffAuth);
  console.log(`-> Total Reservations Returned: ${listRes.body.length}`);

  for (const r of listRes.body) {
    console.log(`\n--- Reservation Record ---`);
    console.log(`Reference: ${r.referenceNumber}`);
    console.log(`ID: ${r.id}`);
    console.log(`Status: ${r.status}`);
    console.log(`Total: $${r.authoritativeTotal} ${r.currency}`);
    console.log(`First-Touch: ${r.firstTouchSource} / ${r.firstTouchCampaign} / ${r.firstTouchContent}`);
    console.log(`Created: ${r.createdAt}`);
  }

  // 3. Verify specifically SYN-VF-50327
  const r50327 = listRes.body.find((x: any) => x.referenceNumber === 'SYN-VF-50327');
  if (!r50327) {
    throw new Error('FAIL: SYN-VF-50327 did not survive lifecycle interruption!');
  }
  console.log('\n[PASS] SYN-VF-50327 survived container lifecycle interruption!');

  // Verify line items for SYN-VF-50327
  const detail50327 = await get(`/api/coordinator/reservations/${r50327.id}`, staffAuth);
  console.log(`SYN-VF-50327 Line Items Count: ${detail50327.body.items?.length}`);
  if (detail50327.body.items?.length > 0) {
    console.log(`[PASS] Line Item: ${detail50327.body.items[0].snapshotProductName} ($${detail50327.body.items[0].snapshotUnitPrice})`);
  }

  // 4. Verify specifically the runtime created reservation SYN-VF-51607
  const r51607 = listRes.body.find((x: any) => x.referenceNumber === 'SYN-VF-51607');
  if (!r51607) {
    throw new Error('FAIL: Runtime reservation SYN-VF-51607 did not survive lifecycle interruption!');
  }
  console.log('\n[PASS] Runtime Reservation SYN-VF-51607 survived container lifecycle interruption!');

  // Verify line items for SYN-VF-51607
  const detail51607 = await get(`/api/coordinator/reservations/${r51607.id}`, staffAuth);
  console.log(`SYN-VF-51607 Line Items Count: ${detail51607.body.items?.length}`);
  for (const item of detail51607.body.items || []) {
    console.log(` -> Item: ${item.snapshotProductName} ($${item.calculatedSubtotal})`);
  }

  // 5. Verify Media Asset Persistence
  console.log('\n[Check 3] Verifying Durable Media Asset...');
  const mediaRes = await get('/api/media/product/prod_flight_of_angels');
  console.log(`prod_flight_of_angels Media Assets Count: ${mediaRes.body.length}`);
  const customMedia = mediaRes.body.find((m: any) => m.caption === 'Verified Victoria Falls Crest Panorama');
  if (!customMedia) {
    throw new Error('FAIL: Custom uploaded media asset did not survive lifecycle interruption!');
  }
  console.log('[PASS] Uploaded media asset survived container lifecycle interruption!');
  console.log(`       Media ID: ${customMedia.id}`);
  console.log(`       URL: ${customMedia.url}`);
  console.log(`       Caption: ${customMedia.caption}`);

  console.log('\n=== ALL PERSISTENCE AND RECOVERY ACCEPTANCE CHECKS PASSED ===');
}

verifyAfterLifecycle()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
