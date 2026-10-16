import assert from 'node:assert/strict';
import { validateExperienceDate } from '../routes/feedback.ts';

const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

assert.equal(validateExperienceDate(today), today, 'today should be accepted');
assert.equal(validateExperienceDate(yesterday), yesterday, 'a past date should be accepted');
assert.equal(validateExperienceDate('2024-02-29'), '2024-02-29', 'valid leap day should be accepted');
assert.equal(validateExperienceDate('2025-02-29'), null, 'invalid leap day should be rejected');
assert.equal(validateExperienceDate('2026-13-01'), null, 'invalid month should be rejected');
assert.equal(validateExperienceDate('2026-04-31'), null, 'invalid calendar day should be rejected');
assert.equal(validateExperienceDate(tomorrow), null, 'future date should be rejected');
assert.equal(validateExperienceDate('16/10/2026'), null, 'non-ISO date should be rejected');
assert.equal(validateExperienceDate(''), null, 'empty optional date should be accepted as absent');
console.log('Feedback date validation tests passed.');
