/**
 * 专家项目评审详情页
 * 包含评审概览、待审核列表、区县指标三个Tab
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
} from 'antd';
import {
  HomeOutlined,
  BarChartOutlined,
  UnorderedListOutlined,
  EnvironmentOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import * as expertService from '../../services/expertService';
import type { ExpertProject } from '../../services/expertService';
import ReviewOverview from './components/ReviewOverview';
import SubmissionList from './components/SubmissionList';
import DistrictIndicators from './components/DistrictIndicators';
import styles from './index.module.css';

// 项目状态配置
const statusConfig: Record<string, { color: string; text: string }> = {
  '配置中': { color: 'default', text: '配置中' },
  '填报中': { color: 'processing', text: '填报中' },
  'data_collection': { color: 'processing', text: '填报中' },
  '评审中': { color: 'warning', text: '评审中' },
  'review': { color: 'warning', text: '评审中' },
  '已中止': { color: 'error', text: '已中止' },
  '已完成': { color: 'success', text: '已完成' },
  'completed': { color: 'success', text: '已完成' },
};

const ExpertProjectDetail: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [project, setProject] = useState<ExpertProject | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [overviewRefreshKey, setOverviewRefreshKey] = useState(0);

  // 加载项目信息
  const loadProject = useCallback(async () => {
    if (!projectId) return;

    setLoading(true);
    try {
      const data = await expertService.getExpertProject(projectId);
      setProject(data);
    } catch (error) {
      console.error('加载项目信息失败:', error);
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  // 格式化日期
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return dateStr.split('T')[0];
  };

  const statusInfo = statusConfig[project?.status || ''] || statusConfig['配置中'];

  // 处理Tab切换
  const handleTabChange = (key: string) => {
    setActiveTab(key);
    // 切换到评审概览Tab时刷新数据
    if (key === 'overview') {
      setOverviewRefreshKey(prev => prev + 1);
    }
  };

  const tabItems = [
    {
      key: 'overview',
      label: (
        <span>
          <BarChartOutlined />
          评审概览
        </span>
      ),
      children: <ReviewOverview projectId={projectId!} refreshKey={overviewRefreshKey} />,
    },
    {
      key: 'submissions',
      label: (
        <span>
          <UnorderedListOutlined />
          待审核列表
        </span>
      ),
      children: <SubmissionList projectId={projectId!} />,
    },
    {
      key: 'districts',
      label: (
        <span>
          <EnvironmentOutlined />
          区县指标
        </span>
      ),
      children: <DistrictIndicators projectId={projectId!} assessmentType={project?.assessmentType} />,
    },
  ];

  return (
    <div className={styles.projectDetail}>
      {/* 面包屑导航 */}
      <Breadcrumb
        className={styles.breadcrumb}
        items={[
          {
            href: '/expert',
            title: (
              <>
                <HomeOutlined />
                <span>我的项目</span>
              </>
            ),
          },
          {
            title: project?.name || '项目详情',
          },
        ]}
      />

      {/* 返回按钮 */}
      <Button
        type="link"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/expert')}
        className={styles.backButton}
      >
        返回项目列表
      </Button>

      <Spin spinning={loading}>
        {project && (
          <>
            {/* 项目信息头部 */}
            <Card className={styles.headerCard}>
              <div className={styles.projectInfo}>
                <div className={styles.projectMain}>
                  <h1 className={styles.projectName}>{project.name}</h1>
                  <Space size={8}>
                    <Tag color={statusInfo.color}>{statusInfo.text}</Tag>
                    {project.assessmentType && (
                      <Tag color={project.assessmentType === '普及普惠' ? '#722ed1' : '#13c2c2'}>
                        {project.assessmentType}
                      </Tag>
                    )}
                  </Space>
                </div>
                {project.description && (
                  <p className={styles.projectDesc}>{project.description}</p>
                )}
                <div className={styles.projectMeta}>
                  <span>评估周期：{formatDate(project.startDate)} ~ {formatDate(project.endDate)}</span>
                </div>
              </div>
            </Card>

            {/* Tab 内容区 */}
            <Card className={styles.contentCard}>
              <Tabs
                activeKey={activeTab}
                onChange={handleTabChange}
                items={tabItems}
                size="large"
              />
            </Card>
          </>
        )}
      </Spin>
    </div>
  );
};

export default ExpertProjectDetail;
