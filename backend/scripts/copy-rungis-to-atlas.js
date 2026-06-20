import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const DEFAULT_SOURCE_URL = ['mongodb://192.168.1.80:27017', '/rungis'].join('');
const DEFAULT_TARGET_URL = [
  'mongodb+srv://',
  'laurent@',
  ':',
  'JeA77Dx8MOItdoPF',
  '@cluster0.ewchd67.mongodb.net/?appName=Cluster0'
].join('');
const DEFAULT_BATCH_SIZE = 1000;
const DEFAULT_CONNECT_TIMEOUT_MS = 10000;
const INTERNAL_COLLECTION_PREFIXES = ['system.'];

function usage() {
  console.log(`Copy the complete local Rungis MongoDB database to MongoDB Atlas.

Usage:
  node backend/scripts/copy-rungis-to-atlas.js --dry-run
  node backend/scripts/copy-rungis-to-atlas.js --yes

Options:
  --dry-run                    Inspect source collections and print the copy plan; no Atlas writes.
  --yes                        Required for write mode to avoid accidental destructive copies.
  --source-url <url>           Source MongoDB URL, default ${sanitizeMongoUrlForLog(DEFAULT_SOURCE_URL)}.
  --target-url <url>           Target MongoDB URL, default ${sanitizeMongoUrlForLog(DEFAULT_TARGET_URL)}.
  --source-db <name>           Source database name, default from source URL path.
  --target-db <name>           Target database name, default source database name.
  --batch-size <count>         Documents per insert batch, default ${DEFAULT_BATCH_SIZE}.
  --connect-timeout-ms <ms>    MongoDB connect/server-selection timeout, default ${DEFAULT_CONNECT_TIMEOUT_MS}.
  --limit-collections <count>  Process only the first N source collections; 0 is a connection/config check.
  --keep-target-db             Do not drop the target database before copying. Source collections are still replaced.
  --check-connections          In dry-run mode, also connect to Atlas and run ping.
  --help, -h                   Show this help message.

Environment:
  MONGO_SOURCE_URL             Overrides the default source URL.
  MONGO_ATLAS_URL              Overrides the default Atlas target URL.

Write-mode behavior:
  - requires --yes;
  - drops the target database first unless --keep-target-db is set;
  - recreates source collections and views in Atlas;
  - copies all documents while preserving _id values;
  - recreates non-_id indexes after document copy.
`);
}

function parseNonNegativeInteger(value, optionName, defaultValue) {
  if (value === undefined) return defaultValue;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${optionName} must be a non-negative integer.`);
  }
  return parsed;
}

function parsePositiveInteger(value, optionName, defaultValue) {
  if (value === undefined) return defaultValue;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${optionName} must be a positive integer.`);
  }
  return parsed;
}

function parseOptions(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      'dry-run': { type: 'boolean', default: false },
      yes: { type: 'boolean', default: false },
      'source-url': { type: 'string' },
      'target-url': { type: 'string' },
      'source-db': { type: 'string' },
      'target-db': { type: 'string' },
      'batch-size': { type: 'string' },
      'connect-timeout-ms': { type: 'string' },
      'limit-collections': { type: 'string' },
      'keep-target-db': { type: 'boolean', default: false },
      'check-connections': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false }
    },
    strict: true,
    allowPositionals: false
  });

  const sourceUrl = values['source-url'] ?? process.env.MONGO_SOURCE_URL ?? DEFAULT_SOURCE_URL;
  const targetUrl = values['target-url'] ?? process.env.MONGO_ATLAS_URL ?? DEFAULT_TARGET_URL;
  const sourceDb = values['source-db'] ?? extractDbNameFromMongoUrl(sourceUrl) ?? 'rungis';
  const targetDb = values['target-db'] ?? extractDbNameFromMongoUrl(targetUrl) ?? sourceDb;

  return {
    dryRun: values['dry-run'],
    yes: values.yes,
    help: values.help,
    sourceUrl,
    targetUrl,
    sourceDb,
    targetDb,
    batchSize: parsePositiveInteger(values['batch-size'], '--batch-size', DEFAULT_BATCH_SIZE),
    connectTimeoutMs: parsePositiveInteger(values['connect-timeout-ms'], '--connect-timeout-ms', DEFAULT_CONNECT_TIMEOUT_MS),
    limitCollections: parseNonNegativeInteger(values['limit-collections'], '--limit-collections'),
    checkConnections: values['check-connections'],
    replaceTargetDb: !values['keep-target-db']
  };
}

function extractDbNameFromMongoUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const dbName = url.pathname.replace(/^\//, '').trim();
    return dbName || undefined;
  } catch {
    return undefined;
  }
}

