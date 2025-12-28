# 评估专家功能重构方案

> 版本：1.0
> 日期：2025-01-28
> 状态：设计中

## 一、方案概述

### 1.1 背景

当前系统中评估专家的功能定位为"数据审核员"，主要工作是对采集员提交的数据进行通过/驳回操作。这与教育督导实际业务需求存在较大差距。

### 1.2 目标

将评估专家从"审核员"转变为"专业评估者"：

| 维度 | 原设计（审核员） | 新设计（评估专家） |
|------|-----------------|-------------------|
| 核心动作 | 通过/驳回 | 专业评分 + 定性评价 |
| 工作对象 | 单条提交记录 | 评估对象（学校/区县） |
| 产出物 | 审核结论 | 评估报告 + 改进建议 |
| 价值体现 | 数据把关 | 专业判断与指导 |

### 1.3 核心原则

1. **审核功能转给项目管理员**：数据审核是管理工作，由项目管理员负责
2. **专家专注专业评估**：专家的核心价值在于专业判断和指导改进
3. **评估以对象为中心**：按学校/区县整体评估，而非逐条审核数据

---

## 二、现有功能处理清单

### 2.1 保留的功能

| 模块 | 功能 | 文件位置 | 说明 |
|------|------|---------|------|
| 提交状态管理 | submissions.status 字段 | `backend/database/schema.sql` | 保留 draft/submitted/approved/rejected 状态 |
| 审核接口 | `/submissions/:id/approve` | `backend/routes/submissions.js:1730` | 项目管理员使用 |
| 审核接口 | `/submissions/:id/reject` | `backend/routes/submissions.js:1846` | 项目管理员使用 |
| 审核开关 | `project_tools.require_review` | `backend/database/schema.sql` | 控制工具提交是否需审核 |
| 项目人员 | `project_personnel` 表 | `backend/database/schema.sql` | 保留 project_expert 角色 |
| 任务配置 | `tasks.requires_review` | `backend/routes/tasks.js` | 保留，由项目管理员审核 |

### 2.2 需要修改的功能

| 模块 | 当前功能 | 修改内容 | 文件位置 |
|------|---------|---------|---------|
| ExpertReviewTab | 审核任务分配+审核操作 | 改为仅显示审核统计，审核操作移至单独界面 | `frontend/src/pages/ProjectConfig/components/ExpertReviewTab.tsx` |
| 任务分配 | `tasks.reviewer_id` 字段 | 移除该字段，审核由项目管理员统一处理 | `backend/database/add-task-config-fields.sql` |

### 2.3 需要移除的功能

| 模块 | 功能 | 文件位置 | 替代方案 |
|------|------|---------|---------|
| 审核任务分配表 | `review_assignments` | `backend/database/schema.sql:544` | 新建 `expert_assignments` 表 |
| 审核范围表 | `reviewer_scopes` | `backend/database/schema.sql:566` | 新建 `expert_evaluation_scopes` 表 |
| 审核分配API | `/review-assignments/*` | `backend/routes/reviewAssignments.js` | 新建 `/evaluations/*` API |
| 专家端审核 | SubmissionList 中的审核按钮 | `frontend/src/pages/ExpertProjectDetail/components/SubmissionList.tsx` | 改为查看功能 |
| 审核分配服务 | reviewAssignmentService | `frontend/src/services/reviewAssignmentService.ts` | 新建 evaluationService |

### 2.4 需要新增的功能

详见第三节"新功能设计"。

---

## 三、新功能设计

### 3.1 功能模块总览

```
评估专家功能体系
│
├─ 1. 评估任务管理
│     ├─ 待评估对象列表
│     ├─ 评估进度跟踪
│     └─ 评估截止提醒
│
├─ 2. 数据查阅与分析
│     ├─ 指标数据查看（按学校/区县）
│     ├─ 佐证材料查阅
│     ├─ 数据对比分析
│     └─ 历史数据趋势
│
├─ 3. 专业评估打分
│     ├─ 指标逐项评分（按评分标准）
│     ├─ 评分依据说明
│     ├─ 自动/手动达标判定
│     └─ 多专家协同评分
│
├─ 4. 定性评价撰写
│     ├─ 整体评价（优势/不足）
│     ├─ 问题诊断
│     ├─ 改进建议
│     └─ 亮点与创新
│
├─ 5. 评估报告生成
│     ├─ 单校评估报告
│     ├─ 区县汇总报告
│     └─ 专家意见汇总
│
└─ 6. 问题跟踪
      ├─ 问题台账登记
      ├─ 整改跟踪
      └─ 复评验收
```

