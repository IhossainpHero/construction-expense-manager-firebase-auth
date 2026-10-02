import mongoose from "mongoose";

const entrySchema = new mongoose.Schema(
  {
    partyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Party",
      required: true,
    },

    type: {
      type: String,
      trim: true,
    },

    date: {
      type: String,
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    productName: {
      type: String,
      trim: true,
    },

    quantity: {
      type: String,
      trim: true,
    },

    note: {
      type: String,
      trim: true,
    },

    method: {
      type: String,
      trim: true,
    },

    kind: {
      type: String,
      enum: ["bill", "payment"],
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("Entry", entrySchema);
