/**
 * 普及普惠（幼儿园）指标组件
 *
 * 按照学前教育普及普惠督导评估指标体系展示各幼儿园情况：
 * - 幼儿园汇总统计（按办学性质、城乡类型分类）
 * - 幼儿园列表（基本信息和评估状态）
 * - 幼儿园详情弹窗
 */
import React, { useState, useEffect } from 'react';
import { Table, Tag, Card, Row, Col, Statistic, Spin, Empty, Modal, Descriptions, Alert, Progress } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  HomeOutlined,
  TeamOutlined,
  UserOutlined,
  BankOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons';
import {
  getDistrictSchoolsIndicatorSummary,
  getSchoolIndicatorDetail,
  SchoolIndicatorSummary,
  SchoolIndicatorDetail,
} from '../../../services/districtService';

interface PreschoolSchoolIndicatorsProps {
  districtId: string;
  projectId: string;
}

const PreschoolSchoolIndicators: React.FC<PreschoolSchoolIndicatorsProps> = ({
  districtId,
  projectId,
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    summary: {
      schoolCount: number;
      totalIndicators: number;
      totalCompliant: number;
      totalNonCompliant: number;
      avgComplianceRate: number | null;
    } | null;
    schools: SchoolIndicatorSummary[];
  }>({ summary: null, schools: [] });

  // 幼儿园详情弹窗
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [schoolDetail, setSchoolDetail] = useState<SchoolIndicatorDetail | null>(null);

  // 加载数据（固定筛选幼儿园）
  useEffect(() => {
    if (!districtId || !projectId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const result = await getDistrictSchoolsIndicatorSummary(districtId, projectId, '幼儿园');
        setData({
          summary: result.summary,
          schools: result.schools,
        });
      } catch (error) {
        console.error('加载数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [districtId, projectId]);

  // 查看幼儿园详情
  const handleViewDetail = async (schoolId: string) => {
    setDetailModalVisible(true);
    setDetailLoading(true);

    try {
      const detail = await getSchoolIndicatorDetail(schoolId, projectId);
      setSchoolDetail(detail);
    } catch (error) {
      console.error('加载幼儿园详情失败:', error);
      setSchoolDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  if (!projectId) {
    return <Empty description="请先选择项目" />;
  }

  // 获取办学性质标签颜色
  const getCategoryColor = (category: string) => {
    const colorMap: Record<string, string> = {
      '公办': 'green',
      '民办': 'blue',
      '普惠性民办': 'cyan',
      '非普惠性民办': 'orange',
    };
    return colorMap[category] || 'default';
  };

  // 获取城乡类型标签颜色
  const getUrbanRuralColor = (type: string) => {
    const colorMap: Record<string, string> = {
      '城区': 'purple',
      '镇区': 'cyan',
      '乡村': 'gold',
    };
    return colorMap[type] || 'default';
  };

  // 计算统计数据
  const calculateStats = () => {
    const schools = data.schools;
    const publicCount = schools.filter(s => s.school?.schoolCategory === '公办').length;
    const privateCount = schools.filter(s => s.school?.schoolCategory === '民办').length;
    const totalStudents = schools.reduce((sum, s) => sum + (s.school?.studentCount || 0), 0);
    const publicStudents = schools
      .filter(s => s.school?.schoolCategory === '公办')
      .reduce((sum, s) => sum + (s.school?.studentCount || 0), 0);
    const totalTeachers = schools.reduce((sum, s) => sum + (s.school?.teacherCount || 0), 0);

    return {
      publicCount,
      privateCount,
      totalStudents,
      publicStudents,
      totalTeachers,
      publicRatio: totalStudents > 0 ? ((publicStudents / totalStudents) * 100).toFixed(2) : '0',
    };
  };

  const stats = calculateStats();

  // 幼儿园列表列定义
  const columns: ColumnsType<SchoolIndicatorSummary> = [
    {
      title: '幼儿园名称',
      key: 'name',
      width: 200,
      fixed: 'left',
      render: (_, record) => {
        const name = record?.school?.name ?? '-';
        const schoolId = record?.school?.id;
        if (!schoolId) return name;
        return <a onClick={() => handleViewDetail(schoolId)}>{name}</a>;
      },
    },
    {
      title: '办学性质',
      key: 'schoolCategory',
      width: 110,
      filters: [
        { text: '公办', value: '公办' },
        { text: '民办', value: '民办' },
      ],
      onFilter: (value, record) => record?.school?.schoolCategory === value,
      render: (_, record) => {
        const category = record?.school?.schoolCategory;
        if (!category) return '-';
        return <Tag color={getCategoryColor(category)}>{category}</Tag>;
      },
    },
    {
      title: '城乡类型',
      key: 'urbanRural',
      width: 90,
      filters: [
        { text: '城区', value: '城区' },
        { text: '镇区', value: '镇区' },
        { text: '乡村', value: '乡村' },
      ],
      onFilter: (value, record) => record?.school?.urbanRural === value,
      render: (_, record) => {
        const type = record?.school?.urbanRural;
        if (!type) return '-';
        return <Tag color={getUrbanRuralColor(type)}>{type}</Tag>;
      },
    },
    {
      title: '在园幼儿数',
      key: 'studentCount',
      width: 100,
      align: 'right',
      sorter: (a, b) => (a?.school?.studentCount || 0) - (b?.school?.studentCount || 0),
      render: (_, record) => record?.school?.studentCount ?? '-',
    },
    {
      title: '教职工数',
      key: 'teacherCount',
      width: 100,
      align: 'right',
      sorter: (a, b) => (a?.school?.teacherCount || 0) - (b?.school?.teacherCount || 0),
      render: (_, record) => record?.school?.teacherCount ?? '-',
    },
    {
      title: '师幼比',
      key: 'ratio',
      width: 90,
      align: 'right',
      render: (_, record) => {
        const students = record?.school?.studentCount;
        const teachers = record?.school?.teacherCount;
        if (!students || !teachers) return '-';
        return `1:${(students / teachers).toFixed(1)}`;
      },
    },
    {
      title: '指标评估',
      key: 'stats',
      width: 140,
      render: (_, record) => {
        const total = record?.statistics?.total ?? 0;
        if (total === 0) {
          return <Tag color="default">暂无数据</Tag>;
        }
        return (
          <span>
            <Tag color="success">{record?.statistics?.compliant ?? 0} 达标</Tag>
            <Tag color="error">{record?.statistics?.nonCompliant ?? 0} 未达标</Tag>
          </span>
        );
      },
    },
    {
      title: '达标率',
      dataIndex: 'complianceRate',
      key: 'complianceRate',
      width: 150,
      sorter: (a, b) => (a.complianceRate || 0) - (b.complianceRate || 0),
      render: (rate: number | null, record) => {
        const total = record?.statistics?.total ?? 0;
        if (total === 0) {
          return <span style={{ color: '#999' }}>-</span>;
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Progress
              percent={rate || 0}
              size="small"
              style={{ width: 80 }}
              strokeColor={
                (rate || 0) >= 90 ? '#52c41a' : (rate || 0) >= 70 ? '#faad14' : '#ff4d4f'
              }
              showInfo={false}
            />
            <span style={{ fontWeight: 500 }}>{rate !== null ? `${rate}%` : '-'}</span>
          </div>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      fixed: 'right',
      render: (_, record) => {
        const schoolId = record?.school?.id;
        if (!schoolId) return <span style={{ color: '#999' }}>-</span>;
        return <a onClick={() => handleViewDetail(schoolId)}>详情</a>;
      },
    },
  ];

  // 可展开行内容
  const expandedRowRender = (record: SchoolIndicatorSummary) => {
    if (!record?.nonCompliantIndicators || record.nonCompliantIndicators.length === 0) {
      const total = record?.statistics?.total ?? 0;
      if (total === 0) {
        return <div style={{ padding: 16, color: '#999' }}>暂无指标评估数据</div>;
      }
      return <div style={{ padding: 16, color: '#52c41a' }}>所有指标均达标</div>;
    }

    return (
      <div style={{ padding: '8px 16px', background: '#fafafa' }}>
        <div style={{ fontWeight: 500, marginBottom: 8 }}>未达标指标：</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {record.nonCompliantIndicators.map((indicator, index) => (
            <Tag key={index} color="error">
              {indicator.indicatorName}
              <span style={{ marginLeft: 4, opacity: 0.7 }}>
                (实际值: {indicator.value ?? indicator.text_value ?? '-'}, 阈值: {indicator.threshold})
              </span>
            </Tag>
          ))}
        </div>
      </div>
    );
  };

  // 详情弹窗指标列表列定义
  const detailColumns: ColumnsType<SchoolIndicatorDetail['indicators'][0]> = [
    {
      title: '指标代码',
      dataIndex: 'indicatorCode',
      key: 'indicatorCode',
      width: 120,
    },
    {
      title: '指标名称',
      dataIndex: 'indicatorName',
      key: 'indicatorName',
      width: 200,
    },
    {
      title: '实际值',
      key: 'value',
      width: 120,
      render: (_, record) => record.value ?? record.textValue ?? '-',
    },
    {
      title: '阈值',
      dataIndex: 'threshold',
      key: 'threshold',
      width: 100,
    },
    {
      title: '达标状态',
      dataIndex: 'isCompliant',
      key: 'isCompliant',
      width: 100,
      render: (status: number | null) => {
        if (status === 1) {
          return <Tag icon={<CheckCircleOutlined />} color="success">达标</Tag>;
        } else if (status === 0) {
          return <Tag icon={<CloseCircleOutlined />} color="error">未达标</Tag>;
        }
        return <Tag icon={<MinusCircleOutlined />} color="default">待评估</Tag>;
      },
    },
    {
      title: '采集时间',
      dataIndex: 'collectedAt',
      key: 'collectedAt',
      width: 120,
    },
  ];

  return (
    <div>
      {/* 普及普惠指标说明 */}
      <Alert
        message="学前教育普及普惠督导评估 - 幼儿园保教质量保障情况"
        description={
          <div>
            本页面展示区县内各幼儿园的基本情况和指标评估结果，用于支撑普及普惠督导评估中"幼儿园保教质量保障情况"维度的评估。
            评估指标包括：办园条件合格、班额基本达标、教师配足配齐等。
          </div>
        }
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      {/* 汇总统计 - 普及普惠相关 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={<span><BankOutlined style={{ marginRight: 8 }} />幼儿园总数</span>}
              value={data.summary?.schoolCount || data.schools.length}
              suffix="所"
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
              公办 {stats.publicCount} | 民办 {stats.privateCount}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={<span><TeamOutlined style={{ marginRight: 8 }} />在园幼儿总数</span>}
              value={stats.totalStudents}
              suffix="人"
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
              公办园 {stats.publicStudents} 人
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={<span><HomeOutlined style={{ marginRight: 8 }} />公办园在园幼儿占比</span>}
              value={stats.publicRatio}
              precision={2}
              suffix="%"
              valueStyle={{
                color: parseFloat(stats.publicRatio) >= 50 ? '#3f8600' : '#cf1322',
              }}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
              达标标准：≥50%
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={<span><UserOutlined style={{ marginRight: 8 }} />教职工总数</span>}
              value={stats.totalTeachers}
              suffix="人"
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
              师幼比参考
            </div>
          </Card>
        </Col>
      </Row>

      {/* 指标达标统计 */}
      {data.summary && (data.summary.totalIndicators > 0) && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12}>
            <Card size="small" title="指标评估统计">
              <Row gutter={16}>
                <Col span={8}>
                  <Statistic
                    title="达标"
                    value={data.summary.totalCompliant}
                    suffix="项"
                    valueStyle={{ color: '#3f8600' }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="未达标"
                    value={data.summary.totalNonCompliant}
                    suffix="项"
                    valueStyle={{ color: '#cf1322' }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="平均达标率"
                    value={data.summary.avgComplianceRate || 0}
                    precision={2}
                    suffix="%"
                    valueStyle={{
                      color:
                        (data.summary.avgComplianceRate || 0) >= 90
                          ? '#3f8600'
                          : (data.summary.avgComplianceRate || 0) >= 70
                          ? '#faad14'
                          : '#cf1322',
                    }}
                  />
                </Col>
              </Row>
            </Card>
          </Col>
          <Col xs={24} sm={12}>
            <Card size="small" title="幼儿园保教质量保障指标">
              <div style={{ fontSize: 13, color: '#666', lineHeight: 1.8 }}>
                <div>• 3.1 办园条件合格（办园条件合格率 ≥ 100%）</div>
                <div>• 3.2 班额基本达标（超标准班额班级数 = 0）</div>
                <div>• 3.3 教师配足配齐（教职工配备达标率 ≥ 100%）</div>
              </div>
            </Card>
          </Col>
        </Row>
      )}

      {/* 幼儿园列表 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
        </div>
      ) : data.schools.length > 0 ? (
        <Card title={`幼儿园列表（共 ${data.schools.length} 所）`}>
          <Table
            columns={columns}
            dataSource={data.schools}
            rowKey={(record) => record?.school?.id || `row-${Math.random()}`}
            expandable={{
              expandedRowRender,
              rowExpandable: () => true,
            }}
            scroll={{ x: 1200 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 所幼儿园`,
            }}
          />
        </Card>
      ) : (
        <Empty description="暂无幼儿园数据" />
      )}

      {/* 幼儿园详情弹窗 */}
      <Modal
        title={
          schoolDetail?.school?.name
            ? `${schoolDetail.school.name} - 详情`
            : '幼儿园详情'
        }
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setSchoolDetail(null);
        }}
        width={900}
        footer={null}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
          </div>
        ) : schoolDetail?.school ? (
          <div>
            {/* 幼儿园基本信息 */}
            <Descriptions
              bordered
              column={2}
              size="small"
              style={{ marginBottom: 16 }}
            >
              <Descriptions.Item label="幼儿园编码">{schoolDetail.school.code}</Descriptions.Item>
              <Descriptions.Item label="幼儿园名称">{schoolDetail.school.name}</Descriptions.Item>
              <Descriptions.Item label="学校类型">{schoolDetail.school.schoolType}</Descriptions.Item>
              <Descriptions.Item label="所属区县">{schoolDetail.school.districtName || '-'}</Descriptions.Item>
              <Descriptions.Item label="在园幼儿数">{schoolDetail.school.studentCount} 人</Descriptions.Item>
              <Descriptions.Item label="教职工数">{schoolDetail.school.teacherCount} 人</Descriptions.Item>
              <Descriptions.Item label="师幼比" span={2}>
                {schoolDetail.school.teacherCount && schoolDetail.school.studentCount
                  ? `1:${(schoolDetail.school.studentCount / schoolDetail.school.teacherCount).toFixed(1)}`
                  : '-'}
              </Descriptions.Item>
            </Descriptions>

            {/* 指标评估统计 */}
            <Card size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={6}>
                  <Statistic title="指标总数" value={schoolDetail.statistics.total} suffix="项" />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="达标"
                    value={schoolDetail.statistics.compliant}
                    suffix="项"
                    valueStyle={{ color: '#3f8600' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="未达标"
                    value={schoolDetail.statistics.nonCompliant}
                    suffix="项"
                    valueStyle={{ color: '#cf1322' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="达标率"
                    value={schoolDetail.complianceRate || 0}
                    suffix="%"
                    valueStyle={{
                      color:
                        (schoolDetail.complianceRate || 0) >= 90
                          ? '#3f8600'
                          : (schoolDetail.complianceRate || 0) >= 70
                          ? '#faad14'
                          : '#cf1322',
                    }}
                  />
                </Col>
              </Row>
            </Card>

            {/* 指标列表 */}
            {schoolDetail.indicators.length > 0 ? (
              <Table
                columns={detailColumns}
                dataSource={schoolDetail.indicators}
                rowKey="id"
                size="small"
                pagination={false}
                scroll={{ y: 300 }}
              />
            ) : (
              <Empty description="暂无指标评估数据" />
            )}

            {/* 普及普惠评估指标说明 */}
            <Card
              size="small"
              title="幼儿园保教质量保障情况评估说明"
              style={{ marginTop: 16 }}
            >
              <div style={{ fontSize: 13, color: '#666' }}>
                <p>根据《学前教育普及普惠督导评估指标体系》，幼儿园需满足以下条件：</p>
                <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
                  <li>3.1 办园条件合格（办园条件合格率 ≥ 100%）</li>
                  <li>3.2 班额基本达标（超标准班额班级数 = 0）</li>
                  <li>3.3 教师配足配齐（教职工配备达标率 ≥ 100%）</li>
                  <li>3.4 教师管理制度严格</li>
                  <li>3.5 落实科学保教要求</li>
                  <li>3.6 无"小学化"现象</li>
                </ul>
                <p style={{ color: '#faad14', marginTop: 8 }}>
                  注：具体评估结果需结合区县填报的综合数据和佐证材料进行判定。
                </p>
              </div>
            </Card>
          </div>
        ) : (
          <Empty description="暂无数据" />
        )}
      </Modal>
    </div>
  );
};

export default PreschoolSchoolIndicators;
