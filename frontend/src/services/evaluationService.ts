/**
 * 评估服务
 * 管理评估专家的专业评估功能
 */

import { get, post, put, del } from './api';

// ==================== 类型定义 ====================

/** 评估任务状态 */
export type EvaluationStatus = 'pending' | 'in_progress' | 'completed' | 'submitted';

/** 评分等级 */
export type ScoreLevel = 'A' | 'B' | 'C' | 'D';

/** 评语类型 */
export type CommentType = 'strength' | 'weakness' | 'suggestion' | 'highlight' | 'overall';

/** 评估对象类型 */
export type TargetType = 'school' | 'district';

/** 评分方式 */
export type ScoringType = 'numeric' | 'level' | 'binary';

/** 评估任务进度 */
export interface EvaluationProgress {
  scored: number;
  total: number;
}

/** 评估任务 */
export interface Evaluation {
  id: string;
  projectId: string;
  projectName?: string;
  expertId?: string;
  expertName?: string;
  targetType: TargetType;
  targetId: string;
  targetName?: string;
  indicatorScope?: string;
  status: EvaluationStatus;
  dueDate?: string;
  assignedAt?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt?: string;
  progress?: EvaluationProgress;
}

/** 指标信息（含评分状态） */
export interface IndicatorWithScore {
  id: string;
  code: string;
  name: string;
  parentId?: string;
  level: number;
  isLeaf: boolean;
  description?: string;
  threshold?: string;
  unit?: string;
  // 评分信息
  score?: number;
  scoreLevel?: ScoreLevel;
  isCompliant?: boolean;
  scoreBasis?: string;
  scoredAt?: string;
}

/** 填报数据 */
export interface SubmissionData {
  id: string;
  formId: string;
  formName?: string;
  submitterName?: string;
  submitterOrg?: string;
  status: string;
  submittedAt?: string;
  data?: Record<string, unknown>;
}

/** 佐证材料 */
export interface MaterialInfo {
  id: string;
  fileName: string;
  filePath: string;
  indicatorId?: string;
  createdAt?: string;
}

/** 评估任务详情 */
export interface EvaluationDetail {
  evaluation: Evaluation;
  indicators: IndicatorWithScore[];
  submissions: SubmissionData[];
  materials: MaterialInfo[];
}

/** 评分标准 - 等级配置 */
export interface ScoringLevel {
  level: ScoreLevel;
  label: string;
  min: number;
  max: number;
}

/** 评分标准 */
export interface ScoringStandard {
  scoringType: ScoringType;
  maxScore: number;
  minScore: number;
  passScore?: number;
  levels?: ScoringLevel[];
  scoringGuide?: string;
  referenceMaterials?: string[];
}

/** 指标数据（用于评分参考） */
export interface IndicatorData {
  indicator: {
    id: string;
    code: string;
    name: string;
    description?: string;
    threshold?: string;
    unit?: string;
  };
  actualData?: {
    actual_value: number;
    data_source?: string;
    collected_at?: string;
  };
  comparisonData?: {
    districtAvg?: number;
  };
  materials: MaterialInfo[];
}

/** 指标评分 */
export interface IndicatorScore {
  indicatorId: string;
  indicatorCode?: string;
  score: number;
  scoreLevel?: ScoreLevel;
  isCompliant?: boolean;
  scoreBasis?: string;
}

/** 评估评语 */
export interface EvaluationComment {
  id: string;
  commentType: CommentType;
  content: string;
  relatedIndicators?: string[];
  priority?: number;
  createdAt?: string;
}

/** 评语集合 */
export interface CommentsGroup {
  strengths: EvaluationComment[];
  weaknesses: EvaluationComment[];
  suggestions: EvaluationComment[];
  highlights: EvaluationComment[];
  overall: EvaluationComment[];
}

