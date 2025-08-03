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