function sanitizeMongoUrlForLog(rawValue) {
  const value = String(rawValue);
  try {
    const url = new URL(value);
    if (url.username || url.password) {
      return `${url.protocol}//[credentials-redacted]${url.host}${url.pathname}${url.search}`;
    }
  } catch {
    // Fall through to simple masking for non-standard values.
  }
  return value.includes('@') ? value.replace(/\/\/[^/@]+@/, '//[credentials-redacted]') : value;
}

function isUserCollection(collectionInfo) {
  return !INTERNAL_COLLECTION_PREFIXES.some((prefix) => collectionInfo.name.startsWith(prefix));
}

function createMongoClient(url, options) {
  return new MongoClient(url, {
    serverSelectionTimeoutMS: options.connectTimeoutMs,
    connectTimeoutMS: options.connectTimeoutMs
  });
}

function getServerSelectionDetails(error) {
  if (!error?.reason?.servers) return '';

  const details = [];
  for (const [address, server] of error.reason.servers) {
    details.push(`${address}: ${server.type}${server.error?.message ? ` (${server.error.message})` : ''}`);
  }
  return details.length > 0 ? `\n  Server details: ${details.join('; ')}` : '';
}

function formatMongoConnectionError(error, label, url) {
  const safeUrl = sanitizeMongoUrlForLog(url);
  const atlasHint = url.startsWith('mongodb+srv://')
    ? '\n  Atlas hint: this usually means the current public IP is not allowed in Atlas Network Access, or outbound TCP 27017 is blocked. Add your current IPv4 (check with `curl -4 https://ifconfig.me`) to the Atlas IP access list, then retry.'
    : '';

  return [
    `Unable to connect to ${label} MongoDB: ${safeUrl}`,
    `  ${error.name}: ${error.message}`,
    getServerSelectionDetails(error),
    atlasHint
  ].filter(Boolean).join('\n');
}

async function connectAndPing(client, label, url, dbName) {
  try {
    await client.connect();
    await client.db(dbName).command({ ping: 1 });
    console.log(`${label} MongoDB connection OK.`);
  } catch (error) {
    throw new Error(formatMongoConnectionError(error, label, url), { cause: error });
  }
}

function sanitizeCollectionOptions(options = {}) {
  const sanitized = { ...options };
  delete sanitized.uuid;
  return sanitized;
}

function sanitizeIndexSpec(index) {
  const sanitized = { ...index };
  delete sanitized.v;
  delete sanitized.ns;
  return sanitized;
}

async function listSourceCollections(sourceDb, limitCollections) {
  const allCollections = await sourceDb.listCollections({}, { nameOnly: false }).toArray();
  const collections = allCollections
    .filter(isUserCollection)
    .sort((left, right) => {
      if (left.type === right.type) return left.name.localeCompare(right.name);
      return left.type === 'view' ? 1 : -1;
    });

  if (limitCollections === undefined) return collections;
  return collections.slice(0, limitCollections);
}

async function estimateCollection(sourceDb, collectionInfo) {
  if (collectionInfo.type === 'view') {
    return { documentCount: null, indexCount: 0 };
  }

  const collection = sourceDb.collection(collectionInfo.name);
  const [documentCount, indexes] = await Promise.all([
    collection.estimatedDocumentCount(),
    collection.listIndexes().toArray()
  ]);

  return {
    documentCount,
    indexCount: indexes.filter((index) => index.name !== '_id_').length
  };
}

async function printDryRunPlan(sourceDb, options, collections) {
  console.log('Dry-run plan:');
  console.log(`  Source: ${sanitizeMongoUrlForLog(options.sourceUrl)} database=${options.sourceDb}`);
  console.log(`  Target: ${sanitizeMongoUrlForLog(options.targetUrl)} database=${options.targetDb}`);
  console.log(`  Target database action: ${options.replaceTargetDb ? 'drop then recreate' : 'keep database, replace copied collections'}`);
  console.log(`  Collections selected: ${collections.length}`);

  let totalDocuments = 0;
  for (const collectionInfo of collections) {
    const estimate = await estimateCollection(sourceDb, collectionInfo);
    if (estimate.documentCount !== null) totalDocuments += estimate.documentCount;
    const countLabel = estimate.documentCount === null ? 'view' : `${estimate.documentCount} docs`;
    console.log(`  - ${collectionInfo.name} (${collectionInfo.type ?? 'collection'}): ${countLabel}, ${estimate.indexCount} non-_id indexes`);
  }

  console.log(`  Estimated documents to copy: ${totalDocuments}`);
}

async function recreateCollection(targetDb, collectionInfo) {
  const options = sanitizeCollectionOptions(collectionInfo.options ?? {});
  await targetDb.collection(collectionInfo.name).drop().catch((error) => {
    if (error.codeName !== 'NamespaceNotFound') throw error;
  });
  await targetDb.createCollection(collectionInfo.name, options);
}