/** 评估结论 */
export interface EvaluationResult {
  id?: string;
  overallScore: number;
  overallLevel: string;
  isCompliant: boolean;
  complianceRate: number;
  summary?: string;
  mainStrengths?: string[];
  mainWeaknesses?: string[];
  keySuggestions?: string[];
  status?: string;
  submittedAt?: string;
  confirmedAt?: string;
}

/** 评分分布 */
export interface ScoreDistribution {
  A?: number;
  B?: number;
  C?: number;
  D?: number;
}

/** 评估统计 */
export interface EvaluationStats {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  submitted: number;
  byExpert: Array<{
    expertId: string;
    expertName: string;
    total: number;
    completed: number;
  }>;
}

/** 评估分配目标 */
export interface AssignmentTarget {
  id: string;
  type: TargetType;
  name?: string;
}

// ==================== 专家端 API ====================

/**
 * 获取当前专家的评估任务列表
 */
export async function getMyEvaluations(params?: {
  projectId?: string;
  status?: EvaluationStatus;
}): Promise<Evaluation[]> {
  const queryParams: Record<string, string> = {};
  if (params?.projectId) queryParams.projectId = params.projectId;
  if (params?.status) queryParams.status = params.status;

  return get<Evaluation[]>('/expert/evaluations', queryParams);
}

/**
 * 获取评估任务详情
 */
export async function getEvaluationDetail(evaluationId: string): Promise<EvaluationDetail> {
  return get<EvaluationDetail>(`/expert/evaluations/${evaluationId}`);
}

/**
 * 开始评估任务
 */
export async function startEvaluation(evaluationId: string): Promise<{ startedAt: string }> {
  return post<{ startedAt: string }>(`/expert/evaluations/${evaluationId}/start`);
}

/**
 * 提交评估任务
 */
export async function submitEvaluation(
  evaluationId: string,
  summary?: string
): Promise<{
  submittedAt: string;
  overallScore: number;
  overallLevel: string;
  complianceRate: number;
}> {
  return post(`/expert/evaluations/${evaluationId}/submit`, { summary });
}

// ==================== 指标评分 API ====================

/**
 * 获取指标评分标准
 */
export async function getScoringStandard(
  projectId: string,
  indicatorId: string
): Promise<ScoringStandard> {
  return get<ScoringStandard>(`/projects/${projectId}/indicators/${indicatorId}/scoring-standard`);
}

/**
 * 获取指标相关数据（用于评分参考）
 */
export async function getIndicatorData(
  evaluationId: string,
  indicatorId: string
): Promise<IndicatorData> {
  return get<IndicatorData>(`/expert/evaluations/${evaluationId}/indicators/${indicatorId}/data`);
}

/**
 * 保存单个指标评分
 */
export async function saveIndicatorScore(
  evaluationId: string,
  score: IndicatorScore
): Promise<{ scoreId: string; savedAt: string }> {
  return post(`/expert/evaluations/${evaluationId}/scores`, score);
}

/**
 * 批量保存指标评分
 */
export async function saveIndicatorScoresBatch(
  evaluationId: string,
  scores: IndicatorScore[]
): Promise<{ savedCount: number; savedAt: string }> {
  return post(`/expert/evaluations/${evaluationId}/scores/batch`, { scores });
}

// ==================== 评语 API ====================

/**
 * 获取评估评语
 */
export async function getComments(evaluationId: string): Promise<{ comments: CommentsGroup }> {
  return get<{ comments: CommentsGroup }>(`/expert/evaluations/${evaluationId}/comments`);
}

/**
 * 添加评语
 */
export async function addComment(
  evaluationId: string,
  comment: {
    commentType: CommentType;
    content: string;
    relatedIndicators?: string[];
    priority?: number;
  }
): Promise<{ id: string; createdAt: string }> {
  return post(`/expert/evaluations/${evaluationId}/comments`, comment);
}

/**
 * 更新评语
 */
export async function updateComment(
  commentId: string,
  data: {
    content: string;
    relatedIndicators?: string[];
    priority?: number;
  }
): Promise<void> {
  return put(`/expert/comments/${commentId}`, data);
}

