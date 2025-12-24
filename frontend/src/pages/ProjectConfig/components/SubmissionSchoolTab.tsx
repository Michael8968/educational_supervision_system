/**
 * 填报学校配置 Tab 组件
 * 配置项目需要哪些区县和学校参与填报
 */

import React, { useMemo } from 'react';
import { Button, Tag, Select, Space, Card, Row, Col, Statistic, Empty, Spin } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  UploadOutlined,
  DownOutlined,
  RightOutlined,
  BankOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import type { SubmissionDistrict } from '../hooks/useSubmissionSchools';
import styles from '../index.module.css';

// 学校类型选项
const SCHOOL_TYPES = [
  { value: 'all', label: '全部类型' },
  { value: '小学', label: '小学' },
  { value: '初中', label: '初中' },
  { value: '九年一贯制', label: '九年一贯制' },
  { value: '完全中学', label: '完全中学' },
];

// 学校类型对应的标签颜色
const SCHOOL_TYPE_COLORS: Record<string, string> = {
  '小学': 'blue',
  '初中': 'green',
  '九年一贯制': 'purple',
  '完全中学': 'orange',
};

interface SubmissionSchoolTabProps {
  districts: SubmissionDistrict[];
  expandedDistricts: string[];
  schoolTypeFilter: string;
  statistics: {
    totalDistricts: number;
    totalSchools: number;
    schoolsByType: Record<string, number>;
  };
  onSchoolTypeFilterChange: (value: string) => void;
  onToggleExpand: (districtId: string) => void;
  onAddDistrict: () => void;
  onAddSchool: (districtId: string) => void;
  onDeleteDistrict: (districtId: string) => void;
  onDeleteSchool: (schoolId: string) => void;
  onImport: () => void;
  disabled?: boolean;
  loading?: boolean;
}

const SubmissionSchoolTab: React.FC<SubmissionSchoolTabProps> = ({
  districts,
  expandedDistricts,
  schoolTypeFilter,
  statistics,
  onSchoolTypeFilterChange,
  onToggleExpand,
  onAddDistrict,
  onAddSchool,
  onDeleteDistrict,
  onDeleteSchool,
  onImport,
  disabled = false,
  loading = false,
}) => {
  // 渲染空状态
  const renderEmpty = () => (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description="暂未配置填报学校"
    >
      {!disabled && (
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={onAddDistrict}>
            添加区县
          </Button>
          <Button icon={<UploadOutlined />} onClick={onImport}>
            批量导入
          </Button>
        </Space>
      )}
    </Empty>
  );

  // 渲染学校类型分布
  const renderSchoolTypeStats = useMemo(() => {
    const types = ['小学', '初中', '九年一贯制', '完全中学'];
    return types.map(type => {
      const count = statistics.schoolsByType[type] || 0;
      if (count === 0) return null;
      return (
        <Tag key={type} color={SCHOOL_TYPE_COLORS[type]}>
          {type}: {count}
        </Tag>
      );
    }).filter(Boolean);
  }, [statistics.schoolsByType]);

  return (
    <Spin spinning={loading}>
      <div className={styles.submissionSchoolTab}>
        {/* 统计卡片 */}
        <Card size="small" className={styles.statsCard} style={{ marginBottom: 16 }}>
          <Row gutter={24} align="middle">
            <Col span={4}>
              <Statistic
                title="区县数量"
                value={statistics.totalDistricts}
                suffix="个"
                prefix={<BankOutlined />}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="学校数量"
                value={statistics.totalSchools}
                suffix="所"
                prefix={<HomeOutlined />}
              />
            </Col>
            <Col span={8}>
              <div style={{ paddingTop: 8 }}>
                <div style={{ marginBottom: 8, color: '#666', fontSize: 12 }}>学校类型分布</div>
                <div>{renderSchoolTypeStats.length > 0 ? renderSchoolTypeStats : <span style={{ color: '#999' }}>暂无数据</span>}</div>
              </div>
            </Col>
            <Col span={8}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <Select
                  value={schoolTypeFilter}
                  onChange={onSchoolTypeFilterChange}
                  style={{ width: 140 }}
                  options={SCHOOL_TYPES}
                />
                {!disabled && (
                  <>
                    <Button icon={<UploadOutlined />} onClick={onImport}>
                      批量导入
                    </Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={onAddDistrict}>
                      添加区县
                    </Button>
                  </>
                )}
              </div>
            </Col>
          </Row>
        </Card>

        {/* 区县和学校列表 */}
        {districts.length === 0 ? (
          renderEmpty()
        ) : (
          <div className={styles.districtList}>
            {districts.map(district => (
              <div key={district.id} className={styles.districtItem}>
                {/* 区县行 */}
                <div className={styles.districtRow}>
                  <div className={styles.districtLeft}>
                    <span
                      className={styles.expandIcon}
                      onClick={() => onToggleExpand(district.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      {expandedDistricts.includes(district.id) ? <DownOutlined /> : <RightOutlined />}
                    </span>
                    <BankOutlined className={styles.districtIcon} style={{ color: '#1890ff', marginRight: 8 }} />
                    <span className={styles.districtName}>{district.name}</span>
                    {district.code && (
                      <span style={{ color: '#999', fontSize: 12, marginLeft: 8 }}>({district.code})</span>
                    )}
                    <Tag color="blue" style={{ marginLeft: 8 }}>区县</Tag>
                    <span className={styles.schoolCount} style={{ color: '#666', marginLeft: 8 }}>
                      ({district.schools.length} 所学校)
                    </span>
                  </div>
                  <div className={styles.districtActions}>
                    {!disabled && (
                      <>
                        <Button
                          type="link"
                          size="small"
                          icon={<PlusOutlined />}
                          onClick={() => onAddSchool(district.id)}
                        >
                          添加学校
                        </Button>
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={() => onDeleteDistrict(district.id)}
                        >
                          删除
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* 学校列表 */}
                {expandedDistricts.includes(district.id) && district.schools.length > 0 && (
                  <div className={styles.schoolList}>
                    {district.schools.map(school => (
                      <div key={school.id} className={styles.schoolRow}>
                        <div className={styles.schoolLeft}>
                          <HomeOutlined style={{ color: '#52c41a', marginRight: 8, marginLeft: 24 }} />
                          <span className={styles.schoolName}>{school.name}</span>
                          {school.code && (
                            <span style={{ color: '#999', fontSize: 12, marginLeft: 8 }}>({school.code})</span>
                          )}
                          <Tag color={SCHOOL_TYPE_COLORS[school.schoolType] || 'default'} style={{ marginLeft: 8 }}>
                            {school.schoolType}
                          </Tag>
                        </div>
                        {!disabled && (
                          <Button
                            type="text"
                            danger
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={() => onDeleteSchool(school.id)}
                          >
                            删除
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* 展开但无学校时的提示 */}
                {expandedDistricts.includes(district.id) && district.schools.length === 0 && (
                  <div className={styles.emptySchools} style={{ padding: '16px 24px', color: '#999', marginLeft: 24 }}>
                    暂无学校，
                    {!disabled && (
                      <Button type="link" size="small" onClick={() => onAddSchool(district.id)}>
                        点击添加
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Spin>
  );
};

export default SubmissionSchoolTab;
