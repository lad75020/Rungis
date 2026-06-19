import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import { markRungisBillPaid, searchUnpaidRungisBills } from '../../src/services/rungis-bills/generation.js';

function chain(result) {
  return {
    sort() {
      return { lean: async () => result };
    },
    lean: async () => result
  };
}

test('searchUnpaidRungisBills filters by month and escaped organization query', async () => {
  const calls = [];
  const RungisBill = {
    find(filter) {
      calls.push(filter);
      return chain([
        {
          _id: '507f1f77bcf86cd799439011',
          applicableYear: 2026,
          applicableMonth: 5,
          role: 'vendor',
          userOrganisationName: 'Market Vendor',
          userUniqueId: '00024',
          grossAmountBeforeTax: 1000,
          rungisFeeRate: 2.5,
          payableAmountBeforeTax: 25,
          vatRate: 20,
          vatAmount: 5,
          payableAmountIncludingVat: 30,
          currency: 'EUR',
          paid: false,
          generatedAt: new Date('2026-06-01T00:00:00Z')
        }
      ]);
    }
  };

  const rows = await searchUnpaidRungisBills({ RungisBill, month: '2026-05', organization: 'Market (A)' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].payableAmountIncludingVat, 30);
  assert.equal(calls[0].paid, false);
  assert.equal(calls[0].applicableYear, 2026);
  assert.equal(calls[0].applicableMonth, 5);
  assert.match(String(calls[0].userOrganisationName.$regex), /Market/);
});

test('markRungisBillPaid sets paid fields atomically', async () => {
  const billId = new mongoose.Types.ObjectId();
  const adminId = new mongoose.Types.ObjectId();
  const RungisBill = {
    findOneAndUpdate(filter, update) {
      assert.deepEqual(filter, { _id: billId, paid: false });
      assert.equal(update.$set.paid, true);
      assert.equal(String(update.$set.paidByAdminId), String(adminId));
      return { lean: async () => ({ _id: billId, applicableYear: 2026, applicableMonth: 5, role: 'client', userUniqueId: '00025', userOrganisationName: 'Client', grossAmountBeforeTax: 100, rungisFeeRate: 5, payableAmountBeforeTax: 5, vatRate: 20, vatAmount: 1, payableAmountIncludingVat: 6, currency: 'EUR', paid: true, generatedAt: new Date() }) };
    },
    findById() {
      throw new Error('not expected');
    }
  };

  const result = await markRungisBillPaid({ RungisBill, billId: String(billId), adminUserId: String(adminId) });
  assert.equal(result.ok, true);
  assert.equal(result.alreadyPaid, false);
  assert.equal(result.bill.paid, true);
});
