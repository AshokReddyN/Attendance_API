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

  describe('GET /api/payments/me', () => {
    it('should return the full payment history for the logged-in user, sorted by month desc', async () => {
      // Create events across different months
      const eventAug1 = await Event.create({ name: 'Event Aug 1', price: 100, endAt: new Date('2025-08-05') });
      const eventAug2 = await Event.create({ name: 'Event Aug 2', price: 150, endAt: new Date('2025-08-20') });
      const eventJul1 = await Event.create({ name: 'Event Jul 1', price: 200, endAt: new Date('2025-07-10') });
      const eventSep1 = await Event.create({ name: 'Event Sep 1', price: 50, endAt: new Date('2025-09-01') });

      // Create participations for the logged-in user (user1)
      await Participation.create({ event: eventAug1._id, user: user1._id });
      await Participation.create({ event: eventAug2._id, user: user1._id });
      await Participation.create({ event: eventJul1._id, user: user1._id });
      await Participation.create({ event: eventSep1._id, user: user1._id });

      // Participation for another user, should not be included
      await Participation.create({ event: eventAug1._id, user: user2._id });

      // Create payment records for some months
      await Payment.create({ user: user1._id, month: '2025-07', paymentStatus: 'Paid', totalAmount: 200 });
      await Payment.create({ user: user1._id, month: '2025-09', paymentStatus: 'Paid', totalAmount: 50 });

      const res = await request(app)
        .get('/api/payments/me')
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      const history = res.body.data;
      expect(history).toHaveLength(3);

      // Check sorting (latest month first)
      expect(history[0].month).toBe('2025-09');
      expect(history[1].month).toBe('2025-08');
      expect(history[2].month).toBe('2025-07');

      // Check data for each month
      const sep_payment = history[0];
      expect(sep_payment.totalAmount).toBe(50);
      expect(sep_payment.paymentStatus).toBe('Paid');

      const aug_payment = history[1];
      expect(aug_payment.totalAmount).toBe(250); // 100 + 150
      expect(aug_payment.paymentStatus).toBe('Unpaid'); // No payment record for August

      const jul_payment = history[2];
      expect(jul_payment.totalAmount).toBe(200);
      expect(jul_payment.paymentStatus).toBe('Paid');
    });

    it('should return 401 if user is not authenticated', async () => {
        const res = await request(app).get('/api/payments/me');
        expect(res.statusCode).toBe(401);
    });

    it('should return an empty array if the user has no participation history', async () => {
      const res = await request(app)
        .get('/api/payments/me')
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });
  });
});
