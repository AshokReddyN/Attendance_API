const request = require('supertest');
const app = require('../server');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');
const Event = require('../models/Event');
const Participation = require('../models/Participation');
const jwt = require('jsonwebtoken');

describe('Users API', () => {
  let mongoServer;
  let adminToken;
  let memberToken;
  let memberUser;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    const adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'password123',
      role: 'admin',
    });
    adminToken = jwt.sign({ id: adminUser._id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });

    memberUser = await User.create({
      name: 'Member User',
      email: 'member@example.com',
      password: 'password123',
      role: 'member',
    });
    memberToken = jwt.sign({ id: memberUser._id, role: 'member' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Event.deleteMany({});
    await Participation.deleteMany({});
  });

  describe('GET /api/users/me/participations', () => {
    it('should return the participation history for a member', async () => {
      const event1 = await Event.create({ name: 'Event 1', price: 10, endAt: new Date('2025-07-01') });
      const event2 = await Event.create({ name: 'Event 2', price: 20, endAt: new Date('2025-07-02') });

      await Participation.create({ event: event1._id, user: memberUser._id, optedInAt: new Date('2025-07-01T10:00:00.000Z') });
      await Participation.create({ event: event2._id, user: memberUser._id, optedInAt: new Date('2025-07-02T10:00:00.000Z') });

      const res = await request(app)
        .get('/api/users/me/participations')
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.participations.length).toBe(2);
      expect(res.body.participations[0].eventName).toBe('Event 1');
      expect(res.body.participations[0].price).toBe(10);
      expect(res.body.participations[0].eventDate).toBe('2025-07-01');
      expect(res.body.participations[1].eventName).toBe('Event 2');
    });

    it('should not allow an admin to access this route', async () => {
      const res = await request(app)
        .get('/api/users/me/participations')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('User role admin is not authorized to access this route');
    });
  });
});