/**
 * 删除评语
 */
export async function deleteComment(commentId: string): Promise<void> {
  return del(`/expert/comments/${commentId}`);
}

// ==================== 评估结论 API ====================

/**
 * 获取评估结论
 */
export async function getEvaluationResult(evaluationId: string): Promise<{
  result: EvaluationResult | null;
  scoreDistribution: ScoreDistribution;
}> {
  return get(`/expert/evaluations/${evaluationId}/result`);
}

/**
 * 保存评估结论（草稿）
 */
export async function saveEvaluationResult(
  evaluationId: string,
  data: {
    summary?: string;
    mainStrengths?: string[];
    mainWeaknesses?: string[];
    keySuggestions?: string[];
  }
): Promise<{
  overallScore: number;
  overallLevel: string;
  complianceRate: number;
  savedAt: string;
}> {
  return put(`/expert/evaluations/${evaluationId}/result`, data);
}

// ==================== 项目管理员 API ====================

/**
 * 分配评估任务
 */
export async function assignEvaluations(
  projectId: string,
  data: {
    expertId: string;
    targets: AssignmentTarget[];
    dueDate?: string;
  }
): Promise<{ assignedCount: number; assignedIds: string[] }> {
  return post(`/projects/${projectId}/expert-assignments`, data);
}

/**
 * 获取项目评估任务统计
 */
export async function getEvaluationStats(projectId: string): Promise<EvaluationStats> {
  return get<EvaluationStats>(`/projects/${projectId}/expert-assignments/stats`);
}

/**
 * 确认评估结论
 */
export async function confirmEvaluationResult(
  projectId: string,
  resultId: string
): Promise<void> {
  return post(`/projects/${projectId}/evaluation-results/${resultId}/confirm`);
}

// ==================== 问题台账 API ====================

/** 问题严重程度 */
export type IssueSeverity = 'high' | 'medium' | 'low';

/** 问题状态 */
export type IssueStatus = 'open' | 'rectifying' | 'resolved' | 'closed' | 'waived';

/** 问题 */
export interface Issue {
  id: string;
  issueCode: string;
  title: string;
  description?: string;
  relatedIndicators?: string[];
  severity: IssueSeverity;
  targetId?: string;
  targetName?: string;
  targetType?: string;
  status: IssueStatus;
  rectificationRequired: boolean;
  rectificationDeadline?: string;
  rectificationSuggestion?: string;
  rectifiedAt?: string;
  rectificationEvidence?: Array<{ fileName: string; fileUrl: string }>;
  reviewStatus?: string;
  reviewResult?: string;
  reviewComment?: string;
  foundByName?: string;
  foundAt?: string;
  createdAt?: string;
}

/** 问题统计 */
export interface IssueStats {
  total: number;
  open: number;
  rectifying: number;
  resolved: number;
  closed: number;
  waived: number;
  bySeverity: {
    high: number;
    medium: number;
    low: number;
  };
  byTarget: Array<{
    targetId: string;
    targetName: string;
    total: number;
    pending: number;
  }>;
}

/**
 * 登记问题
 */
export async function createIssue(
  evaluationId: string,
  issue: {
    title: string;
    description?: string;
    relatedIndicators?: string[];
    severity?: IssueSeverity;
    rectificationDeadline?: string;
    rectificationSuggestion?: string;
  }
): Promise<{ id: string; issueCode: string; createdAt: string }> {
  return post(`/expert/evaluations/${evaluationId}/issues`, issue);
}

/**
 * 获取评估任务相关问题列表
 */
export async function getEvaluationIssues(evaluationId: string): Promise<Issue[]> {
  return get<Issue[]>(`/expert/evaluations/${evaluationId}/issues`);
}

/**
 * 获取项目问题列表
 */
