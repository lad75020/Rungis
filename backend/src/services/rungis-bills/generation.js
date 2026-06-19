import mongoose from 'mongoose';
import {
  calculatePercentageAmount,
  getPreviousUtcCalendarMonth,
  parseRungisMonth,
  roundMoney
} from './settings.js';
import { normalizePartySnapshot, mapRungisBillSummary } from './invoice-data.js';

function ensureObjectId(value, label) {
  const id = String(value ?? '');
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error(`${label} is invalid.`);
  }
  return new mongoose.Types.ObjectId(id);
}

function buildAmounts(grossAmountBeforeTax, rungisFeeRate, vatRate) {
  const gross = roundMoney(grossAmountBeforeTax);
  const payableAmountBeforeTax = calculatePercentageAmount(gross, rungisFeeRate);
  const vatAmount = calculatePercentageAmount(payableAmountBeforeTax, vatRate);
  return {
    grossAmountBeforeTax: gross,
    payableAmountBeforeTax,
    vatAmount,
    payableAmountIncludingVat: roundMoney(payableAmountBeforeTax + vatAmount)
  };
}

async function getUsersByIds(User, ids) {
  const uniqueIds = [...new Set(ids.map((id) => String(id)).filter(Boolean))];
  const users = await User.find({ _id: { $in: uniqueIds } }).lean();
  return new Map(users.map((user) => [String(user._id), user]));
}

async function aggregateVendorTotals(ValidatedOrder, periodStart, periodEnd) {
  return ValidatedOrder.aggregate([
    { $match: { validatedAt: { $gte: periodStart, $lt: periodEnd } } },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.vendorId',
        grossAmountBeforeTax: { $sum: '$items.lineTotal' }
      }
    },
    { $match: { grossAmountBeforeTax: { $gt: 0 } } }
  ]);
}

async function aggregateClientTotals(ValidatedOrder, periodStart, periodEnd) {
  return ValidatedOrder.aggregate([
    { $match: { validatedAt: { $gte: periodStart, $lt: periodEnd } } },
    {
      $group: {
        _id: '$clientId',
        grossAmountBeforeTax: { $sum: '$grandTotal' }
      }
    },
    { $match: { grossAmountBeforeTax: { $gt: 0 } } }
  ]);
}

export async function generateRungisBillsForPreviousMonth({
  RungisBill,
  User,
  ValidatedOrder,
  adminUserId,
  settings,
  referenceDate = new Date()
}) {
  if (!settings?.configured) {
    const error = new Error('Rungis fee and VAT rates must be configured before generation.');
    error.statusCode = 409;
    throw error;
  }

  const period = getPreviousUtcCalendarMonth(referenceDate);
  const adminUser = await User.findById(adminUserId).lean();
  const adminPartySnapshot = normalizePartySnapshot(adminUser);
  if (!adminPartySnapshot) {
    const error = new Error('Admin invoice identity is missing.');
    error.statusCode = 422;
    throw error;
  }

  const [vendorTotals, clientTotals] = await Promise.all([
    aggregateVendorTotals(ValidatedOrder, period.periodStart, period.periodEnd),
    aggregateClientTotals(ValidatedOrder, period.periodStart, period.periodEnd)
  ]);
  const totals = [
    ...vendorTotals.map((row) => ({ role: 'vendor', userId: row._id, grossAmountBeforeTax: row.grossAmountBeforeTax })),
    ...clientTotals.map((row) => ({ role: 'client', userId: row._id, grossAmountBeforeTax: row.grossAmountBeforeTax }))
  ];

  const usersById = await getUsersByIds(User, totals.map((row) => row.userId));
  let generated = 0;
  let updated = 0;
  let skippedPaid = 0;
  let skippedMissingIdentity = 0;

  for (const total of totals) {
    const user = usersById.get(String(total.userId));
    const userPartySnapshot = normalizePartySnapshot(user);
    if (!user?.uniqueId || !/^\d{5}$/.test(user.uniqueId) || !userPartySnapshot) {
      skippedMissingIdentity += 1;
      continue;
    }

    const filter = {
      applicableYear: period.applicableYear,
      applicableMonth: period.applicableMonth,
      role: total.role,
      userUniqueId: user.uniqueId
    };
    const existing = await RungisBill.findOne(filter).select({ paid: 1 }).lean();
    if (existing?.paid) {
      skippedPaid += 1;
      continue;
    }

    const amounts = buildAmounts(total.grossAmountBeforeTax, settings.rungisFeeRate, settings.vatRate);
    const update = {
      $set: {
        ...period,
        role: total.role,
        userId: user._id,
        userUniqueId: user.uniqueId,
        userOrganisationName: user.organisation,
        ...amounts,
        rungisFeeRate: settings.rungisFeeRate,
        vatRate: settings.vatRate,
        currency: 'EUR',
        generatedAt: new Date(),
        adminPartySnapshot,
        userPartySnapshot
      },
      $setOnInsert: {
        paid: false,
        paidAt: null,
        paidByAdminId: null
      }
    };
    const result = await RungisBill.updateOne(filter, update, { upsert: true });
    if (result.upsertedCount > 0) {
      generated += 1;
    } else {
      updated += 1;
    }
  }

  return {
    ...period,
    generated,
    updated,
    skippedPaid,
    skippedMissingIdentity,
    totalEligible: totals.length
  };
}

export async function searchUnpaidRungisBills({ RungisBill, month, organization = '' }) {
  const parsed = parseRungisMonth(month);
  if (!parsed) {
    const error = new Error('Month must use YYYY-MM format.');
    error.statusCode = 400;
    throw error;
  }
  const filter = {
    paid: false,
    applicableYear: parsed.applicableYear,
    applicableMonth: parsed.applicableMonth
  };
  const query = String(organization ?? '').trim();
  if (query) {
    filter.userOrganisationName = { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  }
  const bills = await RungisBill.find(filter).sort({ userOrganisationName: 1, role: 1 }).lean();
  return bills.map(mapRungisBillSummary);
}

export async function markRungisBillPaid({ RungisBill, billId, adminUserId }) {
  const id = ensureObjectId(billId, 'Bill id');
  const adminId = ensureObjectId(adminUserId, 'Admin id');
  const now = new Date();
  const bill = await RungisBill.findOneAndUpdate(
    { _id: id, paid: false },
    { $set: { paid: true, paidAt: now, paidByAdminId: adminId } },
    { new: true }
  ).lean();

  if (bill) {
    return { ok: true, alreadyPaid: false, bill: mapRungisBillSummary(bill) };
  }

  const existing = await RungisBill.findById(id).lean();
  if (existing?.paid) {
    return { ok: true, alreadyPaid: true, bill: mapRungisBillSummary(existing) };
  }
  const error = new Error('Rungis bill not found.');
  error.statusCode = 404;
  throw error;
}