### 3.2 数据库设计

#### 3.2.1 评估任务分配表（expert_assignments）

```sql
-- 替代原 review_assignments 表
CREATE TABLE expert_assignments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  expert_id TEXT NOT NULL,                -- project_personnel.id (role='project_expert')

  -- 评估对象（学校或区县）
  target_type TEXT NOT NULL,              -- 'school' | 'district'
  target_id TEXT NOT NULL,                -- project_samples.id

  -- 评估范围
  indicator_scope TEXT DEFAULT 'all',     -- 'all' | 'partial'（全部指标或部分指标）

  -- 状态与时间
  status TEXT DEFAULT 'pending',          -- pending | in_progress | completed | submitted
  assigned_at TEXT,
  started_at TEXT,
  completed_at TEXT,
  due_date TEXT,

  -- 元数据
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT,

  UNIQUE(project_id, expert_id, target_id)
);

CREATE INDEX idx_expert_assignments_expert ON expert_assignments(expert_id);
CREATE INDEX idx_expert_assignments_target ON expert_assignments(target_type, target_id);
CREATE INDEX idx_expert_assignments_status ON expert_assignments(status);
```

#### 3.2.2 指标评分表（indicator_scores）

```sql
-- 专家对每个指标的评分记录
CREATE TABLE indicator_scores (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL,            -- expert_assignments.id
  project_id TEXT NOT NULL,
  expert_id TEXT NOT NULL,
  target_id TEXT NOT NULL,                -- 评估对象ID

  -- 指标信息
  indicator_id TEXT NOT NULL,             -- indicators.id（末级指标）
  indicator_code TEXT,                    -- 指标编码，冗余存储便于查询

  -- 评分结果
  score REAL,                             -- 评分值（如 0-100 或等级对应分）
  score_level TEXT,                       -- 等级：A/B/C/D 或 优秀/良好/合格/不合格
  is_compliant BOOLEAN,                   -- 是否达标

  -- 评分依据
  score_basis TEXT,                       -- 评分依据说明（专家填写）
  data_reference TEXT,                    -- 引用的数据（JSON，记录评分时的数据快照）

  -- 时间戳
  scored_at TEXT,
  updated_at TEXT,

  UNIQUE(assignment_id, indicator_id)
);

CREATE INDEX idx_indicator_scores_assignment ON indicator_scores(assignment_id);
CREATE INDEX idx_indicator_scores_indicator ON indicator_scores(indicator_id);
```

#### 3.2.3 评估评语表（evaluation_comments）

```sql
-- 专家对评估对象的定性评价
CREATE TABLE evaluation_comments (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL,            -- expert_assignments.id
  project_id TEXT NOT NULL,
  expert_id TEXT NOT NULL,
  target_id TEXT NOT NULL,

  -- 评价类型
  comment_type TEXT NOT NULL,             -- 'strength' | 'weakness' | 'suggestion' | 'highlight' | 'overall'

  -- 评价内容
  content TEXT NOT NULL,                  -- 评价内容
  related_indicators TEXT,                -- 关联的指标ID列表（JSON数组）
  priority INTEGER DEFAULT 0,             -- 优先级/重要程度（用于排序）

  -- 时间戳
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);

CREATE INDEX idx_evaluation_comments_assignment ON evaluation_comments(assignment_id);
CREATE INDEX idx_evaluation_comments_type ON evaluation_comments(comment_type);
```

#### 3.2.4 评估结论表（evaluation_results）

