import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
assert.match(rules, /match \/\{document=\*\*\} \{/);
assert.match(rules, /allow read, write: if false;/);
assert.doesNotMatch(rules, /allow\s+(?:read|write|read,\s*write)\s*:\s*if\s+true\s*;/,
  'Firestore rules must not grant unconditional client access');
console.log('Firestore client-deny rules static checks passed.');
