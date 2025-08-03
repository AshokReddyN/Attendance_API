const request = require('supertest');
const app = require('../server');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');
const Event = require('../models/Event');
const Participation = require('../models/Participation');
const jwt = require('jsonwebtoken');

describe('Participations API', () => {
  let mongoServer;
  let adminToken;
  let memberToken;
  let memberUser;
  let openEvent;
  let closedEvent;

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

    openEvent = await Event.create({
      name: 'Open Event',
      price: 100,
      endAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      status: 'open',
    });

    closedEvent = await Event.create({
      name: 'Closed Event',
      price: 100,
      endAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      status: 'closed',
    });
  });

  describe('POST /api/events/:id/optin', () => {
    it('should allow a member to opt-in to an open event', async () => {
      const res = await request(app)
        .post(`/api/events/${openEvent._id}/optin`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.participation).toHaveProperty('id');
      expect(res.body.participation.eventId).toBe(openEvent._id.toString());
      expect(res.body.participation.userId).toBe(memberUser._id.toString());
    });

    it('should not allow a member to opt-in to a closed event', async () => {
      const res = await request(app)
        .post(`/api/events/${closedEvent._id}/optin`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Event is not open for opt-in');
    });

    it('should not allow a member to opt-in to the same event twice', async () => {
      await Participation.create({ event: openEvent._id, user: memberUser._id });

      const res = await request(app)
        .post(`/api/events/${openEvent._id}/optin`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Already opted in to this event');
    });

    it('should not allow an admin to opt-in to an event', async () => {
      const res = await request(app)
        .post(`/api/events/${openEvent._id}/optin`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('User role admin is not authorized to access this route');
    });

    it('should return 404 if event not found', async () => {
      const nonExistentEventId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .post(`/api/events/${nonExistentEventId}/optin`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.statusCode).toEqual(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Event not found');
    });
  });
});
