import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';

import { User } from '../../src/models/user.model.js';
import {
  buildBillUniqueIdFromMap,
  getBillPartyUniqueIdById
} from '../../src/routes/index.js';

test('builds bill UUIDs from user uniqueId fields, preserving 5-digit leading zeros', async () => {
  const vendorId = new mongoose.Types.ObjectId();
  const clientId = new mongoose.Types.ObjectId();
  const originalFind = User.find;
  let selectedFields = null;

  User.find = () => ({
    select(fields) {
      selectedFields = fields;
      return {
        lean: async () => [
          {
            _id: vendorId,
            uniqueId: '00024',
            businessRegistrationId: 5206983588503
          },
          {
            _id: clientId,
            uniqueId: '00012',
            businessRegistrationId: 4700166914691
          }
        ]
      };
    }
  });

  try {
    const partyUniqueIdById = await getBillPartyUniqueIdById([vendorId, clientId]);

    assert.deepEqual(selectedFields, { _id: 1, uniqueId: 1 });
    assert.equal(partyUniqueIdById.get(vendorId.toString()), '00024');
    assert.equal(partyUniqueIdById.get(clientId.toString()), '00012');
    assert.equal(
      buildBillUniqueIdFromMap({
        billDate: new Date('2026-06-19T00:00:00.000Z'),
        vendorId,
        clientId,
        partyUniqueIdById
      }),
      '202606190002400012'
    );
  } finally {
    User.find = originalFind;
  }
});

test('user schema accepts only 5-digit unique IDs when provided', async () => {
  const baseUser = {
    role: 'vendor',
    username: 'vendor-unique-id-test',
    firstName: 'Vendor',
    lastName: 'Test',
    organisation: 'Vendor Test',
    city: 'Paris',
    zipcode: '75001',
    email: 'vendor-unique-id-test@example.com',
    physicalAddress: '1 Market Street',
    phoneNumber: '0102030405',
    businessRegistrationId: 1234567890123,
    passwordHash: 'hash',
    isActive: true
  };

  assert.equal(await new User({ ...baseUser, uniqueId: '00024' }).validate(), undefined);
  await assert.rejects(
    () => new User({ ...baseUser, uniqueId: '24' }).validate(),
    /Unique ID must be exactly 5 digits/
  );
});
