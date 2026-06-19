import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rungis-settings-'));
process.env.APP_SETTINGS_SQLITE_PATH = path.join(tempDir, 'settings.sqlite');

const settings = await import('../../src/services/rungis-bills/settings.js');
const store = await import('../../src/lib/app-settings-store.js');

test.after(() => {
  store.closeAppSettingsStore();
});

test('normalizes valid percentages and rejects invalid values', () => {
  assert.equal(settings.normalizePercentage('2.345'), 2.35);
  assert.equal(settings.normalizePercentage(0), 0);
  assert.equal(settings.normalizePercentage(100), 100);
  assert.equal(settings.normalizePercentage(-1), null);
  assert.equal(settings.normalizePercentage(101), null);
  assert.equal(settings.normalizePercentage('abc'), null);
});

test('persists Rungis fee and VAT settings in SQLite', () => {
  const saved = settings.setRungisBillingSettings({ rungisFeeRate: 2.5, vatRate: 20 });
  assert.deepEqual(saved, { rungisFeeRate: 2.5, vatRate: 20, configured: true });
  assert.deepEqual(settings.getRungisBillingSettings(), { rungisFeeRate: 2.5, vatRate: 20, configured: true });
  assert.equal(settings.setRungisBillingSettings({ rungisFeeRate: 200, vatRate: 20 }), null);
});

test('calculates previous UTC calendar month', () => {
  const period = settings.getPreviousUtcCalendarMonth(new Date(Date.UTC(2026, 0, 15)));
  assert.equal(period.applicableYear, 2025);
  assert.equal(period.applicableMonth, 12);
  assert.equal(period.periodStart.toISOString(), '2025-12-01T00:00:00.000Z');
  assert.equal(period.periodEnd.toISOString(), '2026-01-01T00:00:00.000Z');
});
