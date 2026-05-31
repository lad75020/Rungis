import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import mongoose from 'mongoose';

import { Merchandise } from '../src/models/merchandise.model.js';
import { User } from '../src/models/user.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const mongoUrl = process.env.MONGO_URL ?? 'mongodb://192.168.1.80:27017/rungis';

function randomIntInclusive(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPriceEur() {
  const cents = randomIntInclusive(100, 100000);
  return Number((cents / 100).toFixed(2));
}

function pickRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function buildReference(itemNumber, repeatIndex) {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ITEM${itemNumber}-R${repeatIndex}-${suffix}`;
}

async function main() {
  await mongoose.connect(mongoUrl);

  try {
    const vendors = await User.find({ role: 'vendor', isActive: true }).select({ _id: 1, username: 1 }).lean();

    if (vendors.length === 0) {
      throw new Error('No active vendors found. Seed vendors first.');
    }

    const categories = Array.from({ length: 10 }, (_item, idx) => `category${idx + 1}`);
    const docs = [];

    for (let i = 1; i <= 100; i += 1) {
      const itemName = `item${i}`;
      const category = pickRandom(categories);
      const repeats = randomIntInclusive(1, 3);

      for (let r = 1; r <= repeats; r += 1) {
        const vendor = pickRandom(vendors);

        docs.push({
          name: itemName,
          reference: buildReference(i, r),
          price: randomPriceEur(),
          category,
          vendorId: vendor._id
        });
      }
    }

    const result = await Merchandise.insertMany(docs, { ordered: false });

    const byCategory = result.reduce((acc, doc) => {
      acc[doc.category] = (acc[doc.category] ?? 0) + 1;
      return acc;
    }, {});

    console.log('Merchandise seed complete.');
    console.log(`Inserted documents: ${result.length}`);
    console.log('Currency: EUR (prices stored in euro units)');
    console.log(`Categories used: ${Object.keys(byCategory).length}`);
    console.log(`Per-category counts: ${JSON.stringify(byCategory)}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
