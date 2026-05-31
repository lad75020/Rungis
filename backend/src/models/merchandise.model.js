import mongoose from 'mongoose';

const merchandiseSchema = new mongoose.Schema(
  {
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
    price: {
      type: Number,
      required: true,
      min: 0
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 100
    },
    minimumStockThreshold: {
      type: Number,
      default: null,
      validate: {
        validator(value) {
          return value === null || (Number.isInteger(value) && value >= 0);
        },
        message: 'Minimum stock threshold must be a non-negative integer or null.'
      }
    },
    category: {
      type: String,
      required: true,
      trim: true
    },
    imageFilename: {
      type: String,
      trim: true,
      default: ''
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    }
  },
  {
    timestamps: true,
    collection: 'merchandises'
  }
);

merchandiseSchema.index({ category: 1, name: 1, reference: 1, vendorId: 1 }, { unique: true });
merchandiseSchema.index({ vendorId: 1, createdAt: -1 });

export const Merchandise = mongoose.model('Merchandise', merchandiseSchema);
