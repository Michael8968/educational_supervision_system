/**
 * 学前教育普及普惠督导评估指标体系导入脚本
 *
 * 功能：
 * 1. 读取学前教育指标体系JSON文件
 * 2. 创建指标体系记录
 * 3. 导入指标树（包含数据指标和佐证资料）
 * 4. 生成指标编码
 *
 * 使用方法：
 * node backend/scripts/import-preschool-indicators.js
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// 数据库配置
const DATABASE_PATH = path.join(__dirname, '../database.db');

// 检查数据库是否存在
if (!fs.existsSync(DATABASE_PATH)) {
  console.error(`❌ 数据库文件不存在: ${DATABASE_PATH}`);
  console.error('请先运行 npm run init-db 初始化数据库');
  process.exit(1);
}

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(DATABASE_PATH);

// 指标体系JSON文件路径
const INDICATOR_JSON_PATH = path.join(__dirname, '../../doc/数据/学前教育普及普惠督导评估指标体系.json');

// 辅助函数：promisify数据库操作
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

/**
 * 统计指标树中的指标数量
 */
function countIndicators(tree) {
  let count = 0;

  function traverse(nodes) {
    for (const node of nodes) {
      count++;
      if (node.children && node.children.length > 0) {
        traverse(node.children);
      }
    }
  }

  traverse(tree);
  return count;
}

/**
 * 插入指标树节点（递归）
 */
async function insertIndicatorNode(node, systemId, parentId = null) {
  const indicatorId = node.id || uuidv4();
  const now = new Date().toISOString();

  // 插入指标节点
  await dbRun(
    `INSERT INTO indicators (
      id, system_id, parent_id, code, name, description,
      level, is_leaf, weight, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      indicatorId,
      systemId,
      parentId,
      node.code,
      node.name,
      node.description || null,
      node.level,
      node.isLeaf ? 1 : 0,
      node.weight || null,
      node.sortOrder || 0,
      now,
      now
    ]
  );

  console.log(`  ✓ 插入指标: ${node.code} ${node.name}`);

  // 插入数据指标
  if (node.dataIndicators && node.dataIndicators.length > 0) {
    for (const dataIndicator of node.dataIndicators) {
      const dataIndicatorId = dataIndicator.id || uuidv4();
      await dbRun(
        `INSERT INTO data_indicators (
          id, indicator_id, code, name, threshold, description,
          data_source, sort_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          dataIndicatorId,
          indicatorId,
          dataIndicator.code,
          dataIndicator.name,
          dataIndicator.threshold || null,
          dataIndicator.description || null,
          dataIndicator.dataSource || null,
          dataIndicator.sortOrder || 0,
          now,
          now
        ]
      );
      console.log(`    ✓ 插入数据指标: ${dataIndicator.code} ${dataIndicator.name}`);
    }
  }

  // 插入佐证资料
  if (node.supportingMaterials && node.supportingMaterials.length > 0) {
    for (const material of node.supportingMaterials) {
      const materialId = material.id || uuidv4();
      await dbRun(
        `INSERT INTO supporting_materials (
          id, indicator_id, code, name, file_types, max_size,
          description, required, sort_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          materialId,
          indicatorId,
          material.code,
          material.name,
          material.fileTypes || null,
          material.maxSize || null,
          material.description || null,
          material.required ? 1 : 0,
          material.sortOrder || 0,
          now,
          now
        ]
      );
      console.log(`    ✓ 插入佐证资料: ${material.code} ${material.name}`);
    }
  }

  // 递归插入子节点
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      await insertIndicatorNode(child, systemId, indicatorId);
    }
  }

  return indicatorId;
}

/**
 * 主函数
 */
async function main() {
  console.log('\n========================================');
  console.log('学前教育普及普惠督导评估指标体系导入');
  console.log('========================================\n');

  try {
    // 1. 读取JSON文件
    console.log('📖 读取指标体系JSON文件...');
    if (!fs.existsSync(INDICATOR_JSON_PATH)) {
      throw new Error(`指标体系文件不存在: ${INDICATOR_JSON_PATH}`);
    }

    const jsonContent = fs.readFileSync(INDICATOR_JSON_PATH, 'utf-8');
    const indicatorSystem = JSON.parse(jsonContent);
    console.log(`✓ 成功读取: ${indicatorSystem.name}\n`);

    // 2. 检查是否已存在同名指标体系
    console.log('🔍 检查指标体系是否已存在...');
    const existing = await dbGet(
      'SELECT id, name FROM indicator_systems WHERE name = ?',
      [indicatorSystem.name]
    );

    if (existing) {
      console.log(`⚠️  警告: 已存在同名指标体系: ${existing.name} (ID: ${existing.id})`);
      console.log('如需重新导入，请先手动删除该指标体系或修改名称\n');
      process.exit(0);
    }
    console.log('✓ 无重复，可以导入\n');

    // 3. 统计指标数量
    const indicatorCount = countIndicators(indicatorSystem.tree);
    console.log(`📊 统计: 共 ${indicatorCount} 个指标节点\n`);

    // 4. 创建指标体系记录
    console.log('💾 创建指标体系记录...');
    const systemId = uuidv4();
    const now = new Date().toISOString();

    await dbRun(
      `INSERT INTO indicator_systems (
        id, name, type, target, tags, description,
        indicator_count, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        systemId,
        indicatorSystem.name,
        indicatorSystem.type,
        indicatorSystem.target,
        indicatorSystem.tags ? indicatorSystem.tags.join(',') : null,
        indicatorSystem.description || null,
        indicatorCount,
        'published',
        now,
        now
      ]
    );
    console.log(`✓ 指标体系已创建 (ID: ${systemId})\n`);

    // 5. 导入指标树
    console.log('🌳 开始导入指标树...\n');

    for (const rootNode of indicatorSystem.tree) {
      await insertIndicatorNode(rootNode, systemId, null);
    }

    console.log('\n✓ 指标树导入完成\n');

    // 6. 验证导入结果
    console.log('✅ 验证导入结果...');

    const indicators = await dbAll(
      'SELECT level, COUNT(*) as count FROM indicators WHERE system_id = ? GROUP BY level',
      [systemId]
    );

    console.log('指标层级统计:');
    for (const row of indicators) {
      console.log(`  第${row.level}级: ${row.count} 个`);
    }

    const dataIndicators = await dbGet(
      'SELECT COUNT(*) as count FROM data_indicators WHERE indicator_id IN (SELECT id FROM indicators WHERE system_id = ?)',
      [systemId]
    );
    console.log(`数据指标: ${dataIndicators.count} 个`);

    const materials = await dbGet(
      'SELECT COUNT(*) as count FROM supporting_materials WHERE indicator_id IN (SELECT id FROM indicators WHERE system_id = ?)',
      [systemId]
    );
    console.log(`佐证资料: ${materials.count} 个`);

    console.log('\n========================================');
    console.log('✅ 导入成功！');
    console.log('========================================\n');
    console.log(`指标体系ID: ${systemId}`);
    console.log(`指标体系名称: ${indicatorSystem.name}`);
    console.log(`指标总数: ${indicatorCount}`);
    console.log(`数据指标数: ${dataIndicators.count}`);
    console.log(`佐证资料数: ${materials.count}`);
    console.log('\n');

  } catch (error) {
    console.error('\n❌ 导入失败:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    db.close();
  }
}

// 运行主函数
main();
