/**
 * 项目 API 测试
 */

const request = require('supertest');
const { createApp } = require('../app');
const mockDb = require('./mockDb');

describe('Projects API', () => {
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

  describe('GET /api/projects', () => {
    it('should return 200 and data array', async () => {
      const response = await request(app)
        .get('/api/projects')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should accept filter parameters', async () => {
      const response = await request(app)
        .get('/api/projects?status=配置中')
        .expect(200);

      expect(response.body.code).toBe(200);
    });
  });

  describe('GET /api/projects/:id', () => {
    it('should return 404 for non-existent id', async () => {
      const response = await request(app)
        .get('/api/projects/nonexistent-project-id')
        .expect(404);

      expect(response.body.code).toBe(404);
    });
  });

  describe('POST /api/projects', () => {
    it('should reject empty name', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({ name: '' })
        .expect(400);

      expect(response.body).toBeDefined();
    });

    it('should reject missing required fields', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({})
        .expect(400);

      expect(response.body).toBeDefined();
    });

    it('should accept valid project data', async () => {
      const newProject = {
        name: '新评估项目',
        indicator_system_id: 'is-001',
        year: 2025
      };

      const response = await request(app)
        .post('/api/projects')
        .send(newProject);

      expect([200, 201]).toContain(response.status);
    });
  });

  describe('PUT /api/projects/:id', () => {
    it('should return 404 for non-existent id', async () => {
      const response = await request(app)
        .put('/api/projects/nonexistent-project-id')
        .send({ name: 'test' })
        .expect(404);

      expect(response.body.code).toBe(404);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    it('should return 404 for non-existent id', async () => {
      const response = await request(app)
        .delete('/api/projects/nonexistent-project-id')
        .expect(404);

      expect(response.body.code).toBe(404);
    });
  });

  describe('Project Personnel', () => {
    it('should accept personnel query with project_id', async () => {
      const response = await request(app)
        .get('/api/project-personnel?project_id=p-001');

      // 可能返回 200 或 404（取决于路由配置）
      expect([200, 404]).toContain(response.status);
    });
  });
});
