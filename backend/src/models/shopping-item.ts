import { Schema, model } from 'mongoose';

const shoppingItemSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
    bought: { type: Boolean, required: true, default: false }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
    bufferCommands: false
  }
);

export const ShoppingItemModel = model('ShoppingItem', shoppingItemSchema);
