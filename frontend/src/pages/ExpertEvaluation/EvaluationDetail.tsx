/**
 * 评估详情页 - 指标评分与评语
 * 专家对评估对象的指标进行评分，添加评语，提交结论
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Breadcrumb,
  Card,
  Tabs,
  Tag,
  Space,
  Spin,
  Button,
  Progress,
  Tree,
  Descriptions,
  Input,
  message,
  Modal,
  Empty,
  Tooltip,
  Statistic,
  Row,
  Col,
  List,
  Form,
  Select,
  DatePicker,
  Table,
  Divider,
  Alert,
} from 'antd';
import {
  HomeOutlined,
  ArrowLeftOutlined,
  CheckCircleOutlined,
  SaveOutlined,
  SendOutlined,
  FileTextOutlined,
  PaperClipOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  AimOutlined,
  BulbOutlined,
  WarningOutlined,
  LikeOutlined,
  ExclamationCircleOutlined,
  FileSearchOutlined,
  FileDoneOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import * as evaluationService from '../../services/evaluationService';
import type {
  Evaluation,
  IndicatorWithScore,
  IndicatorData,
  ScoringStandard,
  EvaluationComment,
  CommentsGroup,
  EvaluationResult,
  ScoreLevel,
  CommentType,
  Issue,
  IssueSeverity,
  IssueStatus,
  EvaluationReportData,
} from '../../services/evaluationService';
import type { ColumnsType } from 'antd/es/table';
import styles from './index.module.css';

const { TextArea } = Input;

const EvaluationDetail: React.FC = () => {
  const { evaluationId } = useParams<{ evaluationId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [indicators, setIndicators] = useState<IndicatorWithScore[]>([]);
  const [selectedIndicator, setSelectedIndicator] = useState<IndicatorWithScore | null>(null);
  const [indicatorData, setIndicatorData] = useState<IndicatorData | null>(null);
  const [scoringStandard, setScoringStandard] = useState<ScoringStandard | null>(null);
  const [comments, setComments] = useState<CommentsGroup | null>(null);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [activeTab, setActiveTab] = useState('scoring');

  // 评分表单
  const [currentScore, setCurrentScore] = useState<number | null>(null);
  const [currentLevel, setCurrentLevel] = useState<ScoreLevel | null>(null);
  const [currentBasis, setCurrentBasis] = useState('');
  const [saving, setSaving] = useState(false);

  // 评语表单
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [editingComment, setEditingComment] = useState<EvaluationComment | null>(null);
  const [commentForm] = Form.useForm();

  // 问题台账
  const [issues, setIssues] = useState<Issue[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [issueModalVisible, setIssueModalVisible] = useState(false);
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);
  const [issueForm] = Form.useForm();

  // 评估报告
  const [reportData, setReportData] = useState<EvaluationReportData | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // 加载评估详情
  const loadDetail = useCallback(async () => {
    if (!evaluationId) return;

    setLoading(true);
    try {
      const data = await evaluationService.getEvaluationDetail(evaluationId);
      setEvaluation(data.evaluation);
      setIndicators(data.indicators);

      // 默认选中第一个末级指标
      const firstLeaf = data.indicators.find(i => i.isLeaf);
      if (firstLeaf) {
        setSelectedIndicator(firstLeaf);
      }
    } catch (error) {
      console.error('加载评估详情失败:', error);
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  }, [evaluationId]);

  // 加载评语
  const loadComments = useCallback(async () => {
    if (!evaluationId) return;
    try {
      const data = await evaluationService.getComments(evaluationId);
      setComments(data.comments);
    } catch (error) {
      console.error('加载评语失败:', error);
    }
  }, [evaluationId]);

  // 加载结论
  const loadResult = useCallback(async () => {
    if (!evaluationId) return;
    try {
      const data = await evaluationService.getEvaluationResult(evaluationId);
      setResult(data.result);
    } catch (error) {
      console.error('加载结论失败:', error);
    }
  }, [evaluationId]);

  // 加载问题台账
  const loadIssues = useCallback(async () => {
    if (!evaluationId) return;
    setIssuesLoading(true);
    try {
      const data = await evaluationService.getEvaluationIssues(evaluationId);
      setIssues(data || []);
    } catch (error) {
      console.error('加载问题列表失败:', error);
      setIssues([]);
    } finally {
      setIssuesLoading(false);
    }
  }, [evaluationId]);

  // 加载报告预览
  const loadReport = useCallback(async () => {
    if (!evaluationId) return;
    setReportLoading(true);
    try {
      const data = await evaluationService.getReportPreview(evaluationId);
      setReportData(data);
    } catch (error) {
      console.error('加载报告预览失败:', error);
      setReportData(null);
    } finally {
      setReportLoading(false);
    }
  }, [evaluationId]);

  useEffect(() => {
    loadDetail();
    loadComments();
    loadResult();
    loadIssues();
  }, [loadDetail, loadComments, loadResult, loadIssues]);

  // 切换到报告tab时加载报告数据
  useEffect(() => {
    if (activeTab === 'report' && !reportData && !reportLoading) {
      loadReport();
    }
  }, [activeTab, reportData, reportLoading, loadReport]);

  // 选中指标时加载数据
  useEffect(() => {
    if (!selectedIndicator || !evaluation) return;

    const loadIndicatorDetails = async () => {
      try {
        const [data, standard] = await Promise.all([
          evaluationService.getIndicatorData(evaluationId!, selectedIndicator.id),
          evaluationService.getScoringStandard(evaluation.projectId, selectedIndicator.id),
        ]);
        setIndicatorData(data);
        setScoringStandard(standard);

        // 恢复已保存的评分
        if (selectedIndicator.score !== undefined) {
          setCurrentScore(selectedIndicator.score);
          setCurrentLevel(selectedIndicator.scoreLevel || null);
          setCurrentBasis(selectedIndicator.scoreBasis || '');
        } else {
          setCurrentScore(null);
          setCurrentLevel(null);
          setCurrentBasis('');
        }
      } catch (error) {
        console.error('加载指标数据失败:', error);
      }
    };

    loadIndicatorDetails();
  }, [selectedIndicator, evaluation, evaluationId]);

  // 构建指标树
  const buildIndicatorTree = (): DataNode[] => {
    const map = new Map<string, DataNode>();
    const roots: DataNode[] = [];

    // 第一遍：创建节点
    indicators.forEach(ind => {
      const scored = ind.score !== undefined;
      map.set(ind.id, {
        key: ind.id,
        title: (
          <Space size={4}>
            <span style={{ color: ind.isLeaf ? '#1890ff' : undefined }}>
              {ind.code} {ind.name}
            </span>
            {ind.isLeaf && scored && (
              <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 12 }} />
            )}
          </Space>
        ),
        children: [],
        selectable: ind.isLeaf,
        isLeaf: ind.isLeaf,
      });
    });

    // 第二遍：建立父子关系
    indicators.forEach(ind => {
      const node = map.get(ind.id)!;
      if (ind.parentId && map.has(ind.parentId)) {
        const parent = map.get(ind.parentId)!;
        (parent.children as DataNode[]).push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  // 选择等级
  const handleSelectLevel = (level: ScoreLevel) => {
    setCurrentLevel(level);
    const config = evaluationService.scoreLevelConfig[level];
    // 设置等级对应的默认分数
    setCurrentScore(config.min + Math.floor((config.max - config.min) / 2));
  };

  // 保存评分
  const handleSaveScore = async () => {
    if (!selectedIndicator || currentLevel === null) {
      message.warning('请选择评分等级');
      return;
    }

    setSaving(true);
    try {
      await evaluationService.saveIndicatorScore(evaluationId!, {
        indicatorId: selectedIndicator.id,
        indicatorCode: selectedIndicator.code,
        score: currentScore || 0,
        scoreLevel: currentLevel,
        isCompliant: currentLevel === 'A' || currentLevel === 'B' || currentLevel === 'C',
        scoreBasis: currentBasis,
      });

      message.success('评分已保存');

      // 更新本地状态
      setIndicators(prev => prev.map(ind =>
        ind.id === selectedIndicator.id
          ? { ...ind, score: currentScore!, scoreLevel: currentLevel, scoreBasis: currentBasis }
          : ind
      ));
      setSelectedIndicator(prev => prev ? { ...prev, score: currentScore!, scoreLevel: currentLevel, scoreBasis: currentBasis } : null);

      // 刷新结论
      loadResult();
    } catch (error) {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 添加/编辑评语
  const handleSaveComment = async (values: { commentType: CommentType; content: string }) => {
    try {
      if (editingComment) {
        await evaluationService.updateComment(editingComment.id, {
          content: values.content,
        });
        message.success('评语已更新');
      } else {
        await evaluationService.addComment(evaluationId!, {
          commentType: values.commentType,
          content: values.content,
        });
        message.success('评语已添加');
      }
      setCommentModalVisible(false);
      setEditingComment(null);
      commentForm.resetFields();
      loadComments();
    } catch (error) {
      message.error('操作失败');
    }
  };

  // 删除评语
  const handleDeleteComment = async (commentId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这条评语吗？',
      onOk: async () => {
        try {
          await evaluationService.deleteComment(commentId);
          message.success('已删除');
          loadComments();
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  // 保存问题
  const handleSaveIssue = async (values: {
    title: string;
    description?: string;
    severity: IssueSeverity;
    rectificationDeadline?: any;
    relatedIndicators?: string[];
  }) => {
    try {
      const payload = {
        ...values,
        rectificationDeadline: values.rectificationDeadline?.format('YYYY-MM-DD'),
      };

      if (editingIssue) {
        await evaluationService.updateIssue(editingIssue.id, payload);
        message.success('问题已更新');
      } else {
        await evaluationService.createIssue(evaluationId!, payload);
        message.success('问题已登记');
      }
      setIssueModalVisible(false);
      setEditingIssue(null);
      issueForm.resetFields();
      loadIssues();
    } catch (error) {
      message.error('操作失败');
    }
  };

  // 删除问题
  const handleDeleteIssue = async (issueId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这条问题吗？删除后无法恢复。',
      onOk: async () => {
        try {
          await evaluationService.deleteIssue(issueId);
          message.success('已删除');
          loadIssues();
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  // 生成评估报告
  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      await evaluationService.generateReport(evaluationId!);
      message.success('评估报告已生成');
      loadReport();
    } catch (error) {
      message.error('生成报告失败');
    } finally {
      setGenerating(false);
    }
  };

  // 问题列表列定义
  const issueColumns: ColumnsType<Issue> = [
    {
      title: '问题编号',
      dataIndex: 'issueCode',
      key: 'issueCode',
      width: 120,
      render: (code) => <Tag color="blue">{code}</Tag>,
    },
    {
      title: '问题标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (severity: IssueSeverity) => {
        const config = evaluationService.issueSeverityConfig[severity];
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: IssueStatus) => {
        const config = evaluationService.issueStatusConfig[status];
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '整改期限',
      dataIndex: 'rectificationDeadline',
      key: 'rectificationDeadline',
      width: 120,
      render: (date) => date ? new Date(date).toLocaleDateString('zh-CN') : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => {
        if (evaluation?.status === 'submitted') {
          return (
            <Button type="link" size="small" icon={<FileSearchOutlined />}>
              查看
            </Button>
          );
        }
        if (record.status !== 'open') {
          return (
            <Button type="link" size="small" icon={<FileSearchOutlined />}>
              查看
            </Button>
          );
        }
        return (
          <Space size="small">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                setEditingIssue(record);
                issueForm.setFieldsValue({
                  title: record.title,
                  description: record.description,
                  severity: record.severity,
                  relatedIndicators: record.relatedIndicators,
                });
                setIssueModalVisible(true);
              }}
            >
              编辑
            </Button>
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteIssue(record.id)}
            >
              删除
            </Button>
          </Space>
        );
      },
    },
  ];

  // 提交评估
  const handleSubmit = async () => {
    // 检查是否有未评分的指标
    const unscoredCount = indicators.filter(i => i.isLeaf && i.score === undefined).length;
    if (unscoredCount > 0) {
      Modal.confirm({
        title: '评分未完成',
        content: `还有 ${unscoredCount} 个指标未评分，确定要提交吗？`,
        okText: '继续提交',
        cancelText: '返回修改',
        onOk: doSubmit,
      });
    } else {
      doSubmit();
    }
  };

  const doSubmit = async () => {
    try {
      const res = await evaluationService.submitEvaluation(evaluationId!);
      message.success(`评估已提交！综合得分：${res.overallScore.toFixed(1)}分 (${res.overallLevel})`);
      loadDetail();
      loadResult();
    } catch (error) {
      message.error('提交失败');
    }
  };

  // 计算进度
  const totalLeaf = indicators.filter(i => i.isLeaf).length;
  const scoredLeaf = indicators.filter(i => i.isLeaf && i.score !== undefined).length;
  const progressPercent = totalLeaf > 0 ? Math.round((scoredLeaf / totalLeaf) * 100) : 0;

  const statusConfig = evaluation ? evaluationService.evaluationStatusConfig[evaluation.status] : null;

  // Tab 配置
  const tabItems = [
    {
      key: 'scoring',
      label: (
        <span>
          <AimOutlined />
          指标评分
        </span>
      ),
      children: (
        <div className={styles.indicatorPanel}>
          {/* 左侧指标树 */}
          <div className={styles.indicatorTree}>
            <div style={{ marginBottom: 12, fontWeight: 500 }}>指标体系</div>
            <Tree
              treeData={buildIndicatorTree()}
              selectedKeys={selectedIndicator ? [selectedIndicator.id] : []}
              onSelect={(keys) => {
                if (keys.length > 0) {
                  const ind = indicators.find(i => i.id === keys[0]);
                  if (ind?.isLeaf) {
                    setSelectedIndicator(ind);
                  }
                }
              }}
              defaultExpandAll
              showLine={{ showLeafIcon: false }}
            />
          </div>

          {/* 右侧评分区域 */}
          <div className={styles.indicatorContent}>
            {selectedIndicator ? (
              <>
                <div className={styles.indicatorHeader}>
                  <h3 className={styles.indicatorTitle}>
                    <span className={styles.indicatorCode}>{selectedIndicator.code}</span>
                    {selectedIndicator.name}
                  </h3>
                  {selectedIndicator.score !== undefined && (
                    <Tag color="success">
                      <CheckCircleOutlined /> 已评分
                    </Tag>
                  )}
                </div>

                {selectedIndicator.description && (
                  <p style={{ color: '#666', marginBottom: 16 }}>{selectedIndicator.description}</p>
                )}

                {/* 数据展示 */}
                <div className={styles.dataSection}>
                  <div className={styles.sectionTitle}>
                    <FileTextOutlined style={{ marginRight: 8 }} />
                    采集数据
                  </div>
                  <div className={styles.dataCard}>
                    {indicatorData?.actualData ? (
                      <>
                        <div className={styles.dataItem}>
                          <span className={styles.dataLabel}>实际值</span>
                          <span className={styles.dataValue}>
                            {indicatorData.actualData.actual_value}
                            {indicatorData.indicator.unit && ` ${indicatorData.indicator.unit}`}
                          </span>
                        </div>
                        {indicatorData.indicator.threshold && (
                          <div className={styles.dataItem}>
                            <span className={styles.dataLabel}>标准值</span>
                            <span className={styles.dataValue}>{indicatorData.indicator.threshold}</span>
                          </div>
                        )}
                        {indicatorData.comparisonData?.districtAvg && (
                          <div className={styles.dataItem}>
                            <span className={styles.dataLabel}>区县平均</span>
                            <span className={styles.dataValue}>
                              {indicatorData.comparisonData.districtAvg.toFixed(2)}
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
                    )}
                  </div>
                </div>

                {/* 佐证材料 */}
                {indicatorData?.materials && indicatorData.materials.length > 0 && (
                  <div className={styles.dataSection}>
                    <div className={styles.sectionTitle}>
                      <PaperClipOutlined style={{ marginRight: 8 }} />
                      佐证材料
                    </div>
                    <div className={styles.materialList}>
                      {indicatorData.materials.map(m => (
                        <Tooltip key={m.id} title="点击下载">
                          <a
                            className={styles.materialItem}
                            href={m.filePath}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <PaperClipOutlined className={styles.materialIcon} />
                            {m.fileName}
                          </a>
                        </Tooltip>
                      ))}
                    </div>
                  </div>
                )}

                {/* 评分区域 */}
                {evaluation?.status !== 'submitted' && (
                  <div className={styles.scoringSection}>
                    <div className={styles.scoringTitle}>评分</div>
                    <div className={styles.scoreLevels}>
                      {(['A', 'B', 'C', 'D'] as ScoreLevel[]).map(level => {
                        const config = evaluationService.scoreLevelConfig[level];
                        return (
                          <div
                            key={level}
                            className={`${styles.scoreLevel} ${styles[`scoreLevel${level}`]} ${currentLevel === level ? styles.selected : ''}`}
                            onClick={() => handleSelectLevel(level)}
                          >
                            <div className={styles.scoreLevelLabel}>{level}</div>
                            <div className={styles.scoreLevelText}>{config.text}</div>
                            <div className={styles.scoreLevelText}>{config.min}-{config.max}分</div>
                          </div>
                        );
                      })}
                    </div>

                    <div className={styles.scoreBasis}>
                      <div style={{ marginBottom: 8, fontWeight: 500 }}>评分依据</div>
                      <TextArea
                        value={currentBasis}
                        onChange={(e) => setCurrentBasis(e.target.value)}
                        placeholder="请输入评分依据说明..."
                        rows={3}
                      />
                    </div>

                    <div style={{ marginTop: 16, textAlign: 'right' }}>
                      <Button
                        type="primary"
                        icon={<SaveOutlined />}
                        onClick={handleSaveScore}
                        loading={saving}
                        disabled={currentLevel === null}
                      >
                        保存评分
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className={styles.emptyIndicator}>
                <AimOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                <p>请从左侧选择一个指标进行评分</p>
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'comments',
      label: (
        <span>
          <BulbOutlined />
          评估评语
        </span>
      ),
      children: (
        <div className={styles.commentsSection}>
          {evaluation?.status !== 'submitted' && (
            <div style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingComment(null);
                  commentForm.resetFields();
                  setCommentModalVisible(true);
                }}
              >
                添加评语
              </Button>
            </div>
          )}

          <Row gutter={16}>
            <Col span={12}>
              <Card
                title={<><LikeOutlined style={{ color: '#52c41a' }} /> 主要亮点</>}
                size="small"
              >
                <List
                  dataSource={comments?.strengths || []}
                  renderItem={item => (
                    <List.Item
                      actions={evaluation?.status !== 'submitted' ? [
                        <Button
                          type="link"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => {
                            setEditingComment(item);
                            commentForm.setFieldsValue({
                              commentType: item.commentType,
                              content: item.content,
                            });
                            setCommentModalVisible(true);
                          }}
                        />,
                        <Button
                          type="link"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => handleDeleteComment(item.id)}
                        />,
                      ] : undefined}
                    >
                      {item.content}
                    </List.Item>
                  )}
                  locale={{ emptyText: '暂无亮点评语' }}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card
                title={<><WarningOutlined style={{ color: '#ff4d4f' }} /> 问题不足</>}
                size="small"
              >
                <List
                  dataSource={comments?.weaknesses || []}
                  renderItem={item => (
                    <List.Item
                      actions={evaluation?.status !== 'submitted' ? [
                        <Button
                          type="link"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => {
                            setEditingComment(item);
                            commentForm.setFieldsValue({
                              commentType: item.commentType,
                              content: item.content,
                            });
                            setCommentModalVisible(true);
                          }}
                        />,
                        <Button
                          type="link"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => handleDeleteComment(item.id)}
                        />,
                      ] : undefined}
                    >
                      {item.content}
                    </List.Item>
                  )}
                  locale={{ emptyText: '暂无问题评语' }}
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col span={24}>
              <Card
                title={<><BulbOutlined style={{ color: '#1890ff' }} /> 改进建议</>}
                size="small"
              >
                <List
                  dataSource={comments?.suggestions || []}
                  renderItem={item => (
                    <List.Item
                      actions={evaluation?.status !== 'submitted' ? [
                        <Button
                          type="link"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => {
                            setEditingComment(item);
                            commentForm.setFieldsValue({
                              commentType: item.commentType,
                              content: item.content,
                            });
                            setCommentModalVisible(true);
                          }}
                        />,
                        <Button
                          type="link"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => handleDeleteComment(item.id)}
                        />,
                      ] : undefined}
                    >
                      {item.content}
                    </List.Item>
                  )}
                  locale={{ emptyText: '暂无改进建议' }}
                />
              </Card>
            </Col>
          </Row>
        </div>
      ),
    },
    {
      key: 'result',
      label: (
        <span>
          <CheckCircleOutlined />
          评估结论
        </span>
      ),
      children: (
        <div className={styles.resultSection}>
          {result ? (
            <div className={styles.resultCard}>
              <div className={styles.resultHeader}>
                <h3 className={styles.resultTitle}>评估结论</h3>
                <Tag color={result.status === 'submitted' ? 'success' : 'default'}>
                  {result.status === 'submitted' ? '已提交' : '草稿'}
                </Tag>
              </div>

              <Row gutter={24}>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <div className={styles.resultScore}>{result.overallScore.toFixed(1)}</div>
                    <div className={styles.resultLevel}>{result.overallLevel}</div>
                  </div>
                </Col>
                <Col span={16}>
                  <div className={styles.resultStats}>
                    <div className={styles.resultStatItem}>
                      <div className={styles.resultStatValue}>
                        {(result.complianceRate * 100).toFixed(0)}%
                      </div>
                      <div className={styles.resultStatLabel}>达标率</div>
                    </div>
                    <div className={styles.resultStatItem}>
                      <div className={styles.resultStatValue}>{scoredLeaf}/{totalLeaf}</div>
                      <div className={styles.resultStatLabel}>已评指标</div>
                    </div>
                    <div className={styles.resultStatItem}>
                      <div className={styles.resultStatValue}>
                        {result.isCompliant ? '是' : '否'}
                      </div>
                      <div className={styles.resultStatLabel}>整体达标</div>
                    </div>
                  </div>
                </Col>
              </Row>
            </div>
          ) : (
            <Card>
              <Empty description="完成指标评分后将自动生成评估结论" />
            </Card>
          )}

          {/* 提交按钮 */}
          {evaluation?.status !== 'submitted' && (
            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <Button
                type="primary"
                size="large"
                icon={<SendOutlined />}
                onClick={handleSubmit}
              >
                提交评估
              </Button>
              <p style={{ color: '#999', marginTop: 8 }}>
                提交后将无法修改评分和评语
              </p>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'issues',
      label: (
        <span>
          <ExclamationCircleOutlined />
          问题台账 {issues.length > 0 && <Tag color="red">{issues.length}</Tag>}
        </span>
      ),
      children: (
        <div>
          {/* 问题列表头部 */}
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Space>
                <span style={{ fontWeight: 500, fontSize: 16 }}>
                  已登记问题: {issues.length} 条
                </span>
                {issues.filter(i => i.status === 'open').length > 0 && (
                  <Tag color="orange">待整改 {issues.filter(i => i.status === 'open').length}</Tag>
                )}
              </Space>
            </div>
            {evaluation?.status !== 'submitted' && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingIssue(null);
                  issueForm.resetFields();
                  setIssueModalVisible(true);
                }}
              >
                登记问题
              </Button>
            )}
          </div>

          {/* 问题列表 */}
          <Spin spinning={issuesLoading}>
            {issues.length > 0 ? (
              <Table
                rowKey="id"
                columns={issueColumns}
                dataSource={issues}
                pagination={{
                  pageSize: 10,
                  showTotal: (total) => `共 ${total} 条记录`,
                }}
              />
            ) : (
              <Empty
                image={<ExclamationCircleOutlined style={{ fontSize: 48, color: '#ccc' }} />}
                description={
                  <span style={{ color: '#999' }}>
                    暂无登记问题
                    <br />
                    {evaluation?.status !== 'submitted' && '发现问题时请点击"登记问题"按钮记录'}
                  </span>
                }
              />
            )}
          </Spin>
        </div>
      ),
    },
    {
      key: 'report',
      label: (
        <span>
          <FileDoneOutlined />
          评估报告
        </span>
      ),
      children: (
        <Spin spinning={reportLoading}>
          {reportData ? (
            <div>
              {/* 报告头部 */}
              <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 20 }}>
                    {reportData.evaluation.targetName} 评估报告
                  </h2>
                  <p style={{ color: '#666', marginTop: 8 }}>
                    项目：{reportData.evaluation.projectName} |
                    专家：{reportData.evaluation.expertName} |
                    类型：{reportData.evaluation.targetType === 'school' ? '学校' : '区县'}
                  </p>
                </div>
                <Space>
                  <Button
                    icon={<DownloadOutlined />}
                    onClick={() => message.info('导出功能开发中')}
                  >
                    导出报告
                  </Button>
                  <Button
                    type="primary"
                    icon={<FileDoneOutlined />}
                    onClick={handleGenerateReport}
                    loading={generating}
                    disabled={evaluation?.status !== 'submitted'}
                  >
                    生成报告
                  </Button>
                </Space>
              </div>

              {evaluation?.status !== 'submitted' && (
                <Alert
                  message="评估尚未提交"
                  description="请先完成评分并提交评估后再生成正式报告"
                  type="warning"
                  showIcon
                  style={{ marginBottom: 24 }}
                />
              )}

              {/* 评估结论概览 */}
              {reportData.conclusion && (
                <Card title="评估结论" style={{ marginBottom: 24 }}>
                  <Row gutter={24}>
                    <Col span={6}>
                      <Statistic
                        title="综合得分"
                        value={reportData.conclusion.overallScore}
                        precision={1}
                        suffix="分"
                        valueStyle={{ color: reportData.conclusion.overallScore >= 80 ? '#52c41a' : reportData.conclusion.overallScore >= 60 ? '#1890ff' : '#ff4d4f' }}
                      />
                    </Col>
                    <Col span={6}>
                      <Statistic
                        title="评估等级"
                        value={reportData.conclusion.overallLevel}
                        valueStyle={{ color: '#1890ff' }}
                      />
                    </Col>
                    <Col span={6}>
                      <Statistic
                        title="达标率"
                        value={(reportData.conclusion.complianceRate * 100).toFixed(0)}
                        suffix="%"
                        valueStyle={{ color: reportData.conclusion.isCompliant ? '#52c41a' : '#ff4d4f' }}
                      />
                    </Col>
                    <Col span={6}>
                      <Statistic
                        title="是否达标"
                        value={reportData.conclusion.isCompliant ? '达标' : '不达标'}
                        valueStyle={{ color: reportData.conclusion.isCompliant ? '#52c41a' : '#ff4d4f' }}
                      />
                    </Col>
                  </Row>
                </Card>
              )}

              {/* 评分统计 */}
              <Card title="评分统计" style={{ marginBottom: 24 }}>
                <Row gutter={24}>
                  <Col span={6}>
                    <Statistic
                      title="已评指标"
                      value={reportData.scoreStats.total}
                      suffix="个"
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="达标指标"
                      value={reportData.scoreStats.compliant}
                      suffix="个"
                      valueStyle={{ color: '#52c41a' }}
                    />
                  </Col>
                  <Col span={12}>
                    <div style={{ marginBottom: 8 }}>评分分布</div>
                    <Space size={16}>
                      <Tag color="green">A级: {reportData.scoreStats.distribution.A}个</Tag>
                      <Tag color="blue">B级: {reportData.scoreStats.distribution.B}个</Tag>
                      <Tag color="orange">C级: {reportData.scoreStats.distribution.C}个</Tag>
                      <Tag color="red">D级: {reportData.scoreStats.distribution.D}个</Tag>
                    </Space>
                  </Col>
                </Row>
              </Card>

              {/* 主要亮点与问题 */}
              <Row gutter={24} style={{ marginBottom: 24 }}>
                <Col span={12}>
                  <Card
                    title={<><LikeOutlined style={{ color: '#52c41a' }} /> 主要亮点</>}
                    size="small"
                  >
                    {reportData.comments.strengths.length > 0 ? (
                      <List
                        size="small"
                        dataSource={reportData.comments.strengths}
                        renderItem={item => (
                          <List.Item>{item.content}</List.Item>
                        )}
                      />
                    ) : (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无" />
                    )}
                  </Card>
                </Col>
                <Col span={12}>
                  <Card
                    title={<><WarningOutlined style={{ color: '#ff4d4f' }} /> 问题不足</>}
                    size="small"
                  >
                    {reportData.comments.weaknesses.length > 0 ? (
                      <List
                        size="small"
                        dataSource={reportData.comments.weaknesses}
                        renderItem={item => (
                          <List.Item>{item.content}</List.Item>
                        )}
                      />
                    ) : (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无" />
                    )}
                  </Card>
                </Col>
              </Row>

              {/* 改进建议 */}
              <Card
                title={<><BulbOutlined style={{ color: '#1890ff' }} /> 改进建议</>}
                size="small"
                style={{ marginBottom: 24 }}
              >
                {reportData.comments.suggestions.length > 0 ? (
                  <List
                    size="small"
                    dataSource={reportData.comments.suggestions}
                    renderItem={item => (
                      <List.Item>{item.content}</List.Item>
                    )}
                  />
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无" />
                )}
              </Card>

              {/* 问题清单 */}
              {reportData.issues.length > 0 && (
                <Card title={<><ExclamationCircleOutlined style={{ color: '#fa8c16' }} /> 问题清单</>} size="small">
                  <Table
                    size="small"
                    dataSource={reportData.issues}
                    rowKey="id"
                    pagination={false}
                    columns={[
                      { title: '问题编号', dataIndex: 'issue_code', width: 120 },
                      { title: '问题标题', dataIndex: 'title' },
                      {
                        title: '严重程度',
                        dataIndex: 'severity',
                        width: 100,
                        render: (s: string) => {
                          const colors: Record<string, string> = { high: 'red', medium: 'orange', low: 'blue' };
                          const texts: Record<string, string> = { high: '高', medium: '中', low: '低' };
                          return <Tag color={colors[s]}>{texts[s]}</Tag>;
                        },
                      },
                      {
                        title: '状态',
                        dataIndex: 'status',
                        width: 100,
                        render: (s: string) => {
                          const config = evaluationService.issueStatusConfig[s as IssueStatus];
                          return <Tag color={config?.color}>{config?.text || s}</Tag>;
                        },
                      },
                    ]}
                  />
                </Card>
              )}

              {/* 指标评分明细 */}
              <Divider />
              <Card title="指标评分明细">
                <Table
                  size="small"
                  dataSource={reportData.scores}
                  rowKey="indicator_id"
                  pagination={{ pageSize: 20 }}
                  columns={[
                    { title: '指标编码', dataIndex: 'indicator_code', width: 120 },
                    { title: '指标名称', dataIndex: 'indicator_name' },
                    {
                      title: '得分',
                      dataIndex: 'score',
                      width: 80,
                      render: (score: number) => <span style={{ fontWeight: 500 }}>{score}</span>,
                    },
                    {
                      title: '等级',
                      dataIndex: 'score_level',
                      width: 80,
                      render: (level: string) => {
                        const colors: Record<string, string> = { A: 'green', B: 'blue', C: 'orange', D: 'red' };
                        return <Tag color={colors[level]}>{level}</Tag>;
                      },
                    },
                    {
                      title: '达标',
                      dataIndex: 'is_compliant',
                      width: 80,
                      render: (val: boolean) => val ? <Tag color="success">达标</Tag> : <Tag color="error">不达标</Tag>,
                    },
                    { title: '评分依据', dataIndex: 'score_basis', ellipsis: true },
                  ]}
                />
              </Card>
            </div>
          ) : (
            <Empty
              image={<FileDoneOutlined style={{ fontSize: 48, color: '#ccc' }} />}
              description={
                <span style={{ color: '#999' }}>
                  暂无报告数据
                  <br />
                  请先完成指标评分后再查看报告
                </span>
              }
            />
          )}
        </Spin>
      ),
    },
  ];

  return (
    <div className={styles.evaluationDetail}>
      {/* 面包屑导航 */}
      <Breadcrumb
        className={styles.breadcrumb}
        items={[
          {
            href: '/expert/evaluations',
            title: (
              <>
                <HomeOutlined />
                <span>评估任务</span>
              </>
            ),
          },
          {
            title: evaluation?.targetName || '评估详情',
          },
        ]}
      />

      {/* 返回按钮 */}
      <Button
        type="link"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/expert/evaluations')}
        className={styles.backButton}
      >
        返回任务列表
      </Button>

      <Spin spinning={loading}>
        {evaluation && (
          <>
            {/* 头部信息 */}
            <Card className={styles.headerCard}>
              <div className={styles.targetInfo}>
                <div className={styles.targetMain}>
                  <h1 className={styles.targetName}>{evaluation.targetName}</h1>
                  <Space size={8}>
                    <Tag color={evaluation.targetType === 'school' ? 'blue' : 'green'}>
                      {evaluation.targetType === 'school' ? '学校' : '区县'}
                    </Tag>
                    {statusConfig && (
                      <Tag color={statusConfig.color}>{statusConfig.text}</Tag>
                    )}
                  </Space>
                  <div className={styles.targetMeta}>
                    所属项目：{evaluation.projectName}
                  </div>
                </div>
                <div className={styles.progressCard}>
                  <span className={styles.progressLabel}>评分进度</span>
                  <Progress
                    type="circle"
                    percent={progressPercent}
                    width={80}
                    strokeColor={progressPercent === 100 ? '#52c41a' : '#1890ff'}
                    format={() => `${scoredLeaf}/${totalLeaf}`}
                  />
                </div>
              </div>
            </Card>

            {/* Tab 内容区 */}
            <Card className={styles.contentCard}>
              <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={tabItems}
                size="large"
              />
            </Card>
          </>
        )}
      </Spin>

      {/* 评语编辑弹窗 */}
      <Modal
        title={editingComment ? '编辑评语' : '添加评语'}
        open={commentModalVisible}
        onCancel={() => {
          setCommentModalVisible(false);
          setEditingComment(null);
          commentForm.resetFields();
        }}
        footer={null}
        width={500}
      >
        <Form form={commentForm} onFinish={handleSaveComment} layout="vertical">
          <Form.Item
            name="commentType"
            label="评语类型"
            rules={[{ required: true, message: '请选择评语类型' }]}
          >
            <Select disabled={!!editingComment}>
              <Select.Option value="strength">主要亮点</Select.Option>
              <Select.Option value="weakness">问题不足</Select.Option>
              <Select.Option value="suggestion">改进建议</Select.Option>
              <Select.Option value="highlight">典型经验</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="content"
            label="评语内容"
            rules={[{ required: true, message: '请输入评语内容' }]}
          >
            <TextArea rows={4} placeholder="请输入评语内容..." />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setCommentModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">保存</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 问题登记弹窗 */}
      <Modal
        title={editingIssue ? '编辑问题' : '登记问题'}
        open={issueModalVisible}
        onCancel={() => {
          setIssueModalVisible(false);
          setEditingIssue(null);
          issueForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form form={issueForm} onFinish={handleSaveIssue} layout="vertical">
          <Form.Item
            name="title"
            label="问题标题"
            rules={[{ required: true, message: '请输入问题标题' }]}
          >
            <Input placeholder="请简要描述问题..." />
          </Form.Item>
          <Form.Item
            name="description"
            label="问题描述"
          >
            <TextArea rows={3} placeholder="详细描述问题情况..." />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="severity"
                label="严重程度"
                rules={[{ required: true, message: '请选择严重程度' }]}
              >
                <Select placeholder="选择严重程度">
                  <Select.Option value="high">
                    <Tag color="red">高</Tag> 严重问题
                  </Select.Option>
                  <Select.Option value="medium">
                    <Tag color="orange">中</Tag> 一般问题
                  </Select.Option>
                  <Select.Option value="low">
                    <Tag color="blue">低</Tag> 轻微问题
                  </Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="rectificationDeadline"
                label="整改期限"
              >
                <DatePicker
                  style={{ width: '100%' }}
                  placeholder="选择整改截止日期"
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="relatedIndicators"
            label="关联指标"
          >
            <Select
              mode="multiple"
              placeholder="选择相关指标（可多选）"
              allowClear
            >
              {indicators.filter(i => i.isLeaf).map(ind => (
                <Select.Option key={ind.id} value={ind.id}>
                  {ind.code} {ind.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIssueModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                {editingIssue ? '保存修改' : '登记问题'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default EvaluationDetail;
