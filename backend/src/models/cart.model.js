import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema(
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
      required: true
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
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    lineTotal: {
      type: Number,
      required: true,
      min: 0
    }
  },
  {
    _id: false
  }
);

const cartSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    items: {
      type: [cartItemSchema],
      default: []
    }
  },
  {
    timestamps: true,
    collection: 'carts'
  }
);

export const Cart = mongoose.model('Cart', cartSchema);
