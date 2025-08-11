const express = require('express');
const {
  getMonthlyPayments,
  updatePaymentStatus,
  getMyMonthlyPayments,
} = require('../controllers/paymentsController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/monthly', protect, authorize('admin'), getMonthlyPayments);
router.get('/me/monthly', protect, getMyMonthlyPayments);
router.post('/monthly/status', protect, authorize('admin'), updatePaymentStatus);

module.exports = router;
