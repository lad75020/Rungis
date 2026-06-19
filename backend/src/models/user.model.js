import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['vendor', 'client', 'admin'],
      required: true
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    organisation: {
      type: String,
      required: true,
      trim: true
    },
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    lastName: {
      type: String,
      required: true,
      trim: true
    },
    city: {
      type: String,
      required: true,
      trim: true
    },
    zipcode: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    physicalAddress: {
      type: String,
      required: true,
      trim: true
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true
    },
    businessDescription: {
      type: String,
      trim: true,
      default: '',
      maxlength: 2000
    },
    vatId: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
      validate: {
        validator(value) {
          return !value || value.length === 13;
        },
        message: 'VAT ID must be exactly 13 characters when provided.'
      }
    },
    billMentions: {
      type: String,
      trim: true,
      default: '',
      maxlength: 2000
    },
    logoFilename: {
      type: String,
      trim: true,
      default: ''
    },
    businessRegistrationId: {
      type: Number,
      required: true,
      validate: {
        validator(value) {
          return Number.isInteger(value) && value >= 1000000000000 && value <= 9999999999999;
        },
        message: 'SIRET must be a 13-digit integer.'
      }
    },
    passwordHash: {
      type: String,
      required: true
    },
    vendorIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        }
      ],
      default: []
    },
    clientIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        }
      ],
      default: []
    },
    favoriteMerchandiseIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Merchandise'
        }
      ],
      default: []
    },
    passkeys: {
      type: [
        {
          name: {
            type: String,
            required: true,
            default: 'Unknown device'
          },
          id: {
            type: String,
            required: true
          },
          publicKey: {
            type: String,
            required: true
          },
          counter: {
            type: Number,
            required: true,
            default: 0
          },
          transports: {
            type: [String],
            default: []
          },
          deviceType: {
            type: String,
            enum: ['singleDevice', 'multiDevice'],
            default: 'singleDevice'
          },
          backedUp: {
            type: Boolean,
            default: false
          },
          createdAt: {
            type: Date,
            default: Date.now
          },
          lastUsedAt: {
            type: Date,
            default: null
          }
        }
      ],
      default: []
    },
    isActive: {
      type: Boolean,
      required: true,
      default: false
    }
  },
  {
    timestamps: true
  }
);

userSchema.index({ role: 1, isActive: 1, username: 1 });
userSchema.index({ role: 1, isActive: 1, organisation: 1, username: 1 });

export const User = mongoose.model('User', userSchema);
