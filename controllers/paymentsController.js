const Participation = require('../models/Participation');
const Payment = require('../models/Payment');
const User = require('../models/User');
const mongoose = require('mongoose');

// @desc    Get monthly payment summary
// @route   GET /api/payments/monthly
// @access  Private/Admin
exports.getMonthlyPayments = async (req, res, next) => {
  try {
    const { month } = req.query;

    if (!month) {
      return res
        .status(400)
        .json({ success: false, error: 'Month query parameter is required' });
    }

    const year = parseInt(month.split('-')[0]);
    const monthIndex = parseInt(month.split('-')[1]) - 1;
    const startDate = new Date(year, monthIndex, 1);
    const endDate = new Date(year, monthIndex + 1, 1);

    const participations = await Participation.aggregate([
      {
        $lookup: {
          from: 'events',
          localField: 'event',
          foreignField: '_id',
          as: 'eventDetails',
        },
      },
      {
        $unwind: '$eventDetails',
      },
      {
        $match: {
          'eventDetails.endAt': { $gte: startDate, $lt: endDate },
        },
      },
      {
        $group: {
          _id: '$user',
          totalAmount: { $sum: '$eventDetails.price' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userDetails',
        },
      },
      {
        $unwind: '$userDetails',
      },
      {
        $project: {
          _id: 0,
          userId: '$_id',
          userName: '$userDetails.name',
          totalAmount: '$totalAmount',
        },
      },
    ]);

    const payments = await Payment.find({ month });
    const paymentMap = new Map(
      payments.map((p) => [p.user.toString(), p.paymentStatus])
    );

    const paymentSummary = participations.map((p) => ({
      ...p,
      paymentStatus: paymentMap.get(p.userId.toString()) || 'Unpaid',
    }));

    res.status(200).json({
      success: true,
      month,
      payments: paymentSummary,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// @desc    Update monthly payment status
// @route   POST /api/payments/monthly/status
// @access  Private/Admin
exports.updatePaymentStatus = async (req, res, next) => {
  try {
    const { userId, month, paymentStatus } = req.body;

    if (!userId || !month || !paymentStatus) {
      return res.status(400).json({
        success: false,
        error: 'userId, month, and paymentStatus are required',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const payment = await Payment.findOneAndUpdate(
      { user: userId, month },
      { paymentStatus, updatedAt: new Date() },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      payment,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};
