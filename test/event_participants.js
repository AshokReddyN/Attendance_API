const request = require('supertest');
const app = require('../server');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');
const Event = require('../models/Event');
const Participation = require('../models/Participation');
const jwt = require('jsonwebtoken');

describe('GET /api/events/:eventId/participants', () => {
  let mongoServer;
  let adminToken;
  let memberToken;
  let adminUser;
  let memberUser;
  let anotherMemberUser;
  let event;

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

    anotherMemberUser = await User.create({
        name: 'Another Member',
        email: 'another@example.com',
        password: 'password123',
        role: 'member',
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Event.deleteMany({});
    await Participation.deleteMany({});

    event = await Event.create({
      name: 'Test Event',
      price: 10,
      endAt: new Date(),
    });

    await Participation.create({ event: event._id, user: memberUser._id });
    await Participation.create({ event: event._id, user: anotherMemberUser._id });
  });

  it('should return the list of participants for an admin', async () => {
    const res = await request(app)
      .get(`/api/events/${event._id}/participants`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.eventId).toBe(event._id.toString());
    expect(res.body.participants.length).toBe(2);
    expect(res.body.participants[0].name).toBe(memberUser.name);
    expect(res.body.participants[0].email).toBe(memberUser.email);
    expect(res.body.participants[1].name).toBe(anotherMemberUser.name);
  });

  it('should return a 404 if the event is not found', async () => {
    const nonExistentEventId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .get(`/api/events/${nonExistentEventId}/participants`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toEqual(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Event not found');
  });

  it('should return an empty array if there are no participants', async () => {
    await Participation.deleteMany({});
    const res = await request(app)
      .get(`/api/events/${event._id}/participants`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.participants.length).toBe(0);
  });

  it('should return a 403 error for a non-admin user', async () => {
    const res = await request(app)
      .get(`/api/events/${event._id}/participants`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.statusCode).toEqual(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('User role member is not authorized to access this route');
  });

  it('should return a 401 error if no token is provided', async () => {
    const res = await request(app)
      .get(`/api/events/${event._id}/participants`);

    expect(res.statusCode).toEqual(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Not authorized to access this route');
  });
});
