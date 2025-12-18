import React, { useState, useEffect } from 'react';
import { Table, Tag, Progress, Select, Card, Row, Col, Statistic, Spin, Empty, Modal, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
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

interface SchoolIndicatorsProps {
  districtId: string;
  projectId: string;
}

const SchoolIndicators: React.FC<SchoolIndicatorsProps> = ({ districtId, projectId }) => {
  const [loading, setLoading] = useState(false);
  const [schoolType, setSchoolType] = useState<string>('');
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

  // 学校详情弹窗
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [schoolDetail, setSchoolDetail] = useState<SchoolIndicatorDetail | null>(null);
  const [primaryDetail, setPrimaryDetail] = useState<SchoolIndicatorDetail | null>(null);
  const [juniorDetail, setJuniorDetail] = useState<SchoolIndicatorDetail | null>(null);
  const [detailTabKey, setDetailTabKey] = useState<string>('primary');
  const [currentSchoolType, setCurrentSchoolType] = useState<string>('');

  // 加载数据
  useEffect(() => {
    if (!districtId || !projectId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const result = await getDistrictSchoolsIndicatorSummary(
          districtId,
          projectId,
          schoolType || undefined
        );
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
  }, [districtId, projectId, schoolType]);

  // 查看学校详情
  const handleViewDetail = async (schoolId: string, schoolTypeName?: string) => {
    setDetailModalVisible(true);
    setDetailLoading(true);
    setCurrentSchoolType(schoolTypeName || '');
    setDetailTabKey('primary');
    
    try {
      // 判断是否为一贯制学校或完全中学
      const isIntegratedSchool = schoolTypeName === '九年一贯制' || schoolTypeName === '完全中学';
      
      if (isIntegratedSchool) {
        // 加载两个部门的数据
        const [primaryData, juniorData] = await Promise.all([
          getSchoolIndicatorDetail(schoolId, projectId, 'primary'),
          getSchoolIndicatorDetail(schoolId, projectId, 'junior')
        ]);
        setPrimaryDetail(primaryData);
        setJuniorDetail(juniorData);
        setSchoolDetail(primaryData); // 默认显示小学部
      } else {
        // 普通学校，只加载一次
        const detail = await getSchoolIndicatorDetail(schoolId, projectId);
        setSchoolDetail(detail);
        setPrimaryDetail(null);
        setJuniorDetail(null);
      }
    } catch (error) {
      console.error('加载学校详情失败:', error);
      setSchoolDetail(null);
      setPrimaryDetail(null);
      setJuniorDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  if (!projectId) {
    return <Empty description="请先选择项目" />;
  }

  // 学校列表列定义
  const columns: ColumnsType<SchoolIndicatorSummary> = [
    {
      title: '学校名称',
      key: 'name',
      width: 200,
      fixed: 'left',
      render: (_, record) => record?.school?.name ?? '-',
    },
    {
      title: '学校类型',
      key: 'schoolType',
      width: 120,
      render: (_, record) => {
        const type = record?.school?.schoolType;
        const sectionName = record?.school?.sectionName;
        if (!type) return '-';
        
        // 如果是一贯制学校或完全中学的拆分记录，显示部门信息
        let displayType = type;
        if (sectionName && (type.includes('九年一贯制') || type.includes('完全中学'))) {
          displayType = sectionName;
        }
        
        const colorMap: Record<string, string> = {
          '小学': 'blue',
          '初中': 'green',
          '小学部': 'blue',
          '初中部': 'green',
          '九年一贯制': 'orange',
          '完全中学': 'purple'
        };
        
        return (
          <Tag color={colorMap[displayType] || 'orange'}>
            {displayType}
          </Tag>
        );
      },
    },
    {
      title: '城乡类型',
      key: 'urbanRural',
      width: 80,
      render: (_, record) => record?.school?.urbanRural ?? '-',
    },
    {
      title: '学生数',
      key: 'studentCount',
      width: 80,
      align: 'right',
      render: (_, record) => record?.school?.studentCount ?? '-',
    },
    {
      title: '教师数',
      key: 'teacherCount',
      width: 80,
      align: 'right',
      render: (_, record) => record?.school?.teacherCount ?? '-',
    },
    {
      title: '生师比',
      key: 'studentTeacherRatio',
      width: 80,
      align: 'right',
      render: (_, record) => {
        const ratio = record?.school?.studentTeacherRatio;
        return ratio !== null && ratio !== undefined ? ratio.toFixed(2) : '-';
      },
    },
    {
      title: '指标统计',
      key: 'stats',
      width: 150,
      render: (_, record) => (
        <span>
          <Tag color="success">{record?.statistics?.compliant ?? 0} 达标</Tag>
          <Tag color="error">{record?.statistics?.nonCompliant ?? 0} 未达标</Tag>
        </span>
      ),
    },
    {
      title: '达标率',
      dataIndex: 'complianceRate',
      key: 'complianceRate',
      width: 180,
      render: (rate: number | null) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Progress
            percent={rate || 0}
            size="small"
            style={{ width: 100 }}
            strokeColor={
              (rate || 0) >= 90 ? '#52c41a' : (rate || 0) >= 70 ? '#faad14' : '#ff4d4f'
            }
            showInfo={false}
          />
          <span style={{ fontWeight: 500 }}>{rate !== null ? `${rate}%` : '-'}</span>
        </div>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      fixed: 'right',
      render: (_, record) => {
        const schoolId = record?.school?.id;
        // 获取原始学校类型（去除部门后缀）
        const schoolTypeName = record?.school?.schoolType;
        const originalSchoolType = schoolTypeName?.includes('九年一贯制') 
          ? '九年一贯制' 
          : schoolTypeName?.includes('完全中学')
          ? '完全中学'
          : schoolTypeName;
        if (!schoolId) return <span style={{ color: '#999' }}>-</span>;
        return <a onClick={() => handleViewDetail(schoolId, originalSchoolType)}>查看详情</a>;
      },
    },
  ];

  // 可展开行内容
  const expandedRowRender = (record: SchoolIndicatorSummary) => {
    if (!record?.nonCompliantIndicators || record.nonCompliantIndicators.length === 0) {
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

  // 学校详情指标列表列定义
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
      {/* 筛选条件 */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
        <span>学校类型：</span>
        <Select
          value={schoolType}
          onChange={setSchoolType}
          style={{ width: 120 }}
          allowClear
          placeholder="全部"
          options={[
            { value: '小学', label: '小学' },
            { value: '初中', label: '初中' },
            { value: '九年一贯制', label: '九年一贯制' },
            { value: '完全中学', label: '完全中学' },
          ]}
        />
      </div>

      {/* 汇总统计 */}
      {data.summary && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic title="学校总数" value={data.summary.schoolCount} suffix="所" />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="指标总数"
                value={data.summary.totalIndicators}
                suffix="项"
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="达标/未达标"
                value={`${data.summary.totalCompliant} / ${data.summary.totalNonCompliant}`}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="平均达标率"
                value={data.summary.avgComplianceRate || 0}
                precision={2}
                suffix="%"
                styles={{
                  content: {
                    color:
                      (data.summary.avgComplianceRate || 0) >= 90
                        ? '#3f8600'
                        : (data.summary.avgComplianceRate || 0) >= 70
                        ? '#faad14'
                        : '#cf1322',
                  },
                }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 学校列表 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
        </div>
      ) : data.schools.length > 0 ? (
        <Table
          columns={columns}
          dataSource={data.schools}
          rowKey={(record) => {
            // 对于一贯制学校和完全中学，需要结合 school.id 和 sectionType 确保唯一性
            const schoolId = record?.school?.id || '';
            const sectionType = record?.school?.sectionType || '';
            return sectionType ? `${schoolId}-${sectionType}` : schoolId || `row-${Math.random()}`;
          }}
          expandable={{
            expandedRowRender,
            rowExpandable: (record) => (record?.statistics?.total ?? 0) > 0,
          }}
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 所学校`,
          }}
        />
      ) : (
        <Empty description="暂无学校数据" />
      )}

      {/* 学校详情弹窗 */}
      <Modal
        title={
          schoolDetail?.school?.name
            ? `${schoolDetail.school.name} - 指标详情`
            : '指标详情'
        }
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setSchoolDetail(null);
          setPrimaryDetail(null);
          setJuniorDetail(null);
        }}
        width={900}
        footer={null}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
          </div>
        ) : schoolDetail?.school ? (
          (() => {
            // 判断是否为一贯制学校或完全中学
            const isIntegratedSchool = currentSchoolType === '九年一贯制' || currentSchoolType === '完全中学';
            
            return isIntegratedSchool && primaryDetail && juniorDetail ? (
              // 一贯制学校或完全中学：显示两个Tab
              <Tabs
                activeKey={detailTabKey}
                onChange={(key) => {
                  setDetailTabKey(key);
                  setSchoolDetail(key === 'primary' ? primaryDetail : juniorDetail);
                }}
                items={[
                  {
                    key: 'primary',
                    label: '小学部',
                    children: (
                      <div>
                        {/* 学校基本信息 */}
                        <Card size="small" style={{ marginBottom: 16 }}>
                          <Row gutter={16}>
                            <Col span={6}>
                              <Statistic title="学校类型" value="小学部" />
                            </Col>
                            <Col span={6}>
                              <Statistic title="学生数" value={primaryDetail.school.studentCount} />
                            </Col>
                            <Col span={6}>
                              <Statistic title="教师数" value={primaryDetail.school.teacherCount} />
                            </Col>
                            <Col span={6}>
                              <Statistic
                                title="达标率"
                                value={primaryDetail.complianceRate || 0}
                                suffix="%"
                                styles={{
                                  content: {
                                    color:
                                      (primaryDetail.complianceRate || 0) >= 90
                                        ? '#3f8600'
                                        : (primaryDetail.complianceRate || 0) >= 70
                                        ? '#faad14'
                                        : '#cf1322',
                                  },
                                }}
                              />
                            </Col>
                          </Row>
                        </Card>

                        {/* 指标列表 */}
                        <Table
                          columns={detailColumns}
                          dataSource={primaryDetail.indicators}
                          rowKey="id"
                          size="small"
                          pagination={false}
                          scroll={{ y: 400 }}
                        />
                      </div>
                    ),
                  },
                  {
                    key: 'junior',
                    label: '初中部',
                    children: (
                      <div>
                        {/* 学校基本信息 */}
                        <Card size="small" style={{ marginBottom: 16 }}>
                          <Row gutter={16}>
                            <Col span={6}>
                              <Statistic title="学校类型" value="初中部" />
                            </Col>
                            <Col span={6}>
                              <Statistic title="学生数" value={juniorDetail.school.studentCount} />
                            </Col>
                            <Col span={6}>
                              <Statistic title="教师数" value={juniorDetail.school.teacherCount} />
                            </Col>
                            <Col span={6}>
                              <Statistic
                                title="达标率"
                                value={juniorDetail.complianceRate || 0}
                                suffix="%"
                                styles={{
                                  content: {
                                    color:
                                      (juniorDetail.complianceRate || 0) >= 90
                                        ? '#3f8600'
                                        : (juniorDetail.complianceRate || 0) >= 70
                                        ? '#faad14'
                                        : '#cf1322',
                                  },
                                }}
                              />
                            </Col>
                          </Row>
                        </Card>

                        {/* 指标列表 */}
                        <Table
                          columns={detailColumns}
                          dataSource={juniorDetail.indicators}
                          rowKey="id"
                          size="small"
                          pagination={false}
                          scroll={{ y: 400 }}
                        />
                      </div>
                    ),
                  },
                ]}
              />
            ) : (
              // 普通学校：直接显示
              <div>
                {/* 学校基本信息 */}
                <Card size="small" style={{ marginBottom: 16 }}>
                  <Row gutter={16}>
                    <Col span={6}>
                      <Statistic title="学校类型" value={schoolDetail.school.schoolType} />
                    </Col>
                    <Col span={6}>
                      <Statistic title="学生数" value={schoolDetail.school.studentCount} />
                    </Col>
                    <Col span={6}>
                      <Statistic title="教师数" value={schoolDetail.school.teacherCount} />
                    </Col>
                    <Col span={6}>
                      <Statistic
                        title="达标率"
                        value={schoolDetail.complianceRate || 0}
                        suffix="%"
                        styles={{
                          content: {
                            color:
                              (schoolDetail.complianceRate || 0) >= 90
                                ? '#3f8600'
                                : (schoolDetail.complianceRate || 0) >= 70
                                ? '#faad14'
                                : '#cf1322',
                          },
                        }}
                      />
                    </Col>
                  </Row>
                </Card>

                {/* 指标列表 */}
                <Table
                  columns={detailColumns}
                  dataSource={schoolDetail.indicators}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  scroll={{ y: 400 }}
                />
              </div>
            );
          })()
        ) : (
          <Empty description="暂无数据" />
        )}
      </Modal>
    </div>
  );
};

export default SchoolIndicators;
