import mongoose from 'mongoose';

const validatedOrderItemSchema = new mongoose.Schema(
  {
    merchandiseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchandise',
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    reference: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    category: {
      type: String,
      required: true,
      trim: true
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    vendorName: {
      type: String,
      required: true,
      trim: true
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0
    },
    vatRate: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0
    },
    unitPriceIncludingVat: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    lineTotal: {
      type: Number,
      required: true,
      min: 0
    },
    lineTotalIncludingVat: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    vatCategory: {
      type: String,
      trim: true,
      default: 'O'
    },
    vatExemptionReason: {
      type: String,
      trim: true,
      default: ''
    }
  },
  {
    _id: false
  }
);

const validatedOrderSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    clientUsername: {
      type: String,
      required: true,
      trim: true
    },
    validatedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },
    deliveryDate: {
      type: Date,
      required: true,
      index: true
    },
    currency: {
      type: String,
      required: true,
      default: 'EUR',
      trim: true,
      uppercase: true
    },
    items: {
      type: [validatedOrderItemSchema],
      default: []
    },
    grandTotal: {
      type: Number,
      required: true,
      min: 0
    },
    grandTotalIncludingVat: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    }
  },
  {
    timestamps: true,
    collection: 'validatedorders'
  }
);

validatedOrderSchema.index({ clientId: 1, validatedAt: -1 });
validatedOrderSchema.index({ clientId: 1, deliveryDate: 1, validatedAt: -1 });
validatedOrderSchema.index({ 'items.vendorId': 1, validatedAt: -1 });

export const ValidatedOrder = mongoose.model('ValidatedOrder', validatedOrderSchema);
