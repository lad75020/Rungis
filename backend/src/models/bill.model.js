import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';

const billRefundLineSchema = new mongoose.Schema(
  {
    refundId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Refund',
      required: true
    },
    kind: {
      type: String,
      required: true,
      default: 'refund',
      enum: ['refund']
    },
    name: {
      type: String,
      required: true,
      trim: true,
      default: 'Refund'
    },
    reference: {
      type: String,
      trim: true,
      default: ''
    },
    category: {
      type: String,
      trim: true,
      default: 'Refund'
    },
    unitPrice: {
      type: Number,
      required: true
    },
    quantity: {
      type: Number,
      default: null
    },
    lineTotal: {
      type: Number,
      required: true
    },
    comment: {
      type: String,
      trim: true,
      default: '',
      maxlength: 32
    },
    createdAt: {
      type: Date,
      default: null
    }
  },
  {
    _id: false
  }
);

const billPenaltyLineSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      default: () => randomUUID()
    },
    kind: {
      type: String,
      required: true,
      default: 'penalty',
      enum: ['penalty']
    },
    name: {
      type: String,
      required: true,
      trim: true,
      default: 'Late payment penalty'
    },
    reference: {
      type: String,
      trim: true,
      default: ''
    },
    category: {
      type: String,
      trim: true,
      default: 'Penalty'
    },
    unitPrice: {
      type: Number,
      required: true
    },
    quantity: {
      type: Number,
      default: null
    },
    lineTotal: {
      type: Number,
      required: true
    },
    percentage: {
      type: Number,
      required: true,
      min: 1,
      max: 50
    },
    createdAt: {
      type: Date,
      default: null
    }
  },
  {
    _id: false
  }
);

const billSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      index: true
    },
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
    uuid: {
      type: String,
      required: true,
      unique: true,
      default: () => randomUUID()
    },
    vendorSettled: {
      type: Boolean,
      default: false
    },
    clientSettled: {
      type: Boolean,
      default: false
    },
    totalPrice: {
      type: Number,
      default: 0
    },
    totalQuantity: {
      type: Number,
      default: 0,
      min: 0
    },
    lineCount: {
      type: Number,
      default: 0,
      min: 0
    },
    currency: {
      type: String,
      default: 'EUR',
      trim: true,
      uppercase: true
    },
    orderedAt: {
      type: Date,
      default: null
    },
    clientComment: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1000
    },
    clientCommentSentAt: {
      type: Date,
      default: null
    },
    vendorMessageReadAt: {
      type: Date,
      default: null
    },
    vendorMessageDismissedAt: {
      type: Date,
      default: null
    },
    refundLines: {
      type: [billRefundLineSchema],
      default: []
    },
    penaltyLines: {
      type: [billPenaltyLineSchema],
      default: []
    }
  },
  {
    timestamps: true,
    collection: 'bills'
  }
);

billSchema.index({ date: 1, vendorId: 1, clientId: 1 }, { unique: true });

export const Bill = mongoose.model('Bill', billSchema);
