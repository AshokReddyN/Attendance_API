const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const cors = require('cors'); // Add this line

// Load env vars
dotenv.config();

// Connect to database
if (process.env.NODE_ENV !== 'test') {
  connectDB();
}

const app = express();

// Enable CORS
app.use(cors()); // Add this line

// Body parser
app.use(express.json());

// Mount routers
const auth = require('./routes/auth');
const events = require('./routes/events');
const users = require('./routes/users');
const payments = require('./routes/payments');
app.use('/api/auth', auth);
app.use('/api/events', events);
app.use('/api/users', users);
app.use('/api/payments', payments);

app.get('/', (req, res) => {
  res.send('API is running...');
});

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  const server = app.listen(PORT, '0.0.0.0',() => {
    console.log(`Server running on port ${PORT}`);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err, promise) => {
    console.log(`Error: ${err.message}`);
    // Close server & exit process
    server.close(() => process.exit(1));
  });
}

module.exports = app;
