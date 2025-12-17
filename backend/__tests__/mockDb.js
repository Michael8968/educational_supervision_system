/**
 * Mock 数据库模块
 * 用于单元测试，模拟数据库操作
 */

// 内存数据存储
const mockData = {
  indicator_systems: [],
  indicators: [],
  data_indicators: [],
  supporting_materials: [],
  projects: [],
  project_personnel: [],
  project_tools: [],
  submissions: [],
  submission_materials: [],
  tasks: [],
  districts: [],
  schools: [],
  data_tools: [],
  elements: [],
  element_libraries: [],
  field_mappings: [],
  school_indicator_data: [],
  compliance_rules: [],
  compliance_results: [],
};

/**
 * 重置所有 mock 数据
 */
function resetMockData() {
  Object.keys(mockData).forEach(key => {
    mockData[key] = [];
  });
}

/**
 * 初始化测试数据
 */
function seedTestData() {
  // 添加测试区县
  mockData.districts = [
    { id: 'd-001', name: '和平区', code: 'HP', level: 'district', parent_id: null, created_at: new Date().toISOString() },
    { id: 'd-002', name: '沈河区', code: 'SH', level: 'district', parent_id: null, created_at: new Date().toISOString() },
  ];

  // 添加测试学校
  mockData.schools = [
    { id: 's-001', name: '第一小学', district_id: 'd-001', type: '小学', category: '公办', urban_rural: '城区', student_count: 1000, teacher_count: 50, created_at: new Date().toISOString() },
    { id: 's-002', name: '第二中学', district_id: 'd-001', type: '初中', category: '公办', urban_rural: '城区', student_count: 1500, teacher_count: 80, created_at: new Date().toISOString() },
    { id: 's-003', name: '育才学校', district_id: 'd-002', type: '九年一贯制', category: '民办', urban_rural: '城区', student_count: 2000, teacher_count: 100, created_at: new Date().toISOString() },
  ];

  // 添加测试指标体系
  mockData.indicator_systems = [
    { id: 'is-001', name: '义务教育优质均衡', type: '达标类', target: '义务教育', status: 'published', indicator_count: 10, created_at: new Date().toISOString() },
    { id: 'is-002', name: '学前教育质量评估', type: '评分类', target: '学前教育', status: 'draft', indicator_count: 5, created_at: new Date().toISOString() },
  ];

  // 添加测试指标
  mockData.indicators = [
    { id: 'ind-001', system_id: 'is-001', parent_id: null, code: 'A', name: '资源配置', level: 1, is_leaf: 0, sort_order: 1 },
    { id: 'ind-002', system_id: 'is-001', parent_id: 'ind-001', code: 'A1', name: '师资配置', level: 2, is_leaf: 0, sort_order: 1 },
    { id: 'ind-003', system_id: 'is-001', parent_id: 'ind-002', code: 'A1-1', name: '师生比', level: 3, is_leaf: 1, sort_order: 1 },
  ];

  // 添加测试项目
  mockData.projects = [
    { id: 'p-001', name: '2024年义务教育优质均衡评估', indicator_system_id: 'is-001', status: '配置中', is_published: false, year: 2024, created_at: new Date().toISOString() },
    { id: 'p-002', name: '2024年学前教育质量评估', indicator_system_id: 'is-002', status: '填报中', is_published: true, year: 2024, created_at: new Date().toISOString() },
  ];

  // 添加测试采集工具
  mockData.data_tools = [
    { id: 't-001', name: '学校基本信息表', type: '表单', target: '学校', status: 'published', schema: JSON.stringify({ fields: [] }), created_at: new Date().toISOString() },
    { id: 't-002', name: '教师问卷', type: '问卷', target: '教师', status: 'draft', schema: JSON.stringify({ fields: [] }), created_at: new Date().toISOString() },
  ];

  // 添加测试提交
  mockData.submissions = [
    { id: 'sub-001', project_id: 'p-002', tool_id: 't-001', school_id: 's-001', status: 'draft', data: JSON.stringify({}), created_at: new Date().toISOString() },
    { id: 'sub-002', project_id: 'p-002', tool_id: 't-001', school_id: 's-002', status: 'submitted', data: JSON.stringify({}), created_at: new Date().toISOString() },
  ];
}

/**
 * 模拟 SQL 查询（简化版）
 * 仅支持基本的 SELECT/INSERT/UPDATE/DELETE
 */
