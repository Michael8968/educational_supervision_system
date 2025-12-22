/**
 * 学前教育普及普惠督导评估 - 区县工作台
 *
 * 功能：
 * 1. 显示普及普惠水平3项指标汇总
 * 2. 显示政府保障情况11项指标
 * 3. 显示保教质量保障6项指标
 * 4. 显示分级达标判定结果（巩固/提高/创优）
 * 5. 显示幼儿园统计汇总
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Tabs,
  Tag,
  Alert,
  Spin,
  Table,
  Typography,
  Row,
  Col,
  Statistic,
  Space,
  message
} from 'antd';
import {
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

import {
  getUniversalizationSummary,
  getOverallCompliance,
  getKindergartenSummary,
  getComplianceLevelText,
  getComplianceLevelColor,
  getPreschoolLevelText,
  getPreschoolLevelColor,
  type UniversalizationSummary,
  type OverallComplianceResponse,
  type KindergartenSummaryResponse,
  type ComplianceLevel,
  type IndicatorData,
  type IndicatorEvaluation,
  type KindergartenInfo
} from '../../services/preschoolStatisticsService';

const { Title, Text, Paragraph } = Typography;

interface PreschoolDashboardProps {
  districtId: string;
  projectId: string;
}

/**
 * 获取达标等级的图标
 */
function getComplianceLevelIcon(level: ComplianceLevel) {
  switch (level) {
    case 'compliant':
      return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    case 'basic':
      return <WarningOutlined style={{ color: '#faad14' }} />;
    case 'non-compliant':
      return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
    case 'pending':
    default:
      return <ClockCircleOutlined style={{ color: '#d9d9d9' }} />;
  }
}

/**
 * 获取达标等级的Tag颜色
 */
function getComplianceLevelTagColor(level: ComplianceLevel): string {
  const colorMap: Record<ComplianceLevel, string> = {
    compliant: 'success',
    basic: 'warning',
    'non-compliant': 'error',
    pending: 'default'
  };
  return colorMap[level] || 'default';
}

/**
 * 获取学前双普等级的Tag颜色
 */
function getPreschoolLevelTagColor(level: string): string {
  const colorMap: Record<string, string> = {
    excellence: 'success',
    improved: 'blue',
    consolidated: 'cyan',
    'non-compliant': 'error'
  };
  return colorMap[level] || 'default';
}