```sql
-- 评估最终结论
CREATE TABLE evaluation_results (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL UNIQUE,     -- expert_assignments.id
  project_id TEXT NOT NULL,
  expert_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_type TEXT NOT NULL,

  -- 评估结论
  overall_score REAL,                     -- 综合得分
  overall_level TEXT,                     -- 综合等级：优秀/良好/合格/不合格
  is_compliant BOOLEAN,                   -- 整体是否达标
  compliance_rate REAL,                   -- 达标率（达标指标数/总指标数）

  -- 评估摘要
  summary TEXT,                           -- 总体评价摘要
  main_strengths TEXT,                    -- 主要优势（JSON数组）
  main_weaknesses TEXT,                   -- 主要不足（JSON数组）
  key_suggestions TEXT,                   -- 关键建议（JSON数组）

  -- 状态
  status TEXT DEFAULT 'draft',            -- draft | submitted | confirmed
  submitted_at TEXT,
  confirmed_at TEXT,
  confirmed_by TEXT,                      -- 确认人（项目管理员）

  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);

CREATE INDEX idx_evaluation_results_target ON evaluation_results(target_type, target_id);
CREATE INDEX idx_evaluation_results_project ON evaluation_results(project_id);
```

#### 3.2.5 问题台账表（issue_registry）

```sql
-- 评估发现的问题跟踪
CREATE TABLE issue_registry (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  target_id TEXT NOT NULL,                -- 评估对象
  target_type TEXT NOT NULL,

  -- 问题信息
  issue_code TEXT,                        -- 问题编号（自动生成）
  title TEXT NOT NULL,                    -- 问题标题
  description TEXT,                       -- 问题描述
  related_indicators TEXT,                -- 关联指标（JSON数组）
  severity TEXT DEFAULT 'medium',         -- 严重程度：high | medium | low

  -- 发现信息
  found_by TEXT NOT NULL,                 -- 发现人（expert_id）
  found_at TEXT,
  evaluation_id TEXT,                     -- 关联的评估结论

  -- 整改要求
  rectification_required BOOLEAN DEFAULT true,
  rectification_deadline TEXT,
  rectification_suggestion TEXT,          -- 整改建议

  -- 整改状态
  status TEXT DEFAULT 'open',             -- open | rectifying | resolved | closed | waived
  rectified_at TEXT,
  rectification_evidence TEXT,            -- 整改佐证（JSON，文件列表）

  -- 复评信息
  review_status TEXT,                     -- pending_review | reviewed
  reviewed_by TEXT,
  reviewed_at TEXT,
  review_result TEXT,                     -- passed | failed
  review_comment TEXT,

  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);

CREATE INDEX idx_issue_registry_target ON issue_registry(target_id);
CREATE INDEX idx_issue_registry_status ON issue_registry(status);
CREATE INDEX idx_issue_registry_project ON issue_registry(project_id);
```

#### 3.2.6 评分标准表（scoring_standards）

```sql
-- 指标评分标准配置
CREATE TABLE scoring_standards (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  indicator_id TEXT NOT NULL,

  -- 评分方式
  scoring_type TEXT NOT NULL,             -- 'numeric' | 'level' | 'binary'

  -- 数值型评分配置
  max_score REAL DEFAULT 100,
  min_score REAL DEFAULT 0,
  pass_score REAL,                        -- 及格分

  -- 等级型评分配置
  levels TEXT,                            -- JSON: [{"level": "A", "label": "优秀", "min": 90, "max": 100}, ...]

  -- 评分指南
  scoring_guide TEXT,                     -- 评分指南/细则
  reference_materials TEXT,               -- 参考材料（JSON数组）

  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT,

  UNIQUE(project_id, indicator_id)
);
```

### 3.3 API 接口设计

#### 3.3.1 评估任务接口

```
# 获取专家的评估任务列表
GET /api/expert/evaluations
Query: { status?, projectId? }
Response: {
  evaluations: [{
    id, projectId, projectName,
    targetType, targetId, targetName,
    status, dueDate,
    progress: { scored: 10, total: 25 }
  }]
}

# 获取单个评估任务详情
GET /api/expert/evaluations/:id
Response: {
  evaluation: { ... },
  target: { id, name, type, ... },
  indicators: [{ id, code, name, parentId, hasScored, currentScore }],
  submissions: [{ id, formName, submittedAt, data }],
  materials: [{ id, name, url, indicatorId }]
}

# 开始评估任务
POST /api/expert/evaluations/:id/start
Response: { success: true, startedAt }

# 提交评估任务
POST /api/expert/evaluations/:id/submit
Body: { summary }
Response: { success: true, submittedAt }
```

