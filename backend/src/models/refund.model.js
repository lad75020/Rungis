import mongoose from 'mongoose';

const refundSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 32
    },
    currency: {
      type: String,
      required: true,
      default: 'EUR',
      trim: true,
      uppercase: true
    },
    appliedBillDate: {
      type: Date,
      default: null,
      index: true
    },
    appliedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    collection: 'refunds'
  }
);

refundSchema.index({ vendorId: 1, clientId: 1, appliedBillDate: 1, createdAt: -1 });

export const Refund = mongoose.model('Refund', refundSchema);
