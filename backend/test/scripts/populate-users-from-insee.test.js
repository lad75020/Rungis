import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import {
  businessRegistrationIdGenerator,
  completeLuhn,
  createBusinessRegistrationId,
  isValidLuhn,
  parseCsvLine,
  sampleSiretsFromStockFile
} from '../../scripts/populate-users-from-insee.js';

test('creates 14-digit businessRegistrationId values accepted by the project Luhn function', () => {
  const value = createBusinessRegistrationId('356000000', 4);

  assert.equal(value, '35600000000048');
  assert.match(value, /^\d{14}$/);
  assert.equal(isValidLuhn(value), true);
});

test('completeLuhn appends the check digit to a 13-digit SIRET prefix', () => {
  assert.equal(completeLuhn('4430618410004'), '44306184100047');
  assert.equal(isValidLuhn('44306184100047'), true);
  assert.throws(() => completeLuhn('44306184100047'), /13 digits/);
  assert.throws(() => completeLuhn('443061841000'), /13 digits/);
});

test('businessRegistrationIdGenerator starts with configured SIREN and NIC prefix', () => {
  const generator = businessRegistrationIdGenerator({ startSiren: '120027016', startNic: 56 });
  const first = generator.next().value;
  const second = generator.next().value;

  assert.equal(first, '12002701600563');
  assert.match(second, /^\d{14}$/);
  assert.equal(isValidLuhn(second), true);
  assert.notEqual(second, first);
});

test('businessRegistrationIdGenerator never emits 15-digit values when crossing SIREN seeds', () => {
  const generator = businessRegistrationIdGenerator();

  for (let index = 0; index < 20_010; index += 1) {
    const value = generator.next().value;
    assert.match(value, /^\d{14}$/);
    assert.equal(isValidLuhn(value), true);
  }
});

test('parseCsvLine keeps quoted commas inside a single field', () => {
  assert.deepEqual(parseCsvLine('siret,nom,ville'), ['siret', 'nom', 'ville']);
  assert.deepEqual(parseCsvLine('123,"A, B",Paris'), ['123', 'A, B', 'Paris']);
});

test('sampleSiretsFromStockFile samples active valid SIRETs only', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'rungis-sirets-'));
  const csvPath = path.join(directory, 'StockEtablissement_utf8.csv');

  await writeFile(csvPath, [
    'siren,nic,siret,etatAdministratifEtablissement,libelleCommuneEtablissement',
    '356000000,0004,35600000000048,A,PARIS',
    '443061841,0004,44306184100047,F,PARIS',
    '120027016,0056,12002701600563,A,MONTROUGE',
    '000000000,0000,00000000000001,A,NOWHERE'
  ].join('\n'));

  try {
    const { sirets, eligibleCount } = await sampleSiretsFromStockFile({
      filePath: csvPath,
      sampleSize: 2,
      activeOnly: true
    });

    assert.equal(eligibleCount, 2);
    assert.deepEqual(new Set(sirets), new Set(['35600000000048', '12002701600563']));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
