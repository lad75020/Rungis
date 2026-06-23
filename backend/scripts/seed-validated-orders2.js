import path from 'node:path';
import { randomInt } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import mongoose from 'mongoose';

import { Merchandise } from '../src/models/merchandise.model.js';
import { User } from '../src/models/user.model.js';
import { ValidatedOrder } from '../src/models/validated-order.model.js';
import {
  calculateLineTotalIncludingVat,
  calculatePriceIncludingVat,
  getVatCategory,
  getVatExemptionReason,
  normalizeVatRate,
  roundMoney
} from '../src/utils/vat.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load backend/.env when the script is executed from any working directory.
dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const DEFAULT_MONGO_URL = 'mongodb://192.168.1.80:27017/rungis';
const mongoUrl = process.env.SEED_VALIDATED_ORDERS2_MONGO_URL ?? DEFAULT_MONGO_URL;
const TARGET_COLLECTION = 'validatedorders2';
const DEFAULT_ORDER_COUNT = 500;
const MIN_ITEMS_PER_ORDER = 1;
const MAX_ITEMS_PER_ORDER = 8;
const MIN_QUANTITY = 1;
const MAX_QUANTITY = 10;
const DATE_RANGE_START_UTC = Date.UTC(2026, 5, 1, 0, 0, 0, 0);
const DATE_RANGE_END_UTC = Date.UTC(2026, 5, 21, 23, 59, 59, 999);

const ValidatedOrder2 = mongoose.model(
  'ValidatedOrderSeedValidatedOrders2',
  ValidatedOrder.schema,
  TARGET_COLLECTION
);

function usage() {
  console.log(`Seed random validated order documents into ${TARGET_COLLECTION}.

Usage:
  node backend/scripts/seed-validated-orders2.js [--count 500] [--dry-run]

Options:
  --count <number>  Number of validated order documents to create. Default: ${DEFAULT_ORDER_COUNT}.
  --dry-run         Build and validate documents, but do not insert them.
  --help, -h        Show this help message.

Environment:
  SEED_VALIDATED_ORDERS2_MONGO_URL  Optional MongoDB URL override.

MongoDB URL: ${mongoUrl}
Date range: 2026-06-01T00:00:00.000Z to 2026-06-21T23:59:59.999Z
Target collection: ${TARGET_COLLECTION}`);
}

