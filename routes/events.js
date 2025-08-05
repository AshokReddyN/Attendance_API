const express = require('express');
const {
  createEvent,
  cloneEvent,
  updateEvent,
  closeEvent,
  getEvents,
  optInEvent,
  getEventParticipants,
} = require('../controllers/eventsController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, getEvents);
router.post('/', protect, authorize('admin'), createEvent);
router.post('/clone', protect, authorize('admin'), cloneEvent);
router.get(
  '/:eventId/participants',
  protect,
  authorize('admin'),
  getEventParticipants
);
router.put('/:id', protect, authorize('admin'), updateEvent);
router.post('/:id/close', protect, authorize('admin'), closeEvent);
router.post('/:id/optin', protect, authorize('member'), optInEvent);

module.exports = router;
