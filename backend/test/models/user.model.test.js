import assert from 'node:assert/strict';
import { test } from 'node:test';

import { User } from '../../src/models/user.model.js';

test('businessRegistrationId model validation rejects 13-digit SIRET values', () => {
  const user = new User({
    role: 'vendor',
    username: 'vendor-13',
    organisation: 'Vendor 13',
    firstName: 'Vendor',
    lastName: 'User',
    city: 'Paris',
    zipcode: '75001',
    email: 'vendor13@example.com',
    physicalAddress: '1 Market Street',
    phoneNumber: '0102030405',
    businessRegistrationId: 3560000000004,
    passwordHash: 'hash'
  });

  const error = user.validateSync();

  assert.ok(error?.errors.businessRegistrationId);
  assert.match(error.errors.businessRegistrationId.message, /14-digit/);
});

test('businessRegistrationId model validation accepts valid 14-digit SIRET values and keeps VAT ID rule separate', () => {
  const user = new User({
    role: 'vendor',
    username: 'vendor-14',
    organisation: 'Vendor 14',
    firstName: 'Vendor',
    lastName: 'User',
    city: 'Paris',
    zipcode: '75001',
    email: 'vendor14@example.com',
    physicalAddress: '1 Market Street',
    phoneNumber: '0102030405',
    businessRegistrationId: 35600000000048,
    vatId: 'FR12345678901',
    passwordHash: 'hash'
  });

  assert.equal(user.validateSync(), undefined);
});