export async function getProjectIssues(
  projectId: string,
  params?: { targetId?: string; status?: IssueStatus; severity?: IssueSeverity }
): Promise<Issue[]> {
  const queryParams: Record<string, string> = {};
  if (params?.targetId) queryParams.targetId = params.targetId;
  if (params?.status) queryParams.status = params.status;
  if (params?.severity) queryParams.severity = params.severity;
  return get<Issue[]>(`/projects/${projectId}/issues`, queryParams);
}

/**
 * 获取问题统计
 */
export async function getIssueStats(projectId: string): Promise<IssueStats> {
  return get<IssueStats>(`/projects/${projectId}/issues/stats`);
}

/**
 * 获取单个问题详情
 */
export async function getIssueDetail(issueId: string): Promise<Issue> {
  return get<Issue>(`/issues/${issueId}`);
}

/**
 * 更新问题
 */
export async function updateIssue(
  issueId: string,
  data: {
    title?: string;
    description?: string;
    relatedIndicators?: string[];
    severity?: IssueSeverity;
    rectificationDeadline?: string;
    rectificationSuggestion?: string;
  }
): Promise<void> {
  return put(`/expert/issues/${issueId}`, data);
}

/**
 * 删除问题
 */
export async function deleteIssue(issueId: string): Promise<void> {
  return del(`/expert/issues/${issueId}`);
}

/**
 * 提交整改证据
 */
export async function submitRectification(
  issueId: string,
  data: {
    rectificationEvidence: Array<{ fileName: string; fileUrl: string }>;
    description?: string;
  }
): Promise<void> {
  return put(`/issues/${issueId}/rectify`, data);
}

/**
 * 复评问题
 */
export async function reviewIssue(
  issueId: string,
  data: { result: 'passed' | 'failed'; comment?: string }
): Promise<void> {
  return post(`/expert/issues/${issueId}/review`, data);
}

/**
 * 关闭问题
 */
export async function closeIssue(issueId: string): Promise<void> {
  return post(`/issues/${issueId}/close`);
}

/**
 * 免于整改
 */
export async function waiveIssue(issueId: string, reason?: string): Promise<void> {
  return post(`/issues/${issueId}/waive`, { reason });
}

// ==================== 评估报告 API ====================

/** 评估报告数据 */
export interface EvaluationReportData {
  evaluation: {
    projectName: string;
    targetName: string;
    targetType: string;
    expertName: string;
    assessmentType?: string;
    status: string;
  };
  conclusion: {
    overallScore: number;
    overallLevel: string;
    isCompliant: boolean;
    complianceRate: number;
    summary?: string;
    mainStrengths: string[];
    mainWeaknesses: string[];
    keySuggestions: string[];
    status?: string;
    submittedAt?: string;
  } | null;
  scores: Array<{
    indicator_id: string;
    indicator_code: string;
    indicator_name: string;
    score: number;
    score_level: string;
    is_compliant: boolean;
    score_basis?: string;
  }>;
  scoreStats: {
    total: number;
    compliant: number;
    distribution: ScoreDistribution;
  };
  comments: {
    strengths: EvaluationComment[];
    weaknesses: EvaluationComment[];
    suggestions: EvaluationComment[];
    highlights: EvaluationComment[];
    overall: EvaluationComment[];
  };
  issues: Array<{
    id: string;
    issue_code: string;
    title: string;
    description?: string;
    severity: string;
    status: string;
    rectification_deadline?: string;
    rectification_suggestion?: string;
  }>;
}

/**
 * 获取评估报告预览数据
 */
export async function getReportPreview(evaluationId: string): Promise<EvaluationReportData> {
  return get<EvaluationReportData>(`/expert/evaluations/${evaluationId}/report`);
}

/**
 * 生成评估报告
 */
export async function generateReport(evaluationId: string): Promise<{
  id: string;
  evaluationId: string;
  generatedAt: string;
  projectName: string;
  targetName: string;
}> {
  return post(`/expert/evaluations/${evaluationId}/report/generate`);
}

// ==================== 状态配置 ====================

