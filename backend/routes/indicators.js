const express = require('express');
const router = express.Router();
const { indicatorSystemRules, listQueryRules, idParamRules } = require('../middleware/validate');

// 数据库连接将在index.js中注入
let db = null;

const setDb = (database) => {
  db = database;
};

// 生成UUID
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
const now = () => new Date().toISOString().split('T')[0];

// ==================== 指标体系 CRUD ====================

// 获取指标体系列表
router.get('/indicator-systems', (req, res) => {
  try {
    const systems = db.prepare(`
      SELECT id, name, type, target, tags, description, indicator_count as indicatorCount,
             attachments, status, created_by as createdBy, created_at as createdAt,
             updated_by as updatedBy, updated_at as updatedAt
      FROM indicator_systems
      ORDER BY created_at DESC
    `).all();

    // 解析JSON字段
    systems.forEach(sys => {
      sys.tags = sys.tags ? JSON.parse(sys.tags) : [];
      sys.attachments = sys.attachments ? JSON.parse(sys.attachments) : [];
    });

    res.json({ code: 200, data: systems });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取单个指标体系
router.get('/indicator-systems/:id', (req, res) => {
  try {
    const system = db.prepare(`
      SELECT id, name, type, target, tags, description, indicator_count as indicatorCount,
             attachments, status, created_by as createdBy, created_at as createdAt,
             updated_by as updatedBy, updated_at as updatedAt
      FROM indicator_systems WHERE id = ?
    `).get(req.params.id);

    if (!system) {
      return res.status(404).json({ code: 404, message: '指标体系不存在' });
    }

    system.tags = system.tags ? JSON.parse(system.tags) : [];
    system.attachments = system.attachments ? JSON.parse(system.attachments) : [];

    res.json({ code: 200, data: system });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 创建指标体系
router.post('/indicator-systems', indicatorSystemRules.create, (req, res) => {
  try {
    const { name, type, target, tags, description, attachments } = req.body;
    const id = generateId();
    const timestamp = now();

    db.prepare(`
      INSERT INTO indicator_systems
      (id, name, type, target, tags, description, attachments, status, created_by, created_at, updated_by, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', 'admin', ?, 'admin', ?)
    `).run(id, name, type, target, JSON.stringify(tags || []), description, JSON.stringify(attachments || []), timestamp, timestamp);

    res.json({ code: 200, data: { id }, message: '创建成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新指标体系
router.put('/indicator-systems/:id', indicatorSystemRules.update, (req, res) => {
  try {
    const { name, type, target, tags, description, attachments, status } = req.body;
    const timestamp = now();

    const result = db.prepare(`
      UPDATE indicator_systems
      SET name = ?, type = ?, target = ?, tags = ?, description = ?, attachments = ?, status = ?, updated_by = 'admin', updated_at = ?
      WHERE id = ?
    `).run(name, type, target, JSON.stringify(tags || []), description, JSON.stringify(attachments || []), status, timestamp, req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ code: 404, message: '指标体系不存在' });
    }

    res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除指标体系
router.delete('/indicator-systems/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM indicator_systems WHERE id = ?').run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ code: 404, message: '指标体系不存在' });
    }

    res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 指标树操作 ====================

// 获取指标树
router.get('/indicator-systems/:id/tree', (req, res) => {
  try {
    const systemId = req.params.id;

    // 获取所有指标
    const indicators = db.prepare(`
      SELECT id, system_id as systemId, parent_id as parentId, code, name, description,
             level, is_leaf as isLeaf, weight, sort_order as sortOrder
      FROM indicators WHERE system_id = ? ORDER BY sort_order
    `).all(systemId);

    // 获取数据指标
    const dataIndicators = db.prepare(`
      SELECT di.id, di.indicator_id as indicatorId, di.code, di.name, di.threshold, di.description, di.sort_order as sortOrder
      FROM data_indicators di
      JOIN indicators i ON di.indicator_id = i.id
      WHERE i.system_id = ?
      ORDER BY di.sort_order
    `).all(systemId);

    // 获取佐证资料
    const materials = db.prepare(`
      SELECT sm.id, sm.indicator_id as indicatorId, sm.code, sm.name, sm.file_types as fileTypes,
             sm.max_size as maxSize, sm.description, sm.required, sm.sort_order as sortOrder
      FROM supporting_materials sm
      JOIN indicators i ON sm.indicator_id = i.id
      WHERE i.system_id = ?
      ORDER BY sm.sort_order
    `).all(systemId);

    // 构建指标到数据指标/佐证资料的映射
    const diMap = {};
    dataIndicators.forEach(di => {
      if (!diMap[di.indicatorId]) diMap[di.indicatorId] = [];
      diMap[di.indicatorId].push(di);
    });

    const smMap = {};
    materials.forEach(sm => {
      sm.required = !!sm.required;
      if (!smMap[sm.indicatorId]) smMap[sm.indicatorId] = [];
      smMap[sm.indicatorId].push(sm);
    });

    // 构建树
    const buildTree = (parentId) => {
      return indicators
        .filter(ind => ind.parentId === parentId)
        .map(ind => {
          ind.isLeaf = !!ind.isLeaf;
          const node = { ...ind };
          if (ind.isLeaf) {
            node.dataIndicators = diMap[ind.id] || [];
            node.supportingMaterials = smMap[ind.id] || [];
          } else {
            node.children = buildTree(ind.id);
          }
          return node;
        });
    };

    const tree = buildTree(null);
    res.json({ code: 200, data: tree });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 保存整个指标树
router.put('/indicator-systems/:id/tree', (req, res) => {
  const systemId = req.params.id;
  const tree = req.body.tree;
  const timestamp = now();

  try {
    // 开始事务
    const transaction = db.transaction(() => {
      // 1. 删除现有的指标树（级联删除数据指标和佐证资料）
      db.prepare('DELETE FROM indicators WHERE system_id = ?').run(systemId);

      // 2. 递归插入新的指标树
      const insertIndicator = db.prepare(`
        INSERT INTO indicators (id, system_id, parent_id, code, name, description, level, is_leaf, weight, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertDataIndicator = db.prepare(`
        INSERT INTO data_indicators (id, indicator_id, code, name, threshold, description, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertMaterial = db.prepare(`
        INSERT INTO supporting_materials (id, indicator_id, code, name, file_types, max_size, description, required, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      let indicatorCount = 0;

      const insertNode = (node, parentId, sortOrder) => {
        const nodeId = node.id || generateId();
        insertIndicator.run(
          nodeId, systemId, parentId, node.code, node.name, node.description || '',
          node.level, node.isLeaf ? 1 : 0, node.weight || null, sortOrder, timestamp, timestamp
        );
        indicatorCount++;

        // 插入数据指标
        if (node.isLeaf && node.dataIndicators) {
          node.dataIndicators.forEach((di, idx) => {
            insertDataIndicator.run(
              di.id || generateId(), nodeId, di.code, di.name, di.threshold || '', di.description || '', idx, timestamp, timestamp
            );
          });
        }

        // 插入佐证资料
        if (node.isLeaf && node.supportingMaterials) {
          node.supportingMaterials.forEach((sm, idx) => {
            insertMaterial.run(
              sm.id || generateId(), nodeId, sm.code, sm.name, sm.fileTypes || '', sm.maxSize || '', sm.description || '', sm.required ? 1 : 0, idx, timestamp, timestamp
            );
          });
        }

        // 递归处理子节点
        if (node.children) {
          node.children.forEach((child, idx) => {
            insertNode(child, nodeId, idx);
          });
        }
      };

      tree.forEach((node, idx) => insertNode(node, null, idx));

      // 3. 更新指标体系的指标数量
      db.prepare('UPDATE indicator_systems SET indicator_count = ?, updated_at = ? WHERE id = ?')
        .run(indicatorCount, timestamp, systemId);
    });

    transaction();
    res.json({ code: 200, message: '保存成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 添加单个指标节点
router.post('/indicator-systems/:systemId/indicators', (req, res) => {
  try {
    const { parentId, code, name, description, level, isLeaf } = req.body;
    const id = generateId();
    const timestamp = now();
    const systemId = req.params.systemId;

    // 获取排序位置
    const maxOrder = db.prepare(`
      SELECT MAX(sort_order) as maxOrder FROM indicators WHERE system_id = ? AND parent_id ${parentId ? '= ?' : 'IS NULL'}
    `).get(parentId ? [systemId, parentId] : [systemId]);

    const sortOrder = (maxOrder?.maxOrder ?? -1) + 1;

    db.prepare(`
      INSERT INTO indicators (id, system_id, parent_id, code, name, description, level, is_leaf, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, systemId, parentId || null, code, name, description || '', level, isLeaf ? 1 : 0, sortOrder, timestamp, timestamp);

    // 更新指标数量
    db.prepare('UPDATE indicator_systems SET indicator_count = indicator_count + 1, updated_at = ? WHERE id = ?')
      .run(timestamp, systemId);

    res.json({ code: 200, data: { id }, message: '添加成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新指标节点
router.put('/indicator-systems/:systemId/indicators/:indicatorId', (req, res) => {
  try {
    const { code, name, description, isLeaf, weight } = req.body;
    const timestamp = now();

    const result = db.prepare(`
      UPDATE indicators SET code = ?, name = ?, description = ?, is_leaf = ?, weight = ?, updated_at = ?
      WHERE id = ? AND system_id = ?
    `).run(code, name, description || '', isLeaf ? 1 : 0, weight || null, timestamp, req.params.indicatorId, req.params.systemId);

    if (result.changes === 0) {
      return res.status(404).json({ code: 404, message: '指标不存在' });
    }

    res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除指标节点
router.delete('/indicator-systems/:systemId/indicators/:indicatorId', (req, res) => {
  try {
    const timestamp = now();

    // 计算要删除的节点数（包括子节点）
    const countDeleted = (id) => {
      const children = db.prepare('SELECT id FROM indicators WHERE parent_id = ?').all(id);
      let count = 1;
      children.forEach(child => {
        count += countDeleted(child.id);
      });
      return count;
    };

    const deleteCount = countDeleted(req.params.indicatorId);

    const result = db.prepare('DELETE FROM indicators WHERE id = ?').run(req.params.indicatorId);

    if (result.changes === 0) {
      return res.status(404).json({ code: 404, message: '指标不存在' });
    }

    // 更新指标数量
    db.prepare('UPDATE indicator_systems SET indicator_count = indicator_count - ?, updated_at = ? WHERE id = ?')
      .run(deleteCount, timestamp, req.params.systemId);

    res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 数据指标-评估要素关联 ====================

// 获取数据指标的要素关联列表
router.get('/data-indicators/:dataIndicatorId/elements', (req, res) => {
  try {
    const associations = db.prepare(`
      SELECT
        die.id, die.data_indicator_id as dataIndicatorId, die.element_id as elementId,
        die.mapping_type as mappingType, die.description,
        die.created_by as createdBy, die.created_at as createdAt,
        e.code as elementCode, e.name as elementName, e.element_type as elementType,
        e.data_type as dataType, e.formula,
        el.id as libraryId, el.name as libraryName
      FROM data_indicator_elements die
      JOIN elements e ON die.element_id = e.id
      JOIN element_libraries el ON e.library_id = el.id
      WHERE die.data_indicator_id = ?
      ORDER BY die.created_at DESC
    `).all(req.params.dataIndicatorId);

    res.json({ code: 200, data: associations });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 添加数据指标-要素关联
router.post('/data-indicators/:dataIndicatorId/elements', (req, res) => {
  try {
    const { elementId, mappingType, description } = req.body;
    const dataIndicatorId = req.params.dataIndicatorId;
    const id = generateId();
    const timestamp = now();

    // 检查数据指标是否存在
    const indicator = db.prepare('SELECT id FROM data_indicators WHERE id = ?').get(dataIndicatorId);
    if (!indicator) {
      return res.status(404).json({ code: 404, message: '数据指标不存在' });
    }

    // 检查要素是否存在
    const element = db.prepare('SELECT id FROM elements WHERE id = ?').get(elementId);
    if (!element) {
      return res.status(404).json({ code: 404, message: '要素不存在' });
    }

    // 检查是否已存在关联
    const existing = db.prepare(`
      SELECT id FROM data_indicator_elements WHERE data_indicator_id = ? AND element_id = ?
    `).get(dataIndicatorId, elementId);
    if (existing) {
      return res.status(400).json({ code: 400, message: '该关联已存在' });
    }

    db.prepare(`
      INSERT INTO data_indicator_elements (id, data_indicator_id, element_id, mapping_type, description, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'admin', ?, ?)
    `).run(id, dataIndicatorId, elementId, mappingType || 'primary', description || '', timestamp, timestamp);

    res.json({ code: 200, data: { id }, message: '关联成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新数据指标-要素关联
router.put('/data-indicators/:dataIndicatorId/elements/:associationId', (req, res) => {
  try {
    const { mappingType, description } = req.body;
    const timestamp = now();

    const result = db.prepare(`
      UPDATE data_indicator_elements SET mapping_type = ?, description = ?, updated_at = ?
      WHERE id = ? AND data_indicator_id = ?
    `).run(mappingType, description || '', timestamp, req.params.associationId, req.params.dataIndicatorId);

    if (result.changes === 0) {
      return res.status(404).json({ code: 404, message: '关联不存在' });
    }

    res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除数据指标-要素关联
router.delete('/data-indicators/:dataIndicatorId/elements/:associationId', (req, res) => {
  try {
    const result = db.prepare(`
      DELETE FROM data_indicator_elements WHERE id = ? AND data_indicator_id = ?
    `).run(req.params.associationId, req.params.dataIndicatorId);

    if (result.changes === 0) {
      return res.status(404).json({ code: 404, message: '关联不存在' });
    }

    res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 批量保存数据指标-要素关联
router.put('/data-indicators/:dataIndicatorId/elements', (req, res) => {
  const dataIndicatorId = req.params.dataIndicatorId;
  const associations = req.body.associations || [];
  const timestamp = now();

  try {
    const transaction = db.transaction(() => {
      // 删除现有关联
      db.prepare('DELETE FROM data_indicator_elements WHERE data_indicator_id = ?').run(dataIndicatorId);

      // 插入新关联
      const insert = db.prepare(`
        INSERT INTO data_indicator_elements (id, data_indicator_id, element_id, mapping_type, description, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'admin', ?, ?)
      `);

      associations.forEach(assoc => {
        insert.run(
          assoc.id || generateId(),
          dataIndicatorId,
          assoc.elementId,
          assoc.mappingType || 'primary',
          assoc.description || '',
          timestamp,
          timestamp
        );
      });
    });

    transaction();
    res.json({ code: 200, message: '保存成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取指标体系下所有数据指标及其要素关联
router.get('/indicator-systems/:systemId/data-indicator-elements', (req, res) => {
  try {
    const systemId = req.params.systemId;

    // 获取该指标体系下所有数据指标
    const dataIndicators = db.prepare(`
      SELECT di.id, di.code, di.name, di.threshold, di.description,
             i.id as indicatorId, i.code as indicatorCode, i.name as indicatorName
      FROM data_indicators di
      JOIN indicators i ON di.indicator_id = i.id
      WHERE i.system_id = ?
      ORDER BY i.sort_order, di.sort_order
    `).all(systemId);

    // 获取所有关联
    const associations = db.prepare(`
      SELECT
        die.id, die.data_indicator_id as dataIndicatorId, die.element_id as elementId,
        die.mapping_type as mappingType, die.description,
        e.code as elementCode, e.name as elementName, e.element_type as elementType,
        e.data_type as dataType, e.formula,
        el.id as libraryId, el.name as libraryName
      FROM data_indicator_elements die
      JOIN elements e ON die.element_id = e.id
      JOIN element_libraries el ON e.library_id = el.id
      JOIN data_indicators di ON die.data_indicator_id = di.id
      JOIN indicators i ON di.indicator_id = i.id
      WHERE i.system_id = ?
    `).all(systemId);

    // 构建映射
    const assocMap = {};
    associations.forEach(a => {
      if (!assocMap[a.dataIndicatorId]) assocMap[a.dataIndicatorId] = [];
      assocMap[a.dataIndicatorId].push(a);
    });

    // 组装结果
    const result = dataIndicators.map(di => ({
      ...di,
      elements: assocMap[di.id] || []
    }));

    res.json({ code: 200, data: result });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

module.exports = { router, setDb };
