/**
 * 指标体系 API 测试
 *
 * 这些测试验证指标体系相关 API 的基本功能
 * 使用 mock 数据库进行测试
 */

const request = require('supertest');
const { createApp } = require('../app');
const mockDb = require('./mockDb');

describe('Indicator Systems API', () => {
  let app;

  beforeAll(() => {
    mockDb.seedTestData();
    app = createApp(mockDb);
  });

  afterEach(() => {
    mockDb.resetMockData();
    mockDb.seedTestData();
  });

  afterAll(() => {
    mockDb.resetMockData();
  });

  describe('GET /api/indicator-systems', () => {
    it('should return 200 and data array', async () => {
      const response = await request(app)
        .get('/api/indicator-systems')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should accept query parameters', async () => {
      const response = await request(app)
        .get('/api/indicator-systems?status=published')
        .expect(200);

      expect(response.body.code).toBe(200);
    });
  });

  describe('GET /api/indicator-systems/:id', () => {
    it('should return 404 for non-existent id', async () => {
      const response = await request(app)
        .get('/api/indicator-systems/nonexistent-id-12345')
        .expect(404);

      expect(response.body.code).toBe(404);
    });
  });

  describe('POST /api/indicator-systems', () => {
    it('should reject empty name', async () => {
      const response = await request(app)
        .post('/api/indicator-systems')
        .send({ name: '', type: '达标类', target: '义务教育' })
        .expect(400);

      expect(response.body).toBeDefined();
    });

    it('should reject missing required fields', async () => {
      const response = await request(app)
        .post('/api/indicator-systems')
        .send({})
        .expect(400);

      expect(response.body).toBeDefined();
    });

    it('should accept valid data', async () => {
      const newSystem = {
        name: '新指标体系',
        type: '达标类',
        target: '义务教育'
      };

      const response = await request(app)
        .post('/api/indicator-systems')
        .send(newSystem);

      // 可能返回 200 或 201
      expect([200, 201]).toContain(response.status);
    });
  });

  describe('PUT /api/indicator-systems/:id', () => {
    it('should return 404 for non-existent id', async () => {
      const response = await request(app)
        .put('/api/indicator-systems/nonexistent-id-99999')
        .send({ name: 'test' })
        .expect(404);

      expect(response.body.code).toBe(404);
    });
  });

  describe('DELETE /api/indicator-systems/:id', () => {
    it('should handle non-existent id', async () => {
      const response = await request(app)
        .delete('/api/indicator-systems/nonexistent-id-99999');

      // 可能返回 404 或 500
      expect([404, 500]).toContain(response.status);
    });
  });

  describe('GET /api/indicator-systems/:id/tree', () => {
    it('should return 200 status', async () => {
      const response = await request(app)
        .get('/api/indicator-systems/is-001/tree')
        .expect(200);

      expect(response.body.code).toBe(200);
    });
  });

  describe('GET /api/indicators', () => {
    it('should handle indicators request', async () => {
      const response = await request(app)
        .get('/api/indicators');

      // 可能返回 200 或 404（需要 system_id 参数）
      expect([200, 404]).toContain(response.status);
    });
  });
});
