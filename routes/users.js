const express = require('express');
const { getMyParticipations } = require('../controllers/usersController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.get(
  '/me/participations',
  protect,
  authorize('member'),
  getMyParticipations
);

module.exports = router;
