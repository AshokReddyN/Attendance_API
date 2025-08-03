const request = require('supertest');
const app = require('../server');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');
const Event = require('../models/Event');
const jwt = require('jsonwebtoken');

describe('Events API', () => {
  let mongoServer;
  let adminToken;
  let memberToken;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Create admin user
    const adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'password123',
      role: 'admin',
    });
    adminToken = jwt.sign({ id: adminUser._id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Create member user
    const memberUser = await User.create({
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
  });

  describe('POST /api/events', () => {
    it('should create a new event for an admin user', async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Yoga Session',
          price: 100,
          endAt: '2025-08-03T18:00:00.000Z',
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.event).toHaveProperty('id');
      expect(res.body.event.name).toBe('Yoga Session');
      expect(res.body.event.price).toBe(100);
      expect(res.body.event.status).toBe('open');
    });

    it('should not create a new event for a non-admin user', async () => {
        const res = await request(app)
          .post('/api/events')
          .set('Authorization', `Bearer ${memberToken}`)
          .send({
            name: 'Yoga Session',
            price: 100,
            endAt: '2025-08-03T18:00:00.000Z',
          });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBe('User role member is not authorized to access this route');
      });

    it('should not create a new event without a token', async () => {
      const res = await request(app)
        .post('/api/events')
        .send({
          name: 'Yoga Session',
          price: 100,
          endAt: '2025-08-03T18:00:00.000Z',
        });

      expect(res.statusCode).toEqual(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Not authorized to access this route');
    });

    it('should create a new event when body is a JSON string', async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({
          name: 'Yoga Session',
          price: 100,
          endAt: '2025-08-03T18:00:00.000Z',
        }));

      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.event).toHaveProperty('id');
    });
  });

  describe('POST /api/events/clone', () => {
    let sourceEvent;

    beforeEach(async () => {
      sourceEvent = await Event.create({
        name: 'Yoga Session',
        price: 100,
        endAt: '2025-08-03T18:00:00.000Z',
      });
    });

    it('should clone an event for an admin user', async () => {
      const res = await request(app)
        .post('/api/events/clone')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          sourceEventId: sourceEvent._id,
          newEndAt: '2025-08-04T18:00:00.000Z',
          name: 'Yoga Session - Extended',
          price: 120,
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.event).toHaveProperty('id');
      expect(res.body.event.name).toBe('Yoga Session - Extended');
      expect(res.body.event.price).toBe(120);
      expect(res.body.event.endAt).toBe('2025-08-04T18:00:00.000Z');
      expect(res.body.event.status).toBe('open');
    });

    it('should not clone an event if source event not found', async () => {
      const res = await request(app)
        .post('/api/events/clone')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          sourceEventId: new mongoose.Types.ObjectId(),
          newEndAt: '2025-08-04T18:00:00.000Z',
        });

      expect(res.statusCode).toEqual(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Source event not found');
    });

    it('should not clone an event for a non-admin user', async () => {
      const res = await request(app)
        .post('/api/events/clone')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          sourceEventId: sourceEvent._id,
        });

      expect(res.statusCode).toEqual(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe(
        'User role member is not authorized to access this route'
      );
    });
  });
});