const PreschoolDashboard: React.FC<PreschoolDashboardProps> = ({ districtId, projectId }) => {
  const [activeTab, setActiveTab] = useState('1');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 数据状态
  const [universalizationData, setUniversalizationData] = useState<UniversalizationSummary | null>(null);
  const [overallComplianceData, setOverallComplianceData] = useState<OverallComplianceResponse | null>(null);
  const [kindergartenData, setKindergartenData] = useState<KindergartenSummaryResponse | null>(null);

  // 加载数据
  useEffect(() => {
    loadData();
  }, [districtId, projectId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 并行加载三个接口的数据
      const [universalization, overallCompliance, kindergartens] = await Promise.all([
        getUniversalizationSummary(districtId, projectId),
        getOverallCompliance(districtId, projectId),
        getKindergartenSummary(projectId)
      ]);

      setUniversalizationData(universalization);
      setOverallComplianceData(overallCompliance);
      setKindergartenData(kindergartens);
    } catch (err) {
      console.error('加载学前教育数据失败:', err);
      const errorMsg = err instanceof Error ? err.message : '加载数据失败';
      setError(errorMsg);
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <Alert message="错误" description={error} type="error" showIcon />
      </div>
    );
  }

  // Tab 1: 普及普惠水平指标卡片
  const renderUniversalizationTab = () => {
    if (!universalizationData) return null;

    return (
      <div style={{ padding: '24px' }}>
        <Title level={4}>普及普惠水平（3项指标）</Title>

        {universalizationData.message && (
          <Alert
            message={universalizationData.message}
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        <Row gutter={[16, 16]}>
          {universalizationData.indicators.map((indicator) => (
            <Col xs={24} md={8} key={indicator.code}>
              <Card>
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Text type="secondary">{indicator.name}</Text>
                    {getComplianceLevelIcon(indicator.complianceLevel)}
                  </div>

                  <Title level={2} style={{ margin: '8px 0' }}>
                    {indicator.value !== null ? `${indicator.value}${indicator.unit}` : '-'}
                  </Title>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text type="secondary">
                      标准：{indicator.operator} {indicator.threshold}{indicator.unit}
                    </Text>
                    <Tag color={getComplianceLevelTagColor(indicator.complianceLevel)}>
                      {getComplianceLevelText(indicator.complianceLevel)}
                    </Tag>
                  </div>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>

        {/* 汇总统计 */}
        <Card title="汇总统计" style={{ marginTop: 24 }}>
          <Row gutter={16}>
            <Col span={6}>
              <Statistic
                title="合格"
                value={universalizationData.summary.compliantCount}
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="基本合格"
                value={universalizationData.summary.basicCount}
                valueStyle={{ color: '#faad14' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="不合格"
                value={universalizationData.summary.nonCompliantCount}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="待填报"
                value={universalizationData.summary.pendingCount}
              />
            </Col>
          </Row>
        </Card>
      </div>
    );
  };

  // Tab 2: 综合达标情况
  const renderOverallComplianceTab = () => {
    if (!overallComplianceData) return null;

    const columns: ColumnsType<IndicatorEvaluation> = [
      {
        title: '指标编码',
        dataIndex: 'code',
        key: 'code',
        width: 120
      },
      {
        title: '指标名称',
        dataIndex: 'name',
        key: 'name'
      },
      {
        title: '达标情况',
        dataIndex: 'complianceLevel',
        key: 'complianceLevel',
        width: 150,
        align: 'center',
        render: (level: ComplianceLevel) => (
          <Tag
            icon={getComplianceLevelIcon(level)}
            color={getComplianceLevelTagColor(level)}
          >
            {getComplianceLevelText(level)}
          </Tag>
        )
      }
    ];

    return (
      <div style={{ padding: '24px' }}>
        <Title level={4}>
          全部指标达标情况（共 {overallComplianceData.summary.totalCount} 项）
        </Title>

        {overallComplianceData.message && (
          <Alert
            message={overallComplianceData.message}
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        <Table
          columns={columns}
          dataSource={overallComplianceData.indicators}
          rowKey="code"
          pagination={false}
          bordered
        />

        {/* 达标标准说明 */}
        <Card title="达标标准" style={{ marginTop: 24 }}>
          <Row gutter={16}>
            <Col span={8}>
              <Text type="secondary" strong>创优"学前双普"</Text>
              <Paragraph>
                {overallComplianceData.config.levels.excellence.minCompliant} 项合格 +
                最多 {overallComplianceData.config.levels.excellence.maxBasicCompliant} 项基本合格
              </Paragraph>
            </Col>
            <Col span={8}>
              <Text type="secondary" strong>提高"学前双普"</Text>
              <Paragraph>
                {overallComplianceData.config.levels.improved.minCompliant} 项合格 +
                最多 {overallComplianceData.config.levels.improved.maxBasicCompliant} 项基本合格
              </Paragraph>
            </Col>
            <Col span={8}>
              <Text type="secondary" strong>巩固"学前双普"</Text>
              <Paragraph>
                {overallComplianceData.config.levels.consolidated.minCompliant} 项合格 +
                最多 {overallComplianceData.config.levels.consolidated.maxBasicCompliant} 项基本合格
              </Paragraph>
            </Col>
          </Row>
        </Card>
      </div>
    );
  };

  // Tab 3: 幼儿园统计
  const renderKindergartenTab = () => {
    if (!kindergartenData) return null;

    const columns: ColumnsType<KindergartenInfo> = [
      {
        title: '代码',
        dataIndex: 'code',
        key: 'code',
        width: 100
      },
      {
        title: '名称',
        dataIndex: 'name',
        key: 'name'
      },
      {
        title: '类型',
        dataIndex: 'kindergartenType',
        key: 'kindergartenType',
        width: 120
      },
      {
        title: '在园幼儿数',
        dataIndex: 'studentCount',
        key: 'studentCount',
        width: 120,
        align: 'right'
      },
      {
        title: '教师数',
        dataIndex: 'teacherCount',
        key: 'teacherCount',
        width: 100,
        align: 'right'
      },
      {
        title: '班级数',
        dataIndex: 'classCount',
        key: 'classCount',
        width: 100,
        align: 'right'
      },
      {
        title: '城乡',
        dataIndex: 'urbanRural',
        key: 'urbanRural',
        width: 80
      }
    ];

    return (
      <div style={{ padding: '24px' }}>
        <Title level={4}>幼儿园统计汇总</Title>

        {/* 汇总卡片 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={12} md={6}>
            <Card>
              <Statistic title="幼儿园总数" value={kindergartenData.summary.total} suffix="所" />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card>
              <Statistic title="在园幼儿总数" value={kindergartenData.summary.students.total} suffix="人" />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card>
              <Statistic
                title="公办园占比"
                value={kindergartenData.summary.students.publicRatio || 0}
                suffix="%"
                precision={2}
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card>
              <Statistic
                title="普惠性覆盖率"
                value={kindergartenData.summary.students.inclusiveCoverage || 0}
                suffix="%"
                precision={2}
              />
            </Card>
          </Col>
        </Row>

        {/* 详细统计 */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={12}>
            <Card title="按类型统计" size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>公办园</Text>
                  <Text strong>{kindergartenData.summary.byType.public} 所</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>普惠性民办园</Text>
                  <Text strong>{kindergartenData.summary.byType.inclusivePrivate} 所</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>非普惠性民办园</Text>
                  <Text strong>{kindergartenData.summary.byType.nonInclusivePrivate} 所</Text>
                </div>
              </Space>
            </Card>
          </Col>
          <Col span={12}>
            <Card title="按城乡分布统计" size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>城区</Text>
                  <Text strong>{kindergartenData.summary.byUrbanRural.urban} 所</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>镇区</Text>
                  <Text strong>{kindergartenData.summary.byUrbanRural.town} 所</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>乡村</Text>
                  <Text strong>{kindergartenData.summary.byUrbanRural.rural} 所</Text>
                </div>
              </Space>
            </Card>
          </Col>
        </Row>

        {/* 幼儿园列表 */}
        <Card title="幼儿园明细" size="small">
          <Table
            columns={columns}
            dataSource={kindergartenData.kindergartens}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            size="small"
            bordered
          />
        </Card>
      </div>
    );
  };

  const tabItems = [
    {
      key: '1',
      label: '普及普惠水平',
      children: renderUniversalizationTab()
    },
    {
      key: '2',
      label: '综合达标情况',
      children: renderOverallComplianceTab()
    },
    {
      key: '3',
      label: '幼儿园统计',
      children: renderKindergartenTab()
    }
  ];

  return (
    <div>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={3}>学前教育普及普惠督导评估工作台</Title>
        <Text type="secondary">
          {universalizationData?.district.name || '区县'}
        </Text>
      </div>

      {/* 综合达标等级卡片 */}
      {overallComplianceData?.complianceLevel && (
        <Card style={{ marginBottom: 24 }}>
          <Row gutter={16} align="middle">
            <Col xs={24} md={16}>
              <Space direction="vertical" size="small">
                <Title level={5} style={{ margin: 0 }}>综合达标等级</Title>
                <Space>
                  <Tag
                    color={getPreschoolLevelTagColor(overallComplianceData.complianceLevel.level)}
                    style={{ fontSize: 16, padding: '4px 12px' }}
                  >
                    {overallComplianceData.complianceLevel.name}
                  </Tag>
                  <Text type="secondary">
                    {overallComplianceData.complianceLevel.description}
                  </Text>
                </Space>
              </Space>
            </Col>
            <Col xs={24} md={8} style={{ textAlign: 'right' }}>
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Text type="secondary">
                  合格：{overallComplianceData.summary.compliantCount} 项
                </Text>
                <Text type="secondary">
                  基本合格：{overallComplianceData.summary.basicCount} 项
                </Text>
                {overallComplianceData.summary.nonCompliantCount > 0 && (
                  <Text type="danger">
                    不合格：{overallComplianceData.summary.nonCompliantCount} 项
                  </Text>
                )}
              </Space>
            </Col>
          </Row>
        </Card>
      )}

      {/* 选项卡 */}
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
        />
      </Card>
    </div>
  );
};

export default PreschoolDashboard;
