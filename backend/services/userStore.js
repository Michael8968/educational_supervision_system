/**
 * 用户存储（简化实现：内存存储）
 * - 供 /api/login 与 /api/users 共用
 * - 生产环境应改为数据库表或 Supabase Auth
 */

const nowDate = () => new Date().toISOString().split('T')[0];

/**
 * @typedef {'admin'|'project_manager'|'collector'|'expert'|'decision_maker'} UserRole
 */

/**
 * @typedef {Object} ScopeItem
 * @property {'city'|'district'|'school'} type
 * @property {string} id
 * @property {string} name
 */

/**
 * @typedef {Object} SysUser
 * @property {string} username
 * @property {string} password
 * @property {UserRole[]} roles - 角色数组，支持多角色
 * @property {'active'|'inactive'} status
 * @property {ScopeItem[]} scopes
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/** @type {Map<string, SysUser>} */
const userMap = new Map();

function seedIfEmpty() {
  if (userMap.size > 0) return;
  const ts = nowDate();
  const defaults = [
    { username: 'AAA', password: 'BBB', roles: ['admin'], scopes: [{ type: 'city', id: 'shenyang', name: '沈阳市' }] },
    { username: '111', password: '222', roles: ['project_manager'], scopes: [{ type: 'city', id: 'shenyang', name: '沈阳市' }] },
    { username: '333', password: '444', roles: ['collector'], scopes: [] },
    { username: '555', password: '666', roles: ['expert'], scopes: [] },
    { username: '777', password: '888', roles: ['decision_maker'], scopes: [] },
  ];
  defaults.forEach(u => {
    userMap.set(u.username, {
      ...u,
      status: 'active',
      createdAt: ts,
      updatedAt: ts,
    });
  });
}

seedIfEmpty();

const validRoles = new Set(['admin', 'project_manager', 'collector', 'expert', 'decision_maker']);

// 角色显示名称映射
const roleDisplayNames = {
  admin: '系统管理员',
  project_manager: '项目管理员',
  collector: '数据采集员',
  expert: '评估专家',
  decision_maker: '报告决策者',
};

function listUsers({ keyword, role, status } = {}) {
  const kw = (keyword || '').trim().toLowerCase();
  let arr = Array.from(userMap.values()).map(u => ({ ...u }));
  if (kw) {
    arr = arr.filter(u =>
      u.username.toLowerCase().includes(kw) ||
      (u.roles || []).some(r => (roleDisplayNames[r] || '').toLowerCase().includes(kw))
    );
  }
  // 支持按单个角色筛选
  if (role) arr = arr.filter(u => (u.roles || []).includes(role));
  if (status) arr = arr.filter(u => u.status === status);
  // admin 放在最前
  arr.sort((a, b) => ((a.roles || []).includes('admin') ? -1 : 0) - ((b.roles || []).includes('admin') ? -1 : 0));
  return arr;
}

function getUser(username) {
  return userMap.get(username) || null;
}

function createUser({ username, password, roles, status, scopes } = {}) {
  const ts = nowDate();
  const u = (username || '').trim();
  if (!u) throw new Error('用户名为必填项');
  if (userMap.has(u)) throw new Error('用户名已存在');
  if (!password || String(password).length < 2) throw new Error('密码长度至少 2 位');

  // 验证角色数组
  const rolesArr = Array.isArray(roles) ? roles : [];
  if (rolesArr.length === 0) throw new Error('请至少选择一个角色');
  for (const r of rolesArr) {
    if (!validRoles.has(r)) throw new Error(`无效的角色类型: ${r}`);
  }

  const user = {
    username: u,
    password: String(password),
    roles: rolesArr,
    status: status === 'inactive' ? 'inactive' : 'active',
    scopes: Array.isArray(scopes) ? scopes : [],
    createdAt: ts,
    updatedAt: ts,
  };
  userMap.set(u, user);
  return { ...user };
}

function updateUser(username, updates = {}) {
  const existing = userMap.get(username);
  if (!existing) throw new Error('用户不存在');

  // 验证角色数组
  if (updates.roles !== undefined) {
    const rolesArr = Array.isArray(updates.roles) ? updates.roles : [];
    // 内置管理员账号必须保留 admin 角色
    if (existing.username === 'AAA' && !rolesArr.includes('admin')) {
      throw new Error('内置管理员账号必须保留管理员角色');
    }
    if (rolesArr.length === 0) throw new Error('请至少选择一个角色');
    for (const r of rolesArr) {
      if (!validRoles.has(r)) throw new Error(`无效的角色类型: ${r}`);
    }
  }

  if (updates.status && !['active', 'inactive'].includes(updates.status)) throw new Error('无效的状态');
  if (updates.password !== undefined && String(updates.password).length < 2) throw new Error('密码长度至少 2 位');

  const next = {
    ...existing,
    ...(updates.roles !== undefined ? { roles: Array.isArray(updates.roles) ? updates.roles : [] } : {}),
    ...(updates.status !== undefined ? { status: updates.status } : {}),
    ...(updates.password !== undefined ? { password: String(updates.password) } : {}),
    ...(updates.scopes !== undefined ? { scopes: Array.isArray(updates.scopes) ? updates.scopes : [] } : {}),
    updatedAt: nowDate(),
  };
  userMap.set(username, next);
  return { ...next };
}

function deleteUser(username) {
  if (username === 'AAA') throw new Error('内置管理员账号不允许删除');
  if (!userMap.has(username)) throw new Error('用户不存在');
  userMap.delete(username);
  return true;
}

function verifyCredentials(username, password) {
  const u = userMap.get(username);
  if (!u) return null;
  if (u.status !== 'active') return null;
  if (u.password !== password) return null;
  return { ...u };
}

module.exports = {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  verifyCredentials,
  validRoles: Array.from(validRoles),
};