#### 3.3.2 指标评分接口

```
# 获取指标评分标准
GET /api/projects/:projectId/indicators/:indicatorId/scoring-standard
Response: {
  scoringType: 'level',
  levels: [
    { level: 'A', label: '优秀', min: 90, max: 100, description: '...' },
    { level: 'B', label: '良好', min: 75, max: 89, description: '...' }
  ],
  scoringGuide: '...'
}

# 获取指标相关数据（用于评分参考）
GET /api/expert/evaluations/:evaluationId/indicators/:indicatorId/data
Response: {
  indicator: { id, code, name, threshold, unit },
  actualData: { value: 18.5, source: 'submission', submittedAt: '...' },
  historicalData: [...],
  comparisonData: { districtAvg: 17.2, cityAvg: 16.8 },
  materials: [...]
}

# 保存指标评分
POST /api/expert/evaluations/:evaluationId/scores
Body: {
  indicatorId: 'xxx',
  score: 85,
  scoreLevel: 'B',
  isCompliant: true,
  scoreBasis: '评分依据说明...'
}

# 批量保存评分
POST /api/expert/evaluations/:evaluationId/scores/batch
Body: {
  scores: [{ indicatorId, score, scoreLevel, isCompliant, scoreBasis }, ...]
}
```

#### 3.3.3 评价评语接口

```
# 获取评估对象的所有评语
GET /api/expert/evaluations/:evaluationId/comments
Response: {
  comments: {
    strengths: [{ id, content, relatedIndicators, priority }],
    weaknesses: [...],
    suggestions: [...],
    highlights: [...],
    overall: [...]
  }
}

# 添加评语
POST /api/expert/evaluations/:evaluationId/comments
Body: {
  commentType: 'weakness',
  content: '问题描述...',
  relatedIndicators: ['ind_001', 'ind_002'],
  priority: 1
}

# 更新评语
PUT /api/expert/comments/:commentId
Body: { content, priority }

# 删除评语
DELETE /api/expert/comments/:commentId
```

#### 3.3.4 评估结论接口

```
# 获取评估结论
GET /api/expert/evaluations/:evaluationId/result
Response: {
  result: {
    overallScore: 82.5,
    overallLevel: '良好',
    isCompliant: true,
    complianceRate: 0.88,
    summary: '...',
    mainStrengths: [...],
    mainWeaknesses: [...],
    keySuggestions: [...]
  },
  scoreDistribution: { excellent: 5, good: 12, qualified: 6, unqualified: 2 }
}

# 保存评估结论
PUT /api/expert/evaluations/:evaluationId/result
Body: {
  overallScore: 82.5,
  overallLevel: '良好',
  isCompliant: true,
  summary: '总体评价...',
  mainStrengths: [...],
  mainWeaknesses: [...],
  keySuggestions: [...]
}

# 生成评估报告
POST /api/expert/evaluations/:evaluationId/report/generate
Response: { reportId: 'xxx', reportUrl: '/reports/xxx.pdf' }
```

#### 3.3.5 问题台账接口

```
# 登记问题
POST /api/expert/evaluations/:evaluationId/issues
Body: {
  title: '问题标题',
  description: '问题描述',
  relatedIndicators: ['ind_001'],
  severity: 'medium',
  rectificationDeadline: '2025-06-30',
  rectificationSuggestion: '整改建议'
}

# 获取问题列表
GET /api/projects/:projectId/issues
Query: { targetId?, status?, severity? }

# 提交整改证据（被评对象使用）
PUT /api/issues/:issueId/rectify
Body: {
  rectificationEvidence: [{ fileName, fileUrl }],
  description: '整改说明'
}

# 复评问题（专家使用）
POST /api/expert/issues/:issueId/review
Body: { result: 'passed', comment: '复评意见' }
```