function parseArgs(argv) {
  const options = {
    count: DEFAULT_ORDER_COUNT,
    dryRun: false,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (arg === '--count') {
      const rawCount = argv[index + 1];
      const parsedCount = Number(rawCount);
      if (!Number.isInteger(parsedCount) || parsedCount < 0) {
        throw new Error('--count must be a non-negative integer.');
      }
      options.count = parsedCount;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function pickRandom(array) {
  return array[randomInt(0, array.length)];
}

function shuffle(array) {
  const copy = [...array];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index + 1);
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function randomDateInRange() {
  const timestamp = randomInt(DATE_RANGE_START_UTC, DATE_RANGE_END_UTC + 1);
  return new Date(timestamp);
}

function addUtcDays(date, amount) {
  const shifted = new Date(date);
  shifted.setUTCDate(shifted.getUTCDate() + amount);
  return shifted;
}

function buildVendorNameById(vendors) {
  return new Map(
    vendors.map((vendor) => [
      vendor._id.toString(),
      vendor.organisation || vendor.username || vendor._id.toString()
    ])
  );
}

function buildOrderItems(merchandises, vendorNameById) {
  const itemCount = randomInt(MIN_ITEMS_PER_ORDER, Math.min(MAX_ITEMS_PER_ORDER, merchandises.length) + 1);
  const selectedMerchandises = shuffle(merchandises).slice(0, itemCount);

  return selectedMerchandises.map((merchandise) => {
    const quantity = randomInt(MIN_QUANTITY, MAX_QUANTITY + 1);
    const unitPrice = roundMoney(merchandise.price);
    const vatRate = normalizeVatRate(merchandise.vatRate);
    const lineTotal = roundMoney(unitPrice * quantity);
    const unitPriceIncludingVat = calculatePriceIncludingVat(unitPrice, vatRate);
    const lineTotalIncludingVat = calculateLineTotalIncludingVat(lineTotal, vatRate);
    const vendorId = merchandise.vendorId;

    return {
      merchandiseId: merchandise._id,
      name: merchandise.name,
      reference: merchandise.reference,
      category: merchandise.category,
      vendorId,
      vendorName: vendorNameById.get(vendorId.toString()) ?? vendorId.toString(),
      unitPrice,
      vatRate,
      unitPriceIncludingVat,
      quantity,
      lineTotal,
      lineTotalIncludingVat,
      vatCategory: getVatCategory(vatRate),
      vatExemptionReason: getVatExemptionReason(vatRate)
    };
  });
}

function buildValidatedOrder({ clients, merchandises, vendorNameById }) {
  const client = pickRandom(clients);
  const createdAt = randomDateInRange();
  const deliveryDate = addUtcDays(createdAt, randomInt(0, 4));
  const items = buildOrderItems(merchandises, vendorNameById);

  return {
    clientId: client._id,
    clientUsername: client.username,
    validatedAt: createdAt,
    deliveryDate,
    currency: 'EUR',
    items,
    grandTotal: roundMoney(items.reduce((sum, item) => sum + item.lineTotal, 0)),
    grandTotalIncludingVat: roundMoney(
      items.reduce((sum, item) => sum + item.lineTotalIncludingVat, 0)
    ),
    createdAt,
    updatedAt: createdAt
  };
}

async function loadSeedInputs() {
  const [clients, activeVendors] = await Promise.all([
    User.find({ role: 'client', isActive: true })
      .select({ _id: 1, username: 1 })
      .lean(),
    User.find({ role: 'vendor', isActive: true })
      .select({ _id: 1, username: 1, organisation: 1 })
      .lean()
  ]);

  if (clients.length === 0) {
    throw new Error('No active clients found in users collection.');
  }

  if (activeVendors.length === 0) {
    throw new Error('No active vendors found in users collection.');
  }

  const activeVendorIds = activeVendors.map((vendor) => vendor._id);
  const merchandises = await Merchandise.find({ vendorId: { $in: activeVendorIds } })
    .select({ _id: 1, name: 1, reference: 1, category: 1, price: 1, vatRate: 1, vendorId: 1 })
    .lean();

  if (merchandises.length === 0) {
    throw new Error('No merchandises found for active vendors in merchandises collection.');
  }

  return {
    clients,
    activeVendors,
    merchandises,
    vendorNameById: buildVendorNameById(activeVendors)
  };
}

function summarizeDocuments(docs) {
  const uniqueClientIds = new Set(docs.map((doc) => doc.clientId.toString()));
  const uniqueVendorIds = new Set(
    docs.flatMap((doc) => doc.items.map((item) => item.vendorId.toString()))
  );
  const totalItems = docs.reduce((sum, doc) => sum + doc.items.length, 0);
  const minCreatedAt = docs.reduce(
    (min, doc) => (doc.createdAt < min ? doc.createdAt : min),
    docs[0]?.createdAt ?? new Date(DATE_RANGE_START_UTC)
  );
  const maxCreatedAt = docs.reduce(
    (max, doc) => (doc.createdAt > max ? doc.createdAt : max),
    docs[0]?.createdAt ?? new Date(DATE_RANGE_START_UTC)
  );

  return {
    documents: docs.length,
    uniqueClients: uniqueClientIds.size,
    uniqueVendors: uniqueVendorIds.size,
    totalItems,
    minCreatedAt: minCreatedAt.toISOString(),
    maxCreatedAt: maxCreatedAt.toISOString()
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    usage();
    return;
  }

  await mongoose.connect(mongoUrl, { serverSelectionTimeoutMS: 5000 });

  try {
    const seedInputs = await loadSeedInputs();
    const docs = Array.from({ length: options.count }, () => buildValidatedOrder(seedInputs));

    for (const doc of docs) {
      await new ValidatedOrder2(doc).validate();
    }

    console.log(`Active clients available: ${seedInputs.clients.length}`);
    console.log(`Active vendors available: ${seedInputs.activeVendors.length}`);
    console.log(`Merchandises available from active vendors: ${seedInputs.merchandises.length}`);
    console.log(`Prepared validated order documents: ${docs.length}`);
    console.log(`Summary: ${JSON.stringify(summarizeDocuments(docs))}`);

    if (options.dryRun) {
      console.log('Dry run enabled; no database writes were performed.');
      return;
    }

    if (docs.length === 0) {
      console.log('No documents requested; nothing was inserted.');
      return;
    }

    const result = await ValidatedOrder2.collection.insertMany(docs, { ordered: false });
    console.log(`Inserted documents into ${TARGET_COLLECTION}: ${result.insertedCount}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  if (error?.name === 'MongooseServerSelectionError') {
    console.error('Could not connect to MongoDB.');
    console.error(`Configured MongoDB URL: ${mongoUrl}`);
    console.error('Make sure MongoDB is reachable before executing this script.');
  } else {
    console.error(error);
  }
  process.exit(1);
});
