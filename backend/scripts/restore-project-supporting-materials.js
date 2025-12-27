/**
 * 恢复项目佐证材料
 *
 * 用于修复项目创建后佐证材料丢失的问题
 *
 * 使用方法：
 * node backend/scripts/restore-project-supporting-materials.js [projectId]
 */

require("dotenv").config();
const db = require("../database/db");

// 生成唯一ID
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

// 获取当前时间
const now = () => new Date().toISOString();

async function restoreProjectSupportingMaterials(projectId) {
  console.log(`\n===== 恢复项目 ${projectId} 的佐证材料 =====\n`);

  // 1. 获取项目信息
  const { data: project, error: projErr } = await db.from("projects")
    .select("id, name, indicator_system_id")
    .eq("id", projectId)
    .single();

  if (projErr || !project) {
    console.error("项目不存在:", projErr?.message);
    return;
  }

  console.log("项目名称:", project.name);
  console.log("关联的模板指标体系ID:", project.indicator_system_id);

  const sourceSystemId = project.indicator_system_id;
  if (!sourceSystemId) {
    console.error("项目未关联指标体系模板");
    return;
  }

  // 2. 获取项目的叶子指标
  const { data: projectIndicators } = await db.from("project_indicators")
    .select("id, code, name, is_leaf")
    .eq("project_id", projectId)
    .eq("is_leaf", 1);

  console.log("项目叶子指标数量:", projectIndicators?.length);

  if (!projectIndicators || projectIndicators.length === 0) {
    console.error("项目没有叶子指标");
    return;
  }

  // 3. 获取模板的叶子指标
  const { data: templateIndicators } = await db.from("indicators")
    .select("id, code, name")
    .eq("system_id", sourceSystemId)
    .eq("is_leaf", 1);

  console.log("模板叶子指标数量:", templateIndicators?.length);

  // 4. 建立 code -> 项目指标ID 的映射
  const codeToProjectIndicatorId = {};
  projectIndicators.forEach(ind => {
    codeToProjectIndicatorId[ind.code] = ind.id;
  });

  // 5. 建立 模板指标ID -> 项目指标ID 的映射（通过 code）
  const templateIdToProjectId = {};
  templateIndicators?.forEach(tpl => {
    const projectIndicatorId = codeToProjectIndicatorId[tpl.code];
    if (projectIndicatorId) {
      templateIdToProjectId[tpl.id] = projectIndicatorId;
    }
  });

  console.log("ID映射数量:", Object.keys(templateIdToProjectId).length);

  // 6. 获取模板佐证材料
  const templateIndicatorIds = Object.keys(templateIdToProjectId);
  if (templateIndicatorIds.length === 0) {
    console.error("无法建立指标ID映射");
    return;
  }

  const { data: templateMaterials } = await db.from("supporting_materials")
    .select("*")
    .in("indicator_id", templateIndicatorIds)
    .order("sort_order", { ascending: true });

  console.log("模板佐证材料数量:", templateMaterials?.length);

  if (!templateMaterials || templateMaterials.length === 0) {
    console.log("模板没有佐证材料，无需恢复");
    return;
  }

  // 7. 检查项目当前的佐证材料数量
  const { data: currentMaterials } = await db.from("project_supporting_materials")
    .select("id")
    .eq("project_id", projectId);

  console.log("项目当前佐证材料数量:", currentMaterials?.length);

  // 8. 复制佐证材料到项目
  console.log("\n开始复制佐证材料...\n");

  const timestamp = now();
  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (const material of templateMaterials) {
    const newIndicatorId = templateIdToProjectId[material.indicator_id];
    if (!newIndicatorId) {
      console.log(`  跳过: ${material.code} - 找不到对应的项目指标`);
      skipCount++;
      continue;
    }

    // 检查是否已存在同样的佐证材料（按 code 和 indicator_id 判断）
    const { data: existing } = await db.from("project_supporting_materials")
      .select("id")
      .eq("project_id", projectId)
      .eq("indicator_id", newIndicatorId)
      .eq("code", material.code)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`  已存在: ${material.code}`);
      skipCount++;
      continue;
    }

    // 处理 max_size 字段（可能是字符串如 "20MB" 或数字）
    let maxSize = material.max_size;
    if (typeof maxSize === 'string') {
      const match = maxSize.match(/^(\d+)/);
      maxSize = match ? parseInt(match[1], 10) : null;
    }

    const newMaterial = {
      id: generateId(),
      project_id: projectId,
      indicator_id: newIndicatorId,
      code: material.code,
      name: material.name,
      file_types: material.file_types,
      max_size: maxSize,
      description: material.description,
      required: material.required,
      sort_order: material.sort_order,
      created_at: timestamp,
      updated_at: timestamp
    };

    const { error: insertErr } = await db.from("project_supporting_materials").insert(newMaterial);

    if (insertErr) {
      console.error(`  失败: ${material.code} - ${insertErr.message}`);
      failCount++;
    } else {
      console.log(`  成功: ${material.code} -> indicator_id: ${newIndicatorId}`);
      successCount++;
    }
  }

  // 9. 汇总
  console.log("\n===== 恢复完成 =====");
  console.log(`成功: ${successCount}, 跳过: ${skipCount}, 失败: ${failCount}`);

  // 10. 验证
  const { data: finalMaterials } = await db.from("project_supporting_materials")
    .select("id")
    .eq("project_id", projectId);

  console.log(`\n项目最终佐证材料数量: ${finalMaterials?.length}`);
}

// 主函数
async function main() {
  const projectId = process.argv[2] || "mjnvbpfjcohexn7lv"; // 默认项目 11

  try {
    await restoreProjectSupportingMaterials(projectId);
  } catch (error) {
    console.error("恢复过程出错:", error.message);
  }

  process.exit(0);
}

main();
