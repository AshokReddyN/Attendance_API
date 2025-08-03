const express = require('express');
const {
  createEvent,
  cloneEvent,
  updateEvent,
  closeEvent,
} = require('../controllers/eventsController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.post('/', protect, authorize('admin'), createEvent);
router.post('/clone', protect, authorize('admin'), cloneEvent);
router.put('/:id', protect, authorize('admin'), updateEvent);
router.post('/:id/close', protect, authorize('admin'), closeEvent);

module.exports = router;
