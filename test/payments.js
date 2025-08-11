const request = require('supertest');
const app = require('../server');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');
const Event = require('../models/Event');
const Participation = require('../models/Participation');
const Payment = require('../models/Payment');
const jwt = require('jsonwebtoken');

describe('Payments API', () => {
  let mongoServer;
  let adminToken;
  let memberToken;
  let user1, user2;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    const adminUser = await User.create({ name: 'Admin', email: 'admin@test.com', password: 'password', role: 'admin' });
    adminToken = jwt.sign({ id: adminUser._id, role: 'admin' }, process.env.JWT_SECRET);

    user1 = await User.create({ name: 'User One', email: 'user1@test.com', password: 'password' });
    memberToken = jwt.sign({ id: user1._id, role: 'member' }, process.env.JWT_SECRET);

    user2 = await User.create({ name: 'User Two', email: 'user2@test.com', password: 'password' });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Event.deleteMany({});
    await Participation.deleteMany({});
    await Payment.deleteMany({});
  });

  describe('GET /api/payments/monthly', () => {
    it('should return monthly payment summary for admin', async () => {
      const month = '2025-08';
      const event1 = await Event.create({ name: 'Event 1', price: 100, endAt: new Date('2025-08-05') });
      const event2 = await Event.create({ name: 'Event 2', price: 200, endAt: new Date('2025-08-15') });
      await Event.create({ name: 'Event 3', price: 50, endAt: new Date('2025-09-10') });

      await Participation.create({ event: event1._id, user: user1._id });
      await Participation.create({ event: event2._id, user: user1._id });
      await Participation.create({ event: event1._id, user: user2._id });

      await Payment.create({ user: user2._id, month, paymentStatus: 'Paid', totalAmount: 100 });

      const res = await request(app)
        .get(`/api/payments/monthly?month=${month}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.month).toBe(month);
      expect(res.body.payments).toHaveLength(2);

      const user1Payment = res.body.payments.find(p => p.userId === user1._id.toString());
      expect(user1Payment.userName).toBe('User One');
      expect(user1Payment.totalAmount).toBe(300);
      expect(user1Payment.paymentStatus).toBe('Unpaid');

      const user2Payment = res.body.payments.find(p => p.userId === user2._id.toString());
      expect(user2Payment.userName).toBe('User Two');
      expect(user2Payment.totalAmount).toBe(100);
      expect(user2Payment.paymentStatus).toBe('Paid');
    });

    it('should not allow member to access the route', async () => {
        const res = await request(app)
          .get('/api/payments/monthly?month=2025-08')
          .set('Authorization', `Bearer ${memberToken}`);

        expect(res.statusCode).toBe(403);
      });
  });

  describe('POST /api/payments/monthly/status', () => {
    it('should update payment status for a user', async () => {
      const month = '2025-08';
      const res = await request(app)
        .post('/api/payments/monthly/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: user1._id, month, paymentStatus: 'Paid' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.payment.paymentStatus).toBe('Paid');
      expect(res.body.payment.month).toBe(month);
      expect(res.body.payment.userId).toBe(user1._id.toString());

      const payment = await Payment.findOne({ user: user1._id, month });
      expect(payment.paymentStatus).toBe('Paid');
    });

    it('should not allow member to access the route', async () => {
        const res = await request(app)
          .post('/api/payments/monthly/status')
          .set('Authorization', `Bearer ${memberToken}`)
          .send({ userId: user1._id, month: '2025-08', paymentStatus: 'Paid' });

        expect(res.statusCode).toBe(403);
      });
  });

  describe('GET /api/payments/me/monthly', () => {
    it('should return monthly payment summary for the logged-in user', async () => {
      const month = '2025-08';
      const event1 = await Event.create({ name: 'Event 1', price: 100, endAt: new Date('2025-08-05') });
      const event2 = await Event.create({ name: 'Event 2', price: 200, endAt: new Date('2025-08-15') });
      await Event.create({ name: 'Event in another month', price: 50, endAt: new Date('2025-09-10') });

      await Participation.create({ event: event1._id, user: user1._id });
      await Participation.create({ event: event2._id, user: user1._id });
      // Participation for another user, should not be included
      await Participation.create({ event: event1._id, user: user2._id });

      await Payment.create({ user: user1._id, month, paymentStatus: 'Paid', totalAmount: 300 });

      const res = await request(app)
        .get(`/api/payments/me/monthly?month=${month}`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      const summary = res.body.data;
      expect(summary.userId).toBe(user1._id.toString());
      expect(summary.userName).toBe('User One');
      expect(summary.month).toBe(month);
      expect(summary.totalAmount).toBe(300);
      expect(summary.paymentStatus).toBe('Paid');
      expect(summary.events).toHaveLength(2);
      expect(summary.events[0].name).toBe('Event 1');
      expect(summary.events[1].name).toBe('Event 2');
    });

    it('should return 401 if user is not authenticated', async () => {
        const res = await request(app)
          .get('/api/payments/me/monthly?month=2025-08');

        expect(res.statusCode).toBe(401);
    });

    it('should return 400 if month parameter is missing', async () => {
        const res = await request(app)
          .get('/api/payments/me/monthly')
          .set('Authorization', `Bearer ${memberToken}`);

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('Month query parameter in YYYY-MM format is required');
    });

    it('should return 400 if month parameter is in invalid format', async () => {
        const res = await request(app)
          .get('/api/payments/me/monthly?month=202508')
          .set('Authorization', `Bearer ${memberToken}`);

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('Month query parameter in YYYY-MM format is required');
    });

    it('should return a summary with 0 total when there are no participations', async () => {
      const month = '2025-08';
      const res = await request(app)
        .get(`/api/payments/me/monthly?month=${month}`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      const summary = res.body.data;
      expect(summary.totalAmount).toBe(0);
      expect(summary.paymentStatus).toBe('Unpaid');
      expect(summary.events).toHaveLength(0);
    });
  });
});
