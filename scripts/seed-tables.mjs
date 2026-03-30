/**
 * One-time script: adds tables 9-12 to Firestore via the REST API.
 * Run: node scripts/seed-tables.mjs
 */

const PROJECT_ID = "chaska-a748b";
const API_KEY = "AIzaSyD26NixeC2ss9dxbL9iP8j9okd9mgrEvaU";
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/tables`;

const tablesToAdd = [9, 10, 11, 12];

async function addTable(num) {
  const docId = `table_${num}`;
  const url = `${BASE_URL}/${docId}?key=${API_KEY}`;

  const body = {
    fields: {
      tableNumber: { integerValue: String(num) },
      status:      { stringValue: "free" },
      currentOrderId: { nullValue: null },
    },
  };

  const res = await fetch(url, {
    method: "PATCH", // PATCH = create or overwrite
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`❌ table_${num}: ${err}`);
  } else {
    console.log(`✅ table_${num} created/updated`);
  }
}

for (const n of tablesToAdd) {
  await addTable(n);
}