async function query(sql, params = []) {
  const sqlLower = sql.toLowerCase().trim();

  // 处理 SELECT COUNT
  if (sqlLower.includes('count(*)') || sqlLower.includes('sum(')) {
    // 返回模拟统计数据
    return {
      rows: [{
        total: '0',
        published: '0',
        editing: '0',
        draft: '0',
        standard: '0',
        scoring: '0',
        elementcount: '0',
        configuring: '0',
        filling: '0',
        reviewing: '0',
        stopped: '0',
        completed: '0',
      }],
      rowCount: 1
    };
  }

  // 提取表名
  const tableMatch = sqlLower.match(/from\s+(\w+)/);
  const tableName = tableMatch ? tableMatch[1] : null;

  if (!tableName || !mockData[tableName]) {
    return { rows: [], rowCount: 0 };
  }

  // SELECT 查询
  if (sqlLower.startsWith('select')) {
    let results = [...mockData[tableName]];

    // 简单的 WHERE 条件处理
    if (sqlLower.includes('where')) {
      // 提取 id = 'xxx' 条件
      const idMatch = sql.match(/id\s*=\s*['"]?([^'"]+)['"]?/i);
      if (idMatch) {
        results = results.filter(r => r.id === idMatch[1]);
      }

      // 提取 status = 'xxx' 条件
      const statusMatch = sql.match(/status\s*=\s*['"]?([^'"]+)['"]?/i);
      if (statusMatch) {
        results = results.filter(r => r.status === statusMatch[1]);
      }

      // 提取 system_id = 'xxx' 条件
      const systemIdMatch = sql.match(/system_id\s*=\s*['"]?([^'"]+)['"]?/i);
      if (systemIdMatch) {
        results = results.filter(r => r.system_id === systemIdMatch[1]);
      }

      // 提取 district_id = 'xxx' 条件
      const districtIdMatch = sql.match(/district_id\s*=\s*['"]?([^'"]+)['"]?/i);
      if (districtIdMatch) {
        results = results.filter(r => r.district_id === districtIdMatch[1]);
      }

      // 提取 project_id = 'xxx' 条件
      const projectIdMatch = sql.match(/project_id\s*=\s*['"]?([^'"]+)['"]?/i);
      if (projectIdMatch) {
        results = results.filter(r => r.project_id === projectIdMatch[1]);
      }
    }

    // ORDER BY 处理
    if (sqlLower.includes('order by')) {
      const orderMatch = sqlLower.match(/order by\s+(\w+)(?:\s+(asc|desc))?/);
      if (orderMatch) {
        const field = orderMatch[1];
        const desc = orderMatch[2] === 'desc';
        results.sort((a, b) => {
          if (a[field] < b[field]) return desc ? 1 : -1;
          if (a[field] > b[field]) return desc ? -1 : 1;
          return 0;
        });
      }
    }

    // LIMIT 处理
    if (sqlLower.includes('limit')) {
      const limitMatch = sqlLower.match(/limit\s+(\d+)/);
      if (limitMatch) {
        results = results.slice(0, parseInt(limitMatch[1]));
      }
    }

    return { rows: results, rowCount: results.length };
  }

  // INSERT 查询
  if (sqlLower.startsWith('insert')) {
    const newRecord = { id: `mock-${Date.now()}`, ...params };
    mockData[tableName].push(newRecord);
    return { rows: [newRecord], rowCount: 1 };
  }

  // UPDATE 查询
  if (sqlLower.startsWith('update')) {
    const idMatch = sql.match(/id\s*=\s*['"]?([^'"]+)['"]?/i);
    if (idMatch) {
      const idx = mockData[tableName].findIndex(r => r.id === idMatch[1]);
      if (idx >= 0) {
        mockData[tableName][idx] = { ...mockData[tableName][idx], ...params };
        return { rows: [mockData[tableName][idx]], rowCount: 1 };
      }
    }
    return { rows: [], rowCount: 0 };
  }

  // DELETE 查询
  if (sqlLower.startsWith('delete')) {
    const idMatch = sql.match(/id\s*=\s*['"]?([^'"]+)['"]?/i);
    if (idMatch) {
      const idx = mockData[tableName].findIndex(r => r.id === idMatch[1]);
      if (idx >= 0) {
        const deleted = mockData[tableName].splice(idx, 1);
        return { rows: deleted, rowCount: 1 };
      }
    }
    return { rows: [], rowCount: 0 };
  }

  return { rows: [], rowCount: 0 };
}

/**
 * Mock Supabase from() 方法
 */
