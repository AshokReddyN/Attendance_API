const express = require('express');
const { createEvent, cloneEvent } = require('../controllers/eventsController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.post('/', protect, authorize('admin'), createEvent);
router.post('/clone', protect, authorize('admin'), cloneEvent);

module.exports = router;
