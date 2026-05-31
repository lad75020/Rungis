import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import mongoose from 'mongoose';

import { User } from '../src/models/user.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const mongoUrl = process.env.MONGO_URL ?? 'mongodb://192.168.1.80:27017/rungis';

const FIRST_NAMES = ['Emma', 'Noah', 'Lea', 'Hugo', 'Lina', 'Lucas', 'Chloe', 'Louis', 'Nora', 'Jules'];
const LAST_NAMES = ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Petit', 'Durand', 'Moreau', 'Laurent', 'Simon'];
const CITIES = ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nantes', 'Lille', 'Nice', 'Bordeaux', 'Rennes', 'Reims'];

function randomItem(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function randomZipcode() {
  return String(Math.floor(Math.random() * 90000) + 10000);
}

function randomSiret() {
  return Math.floor(Math.random() * 9000000000000) + 1000000000000;
}

async function main() {
  await mongoose.connect(mongoUrl);

  try {
    const users = await User.find({}).select({ _id: 1 }).lean();
    if (users.length === 0) {
      console.log('No users found.');
      return;
    }

    const updates = users.map((user) => ({
      updateOne: {
        filter: { _id: user._id },
        update: {
          $set: {
            firstName: randomItem(FIRST_NAMES),
            lastName: randomItem(LAST_NAMES),
            city: randomItem(CITIES),
            zipcode: randomZipcode(),
            businessRegistrationId: randomSiret(),
            updatedAt: new Date()
          }
        }
      }
    }));

    const result = await User.bulkWrite(updates);
    console.log(`Users updated: ${result.modifiedCount}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
