const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name'],
  },
  price: {
    type: Number,
    required: [true, 'Please add a price'],
  },
  endAt: {
    type: Date,
    required: [true, 'Please add an end time'],
  },
  status: {
    type: String,
    enum: ['open', 'closed'],
    default: 'open',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Virtual for opt-in count
EventSchema.virtual('optInCount', {
  ref: 'Participation',
  localField: '_id',
  foreignField: 'event',
  count: true,
});

EventSchema.set('toJSON', {
  virtuals: true,
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
  },
});

EventSchema.set('toObject', {
  virtuals: true,
});

module.exports = mongoose.model('Event', EventSchema);
