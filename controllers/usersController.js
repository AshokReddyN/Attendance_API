const Participation = require('../models/Participation');

// @desc    Get my participations
// @route   GET /api/users/me/participations
// @access  Private/Member
exports.getMyParticipations = async (req, res, next) => {
  try {
    const participations = await Participation.find({ user: req.user.id }).populate({
      path: 'event',
      select: 'name price endAt',
    });

    const formattedParticipations = participations.map((p) => ({
      eventId: p.event.id,
      eventName: p.event.name,
      price: p.event.price,
      optedInAt: p.optedInAt,
      eventDate: p.event.endAt.toISOString().split('T')[0],
    }));

    res.status(200).json({
      success: true,
      participations: formattedParticipations,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};
