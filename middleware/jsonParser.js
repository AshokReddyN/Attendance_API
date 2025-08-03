module.exports = (req, res, next) => {
  if (req.headers['content-type'] === 'application/json' && typeof req.body === 'string') {
    try {
      req.body = JSON.parse(req.body);
    } catch (e) {
      return res.status(400).json({ success: false, error: 'Invalid JSON' });
    }
  }
  next();
};