export const evaluationStatusConfig: Record<
  EvaluationStatus,
  { text: string; color: string; icon?: string }
> = {
  pending: { text: '待开始', color: 'default' },
  in_progress: { text: '进行中', color: 'processing' },
  completed: { text: '已完成', color: 'warning' },
  submitted: { text: '已提交', color: 'success' },
};

export const scoreLevelConfig: Record<
  ScoreLevel,
  { text: string; color: string; min: number; max: number }
> = {
  A: { text: '优秀', color: 'success', min: 90, max: 100 },
  B: { text: '良好', color: 'processing', min: 80, max: 89 },
  C: { text: '合格', color: 'warning', min: 60, max: 79 },
  D: { text: '不合格', color: 'error', min: 0, max: 59 },
};

export const commentTypeConfig: Record<CommentType, { text: string; color: string }> = {
  strength: { text: '主要亮点', color: 'success' },
  weakness: { text: '问题不足', color: 'error' },
  suggestion: { text: '改进建议', color: 'processing' },
  highlight: { text: '典型经验', color: 'gold' },
  overall: { text: '总体评价', color: 'default' },
};

export const issueStatusConfig: Record<IssueStatus, { text: string; color: string }> = {
  open: { text: '待整改', color: 'error' },
  rectifying: { text: '整改中', color: 'processing' },
  resolved: { text: '已解决', color: 'success' },
  closed: { text: '已关闭', color: 'default' },
  waived: { text: '免于整改', color: 'warning' },
};

export const issueSeverityConfig: Record<IssueSeverity, { text: string; color: string }> = {
  high: { text: '高', color: 'error' },
  medium: { text: '中', color: 'warning' },
  low: { text: '低', color: 'default' },
};

// ==================== 整改跟踪 API ====================

/** 我的问题列表响应 */
export interface MyIssuesResponse {
  issues: Issue[];
  stats: {
    total: number;
    open: number;
    rectifying: number;
    resolved: number;
    closed: number;
  };
  target: {
    id: string;
    name: string;
    type: 'school' | 'district';
  };
}

/**
 * 获取当前用户（被评估对象）的问题列表
 */
export async function getMyIssues(params?: {
  status?: IssueStatus;
  projectId?: string;
}): Promise<MyIssuesResponse> {
  const queryParams: Record<string, string> = {};
  if (params?.status) queryParams.status = params.status;
  if (params?.projectId) queryParams.projectId = params.projectId;
  return get<MyIssuesResponse>('/my/issues', queryParams);
}

/**
 * 获取单个问题详情（被评估对象）
 */
export async function getMyIssueDetail(issueId: string): Promise<Issue> {
  return get<Issue>(`/my/issues/${issueId}`);
}

/** 整改证据 */
export interface RectificationEvidence {
  files: Array<{ fileName: string; fileUrl: string }>;
  description: string;
  submittedAt?: string;
  submittedBy?: string;
}

/**
 * 提交整改（被评估对象）
 */
export async function submitMyRectification(
  issueId: string,
  data: {
    evidence: Array<{ fileName: string; fileUrl: string }>;
    description?: string;
  }
): Promise<{ message: string }> {
  return put(`/my/issues/${issueId}/rectify`, data);
}

// ==================== 复评验收 API ====================

/** 待复评问题 */
export interface PendingReviewIssue {
  id: string;
  issueCode: string;
  title: string;
  description?: string;
  severity: IssueSeverity;
  status: IssueStatus;
  rectificationDeadline?: string;
  rectificationEvidence?: RectificationEvidence;
  rectifiedAt?: string;
  targetName: string;
  targetType: string;
  projectName: string;
}

/**
 * 获取待复评问题列表（专家）
 */
export async function getPendingReviews(projectId?: string): Promise<PendingReviewIssue[]> {
  const params: Record<string, string> = {};
  if (projectId) params.projectId = projectId;
  return get<PendingReviewIssue[]>('/expert/pending-reviews', params);
}

/**
 * 专家复评问题
 */
