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
