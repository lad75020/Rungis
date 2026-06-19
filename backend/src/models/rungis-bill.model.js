import mongoose from 'mongoose';

const partySnapshotSchema = new mongoose.Schema(
  {
    organisation: { type: String, required: true, trim: true },
    logoFilename: { type: String, trim: true, default: '' },
    city: { type: String, required: true, trim: true },
    zipcode: { type: String, required: true, trim: true },
    physicalAddress: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    businessRegistrationId: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: '' },
    vatId: { type: String, trim: true, uppercase: true, default: '' }
  },
  { _id: false }
);

const moneyField = {
  type: Number,
  required: true,
  validate: {
    validator(value) {
      return Number.isFinite(value) && Math.round(value * 100) === value * 100;
    },
    message: 'Amount must be finite and rounded to cents.'
  }
};

const percentageField = {
  type: Number,
  required: true,
  min: 0,
  max: 100
};

const rungisBillSchema = new mongoose.Schema(
  {
    applicableYear: { type: Number, required: true, min: 2000, max: 9999 },
    applicableMonth: { type: Number, required: true, min: 1, max: 12 },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    role: { type: String, required: true, enum: ['vendor', 'client'] },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userUniqueId: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator(value) {
          return /^\d{5}$/.test(value);
        },
        message: 'User unique id must be exactly 5 digits.'
      }
    },
    userOrganisationName: { type: String, required: true, trim: true },
    grossAmountBeforeTax: moneyField,
    rungisFeeRate: percentageField,
    payableAmountBeforeTax: moneyField,
    vatRate: percentageField,
    vatAmount: moneyField,
    payableAmountIncludingVat: moneyField,
    currency: { type: String, required: true, trim: true, uppercase: true, default: 'EUR' },
    paid: { type: Boolean, required: true, default: false },
    paidAt: { type: Date, default: null },
    paidByAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    generatedAt: { type: Date, required: true, default: Date.now },
    adminPartySnapshot: { type: partySnapshotSchema, required: true },
    userPartySnapshot: { type: partySnapshotSchema, required: true }
  },
  {
    timestamps: true,
    collection: 'rungisbills'
  }
);

rungisBillSchema.index(
  { applicableYear: 1, applicableMonth: 1, role: 1, userUniqueId: 1 },
  { unique: true }
);
rungisBillSchema.index({ paid: 1, applicableYear: 1, applicableMonth: 1, userOrganisationName: 1 });
rungisBillSchema.index({ userId: 1, role: 1, paid: 1, applicableYear: -1, applicableMonth: -1 });

export const RungisBill = mongoose.model('RungisBill', rungisBillSchema);