function from(table) {
  let filters = {};
  let selectFields = '*';
  let orderField = null;
  let orderAsc = true;
  let limitCount = null;

  const chainable = {
    select: (fields = '*') => {
      selectFields = fields;
      return chainable;
    },
    eq: (field, value) => {
      filters[field] = value;
      return chainable;
    },
    neq: (field, value) => {
      filters[`${field}__neq`] = value;
      return chainable;
    },
    in: (field, values) => {
      filters[`${field}__in`] = values;
      return chainable;
    },
    order: (field, { ascending = true } = {}) => {
      orderField = field;
      orderAsc = ascending;
      return chainable;
    },
    limit: (count) => {
      limitCount = count;
      return chainable;
    },
    single: () => {
      return chainable.then(result => {
        if (result.error) return result;
        return { data: result.data?.[0] || null, error: result.data?.length === 0 ? { code: 'PGRST116' } : null };
      });
    },
    insert: (record) => {
      const newRecord = Array.isArray(record) ? record : [record];
      newRecord.forEach(r => {
        if (!r.id) r.id = `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        if (!r.created_at) r.created_at = new Date().toISOString();
        mockData[table].push(r);
      });
      return {
        select: () => ({
          single: () => Promise.resolve({ data: newRecord[0], error: null }),
          then: (fn) => fn({ data: newRecord, error: null })
        }),
        then: (fn) => fn({ data: newRecord, error: null })
      };
    },
    update: (updates) => {
      return {
        eq: (field, value) => {
          const idx = mockData[table].findIndex(r => r[field] === value);
          if (idx >= 0) {
            mockData[table][idx] = { ...mockData[table][idx], ...updates, updated_at: new Date().toISOString() };
          }
          return {
            select: () => ({
              single: () => Promise.resolve({ data: idx >= 0 ? mockData[table][idx] : null, error: null }),
              then: (fn) => fn({ data: idx >= 0 ? [mockData[table][idx]] : [], error: null })
            }),
            then: (fn) => fn({ data: idx >= 0 ? [mockData[table][idx]] : [], error: null })
          };
        }
      };
    },
    delete: () => {
      return {
        eq: (field, value) => {
          const idx = mockData[table].findIndex(r => r[field] === value);
          let deleted = null;
          if (idx >= 0) {
            deleted = mockData[table].splice(idx, 1)[0];
          }
          return Promise.resolve({ data: deleted, error: null });
        }
      };
    },
    upsert: (record, { onConflict } = {}) => {
      const existingIdx = mockData[table].findIndex(r => r.id === record.id);
      if (existingIdx >= 0) {
        mockData[table][existingIdx] = { ...mockData[table][existingIdx], ...record };
      } else {
        if (!record.id) record.id = `mock-${Date.now()}`;
        mockData[table].push(record);
      }
      return {
        select: () => ({
          single: () => Promise.resolve({ data: record, error: null })
        })
      };
    },
    then: (fn) => {
      let results = [...(mockData[table] || [])];

      // 应用过滤器
      Object.entries(filters).forEach(([key, value]) => {
        if (key.endsWith('__neq')) {
          const field = key.replace('__neq', '');
          results = results.filter(r => r[field] !== value);
        } else if (key.endsWith('__in')) {
          const field = key.replace('__in', '');
          results = results.filter(r => value.includes(r[field]));
        } else {
          results = results.filter(r => r[key] === value);
        }
      });

      // 排序
      if (orderField) {
        results.sort((a, b) => {
          if (a[orderField] < b[orderField]) return orderAsc ? -1 : 1;
          if (a[orderField] > b[orderField]) return orderAsc ? 1 : -1;
          return 0;
        });
      }

      // 限制数量
      if (limitCount) {
        results = results.slice(0, limitCount);
      }

      return fn({ data: results, error: null });
    }
  };

  return chainable;
}

// Mock findById
async function findById(table, id, select = '*') {
  const record = mockData[table]?.find(r => r.id === id);
  return record || null;
}

// Mock findAll
async function findAll(table, filters = {}, select = '*') {
  let results = [...(mockData[table] || [])];
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      results = results.filter(r => r[key] === value);
    }
  });
  return results;
}

// Mock insert
async function insert(table, record) {
  if (!record.id) record.id = `mock-${Date.now()}`;
  if (!record.created_at) record.created_at = new Date().toISOString();
  mockData[table].push(record);
  return record;
}

// Mock update
async function update(table, id, updates) {
  const idx = mockData[table].findIndex(r => r.id === id);
  if (idx >= 0) {
    mockData[table][idx] = { ...mockData[table][idx], ...updates, updated_at: new Date().toISOString() };
    return mockData[table][idx];
  }
  return null;
}

// Mock remove
async function remove(table, id) {
  const idx = mockData[table].findIndex(r => r.id === id);
  if (idx >= 0) {
    mockData[table].splice(idx, 1);
    return true;
  }
  return false;
}

// Mock upsert
async function upsert(table, record, conflictColumn = 'id') {
  const existingIdx = mockData[table].findIndex(r => r[conflictColumn] === record[conflictColumn]);
  if (existingIdx >= 0) {
    mockData[table][existingIdx] = { ...mockData[table][existingIdx], ...record };
    return mockData[table][existingIdx];
  }
  return insert(table, record);
}

// Mock testConnection
async function testConnection() {
  return true;
}

// Mock ensureSchema
async function ensureSchema() {
  return;
}

// Mock transaction
async function transaction(callback) {
  const client = { query };
  return callback(client);
}

// Mock close
async function close() {
  return;
}

module.exports = {
  // 数据操作
  mockData,
  resetMockData,
  seedTestData,

  // 数据库方法
  query,
  from,
  findById,
  findAll,
  insert,
  update,
  remove,
  upsert,
  testConnection,
  ensureSchema,
  transaction,
  close,

  // Mock supabase client
  supabase: { from }
};
