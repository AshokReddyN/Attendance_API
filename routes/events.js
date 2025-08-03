const express = require('express');
const { createEvent } = require('../controllers/eventsController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.post('/', protect, authorize('admin'), createEvent);

module.exports = router;
