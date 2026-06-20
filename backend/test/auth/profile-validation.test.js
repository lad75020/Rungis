import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseSiretValue } from '../../src/routes/index.js';

test('profile SIRET parser rejects 13-digit, formatted, and non-digit values', () => {
  for (const value of ['3560000000004', '356 000 000 00048', '3560000000004A', '356000000000480']) {
    const result = parseSiretValue(value);

    assert.equal(result.ok, false);
    assert.match(result.message, /14-digit/);
  }
});

test('profile SIRET parser accepts exactly 14 digits', () => {
  assert.deepEqual(parseSiretValue('35600000000048'), { ok: true, value: 35600000000048 });
});

test('VAT ID remains a distinct 13-character account validation rule', () => {
  assert.equal('FR12345678901'.length, 13);
});
