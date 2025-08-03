const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
  },
  month: {
    type: String,
    required: true, // e.g., "2025-08"
  },
  totalAmount: {
    type: Number,
    required: true,
  },
  paymentStatus: {
    type: String,
    enum: ['Paid', 'Unpaid'],
    default: 'Unpaid',
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

PaymentSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
    returnedObject.userId = returnedObject.user.toString();
    delete returnedObject.user;
  },
});

module.exports = mongoose.model('Payment', PaymentSchema);
