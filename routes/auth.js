const express = require('express');
const { register, login } = require('../controllers/authController');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/test', (req, res) => {
  res.json({ message: 'test route is working' });
});

module.exports = router;