#### 3.3.6 项目管理员接口

```
# 分配评估任务
POST /api/projects/:projectId/expert-assignments
Body: {
  expertId: 'xxx',
  targets: [{ type: 'school', id: 'xxx' }, ...],
  dueDate: '2025-03-01'
}

# 获取评估任务统计
GET /api/projects/:projectId/expert-assignments/stats
Response: {
  total: 50,
  pending: 20,
  inProgress: 15,
  completed: 15,
  byExpert: [{ expertId, expertName, total, completed }]
}

# 确认评估结论
POST /api/projects/:projectId/evaluation-results/:id/confirm
```

### 3.4 前端页面设计

#### 3.4.1 页面路由

```
/expert                              # 专家工作台首页
/expert/projects/:projectId          # 项目评估总览
/expert/evaluations/:evaluationId    # 评估工作台（核心页面）
/expert/evaluations/:evaluationId/report  # 评估报告预览
/expert/issues                       # 问题台账管理
```

#### 3.4.2 评估工作台页面（核心）

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← 返回    XX学校 评估工作台                    进度: 18/25  [提交评估] │
├─────────────────────────────────────────────────────────────────────┤
│  [指标评分]  [数据查阅]  [佐证材料]  [评价意见]  [评估结论]            │
├───────────────────────────────┬─────────────────────────────────────┤
│                               │                                     │
│  指标树                       │  评分区域                            │
│  ├─ 一级指标1                 │  ┌─────────────────────────────────┐ │
│  │  ├─ 二级指标1.1 ✓         │  │ 指标: 1.2.1 生师比              │ │
│  │  │  ├─ 1.1.1 ✓           │  │ 标准: ≤19                       │ │
│  │  │  └─ 1.1.2 ✓           │  │ 实际值: 18.5                     │ │
│  │  └─ 二级指标1.2           │  │ 数据来源: 学校基础信息表         │ │
│  │     ├─ 1.2.1 ○ ←当前     │  │                                 │ │
│  │     └─ 1.2.2              │  │ [达标 ✓]  [不达标]              │ │
│  │                           │  │                                 │ │
│  ├─ 一级指标2                 │  │ 评分: [A 优秀 ▼]                │ │
│  │  └─ ...                   │  │                                 │ │
│  │                           │  │ 评分依据:                        │ │
│  └─ 一级指标3                 │  │ ┌─────────────────────────────┐ │ │
│     └─ ...                   │  │ │ 该校生师比18.5，优于标准值   │ │ │
│                               │  │ │ 19，且近三年持续改善...     │ │ │
│  图例:                        │  │ └─────────────────────────────┘ │ │
│  ✓ 已评分  ○ 当前  · 未评分   │  │                                 │ │
│                               │  │        [保存] [下一项 →]        │ │
│                               │  └─────────────────────────────────┘ │
│                               │                                     │
│                               │  相关数据                           │
│                               │  ┌─────────────────────────────────┐ │
│                               │  │ 历史趋势: 2022:20.1 → 2023:19.2│ │
│                               │  │ 区县平均: 18.8                  │ │
│                               │  │ 全市平均: 19.1                  │ │
│                               │  └─────────────────────────────────┘ │
│                               │                                     │
│                               │  佐证材料 (2)                       │
│                               │  · 教师花名册.xlsx [查看]           │
│                               │  · 学生统计表.pdf [查看]            │
└───────────────────────────────┴─────────────────────────────────────┘
```

#### 3.4.3 评价意见Tab

```
┌─────────────────────────────────────────────────────────────────────┐
│  评价意见                                                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  主要优势 (3)                                           [+ 添加]   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 1. 师资力量雄厚，高级职称教师占比达45%                       │   │
│  │    关联指标: 1.2.1 生师比, 1.2.3 高级职称占比    [编辑][删除]│   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ 2. 教学管理规范，制度健全                                    │   │
│  │    关联指标: 2.1.1 管理制度                      [编辑][删除]│   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  主要不足 (2)                                           [+ 添加]   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 1. 图书资源不足，生均图书仅12册              [高] [登记问题] │   │
│  │    关联指标: 3.1.2 生均图书                      [编辑][删除]│   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  改进建议 (2)                                           [+ 添加]   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 1. 建议2025年秋季前补充采购图书5000册以上                    │   │
│  │ 2. 制定信息化设备更新三年计划                                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  亮点与创新 (1)                                         [+ 添加]   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 1. 校本课程"传统文化进校园"特色鲜明，获市级表彰             │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

