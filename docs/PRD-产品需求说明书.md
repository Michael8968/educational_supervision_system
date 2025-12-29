# 义务教育优质均衡督导评估系统 - 产品需求说明书 (PRD)

> 版本：v1.0
> 日期：2024年12月
> 状态：实现完成

---

## 目录

1. [产品概述](#一产品概述)
2. [用户角色与权限](#二用户角色与权限)
3. [功能模块详解](#三功能模块详解)
4. [核心业务流程](#四核心业务流程)
5. [数据模型设计](#五数据模型设计)
6. [页面与交互设计](#六页面与交互设计)
7. [API 接口设计](#七api-接口设计)
8. [技术架构](#八技术架构)
9. [部署与配置](#九部署与配置)
10. [附录](#十附录)

---

## 一、产品概述

### 1.1 产品定位

**义务教育优质均衡督导评估系统**是一套面向教育管理部门的综合督导评估管理平台，专门用于：
- **义务教育优质均衡** 状态评估
- **学前教育普及普惠** 督导评估

### 1.2 核心价值

| 价值点 | 说明 |
|--------|------|
| 标准化评估 | 基于国家标准的指标体系，确保评估科学规范 |
| 全流程管理 | 从数据采集到报告生成的完整业务闭环 |
| 多角色协作 | 管理员、采集员、专家、决策者分工明确 |
| 数据驱动决策 | 多维度统计分析，支持科学决策 |

### 1.3 产品范围

```
┌─────────────────────────────────────────────────────────────────┐
│                      教育督导评估系统                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐       │
│  │ 义务教育      │  │ 学前教育      │  │ 专项督导      │       │
│  │ 优质均衡      │  │ 普及普惠      │  │ （规划中）    │       │
│  │ ✅ 已实现     │  │ ✅ 已实现     │  │ ⏳ 待开发     │       │
│  └───────────────┘  └───────────────┘  └───────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、用户角色与权限

### 2.1 角色定义

| 角色代码 | 角色名称 | 核心职责 | 默认入口 |
|----------|----------|----------|----------|
| `admin` | 系统管理员 | 系统配置、库资源管理、用户管理 | `/home` |
| `project_admin` | 项目管理员 | 项目配置、人员管理、数据审核 | `/home` |
| `data_collector` | 数据采集员 | 数据填报、材料上传、问题整改 | `/collector` |
| `project_expert` | 项目评估专家 | 专业评估、指标打分、问题登记 | `/expert` |
| `decision_maker` | 报告决策者 | 查看报告、统计分析、决策支持 | `/reports` |

### 2.2 权限矩阵

| 权限代码 | 说明 | admin | project_admin | data_collector | project_expert | decision_maker |
|----------|------|:-----:|:-------------:|:--------------:|:--------------:|:--------------:|
| `canManageSystem` | 系统管理 | ✓ | | | | |
| `canManageProjects` | 项目管理 | ✓ | ✓ | | | |
| `canConfigProject` | 项目配置 | ✓ | ✓ | | | |
| `canCollectData` | 数据填报 | ✓ | | ✓ | | |
| `canReviewData` | 数据评审 | ✓ | | | ✓ | |
| `canViewReports` | 查看报告 | ✓ | | | | ✓ |

### 2.3 功能访问控制

```
canManageSystem     → /users/*, /home/balanced (库管理), /home/balanced/elements, /home/balanced/indicators, /home/balanced/tools
canManageProjects   → /home, /data-review
canConfigProject    → …/project/:projectId/config, …/project/:projectId/*
canCollectData      → /collector/*, /home/balanced/entry/*, /rectification
canReviewData       → /expert/*
canViewReports      → /reports/*
```

---

## 三、功能模块详解

### 3.1 功能架构图

```
义务教育优质均衡督导评估系统
├── 1. 基础库管理（一次性配置）
│   ├── 1.1 指标体系库
│   ├── 1.2 要素库
│   ├── 1.3 采集工具库
│   └── 1.4 用户账号管理
│
├── 2. 项目管理执行
│   ├── 2.1 项目创建与配置
│   ├── 2.2 项目进度查看
│   ├── 2.3 项目数据分析
│   └── 2.4 项目完成交付
│
├── 3. 数据采集填报
│   ├── 3.1 采集员工作台
│   ├── 3.2 动态表单填报
│   ├── 3.3 佐证材料上传
│   └── 3.4 问题整改管理
│
├── 4. 专业评估评分
│   ├── 4.1 专家工作台
│   ├── 4.2 评估任务管理
│   ├── 4.3 指标逐项评分
│   ├── 4.4 评价意见撰写
│   ├── 4.5 评估结论生成
│   └── 4.6 问题台账登记
│
├── 5. 数据审核验收
│   ├── 5.1 数据审核界面
│   ├── 5.2 填报数据审核
│   ├── 5.3 合规性检查
│   └── 5.4 差异系数分析
│
└── 6. 报告与决策支持
    ├── 6.1 项目报告生成
    ├── 6.2 统计分析报告
    ├── 6.3 排名对标报告
    ├── 6.4 预警示警报告
    └── 6.5 对比分析报告
```

### 3.2 模块详细说明

#### 3.2.1 基础库管理

**指标体系库**
- 功能：创建和管理评估指标体系
- 核心操作：创建体系 → 构建指标树 → 设置权重 → 发布
- 数据结构：三级指标树（一级指标 → 二级指标 → 三级指标/数据指标）

**要素库**
- 功能：管理评估数据要素
- 核心操作：创建要素库 → 定义要素 → 关联指标 → 发布
- 要素类型：基础要素（直接采集）、派生要素（公式计算）

**采集工具库**
- 功能：设计数据采集表单
- 核心操作：创建工具 → 设计字段 → 配置逻辑 → 发布
- 工具类型：表单、问卷

**用户账号管理**
- 功能：管理系统用户账号
- 分类：学校账号管理、专家账号管理

#### 3.2.2 项目管理执行

**项目创建与配置**

项目配置中心包含 5 个核心 Tab：

| Tab | 名称 | 功能 |
|-----|------|------|
| 1 | 评估对象 | 配置参评区县和学校 |
| 2 | 填报账号 | 配置项目人员（管理员、采集员） |
| 3 | 指标体系 | 查看和调整项目指标权重 |
| 4 | 填报任务 | 为采集员分配填报任务 |
| 5 | 专家评估 | 为专家分配评估任务 |

**项目状态流转**

```
配置中 ──发布──→ 填报中 ──进入评审──→ 评审中 ──完成──→ 已完成
   ↑                │                  │
   └────── 重启 ────┴───── 中止 ──────→ 已中止
```

#### 3.2.3 数据采集填报

**采集员工作台**
- 查看分配的项目和任务
- 任务状态：待开始 → 进行中 → 已完成/已逾期

**动态表单填报**
- 根据采集工具定义动态渲染表单
- 支持草稿保存
- 支持附件上传

**问题整改**
- 查看被驳回的数据
- 根据审核意见修改
- 重新提交

#### 3.2.4 专业评估评分

**专家评估工作台（5 个子 Tab）**

| Tab | 功能 | 核心内容 |
|-----|------|----------|
| 指标评分 | 逐项评分 | 指标树、评分面板、评分依据 |
| 数据查阅 | 查看数据 | 学校信息、指标数据、填报记录 |
| 佐证材料 | 材料查看 | 分指标展示、预览下载 |
| 评价意见 | 撰写评价 | 优势、不足、建议、亮点 |
| 评估结论 | 生成结论 | 综合得分、等级、达标判定、问题台账 |

**问题台账**
- 登记发现的问题
- 设置整改期限
- 跟踪整改状态
- 复评验收

#### 3.2.5 数据审核验收

**数据审核界面**
- 统计卡：待审核数、已批准数、已驳回数
- 提交列表：项目、学校、工具、状态
- 操作：查看、批准、驳回

**驳回机制**
- 填写驳回原因
- 设置整改期限
- 通知采集员

#### 3.2.6 报告与决策支持

| 报告类型 | 功能 | 数据来源 |
|----------|------|----------|
| 统计报告 | 全局数据统计 | school_indicator_data, district_statistics |
| 排名报告 | 学校/区县排名 | evaluation_results（综合得分） |
| 预警报告 | 未达标预警 | is_compliant = false 的指标 |
| 对比报告 | 对象对比分析 | 学校/区县数据对比 |
| 项目报告 | 完整评估报告 | 汇总所有数据（可导出 PDF） |

---

## 四、核心业务流程

### 4.1 完整业务流程图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            阶段一：基础库建设                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│    系统管理员                                                                │
│        │                                                                    │
│        ├─→ 创建指标体系 → 构建指标树 → 设置权重 → 发布                       │
│        ├─→ 创建要素库 → 定义要素 → 关联指标 → 发布                           │
│        └─→ 创建采集工具 → 设计表单 → 配置逻辑 → 发布                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          阶段二：项目执行流程                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  步骤1：创建项目（项目管理员）                                               │
│    └─→ 创建项目 → 选择指标体系 → 选择要素库 → 选择采集工具                   │
│                                                                              │
│  步骤2：配置项目（项目管理员）                                               │
│    ├─→ 评估对象：添加区县、学校                                              │
│    ├─→ 人员配置：添加采集员、专家                                            │
│    ├─→ 指标配置：调整权重、达标线                                            │
│    ├─→ 任务分配：为采集员分配任务                                            │
│    └─→ 专家分配：为专家分配评估任务                                          │
│                                                                              │
│  步骤3：发布项目 → 通知相关人员                                              │
│                                                                              │
│  步骤4：数据填报（数据采集员）                                               │
│    └─→ 查看任务 → 填写表单 → 上传材料 → 提交数据                             │
│                                                                              │
│  步骤5：数据审核（项目管理员）                                               │
│    └─→ 审核数据 → 批准/驳回 → 驳回时采集员整改 → 重新提交                    │
│                                                                              │
│  步骤6：专家评估（项目评估专家）                                             │
│    └─→ 查看任务 → 逐项评分 → 撰写评价 → 登记问题 → 提交结论                  │
│                                                                              │
│  步骤7：问题整改（采集员整改，专家复评）                                      │
│    └─→ 采集员整改 → 提交证据 → 专家复评 → 关闭问题                           │
│                                                                              │
│  步骤8：确认结论（项目管理员）                                               │
│    └─→ 审核评估结果 → 确认 → 生成最终评估                                    │
│                                                                              │
│  步骤9：报告生成（报告决策者）                                               │
│    └─→ 统计分析 → 排名对标 → 预警识别 → 导出报告                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 数据流转图

```
数据采集员                  项目管理员                  项目评估专家               报告决策者
     │                          │                          │                         │
     │  填写表单                │                          │                         │
     │───────────────────→ submissions.data (JSON)        │                         │
     │  提交数据                │                          │                         │
     │──────────────────→ status='submitted'              │                         │
     │                          │                          │                         │
     │                          │  审核数据                │                         │
     │                    status='approved'                │                         │
     │                          │                          │                         │
     │                          │──────────────────→ school_indicator_data          │
     │                          │                          │                         │
     │                          │                          │  开始评估               │
     │                          │               expert_assignments.status            │
     │                          │                          │  ='in_progress'         │
     │                          │                          │                         │
     │                          │                          │  逐项评分               │
     │                          │                   indicator_scores                 │
     │                          │                          │                         │
     │                          │                          │  撰写评语               │
     │                          │                   evaluation_comments              │
     │                          │                          │                         │
     │                          │                          │  提交结论               │
     │                          │                   evaluation_results               │
     │                          │                          │                         │
     │                          │  确认结论                │                         │
     │                 evaluation_results.status           │                         │
     │                    ='confirmed'                     │                         │
     │                          │                          │                         │
     │                          │──────────────────────────────────────→ 生成报告    │
     │                          │                          │         统计/排名/预警  │
```

### 4.3 角色与状态权限表

| 项目状态 | 项目管理员 | 采集员 | 专家 | 决策者 |
|----------|:----------:|:------:|:----:|:------:|
| 配置中 | ✓ 完全配置 | ✗ | ✗ | ✗ |
| 填报中 | ✓ 部分编辑 | ✓ 填报数据 | ✓ 查看数据 | ✗ |
| 评审中 | ✓ 审核数据 | ✓ 整改问题 | ✓ 评估打分 | ✗ |
| 已完成 | ✓ 只读 | ✗ | ✗ | ✓ 查看报告 |
| 已中止 | ✓ 只读 | ✗ | ✗ | ✗ |

---

## 五、数据模型设计

### 5.1 核心数据表（42 个表）

#### 5.1.1 基础参考数据（3 个表）

| 表名 | 说明 | 核心字段 |
|------|------|----------|
| districts | 区县表 | code, name, type, parent_code |
| schools | 学校表 | code, name, district_id, school_type, school_category |
| evaluation_years | 评估年度表 | year, name, status |

#### 5.1.2 指标与要素体系（8 个表）

| 表名 | 说明 | 核心字段 |
|------|------|----------|
| indicator_systems | 指标体系表 | name, type, status |
| indicators | 指标树表 | system_id, parent_id, level, weight |
| data_indicators | 数据指标表 | indicator_id, threshold, data_source |
| supporting_materials | 佐证材料配置表 | indicator_id, file_types, required |
| element_libraries | 要素库表 | name, status |
| elements | 要素表 | library_id, element_type, formula |
| data_indicator_elements | 数据指标-要素关联表 | data_indicator_id, element_id |
| supporting_material_elements | 佐证材料-要素关联表 | supporting_material_id, element_id |

#### 5.1.3 采集工具与映射（4 个表）

| 表名 | 说明 | 核心字段 |
|------|------|----------|
| data_tools | 采集工具表 | name, type, schema, status |
| field_mappings | 表单字段映射表 | tool_id, field_id, target_id |
| project_tools | 项目-工具关联表 | project_id, tool_id |
| submissions | 填报记录表 | project_id, form_id, status, data |

#### 5.1.4 项目与人员管理（4 个表）

| 表名 | 说明 | 核心字段 |
|------|------|----------|
| projects | 项目表 | name, indicator_system_id, status |
| project_personnel | 项目人员表 | project_id, name, role, district_id |
| project_samples | 评估样本表 | project_id, sample_type, sample_id |
| tasks | 任务分配表 | project_id, tool_id, assignee_id, status |

#### 5.1.5 评估专家功能表（6 个表）

| 表名 | 说明 | 核心字段 |
|------|------|----------|
| expert_assignments | 评估任务分配表 | project_id, expert_id, target_id, status |
| indicator_scores | 指标评分表 | assignment_id, indicator_id, score, is_compliant |
| evaluation_comments | 评估评语表 | assignment_id, comment_type, content |
| evaluation_results | 评估结论表 | assignment_id, overall_score, is_compliant |
| issue_registry | 问题台账表 | project_id, target_id, severity, status |
| scoring_standards | 评分标准表 | project_id, indicator_id, scoring_type |

#### 5.1.6 达标规则引擎（5 个表）

| 表名 | 说明 | 核心字段 |
|------|------|----------|
| compliance_rules | 达标规则表 | code, rule_type, enabled |
| rule_conditions | 规则条件表 | rule_id, field, operator, value |
| rule_actions | 规则动作表 | rule_id, action_type, config |
| compliance_results | 达标判定结果表 | rule_id, entity_id, is_compliant |
| validation_configs | 数据校验规则表 | target_type, validation_type, config |

#### 5.1.7 统计与分析表（3 个表）

| 表名 | 说明 | 核心字段 |
|------|------|----------|
| school_indicator_data | 学校指标数据表 | project_id, school_id, data_indicator_id, value |
| district_statistics | 区县统计快照表 | project_id, district_id, cv_composite, is_cv_compliant |
| threshold_standards | 阈值标准表 | indicator_id, threshold_value |

### 5.2 核心 ER 关系图

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ indicator_      │       │   indicators    │       │ data_indicators │
│   systems       │──1:N──│                 │──1:N──│                 │
│                 │       │   (指标树)       │       │  (数据指标)      │
└─────────────────┘       └─────────────────┘       └─────────────────┘
                                                            │
                                                           1:N
                                                            │
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│    projects     │──1:N──│ project_        │       │ data_indicator_ │
│                 │       │   personnel     │       │    elements     │
│   (项目)        │       │   (项目人员)     │       │  (指标-要素关联) │
└─────────────────┘       └─────────────────┘       └─────────────────┘
        │                         │                         │
        │ 1:N                    1:N                       N:1
        │                         │                         │
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     tasks       │       │ expert_         │       │    elements     │
│                 │       │   assignments   │       │                 │
│   (任务)        │       │   (评估任务)     │       │    (要素)       │
└─────────────────┘       └─────────────────┘       └─────────────────┘
        │                         │
       1:1                       1:N
        │                         │
┌─────────────────┐       ┌─────────────────┐
│  submissions    │       │ indicator_      │
│                 │       │   scores        │
│   (填报记录)    │       │   (指标评分)     │
└─────────────────┘       └─────────────────┘
```

---

## 六、页面与交互设计

### 6.1 页面总览（按角色分类）

#### 系统管理员页面（9 个）

| 页面 | 路径 | 功能 |
|------|------|------|
| 学校账号管理 | `/users/school-account` | 管理学校数据采集员账号 |
| 专家账号管理 | `/users/expert-account` | 管理项目评估专家账号 |
| 要素库 | `/home/balanced/elements` | 创建、编辑、发布评估要素 |
| 指标体系库 | `/home/balanced/indicators` | 创建、编辑、发布指标体系 |
| 指标编辑 | `…/indicators/:id/edit` | 编辑指标详情、权重 |
| 指标树编辑 | `…/indicators/:id/tree` | 编辑指标层级结构 |
| 工具库 | `/home/balanced/tools` | 创建、编辑、发布采集工具 |
| 工具编辑 | `…/tools/:id/edit` | 可视化表单设计 |
| 项目列表 | `/home/balanced` | 项目创建、发布、删除 |

#### 项目管理员页面（12 个）

| 页面 | 路径 | 功能 |
|------|------|------|
| 系统首页 | `/home` | 显示可用督导模块入口 |
| **项目配置中心** | `…/config` | 项目核心配置（5 个 Tab） |
| 项目指标体系 | `…/indicator-system` | 配置项目指标体系 |
| 项目要素 | `…/elements` | 配置项目评估要素 |
| 区县列表 | `…/detail` | 查看项目下区县 |
| 项目详情 | `…/district/:districtId` | 查看区县学校数据 |
| 数据审核 | `/data-review` | 审核采集员提交的数据 |
| 简历分析 | `…/cv-analysis` | CV 差异系数分析 |
| 合规统计 | `…/compliance` | 合规性统计分析 |
| 评估总结 | `…/evaluation-summary` | 生成评估报告 |

#### 数据采集员页面（5 个）

| 页面 | 路径 | 功能 |
|------|------|------|
| 采集员工作台 | `/collector` | 项目和任务列表 |
| 任务列表 | `/collector/:projectId` | 查看分配任务 |
| 数据填报首页 | `/home/balanced/entry` | 选择项目和工具 |
| 表单填报 | `…/form/:formId` | 动态表单填报 |
| 问题整改 | `/rectification` | 查看并整改问题 |

#### 项目评估专家页面（6 个）

| 页面 | 路径 | 功能 |
|------|------|------|
| 专家工作台 | `/expert` | 项目和评估任务列表 |
| 项目评估详情 | `…/projects/:projectId` | 项目评估概览 |
| 区县评估详情 | `…/districts/:districtId` | 学校评估数据 |
| 评估任务列表 | `/expert/evaluations` | 分配的评估任务 |
| 评估工作台 | `…/evaluations/:id` | 核心评估工作页面 |
| 待审核列表 | `/expert/pending-reviews` | 待审核评估结果 |

#### 报告决策者页面（6 个）

| 页面 | 路径 | 功能 |
|------|------|------|
| 报告列表 | `/reports` | 报告查看入口 |
| 项目报告 | `/reports/:projectId` | 完整项目评估报告 |
| 统计报告 | `/reports/statistics` | 全局数据统计 |
| 排名报告 | `/reports/rankings` | 学校和区县排名 |
| 预警报告 | `/reports/alerts` | 需关注的数据预警 |
| 对比报告 | `/reports/comparison` | 对象对比分析 |

### 6.2 核心页面交互说明

#### 6.2.1 项目配置中心

**页面结构：**
```
┌─────────────────────────────────────────────────────────────────┐
│ ← 返回    评估项目配置               [评估指标体系] [评估要素]   │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 项目名称              关联指标体系                          │ │
│ │ 项目周期：2025-04-01 至 2025-06-30       [配置中] 状态      │ │
│ │ 附件：[政策文件.pdf] [评估标准.pdf]                         │ │
│ │                                          [发布项目] [中止]  │ │
│ └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ [评估对象] [填报账号] [指标体系] [填报任务] [专家评估]          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                      Tab 内容区域                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 6.2.2 专家评估工作台

**页面结构：**
```
┌─────────────────────────────────────────────────────────────────┐
│ ← 返回    XX学校评估                              [保存] [提交]  │
├─────────────────────────────────────────────────────────────────┤
│ [指标评分] [数据查阅] [佐证材料] [评价意见] [评估结论]          │
├─────────────────────────────────────────────────────────────────┤
│ ┌────────────────┐ ┌──────────────────────────────────────────┐ │
│ │                │ │                                          │ │
│ │   指标树       │ │          评分面板                        │ │
│ │   (左侧)       │ │                                          │ │
│ │                │ │  指标名称：XXXX                          │ │
│ │  ▼ 一级指标1   │ │  评分标准：达标线≥XX                     │ │
│ │    ▼ 二级1.1   │ │  实际值：XX                              │ │
│ │      ● 三级1   │ │                                          │ │
│ │      ○ 三级2   │ │  达标判定：✓ 达标 / ✗ 不达标             │ │
│ │      ○ 三级3   │ │  评分等级：[A] [B] [C] [D]               │ │
│ │    ▶ 二级1.2   │ │  评分依据：_______________               │ │
│ │  ▶ 一级指标2   │ │                                          │ │
│ │                │ │  相关数据：[历史趋势] [区县平均]         │ │
│ │                │ │            [全市平均] [佐证材料]         │ │
│ └────────────────┘ └──────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

#### 6.2.3 数据审核页面

**页面结构：**
```
┌─────────────────────────────────────────────────────────────────┐
│ 数据审核                                                        │
├─────────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│ │ 待审核   │ │ 已批准   │ │ 已驳回   │ │ 合规率   │            │
│ │   15     │ │   42     │ │   3      │ │  93.3%   │            │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
├─────────────────────────────────────────────────────────────────┤
│ 项目：[全部 ▼]  状态：[全部 ▼]  搜索：[____________]           │
├─────────────────────────────────────────────────────────────────┤
│ │ 项目     │ 学校     │ 工具     │ 提交人 │ 时间   │ 状态 │操作│
│ │─────────────────────────────────────────────────────────────│ │
│ │ 项目A    │ XX小学   │ 教师信息 │ 张三   │ 12-20  │待审核│查看│
│ │ 项目A    │ YY中学   │ 设备清单 │ 李四   │ 12-19  │待审核│查看│
│ │ ...      │ ...      │ ...      │ ...    │ ...    │ ...  │... │
└─────────────────────────────────────────────────────────────────┘
```

---

## 七、API 接口设计

### 7.1 API 端点总览

#### 项目管理 API

```
GET    /api/projects                    # 获取项目列表
POST   /api/projects                    # 创建项目
GET    /api/projects/:id                # 获取项目详情
PUT    /api/projects/:id                # 更新项目
DELETE /api/projects/:id                # 删除项目
POST   /api/projects/:id/publish        # 发布项目
POST   /api/projects/:id/start          # 启动填报
POST   /api/projects/:id/review         # 进入评审
POST   /api/projects/:id/complete       # 完成项目
POST   /api/projects/:id/stop           # 中止项目
POST   /api/projects/:id/restart        # 重启项目
```

#### 人员管理 API

```
GET    /api/projects/:projectId/personnel
POST   /api/projects/:projectId/personnel
PUT    /api/projects/:projectId/personnel/:id
DELETE /api/projects/:projectId/personnel/:id
GET    /api/users
POST   /api/users
PUT    /api/users/:id
POST   /api/users/:id/reset-password
```

#### 任务管理 API

```
GET    /api/projects/:projectId/tasks
POST   /api/projects/:projectId/tasks
PUT    /api/projects/:projectId/tasks/:id
DELETE /api/projects/:projectId/tasks/:id
POST   /api/tasks/:id/complete
```

#### 填报与审核 API

```
GET    /api/submissions?projectId=&status=
POST   /api/submissions
PUT    /api/submissions/:id
POST   /api/submissions/:id/approve
POST   /api/submissions/:id/reject
POST   /api/submissions/:id/upload-material
```

#### 评估专家 API

```
GET    /api/expert/evaluations              # 获取评估任务列表
GET    /api/expert/evaluations/:id          # 获取评估详情
POST   /api/expert/evaluations/:id/start    # 开始评估
POST   /api/expert/evaluations/:id/submit   # 提交评估
POST   /api/expert/evaluations/:id/scores   # 保存评分
GET    /api/expert/evaluations/:id/scores   # 获取评分
POST   /api/expert/evaluations/:id/comments # 添加评语
GET    /api/expert/evaluations/:id/comments # 获取评语
PUT    /api/expert/comments/:id             # 更新评语
DELETE /api/expert/comments/:id             # 删除评语
GET    /api/expert/evaluations/:id/result   # 获取评估结论
PUT    /api/expert/evaluations/:id/result   # 保存评估结论
POST   /api/expert/evaluations/:id/issues   # 登记问题
GET    /api/projects/:projectId/issues      # 获取问题列表
POST   /api/expert/issues/:id/review        # 复评问题
```

#### 报告分析 API

```
GET    /api/reports
GET    /api/reports/:projectId
POST   /api/reports/:projectId/generate
GET    /api/reports/statistics
GET    /api/reports/rankings
GET    /api/reports/alerts
GET    /api/reports/comparison
```

### 7.2 核心接口示例

#### 创建项目

```http
POST /api/projects
Content-Type: application/json

{
  "name": "2024年义务教育优质均衡评估",
  "description": "针对全市义务教育学校的质量监测",
  "indicatorSystemId": "ind-sys-001",
  "elementLibraryId": "elem-lib-001",
  "startDate": "2024-04-01",
  "endDate": "2024-06-30"
}

Response 201:
{
  "id": "proj-001",
  "name": "2024年义务教育优质均衡评估",
  "status": "配置中",
  ...
}
```

#### 保存指标评分

```http
POST /api/expert/evaluations/:id/scores
Content-Type: application/json

{
  "indicatorId": "ind-001",
  "score": 85,
  "scoreLevel": "B",
  "isCompliant": true,
  "scoreBasis": "学校师生比为1:15，符合标准要求"
}

Response 200:
{
  "id": "score-001",
  "assignmentId": "eval-001",
  "indicatorId": "ind-001",
  "score": 85,
  "scoreLevel": "B",
  "isCompliant": true,
  "scoreBasis": "学校师生比为1:15，符合标准要求",
  "scoredAt": "2024-12-29T10:30:00Z"
}
```

---

## 八、技术架构

### 8.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户层                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ 系统管理员│ │ 项目管理员│ │ 数据采集员│ │ 评估专家 │ │决策者│  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        前端应用层                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ React 18 + TypeScript + Ant Design                         │ │
│  │ ├── pages/          # 36 个功能页面                        │ │
│  │ ├── services/       # 23 个 API 服务                       │ │
│  │ ├── components/     # 通用组件                             │ │
│  │ ├── stores/         # Zustand 状态管理                     │ │
│  │ └── App.tsx         # 路由配置 (90+ 路由)                  │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API 服务层                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Node.js + Express                                          │ │
│  │ ├── routes/         # API 路由                             │ │
│  │ ├── controllers/    # 业务控制器                           │ │
│  │ └── utils/          # 工具函数                             │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        数据存储层                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ PostgreSQL (Supabase)                                      │ │
│  │ ├── 42 个业务表                                            │ │
│  │ ├── 外键约束和索引                                         │ │
│  │ └── 存储过程和触发器                                       │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 技术栈详情

| 层级 | 技术选型 | 版本 |
|------|----------|------|
| 前端框架 | React | 18.x |
| 语言 | TypeScript | 5.x |
| UI 组件库 | Ant Design | 5.x |
| 状态管理 | Zustand | 4.x |
| 路由 | React Router | 6.x |
| 样式 | CSS Modules | - |
| 后端框架 | Express | 4.x |
| 运行时 | Node.js | 18.x |
| 数据库 | PostgreSQL | 15.x |
| 数据库托管 | Supabase | - |

---

## 九、部署与配置

### 9.1 环境变量

```bash
# 前端环境变量
REACT_APP_USE_MOCK=false          # 是否使用 Mock 数据
REACT_APP_API_BASE_URL=http://localhost:3001/api

# 后端环境变量
DATABASE_URL=postgresql://...      # Supabase 连接字符串
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=xxx
PORT=3001
```

### 9.2 项目结构

```
educational_supervision_system/
├── frontend/
│   ├── src/
│   │   ├── pages/              # 36 个功能页面
│   │   ├── services/           # 23 个 API 服务
│   │   ├── components/         # 通用组件
│   │   ├── stores/             # Zustand 状态管理
│   │   ├── layouts/            # 页面布局
│   │   └── App.tsx             # 路由配置
│   └── package.json
├── backend/
│   ├── routes/                 # Express API 路由
│   ├── database/
│   │   ├── schema.sql          # 核心表结构
│   │   ├── supabase-setup.sql  # Supabase 初始化
│   │   ├── migrations/         # 迁移脚本
│   │   └── add-*.sql           # 功能扩展脚本
│   └── package.json
├── docs/
│   ├── pages-and-dialogs-summary.md
│   ├── PRD-产品需求说明书.md
│   └── screenshots/
└── scripts/
    └── screenshot-pages.js     # 截图自动化脚本
```

### 9.3 数据库初始化

```bash
# 1. 创建核心表结构
psql -f backend/database/schema.sql

# 2. Supabase 初始化
psql -f backend/database/supabase-setup.sql

# 3. 执行迁移脚本
psql -f backend/database/migrations/*.sql

# 4. 功能扩展（如学前教育支持）
psql -f backend/database/add-preschool-support.sql
```

---

## 十、附录

### 10.1 测试账号

| 角色 | 手机号 | 密码 | 入口 |
|------|--------|------|------|
| 系统管理员 | 13800000000 | 000000 | `/home` |
| 项目管理员 | 13900139003 | Pass@123456 | `/home` |
| 数据采集员 | 13700137006 | Pass@123456 | `/collector` |
| 项目评估专家 | 13600136005 | Pass@123456 | `/expert` |
| 报告决策者 | 13500135003 | Pass@123456 | `/reports` |

### 10.2 相关文档

| 文档 | 路径 | 说明 |
|------|------|------|
| 页面汇总 | `docs/pages-and-dialogs-summary.md` | 所有页面和对话框详情 |
| 截图目录 | `docs/screenshots/` | 按角色分类的页面截图 |

### 10.3 术语表

| 术语 | 说明 |
|------|------|
| 指标体系 | 评估标准的层级结构（一级→二级→三级指标） |
| 要素 | 具体的数据采集项，可直接采集或公式计算 |
| 采集工具 | 数据采集表单，定义字段和逻辑 |
| 达标判定 | 根据阈值判断学校/区县是否达标 |
| CV 系数 | 差异系数，衡量数据离散程度 |
| 问题台账 | 评估发现的问题记录，需跟踪整改 |

### 10.4 版本历史

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v1.0 | 2025-12 | 初始版本，完成核心功能实现 |

---

*文档生成日期：2025年12月29日*
