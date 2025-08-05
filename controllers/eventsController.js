const Event = require('../models/Event');
const Participation = require('../models/Participation');

// @desc    Get events
// @route   GET /api/events
// @access  Private (Admin and Member)
exports.getEvents = async (req, res, next) => {
  try {
    let query;

    if (req.user.role === 'admin') {
      const { month } = req.query;
      const filter = {};

      if (month) {
        const year = parseInt(month.split('-')[0]);
        const monthIndex = parseInt(month.split('-')[1]) - 1;
        const startDate = new Date(year, monthIndex, 1);
        const endDate = new Date(year, monthIndex + 1, 1);
        filter.endAt = { $gte: startDate, $lt: endDate };
      }

      query = Event.find(filter);
    } else {
      // Member
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

      query = Event.find({
        status: 'open',
        endAt: { $gte: startOfDay, $lt: endOfDay },
      });
    }

    const events = await query.populate('optInCount');

    res.status(200).json({
      success: true,
      events,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// @desc    Get event participants
// @route   GET /api/events/:eventId/participants
// @access  Private/Admin
exports.getEventParticipants = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    const participations = await Participation.find({ event: eventId }).populate('user', 'name email');

    const participants = participations.map(p => ({
      userId: p.user._id,
      name: p.user.name,
      email: p.user.email,
      optedInAt: p.optedInAt
    }));

    return res.json({ success: true, eventId, participants });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// @desc    Opt-in to an event
// @route   POST /api/events/:id/optin
// @access  Private/Member
exports.optInEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    if (event.status !== 'open') {
      return res
        .status(400)
        .json({ success: false, error: 'Event is not open for opt-in' });
    }

    // Check if user has already opted in
    const existingParticipation = await Participation.findOne({
      event: req.params.id,
      user: req.user.id,
    });

    if (existingParticipation) {
      return res
        .status(400)
        .json({ success: false, error: 'Already opted in to this event' });
    }

    const participation = await Participation.create({
      event: req.params.id,
      user: req.user.id,
    });

    res.status(201).json({
      success: true,
      participation,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// @desc    Create new event
// @route   POST /api/events
// @access  Private/Admin
exports.createEvent = async (req, res, next) => {
  try {
    const { name, price, endAt } = req.body;

    const event = await Event.create({
      name,
      price,
      endAt,
    });

    res.status(201).json({
      success: true,
      event,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// @desc    Close an event
// @route   POST /api/events/:id/close
// @access  Private/Admin
exports.closeEvent = async (req, res, next) => {
  try {
    let event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    event.status = 'closed';
    await event.save();

    res.status(200).json({
      success: true,
      event,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// @desc    Update an event
// @route   PUT /api/events/:id
// @access  Private/Admin
exports.updateEvent = async (req, res, next) => {
  try {
    let event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    if (event.status === 'closed') {
      return res
        .status(400)
        .json({ success: false, error: 'Cannot update a closed event' });
    }

    event = await Event.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      event,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// @desc    Clone an existing event
// @route   POST /api/events/clone
// @access  Private/Admin
exports.cloneEvent = async (req, res, next) => {
  try {
    const { sourceEventId, newEndAt, name, price } = req.body;

    const sourceEvent = await Event.findById(sourceEventId);

    if (!sourceEvent) {
      return res
        .status(404)
        .json({ success: false, error: 'Source event not found' });
    }

    const newEvent = {
      name: name || sourceEvent.name,
      price: price || sourceEvent.price,
      endAt: newEndAt || sourceEvent.endAt,
      status: 'open',
    };

    const event = await Event.create(newEvent);

    res.status(201).json({
      success: true,
      event,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};
