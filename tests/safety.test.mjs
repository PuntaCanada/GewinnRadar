import test from 'node:test';
import assert from 'node:assert/strict';
test('no production mail configuration is tracked', () => {
  assert.equal(process.env.MAIL_ENABLED === 'true', false);
});