#### 3.4.4 评估结论Tab

```
┌─────────────────────────────────────────────────────────────────────┐
│  评估结论                                              [生成报告]   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  综合评定                                                    │   │
│  │  ┌───────────┬───────────┬───────────┬───────────┐          │   │
│  │  │ 综合得分   │ 评定等级   │ 达标判定   │ 达标率    │          │   │
│  │  │   82.5    │   良好     │  ✓ 达标   │  88%     │          │   │
│  │  └───────────┴───────────┴───────────┴───────────┘          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  评分分布                                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  优秀(A) ████████████ 5个                                   │   │
│  │  良好(B) ████████████████████████████ 12个                  │   │
│  │  合格(C) ████████████████ 6个                               │   │
│  │  不合格  █████ 2个                                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  总体评价                                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ XX学校整体办学水平良好，在师资队伍建设方面表现突出...        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  问题台账 (2条待整改)                                   [查看全部]  │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ #001 生均图书不达标      中等  待整改  截止:2025-06-30      │   │
│  │ #002 多媒体设备故障      低    待整改  截止:2025-09-01      │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                     │
│                                    [保存草稿]  [提交评估结论]       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 四、工作流程设计

### 4.1 整体流程

```
┌─────────────────────────────────────────────────────────────────────┐
│                         评估专家工作流程                             │
└─────────────────────────────────────────────────────────────────────┘

1. 任务分配阶段（项目管理员）
   ┌──────────────┐
   │ 项目管理员    │
   │ 分配评估任务  │──→ 指定专家 + 评估对象 + 截止日期
   └──────────────┘

2. 数据准备阶段（系统自动）
   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
   │ 采集数据汇总  │ ──→ │ 指标数据计算  │ ──→ │ 佐证材料关联  │
   └──────────────┘     └──────────────┘     └──────────────┘

3. 专家评估阶段
   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
   │ 查阅数据     │ ──→ │ 逐项评分     │ ──→ │ 撰写评语     │
   │ 和佐证材料   │     │ 填写依据     │     │ 登记问题     │
   └──────────────┘     └──────────────┘     └──────────────┘
           │                   │                    │
           └───────────────────┴────────────────────┘
                              ↓
                    ┌──────────────┐
                    │ 形成评估结论  │
                    │ 提交评估报告  │
                    └──────────────┘

4. 结果确认阶段（项目管理员）
   ┌──────────────┐     ┌──────────────┐
   │ 项目管理员    │ ──→ │ 汇总专家意见  │
   │ 审核确认     │     │ 生成最终报告  │
   └──────────────┘     └──────────────┘

5. 整改跟踪阶段
   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
   │ 被评对象整改  │ ──→ │ 提交整改证据  │ ──→ │ 专家复评验收  │
   └──────────────┘     └──────────────┘     └──────────────┘
```

### 4.2 状态流转

```
评估任务状态:
  pending ──→ in_progress ──→ completed ──→ submitted
    │              │              │
    └──────────────┴──────────────┘
           专家可随时保存进度

问题状态:
  open ──→ rectifying ──→ resolved ──→ closed
    │          │             │
    │          └─────────────┘
    │            整改不合格返回
    └──→ waived（免于整改）
