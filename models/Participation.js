const mongoose = require('mongoose');

const ParticipationSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.ObjectId,
    ref: 'Event',
    required: true,
  },
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
  },
  optedInAt: {
    type: Date,
    default: Date.now,
  },
});

ParticipationSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
    // Keep the original field names for event and user
    returnedObject.eventId = returnedObject.event.toString();
    returnedObject.userId = returnedObject.user.toString();
    delete returnedObject.event;
    delete returnedObject.user;
  },
});

module.exports = mongoose.model('Participation', ParticipationSchema);