async function recreateView(targetDb, collectionInfo) {
  const options = sanitizeCollectionOptions(collectionInfo.options ?? {});
  await targetDb.collection(collectionInfo.name).drop().catch((error) => {
    if (error.codeName !== 'NamespaceNotFound') throw error;
  });
  await targetDb.createCollection(collectionInfo.name, options);
}

async function copyDocuments({ sourceDb, targetDb, collectionName, batchSize }) {
  const sourceCollection = sourceDb.collection(collectionName);
  const targetCollection = targetDb.collection(collectionName);
  const cursor = sourceCollection.find({}, { noCursorTimeout: true }).batchSize(batchSize);

  let copiedCount = 0;
  let batch = [];

  try {
    for await (const document of cursor) {
      batch.push(document);
      if (batch.length >= batchSize) {
        await targetCollection.insertMany(batch, { ordered: true });
        copiedCount += batch.length;
        batch = [];
      }
    }

    if (batch.length > 0) {
      await targetCollection.insertMany(batch, { ordered: true });
      copiedCount += batch.length;
    }
  } finally {
    await cursor.close();
  }

  return copiedCount;
}

async function recreateIndexes(sourceDb, targetDb, collectionName) {
  const sourceCollection = sourceDb.collection(collectionName);
  const targetCollection = targetDb.collection(collectionName);
  const indexes = (await sourceCollection.listIndexes().toArray())
    .filter((index) => index.name !== '_id_')
    .map(sanitizeIndexSpec);

  if (indexes.length === 0) return 0;
  await targetCollection.createIndexes(indexes);
  return indexes.length;
}

async function copyDatabase(options) {
  if (!options.dryRun && !options.yes) {
    throw new Error('Write mode is destructive on the Atlas target. Re-run with --yes, or use --dry-run first.');
  }

  console.log(`Source: ${sanitizeMongoUrlForLog(options.sourceUrl)} database=${options.sourceDb}`);
  console.log(`Target: ${sanitizeMongoUrlForLog(options.targetUrl)} database=${options.targetDb}`);
  console.log(`Mode: ${options.dryRun ? 'dry-run (no writes)' : 'write'}`);

  const sourceClient = createMongoClient(options.sourceUrl, options);
  const shouldConnectTarget = !options.dryRun || options.checkConnections;
  const targetClient = shouldConnectTarget ? createMongoClient(options.targetUrl, options) : null;

  try {
    await connectAndPing(sourceClient, 'source', options.sourceUrl, options.sourceDb);
    if (targetClient) {
      await connectAndPing(targetClient, 'target', options.targetUrl, options.targetDb);
    }

    const sourceDb = sourceClient.db(options.sourceDb);
    const targetDb = targetClient?.db(options.targetDb);
    const collections = await listSourceCollections(sourceDb, options.limitCollections);

    if (options.dryRun) {
      await printDryRunPlan(sourceDb, options, collections);
      return;
    }

    if (options.replaceTargetDb) {
      console.log(`Dropping target database ${options.targetDb} before copy...`);
      await targetDb.dropDatabase();
    }

    const normalCollections = collections.filter((collection) => collection.type !== 'view');
    const views = collections.filter((collection) => collection.type === 'view');

    let copiedCollections = 0;
    let copiedDocuments = 0;
    let recreatedIndexes = 0;

    for (const collectionInfo of normalCollections) {
      console.log(`\nCopying collection ${collectionInfo.name}...`);
      await recreateCollection(targetDb, collectionInfo);
      const documentCount = await copyDocuments({
        sourceDb,
        targetDb,
        collectionName: collectionInfo.name,
        batchSize: options.batchSize
      });
      const indexCount = await recreateIndexes(sourceDb, targetDb, collectionInfo.name);
      copiedCollections += 1;
      copiedDocuments += documentCount;
      recreatedIndexes += indexCount;
      console.log(`  copied ${documentCount} document(s), recreated ${indexCount} non-_id index(es)`);
    }

    for (const viewInfo of views) {
      console.log(`\nRecreating view ${viewInfo.name}...`);
      await recreateView(targetDb, viewInfo);
      copiedCollections += 1;
    }

    console.log(`\nDone. Collections/views copied: ${copiedCollections}. Documents copied: ${copiedDocuments}. Non-_id indexes recreated: ${recreatedIndexes}.`);
  } finally {
    await sourceClient.close();
    if (targetClient) await targetClient.close();
  }
}

async function main() {
  const options = parseOptions();
  if (options.help) {
    usage();
    return;
  }

  await copyDatabase(options);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