```

---

## 五、实施计划

### 阶段一：基础功能（优先级：高）

1. 数据库表结构创建
   - `expert_assignments`
   - `indicator_scores`
   - `evaluation_comments`
   - `evaluation_results`

2. 后端 API 开发
   - 评估任务 CRUD
   - 指标评分 CRUD
   - 评估结论保存/提交

3. 前端页面开发
   - 评估工作台主页面
   - 指标评分组件
   - 评估结论组件

### 阶段二：评价功能（优先级：中）

4. 定性评价功能
   - 评语管理
   - 问题台账登记

5. 评估报告生成
   - 单校报告模板
   - PDF导出

### 阶段三：问题跟踪（优先级：中）

6. 问题跟踪功能
   - 整改提交
   - 复评验收

7. 多专家协同
   - 评分汇总
   - 意见合并

### 阶段四：清理旧功能（优先级：低）

8. 移除旧代码
   - 删除 `review_assignments` 表
   - 删除 `reviewer_scopes` 表
   - 删除 `reviewAssignments.js`
   - 删除专家端审核按钮
   - 更新 ExpertReviewTab

---

## 六、附录

### 6.1 与其他角色的职责对比

| 角色 | 代码 | 核心职责 | 工作内容 |
|------|------|---------|---------|
| 项目管理员 | project_admin | 项目管理 | 配置项目、管理人员、**审核提交**、查看进度 |
| 数据采集员 | data_collector | 数据采集 | 填报数据、上传佐证 |
| **评估专家** | project_expert | **专业评估** | **评分、评价、问题登记、评估报告** |
| 报告决策者 | decision_maker | 决策参考 | 查看评估报告、统计分析 |

### 6.2 关键文件位置

**需要修改的文件：**
- `frontend/src/pages/ProjectConfig/components/ExpertReviewTab.tsx`
- `frontend/src/pages/ExpertProjectDetail/components/SubmissionList.tsx`
- `frontend/src/services/reviewAssignmentService.ts`
- `backend/routes/reviewAssignments.js`

**需要新建的文件：**
- `backend/database/migrations/001_expert_evaluation_redesign.sql` ✅ 已创建
- `backend/routes/evaluation.js`
- `frontend/src/services/evaluationService.ts`
- `frontend/src/pages/ExpertEvaluation/index.tsx`
- `frontend/src/pages/ExpertEvaluation/components/IndicatorScoring.tsx`
- `frontend/src/pages/ExpertEvaluation/components/EvaluationComments.tsx`
- `frontend/src/pages/ExpertEvaluation/components/EvaluationResult.tsx`

---

## 七、实施记录

### 阶段四：清理旧功能（2025-01-28）

#### 已完成的工作

| 任务 | 状态 | 说明 |
|------|------|------|
| 移除专家端审核按钮 | ✅ 完成 | SubmissionList.tsx 改为只读查看 |
| 更新 ExpertReviewTab | ✅ 完成 | 改为项目管理员数据审核界面 |
| 删除废弃组件 | ✅ 完成 | ManualAssignModal.tsx、ReviewerScopeModal.tsx |
| 标记服务为废弃 | ✅ 完成 | reviewAssignmentService.ts 添加 @deprecated |
| 标记路由为废弃 | ✅ 完成 | reviewAssignments.js 添加 @deprecated |
| 创建数据库迁移脚本 | ✅ 完成 | migrations/001_expert_evaluation_redesign.sql |

#### 变更文件清单

**已修改：**
- `frontend/src/pages/ExpertProjectDetail/components/SubmissionList.tsx` - 移除审核功能，改为只读
- `frontend/src/pages/ProjectConfig/components/ExpertReviewTab.tsx` - 重构为项目管理员审核界面
- `frontend/src/services/reviewAssignmentService.ts` - 添加废弃注释
- `backend/routes/reviewAssignments.js` - 添加废弃注释

**已删除：**
- `frontend/src/pages/ProjectConfig/components/ManualAssignModal.tsx`
- `frontend/src/pages/ProjectConfig/components/ReviewerScopeModal.tsx`

**已新建：**
- `backend/database/migrations/001_expert_evaluation_redesign.sql` - 评估表结构

#### 后续工作（阶段一~三）

1. **阶段一：基础功能**
   - 执行数据库迁移脚本创建新表
   - 开发评估任务 API（evaluation.js）
   - 开发评估工作台前端页面

2. **阶段二：评价功能**
   - 指标评分功能
   - 评语管理功能
   - 评估报告生成

3. **阶段三：问题跟踪**
   - 问题台账登记
   - 整改跟踪
   - 复评验收