export async function reviewIssueResult(
  issueId: string,
  data: { result: 'passed' | 'failed'; comment?: string }
): Promise<{ message: string; newStatus: IssueStatus }> {
  return post(`/expert/issues/${issueId}/review`, data);
}

// ==================== 多专家协同 API ====================

/** 单个专家评估信息 */
export interface ExpertEvaluationInfo {
  evaluationId: string;
  expertId: string;
  expertName: string;
  status: EvaluationStatus;
  startedAt?: string;
  completedAt?: string;
  submittedAt?: string;
  overallScore?: number;
  overallLevel?: string;
  complianceRate?: number;
}

/** 评估目标汇总信息 */
export interface TargetEvaluationSummary {
  targetId: string;
  targetName: string;
  targetType: TargetType;
  districtName?: string;
  // 汇总数据
  expertCount: number;
  completedCount: number;
  averageScore?: number;
  finalLevel?: string;
  complianceRate?: number;
  issueCount: number;
  // 专家评估列表
  evaluations: ExpertEvaluationInfo[];
}

/** 项目评估汇总响应 */
export interface ProjectEvaluationSummary {
  projectId: string;
  projectName: string;
  summaryStats: {
    totalTargets: number;
    completedTargets: number;
    totalEvaluations: number;
    completedEvaluations: number;
    averageScore?: number;
    totalIssues: number;
  };
  targets: TargetEvaluationSummary[];
}

/** 专家工作量统计 */
export interface ExpertWorkloadItem {
  expertId: string;
  expertName: string;
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  submitted: number;
  completionRate: number;
  averageScore?: number;
}

/** 项目专家工作量响应 */
export interface ProjectExpertsWorkload {
  projectId: string;
  projectName: string;
  experts: ExpertWorkloadItem[];
}

/** 目标详细评估响应 */
export interface TargetDetailedEvaluations {
  targetId: string;
  targetName: string;
  targetType: TargetType;
  project: {
    id: string;
    name: string;
  };
  evaluations: Array<{
    id: string;
    expertId: string;
    expertName: string;
    status: EvaluationStatus;
    startedAt?: string;
    completedAt?: string;
    submittedAt?: string;
    result?: {
      overallScore: number;
      overallLevel: string;
      complianceRate: number;
      summary?: string;
      mainStrengths?: string[];
      mainWeaknesses?: string[];
      keySuggestions?: string[];
    };
    scores?: Array<{
      indicatorId: string;
      indicatorCode: string;
      indicatorName: string;
      score: number;
      scoreLevel?: string;
      isCompliant: boolean;
      scoreBasis?: string;
    }>;
  }>;
  // 汇总统计
  summary: {
    expertCount: number;
    completedCount: number;
    averageScore?: number;
    scoreRange?: { min: number; max: number };
    complianceRates?: number[];
  };
}

/**
 * 获取项目评估汇总（按评估对象）
 */
export async function getProjectEvaluationSummary(
  projectId: string,
  params?: { targetType?: TargetType; status?: 'completed' | 'all' }
): Promise<ProjectEvaluationSummary> {
  const queryParams: Record<string, string> = {};
  if (params?.targetType) queryParams.targetType = params.targetType;
  if (params?.status) queryParams.status = params.status;
  return get<ProjectEvaluationSummary>(`/projects/${projectId}/evaluations/summary`, queryParams);
}

/**
 * 获取项目专家工作量统计
 */
export async function getProjectExpertsWorkload(projectId: string): Promise<ProjectExpertsWorkload> {
  return get<ProjectExpertsWorkload>(`/projects/${projectId}/experts/workload`);
}

/**
 * 获取评估对象的详细评估数据（多专家对比）
 */
export async function getTargetDetailedEvaluations(
  projectId: string,
  targetId: string
): Promise<TargetDetailedEvaluations> {
  return get<TargetDetailedEvaluations>(`/projects/${projectId}/targets/${targetId}/evaluations`);
}
