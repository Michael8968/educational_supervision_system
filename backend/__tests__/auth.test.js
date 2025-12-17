/**
 * 认证 API 测试
 */

const request = require('supertest');
const { createApp } = require('../app');
const mockDb = require('./mockDb');

describe('Authentication API', () => {
  let app;

  beforeAll(() => {
    mockDb.seedTestData();
    app = createApp(mockDb);
  });

  afterAll(() => {
    mockDb.resetMockData();
  });

  describe('POST /api/login', () => {
    it('should login successfully with valid admin credentials', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({ username: 'AAA', password: 'BBB' })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.username).toBe('AAA');
      expect(response.body.data.role).toBe('admin');
      expect(response.body.data.roles).toContain('admin');
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.token).toMatch(/^token-\d+-admin$/);
    });

    it('should login successfully with city_admin credentials', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({ username: '111', password: '222' })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.username).toBe('111');
      expect(response.body.data.role).toBe('city_admin');
      expect(response.body.data.roleName).toBe('市级管理员');
    });

    it('should login successfully with district_admin credentials', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({ username: '333', password: '444' })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.role).toBe('district_admin');
      expect(response.body.data.scopes).toBeDefined();
      expect(response.body.data.scopes.length).toBeGreaterThan(0);
    });

    it('should login successfully with school_reporter credentials', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({ username: '555', password: '666' })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.role).toBe('school_reporter');
    });

    it('should fail with invalid password', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({ username: 'AAA', password: 'wrong_password' })
        .expect(401);

      expect(response.body.code).toBe(401);
      expect(response.body.message).toBe('用户名或密码错误');
    });

    it('should fail with non-existent user', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({ username: 'nonexistent', password: 'password' })
        .expect(401);

      expect(response.body.code).toBe(401);
      expect(response.body.message).toBe('用户名或密码错误');
    });

    it('should fail with empty credentials', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({})
        .expect(400);

      // express-validator 返回验证错误
      expect(response.body.errors || response.body.code).toBeDefined();
    });

    it('should fail with missing password', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({ username: 'AAA' })
        .expect(400);

      expect(response.body.errors || response.body.code).toBeDefined();
    });

    it('should fail with missing username', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({ password: 'BBB' })
        .expect(400);

      expect(response.body.errors || response.body.code).toBeDefined();
    });
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.database).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('GET /api/stats', () => {
    it('should return statistics data', async () => {
      const response = await request(app)
        .get('/api/stats')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data).toBeDefined();
    });
  });

  describe('404 handling', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body.code).toBe(404);
      expect(response.body.message).toBe('Not Found');
    });
  });
});
