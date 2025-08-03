const request = require('supertest');
const app = require('../server');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');
const Event = require('../models/Event');
const Participation = require('../models/Participation');
const jwt = require('jsonwebtoken');

describe('Events API', () => {
  let mongoServer;
  let adminToken;
  let memberToken;
  let adminUser;
  let memberUser;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Create admin user
    adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'password123',
      role: 'admin',
    });
    adminToken = jwt.sign({ id: adminUser._id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Create member user
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

  describe('GET /api/events', () => {
    beforeEach(async () => {
      const today = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      const event1 = await Event.create({ name: 'Event 1', price: 10, endAt: today });
      const event2 = await Event.create({ name: 'Event 2', price: 20, endAt: tomorrow });
      const event3 = await Event.create({ name: 'Event 3', price: 30, endAt: nextMonth });

      await Participation.create({ event: event1._id, user: memberUser._id });
      await Participation.create({ event: event1._id, user: adminUser._id });
    });

    it('should return all events for an admin', async () => {
      const res = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.events.length).toBe(3);
      expect(res.body.events[0].optInCount).toBe(2);
      expect(res.body.events[1].optInCount).toBe(0);
    });

    it('should return events filtered by month for an admin', async () => {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const monthString = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;

      const res = await request(app)
        .get(`/api/events?month=${monthString}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.events.length).toBe(1);
      expect(res.body.events[0].name).toBe('Event 3');
    });

    it("should return only today's active events for a member", async () => {
      const res = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.events.length).toBe(1);
      expect(res.body.events[0].name).toBe('Event 1');
      expect(res.body.events[0].optInCount).toBe(2);
    });
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

  describe('PUT /api/events/:id', () => {
    let event;

    beforeEach(async () => {
      event = await Event.create({
        name: 'Yoga Session',
        price: 100,
        endAt: '2025-08-03T18:00:00.000Z',
      });
    });

    it('should update an event for an admin user', async () => {
      const res = await request(app)
        .put(`/api/events/${event._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Morning Yoga',
          price: 110,
          endAt: '2025-08-03T19:00:00.000Z',
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.event.name).toBe('Morning Yoga');
      expect(res.body.event.price).toBe(110);
      expect(res.body.event.endAt).toBe('2025-08-03T19:00:00.000Z');
    });

    it('should not update an event if not found', async () => {
      const res = await request(app)
        .put(`/api/events/${new mongoose.Types.ObjectId()}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Morning Yoga',
        });

      expect(res.statusCode).toEqual(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Event not found');
    });

    it('should not update an event for a non-admin user', async () => {
      const res = await request(app)
        .put(`/api/events/${event._id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          name: 'Morning Yoga',
        });

      expect(res.statusCode).toEqual(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe(
        'User role member is not authorized to access this route'
      );
    });

    it('should not update a closed event', async () => {
      event.status = 'closed';
      await event.save();

      const res = await request(app)
        .put(`/api/events/${event._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Morning Yoga',
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Cannot update a closed event');
    });
  });

  describe('POST /api/events/:id/close', () => {
    let event;

    beforeEach(async () => {
      event = await Event.create({
        name: 'Yoga Session',
        price: 100,
        endAt: '2025-08-03T18:00:00.000Z',
      });
    });

    it('should close an event for an admin user', async () => {
      const res = await request(app)
        .post(`/api/events/${event._id}/close`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send();

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.event.status).toBe('closed');
    });

    it('should not close an event if not found', async () => {
      const res = await request(app)
        .post(`/api/events/${new mongoose.Types.ObjectId()}/close`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send();

      expect(res.statusCode).toEqual(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Event not found');
    });

    it('should not close an event for a non-admin user', async () => {
      const res = await request(app)
        .post(`/api/events/${event._id}/close`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send();

      expect(res.statusCode).toEqual(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe(
        'User role member is not authorized to access this route'
      );
    });
  });
});
