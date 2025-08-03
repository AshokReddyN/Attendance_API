const Event = require('../models/Event');

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
