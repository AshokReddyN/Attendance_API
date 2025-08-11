const express = require('express');
const {
  getMonthlyPayments,
  updatePaymentStatus,
  getMyPaymentsHistory,
} = require('../controllers/paymentsController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/monthly', protect, authorize('admin'), getMonthlyPayments);
router.get('/me', protect, getMyPaymentsHistory);
router.post('/monthly/status', protect, authorize('admin'), updatePaymentStatus);

module.exports = router;
