import path from 'node:path';
import { fileURLToPath } from 'node:url';

import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

import { User } from '../src/models/user.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const mongoUrl = process.env.MONGO_URL ?? 'mongodb://127.0.0.1:27017/rungis';

function randomIntInclusive(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomSiret() {
  return randomIntInclusive(1000000000000, 9999999999999);
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

async function upsertRoleUsers(role, count) {
  const firstNames = ['Emma', 'Noah', 'Lea', 'Hugo', 'Lina', 'Lucas', 'Chloe', 'Louis', 'Nora', 'Jules'];
  const lastNames = ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Petit', 'Durand', 'Moreau', 'Laurent', 'Simon'];
  const cities = ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nantes', 'Lille', 'Nice', 'Bordeaux', 'Rennes', 'Reims'];

  for (let i = 1; i <= count; i += 1) {
    const username = `${role}${i}`;
    const passwordHash = await bcrypt.hash(`password${i}`, 12);
    const isVendor = role === 'vendor';

    await User.updateOne(
      { username },
      {
        $set: {
          role,
          username,
          firstName: firstNames[(i - 1) % firstNames.length],
          lastName: lastNames[(i - 1) % lastNames.length],
          organisation: `${isVendor ? 'Vendor' : 'Client'} Organisation ${i}`,
          city: cities[(i - 1) % cities.length],
          zipcode: `${75000 + i}`,
          email: `${username}@example.com`,
          physicalAddress: `${i} ${isVendor ? 'Vendor' : 'Client'} Street`,
          phoneNumber: `+33170000${String(i).padStart(3, '0')}`,
          businessRegistrationId: randomSiret(),
          passwordHash,
          isActive: true,
          updatedAt: new Date()
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      {
        upsert: true
      }
    );
  }
}

function sortedByUsernameNumber(users, prefix) {
  return [...users].sort((a, b) => {
    const ai = Number(a.username.replace(prefix, ''));
    const bi = Number(b.username.replace(prefix, ''));
    return ai - bi;
  });
}

function buildRandomAssociations(clients, vendors) {
  const clientToVendors = new Map();
  const vendorToClients = new Map();

  for (const client of clients) {
    clientToVendors.set(client._id.toString(), new Set());
  }

  for (const vendor of vendors) {
    vendorToClients.set(vendor._id.toString(), new Set());
  }

  const vendorOrder = shuffle(vendors);
  for (let i = 0; i < clients.length; i += 1) {
    const clientId = clients[i]._id.toString();
    const vendorId = vendorOrder[i]._id.toString();

    clientToVendors.get(clientId).add(vendorId);
    vendorToClients.get(vendorId).add(clientId);
  }

  for (const client of clients) {
    const clientId = client._id.toString();
    const targetVendorCount = randomIntInclusive(1, 5);

    while (clientToVendors.get(clientId).size < targetVendorCount) {
      const availableVendors = vendors.filter((vendor) => {
        const vendorId = vendor._id.toString();
        return (
          vendorToClients.get(vendorId).size < 5 &&
          !clientToVendors.get(clientId).has(vendorId)
        );
      });

      if (availableVendors.length === 0) {
        break;
      }

      const selectedVendor =
        availableVendors[Math.floor(Math.random() * availableVendors.length)];
      const vendorId = selectedVendor._id.toString();

      clientToVendors.get(clientId).add(vendorId);
      vendorToClients.get(vendorId).add(clientId);
    }
  }

  return {
    clientToVendors,
    vendorToClients
  };
}

async function applyAssociations(clients, vendors, associations) {
  const clientBulk = [];
  const vendorBulk = [];

  for (const client of clients) {
    const clientId = client._id.toString();
    const vendorIds = [...associations.clientToVendors.get(clientId)].map(
      (id) => new mongoose.Types.ObjectId(id)
    );

    clientBulk.push({
      updateOne: {
        filter: { _id: client._id },
        update: {
          $set: {
            vendorIds,
            clientIds: []
          }
        }
      }
    });
  }

  for (const vendor of vendors) {
    const vendorId = vendor._id.toString();
    const clientIds = [...associations.vendorToClients.get(vendorId)].map(
      (id) => new mongoose.Types.ObjectId(id)
    );

    vendorBulk.push({
      updateOne: {
        filter: { _id: vendor._id },
        update: {
          $set: {
            clientIds,
            vendorIds: []
          }
        }
      }
    });
  }

  if (clientBulk.length > 0) {
    await User.bulkWrite(clientBulk);
  }

  if (vendorBulk.length > 0) {
    await User.bulkWrite(vendorBulk);
  }
}

async function updateAdminPassword() {
  const adminPasswordHash = await bcrypt.hash('11Rungis00', 12);
  const result = await User.updateMany(
    { role: 'admin' },
    {
      $set: {
        passwordHash: adminPasswordHash,
        isActive: true,
        updatedAt: new Date()
      }
    }
  );

  return result.matchedCount;
}

async function main() {
  await mongoose.connect(mongoUrl);

  try {
    await upsertRoleUsers('client', 10);
    await upsertRoleUsers('vendor', 10);

    const clients = sortedByUsernameNumber(
      await User.find({
        role: 'client',
        username: { $in: Array.from({ length: 10 }, (_item, idx) => `client${idx + 1}`) }
      }).select({ _id: 1, username: 1 }),
      'client'
    );

    const vendors = sortedByUsernameNumber(
      await User.find({
        role: 'vendor',
        username: { $in: Array.from({ length: 10 }, (_item, idx) => `vendor${idx + 1}`) }
      }).select({ _id: 1, username: 1 }),
      'vendor'
    );

    const associations = buildRandomAssociations(clients, vendors);
    await applyAssociations(clients, vendors, associations);

    const adminCount = await updateAdminPassword();

    const clientLinkSummary = clients.map((client) => {
      const links = associations.clientToVendors.get(client._id.toString()).size;
      return `${client.username}:${links}`;
    });

    const vendorLinkSummary = vendors.map((vendor) => {
      const links = associations.vendorToClients.get(vendor._id.toString()).size;
      return `${vendor.username}:${links}`;
    });

    console.log('Seed complete.');
    console.log(`Clients upserted: ${clients.length}`);
    console.log(`Vendors upserted: ${vendors.length}`);
    console.log(`Admin accounts updated: ${adminCount}`);
    console.log(`Client->vendor link counts: ${clientLinkSummary.join(', ')}`);
    console.log(`Vendor->client link counts: ${vendorLinkSummary.join(', ')}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
