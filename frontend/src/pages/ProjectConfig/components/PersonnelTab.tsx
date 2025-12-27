/**
 * 填报账号配置 Tab 组件
 * 配置填报账号，并根据采集工具的填报对象匹配自动分配任务
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, Button, Input, Tag, Space, Select, message, Modal, Tooltip, Card, Row, Col, Statistic, Switch, Empty } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  UploadOutlined,
  SearchOutlined,
  RightOutlined,
  ThunderboltOutlined,
  UserOutlined,
  BankOutlined,
  HomeOutlined,
  SettingOutlined,
  DownOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Personnel, RoleInfo } from '../types';
import * as projectToolService from '../../../services/projectToolService';
import * as taskService from '../../../services/taskService';
import type { ProjectTool } from '../../../services/projectToolService';
import styles from '../index.module.css';

// 评估对象学校类型
interface SubmissionSchoolForPersonnel {
  id: string;
  name: string;
  code?: string;
  schoolType: string;
  parentId: string;
  collectorId?: string;
  collectorName?: string;
  collectorPhone?: string;
}

// 评估对象区县类型
interface SubmissionDistrictForPersonnel {
  id: string;
  name: string;
  code?: string;
  schools: SubmissionSchoolForPersonnel[];
  collectorId?: string;
  collectorName?: string;
  collectorPhone?: string;
}

// 系统用户类型（用于选择数据采集员）
interface SystemUserForSelect {
  phone: string;
  name?: string;
  roles: string[];
  status: string;
}

interface PersonnelTabProps {
  projectId?: string;
  personnel: Record<string, Personnel[]>;
  personnelSearch: string;
  onSearchChange: (value: string) => void;
  onAddPerson: (role?: string) => void;
  onImport: () => void;
  onDeletePerson: (person: Personnel) => void;
  onOpenMore: (role: string) => void;
  filterPersonnel: (role: string) => Personnel[];
  disabled?: boolean;
  // 评估对象相关 props
  submissionDistricts?: SubmissionDistrictForPersonnel[];
  userList?: SystemUserForSelect[];
  loadingUsers?: boolean;
  onSetCollector?: (targetType: 'district' | 'school', targetId: string, userId: string | null, applyToChildren?: boolean) => void;
}

// 填报对象类型
const TARGET_TYPES = [
  { label: '区县', value: '区县' },
  { label: '学校', value: '学校' },
  { label: '教师', value: '教师' },
  { label: '学生', value: '学生' },
  { label: '班级', value: '班级' },
  { label: '家长', value: '家长' },
];

// 角色定义（新角色体系）
// | 角色 | 代码 | 职责 | 权限范围 |
// | 项目管理员 | project_admin | 项目配置和管理 | 配置项目、管理人员、查看进度、生成报表 |
// | 数据采集员 | data_collector | 数据填报和采集 | 填报所属区县内所有学校的数据 |
// | 项目评估专家 | project_expert | 项目评审和评估 | 审核提交的数据、评审评估结果 |

// 获取角色显示名和描述（新角色体系）
const getRoleInfo = (role: string): RoleInfo => {
  const roleMap: Record<string, RoleInfo> = {
    'project_admin': { name: '项目管理员', desc: '项目配置和管理，配置项目、管理人员、查看进度' },
    'data_collector': { name: '数据采集员', desc: '数据填报和采集，填报所属区县内所有学校的数据' },
    'project_expert': { name: '项目评估专家', desc: '数据审核和评估，审核提交的数据、评审评估结果' },
  };
  return roleMap[role] || { name: role, desc: '' };
};

// 项目人员角色选项
export const PERSONNEL_ROLE_OPTIONS = [
  { value: 'project_admin', label: '项目管理员' },
  { value: 'data_collector', label: '数据采集员' },
  { value: 'project_expert', label: '项目评估专家' },
];

// 学校类型颜色
const SCHOOL_TYPE_COLORS: Record<string, string> = {
  '幼儿园': 'magenta',
  '小学': 'blue',
  '初中': 'green',
  '九年一贯制': 'purple',
  '完全中学': 'orange',
};

const PersonnelTab: React.FC<PersonnelTabProps> = ({
  projectId,
  personnel,
  personnelSearch,
  onSearchChange,
  onAddPerson,
  onImport,
  onDeletePerson,
  onOpenMore,
  filterPersonnel,
  disabled = false,
  submissionDistricts = [],
  userList = [],
  loadingUsers = false,
  onSetCollector,
}) => {
  const [tools, setTools] = useState<ProjectTool[]>([]);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [selectedTargetType, setSelectedTargetType] = useState<string>('');

  // 数据采集员树形结构展开状态
  const [expandedDistricts, setExpandedDistricts] = useState<string[]>([]);
  // 是否使用统一账号模式
  const [useUnifiedAccount, setUseUnifiedAccount] = useState(false);
  // 当前正在设置的目标
  const [settingTarget, setSettingTarget] = useState<{ type: 'district' | 'school'; id: string; name: string } | null>(null);
  // 选中的用户
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(undefined);
  // 是否应用到下级学校
  const [applyToChildren, setApplyToChildren] = useState(false);

  // 加载项目采集工具
  const loadTools = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await projectToolService.getProjectTools(projectId);
      setTools(data);
    } catch (error) {
      console.error('加载采集工具失败:', error);
    }
  }, [projectId]);

  useEffect(() => {
    loadTools();
  }, [loadTools]);

  // 按填报对象分组的工具
  const toolsByTarget = tools.reduce((acc, tool) => {
    const targets = tool.toolTarget ? tool.toolTarget.split(',') : ['未分类'];
    targets.forEach(target => {
      const t = target.trim();
      if (!acc[t]) acc[t] = [];
      acc[t].push(tool);
    });
    return acc;
  }, {} as Record<string, ProjectTool[]>);

  // 获取新角色体系人员列表
  const projectAdmins = personnel['project_admin'] || [];
  const dataCollectors = personnel['data_collector'] || [];
  const projectExperts = personnel['project_expert'] || [];

  // 保留旧角色兼容
  const districtReporters = personnel['district_reporter'] || [];
  const schoolReporters = personnel['school_reporter'] || [];

  // 自动分配采集工具
  const handleAutoAssign = async () => {
    if (!projectId) {
      message.warning('项目ID不存在');
      return;
    }

    // 优先使用新角色体系的数据采集员，兼容旧角色
    const allCollectors = dataCollectors.length > 0
      ? dataCollectors
      : [...districtReporters, ...schoolReporters];

    if (allCollectors.length === 0) {
      message.warning('暂无数据采集员，请先添加人员');
      return;
    }

    if (tools.length === 0) {
      message.warning('暂无采集工具，请先配置采集工具');
      return;
    }

    // 筛选要分配的工具
    const toolsToAssign = selectedTargetType
      ? tools.filter(t => t.toolTarget?.includes(selectedTargetType))
      : tools;

    if (toolsToAssign.length === 0) {
      message.warning('没有匹配的采集工具');
      return;
    }

    // 根据填报对象类型确定分配给哪类填报员
    const getReportersForTarget = (target: string): Personnel[] => {
      if (target === '区县') return districtReporters;
      if (target === '学校') return schoolReporters;
      return schoolReporters; // 默认分配给学校填报员
    };

    Modal.confirm({
      title: '自动分配采集工具',
      content: (
        <div>
          <p>将根据采集工具的填报对象自动分配任务：</p>
          <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
            <li>区县类工具 → 区县填报员 ({districtReporters.length} 人)</li>
            <li>学校类工具 → 学校填报员 ({schoolReporters.length} 人)</li>
          </ul>
          {selectedTargetType && <p>筛选条件：填报对象 = {selectedTargetType}</p>}
          <p style={{ color: '#999', marginTop: 8 }}>共 {toolsToAssign.length} 个采集工具待分配。</p>
        </div>
      ),
      okText: '确认分配',
      cancelText: '取消',
      onOk: async () => {
        setAutoAssigning(true);
        let successCount = 0;
        let failCount = 0;

        try {
          // 为每个工具分配给对应的填报员
          for (const tool of toolsToAssign) {
            try {
              const targets = tool.toolTarget ? tool.toolTarget.split(',') : ['学校'];
              const primaryTarget = targets[0].trim();
              const targetReporters = getReportersForTarget(primaryTarget);

              if (targetReporters.length === 0) {
                console.warn(`工具 ${tool.toolName} 的填报对象 ${primaryTarget} 暂无填报员`);
                continue;
              }

              await taskService.batchCreateTasks({
                projectId,
                toolId: tool.toolId,
                assigneeIds: targetReporters.map(c => c.id),
              });
              successCount++;
            } catch (err) {
              failCount++;
              console.error(`分配工具 ${tool.toolName} 失败:`, err);
            }
          }

          if (successCount > 0) {
            message.success(`成功分配 ${successCount} 个工具的任务`);
          }
          if (failCount > 0) {
            message.warning(`${failCount} 个工具分配失败（可能已存在相同任务）`);
          }
        } catch (error) {
          message.error('自动分配失败');
        } finally {
          setAutoAssigning(false);
        }
      },
    });
  };

  // 人员表格列定义
  const personnelColumns: ColumnsType<Personnel> = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 100,
      render: (name) => (
        <Space>
          <UserOutlined />
          <span className={styles.personName}>{name}</span>
        </Space>
      )
    },
    { title: '单位', dataIndex: 'organization', key: 'organization', width: 180 },
    {
      title: '电话号码',
      dataIndex: 'phone',
      key: 'phone',
      width: 140,
      render: (phone: any) => {
        // 如果 phone 是对象，提取 phone 属性或显示错误
        if (phone && typeof phone === 'object') {
          return phone.phone || phone.error || '-';
        }
        return phone || '-';
      },
    },
    ...(!disabled ? [{
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: unknown, record: Personnel) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => onDeletePerson(record)}
        />
      ),
    }] : []),
  ];

  // 数据采集员表格列定义（包含负责区县）
  const dataCollectorColumns: ColumnsType<Personnel> = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 100,
      render: (name) => (
        <Space>
          <UserOutlined />
          <span className={styles.personName}>{name}</span>
        </Space>
      )
    },
    { title: '单位', dataIndex: 'organization', key: 'organization', width: 150 },
    {
      title: '负责区县',
      dataIndex: 'districtName',
      key: 'districtName',
      width: 120,
      render: (districtName: string) => districtName ? (
        <Tag color="blue">{districtName}</Tag>
      ) : <span style={{ color: '#999' }}>未分配</span>
    },
    {
      title: '电话号码',
      dataIndex: 'phone',
      key: 'phone',
      width: 140,
      render: (phone: any) => {
        // 如果 phone 是对象，提取 phone 属性或显示错误
        if (phone && typeof phone === 'object') {
          return phone.phone || phone.error || '-';
        }
        return phone || '-';
      },
    },
    ...(!disabled ? [{
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: unknown, record: Personnel) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => onDeletePerson(record)}
        />
      ),
    }] : []),
  ];

  return (
    <div className={styles.personnelTab}>
      {/* 统计卡片 */}
      <Card size="small" className={styles.statsCard} style={{ marginBottom: 16 }}>
        <Row gutter={24}>
          <Col span={4}>
            <Statistic
              title="项目管理员"
              value={projectAdmins.length}
              suffix="人"
              prefix={<UserOutlined />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title="数据采集员"
              value={dataCollectors.length}
              suffix="人"
              prefix={<UserOutlined />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title="项目评估专家"
              value={projectExperts.length}
              suffix="人"
              prefix={<UserOutlined />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title="采集工具"
              value={tools.length}
              suffix="个"
            />
          </Col>
          <Col span={8}>
            <div style={{ paddingTop: 8 }}>
              <div style={{ marginBottom: 8, color: '#666' }}>按填报对象筛选</div>
              <Space>
                <Select
                  placeholder="全部对象"
                  style={{ width: 120 }}
                  allowClear
                  value={selectedTargetType || undefined}
                  onChange={setSelectedTargetType}
                >
                  {TARGET_TYPES.map(t => (
                    <Select.Option key={t.value} value={t.value}>
                      {t.label}
                      {toolsByTarget[t.value] && (
                        <Tag style={{ marginLeft: 8 }}>{toolsByTarget[t.value].length}</Tag>
                      )}
                    </Select.Option>
                  ))}
                </Select>
                {!disabled && (
                  <Tooltip title="根据采集工具的填报对象自动分配给数据采集员">
                    <Button
                      type="primary"
                      icon={<ThunderboltOutlined />}
                      onClick={handleAutoAssign}
                      loading={autoAssigning}
                      disabled={(dataCollectors.length === 0 && districtReporters.length === 0 && schoolReporters.length === 0) || tools.length === 0}
                    >
                      自动分配任务
                    </Button>
                  </Tooltip>
                )}
              </Space>
            </div>
          </Col>
        </Row>
      </Card>

      {/* 采集工具概览 */}
      {tools.length > 0 && (
        <Card size="small" title="已配置的采集工具" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {tools.map(tool => (
              <Tag
                key={tool.id}
                color={
                  !selectedTargetType || tool.toolTarget?.includes(selectedTargetType)
                    ? 'blue'
                    : 'default'
                }
              >
                {tool.toolName}
                <span style={{ marginLeft: 4, opacity: 0.7 }}>
                  ({tool.toolTarget || '未设置'})
                </span>
              </Tag>
            ))}
          </div>
        </Card>
      )}

      {/* 项目管理员配置 */}
      <div className={styles.personnelHeader}>
        <h3 className={styles.sectionTitle}>项目管理员</h3>
        <div className={styles.personnelActions}>
          <Input
            placeholder="搜索人员"
            prefix={<SearchOutlined />}
            value={personnelSearch}
            onChange={e => onSearchChange(e.target.value)}
            className={styles.searchInput}
            style={{ width: 200 }}
          />
          <Button
            icon={<UploadOutlined />}
            onClick={onImport}
            disabled={disabled}
          >
            导入人员
          </Button>
          {!disabled && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => onAddPerson('project_admin')}
            >
              添加管理员
            </Button>
          )}
        </div>
      </div>

      {/* 项目管理员列表 */}
      <Table
        rowKey="id"
        columns={personnelColumns}
        dataSource={projectAdmins}
        pagination={{
          pageSize: 10,
          showTotal: (total) => `共 ${total} 人`,
          showSizeChanger: true,
        }}
        size="small"
        className={styles.personnelTable}
      />

      {/* 数据采集员配置 - 按评估对象树形结构展示 */}
      <div className={styles.personnelHeader} style={{ marginTop: 24 }}>
        <h3 className={styles.sectionTitle}>数据采集员</h3>
        <div className={styles.personnelActions}>
          <Space>
            <span style={{ color: '#666', fontSize: 13 }}>区县和学校使用相同账号：</span>
            <Switch
              checked={useUnifiedAccount}
              onChange={setUseUnifiedAccount}
              disabled={disabled}
              size="small"
            />
          </Space>
        </div>
      </div>

      {/* 评估对象树形结构 - 数据采集员配置 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        {submissionDistricts.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂未添加评估对象，请先在「评估对象」中添加区县和学校"
          />
        ) : (
          <div className={styles.collectorTreeContainer}>
            {submissionDistricts.map(district => (
              <div key={district.id} className={styles.collectorDistrictItem}>
                {/* 区县行 */}
                <div className={styles.collectorDistrictRow}>
                  <div className={styles.collectorNodeLeft}>
                    <span
                      className={styles.expandIcon}
                      onClick={() => {
                        setExpandedDistricts(prev =>
                          prev.includes(district.id)
                            ? prev.filter(id => id !== district.id)
                            : [...prev, district.id]
                        );
                      }}
                    >
                      {expandedDistricts.includes(district.id) ? <DownOutlined /> : <RightOutlined />}
                    </span>
                    <BankOutlined style={{ color: '#1890ff', marginRight: 8 }} />
                    <span className={styles.collectorNodeName}>{district.name}</span>
                    <span style={{ color: '#999', marginLeft: 8, fontSize: 12 }}>
                      ({district.schools.length} 所学校)
                    </span>
                  </div>
                  <div className={styles.collectorNodeRight}>
                    {district.collectorName ? (
                      <Space>
                        <Tag color="blue">
                          <UserOutlined style={{ marginRight: 4 }} />
                          {district.collectorName}
                        </Tag>
                        <span style={{ color: '#999', fontSize: 12 }}>{district.collectorPhone}</span>
                        {!disabled && (
                          <Button
                            type="link"
                            size="small"
                            icon={<SettingOutlined />}
                            onClick={() => {
                              setSettingTarget({ type: 'district', id: district.id, name: district.name });
                              setSelectedUserId(district.collectorId);
                              setApplyToChildren(useUnifiedAccount);
                            }}
                          >
                            修改
                          </Button>
                        )}
                      </Space>
                    ) : (
                      !disabled && (
                        <Button
                          type="link"
                          size="small"
                          icon={<PlusOutlined />}
                          onClick={() => {
                            setSettingTarget({ type: 'district', id: district.id, name: district.name });
                            setSelectedUserId(undefined);
                            setApplyToChildren(useUnifiedAccount);
                          }}
                        >
                          设置采集员
                        </Button>
                      )
                    )}
                  </div>
                </div>

                {/* 学校列表 */}
                {expandedDistricts.includes(district.id) && (
                  <div className={styles.collectorSchoolList}>
                    {district.schools.map(school => (
                      <div key={school.id} className={styles.collectorSchoolRow}>
                        <div className={styles.collectorNodeLeft}>
                          <HomeOutlined style={{ color: '#52c41a', marginRight: 8, marginLeft: 24 }} />
                          <span className={styles.collectorNodeName}>{school.name}</span>
                          <Tag
                            color={SCHOOL_TYPE_COLORS[school.schoolType] || 'default'}
                            style={{ marginLeft: 8 }}
                          >
                            {school.schoolType}
                          </Tag>
                        </div>
                        <div className={styles.collectorNodeRight}>
                          {/* 统一账号模式下显示区县的账号 */}
                          {useUnifiedAccount ? (
                            district.collectorName ? (
                              <Tag color="default">
                                <UserOutlined style={{ marginRight: 4 }} />
                                同区县（{district.collectorName}）
                              </Tag>
                            ) : (
                              <span style={{ color: '#999', fontSize: 12 }}>未设置（继承区县）</span>
                            )
                          ) : (
                            // 独立账号模式
                            school.collectorName ? (
                              <Space>
                                <Tag color="green">
                                  <UserOutlined style={{ marginRight: 4 }} />
                                  {school.collectorName}
                                </Tag>
                                <span style={{ color: '#999', fontSize: 12 }}>{school.collectorPhone}</span>
                                {!disabled && (
                                  <Button
                                    type="link"
                                    size="small"
                                    icon={<SettingOutlined />}
                                    onClick={() => {
                                      setSettingTarget({ type: 'school', id: school.id, name: school.name });
                                      setSelectedUserId(school.collectorId);
                                      setApplyToChildren(false);
                                    }}
                                  >
                                    修改
                                  </Button>
                                )}
                              </Space>
                            ) : (
                              !disabled && (
                                <Button
                                  type="link"
                                  size="small"
                                  icon={<PlusOutlined />}
                                  onClick={() => {
                                    setSettingTarget({ type: 'school', id: school.id, name: school.name });
                                    setSelectedUserId(undefined);
                                    setApplyToChildren(false);
                                  }}
                                >
                                  设置采集员
                                </Button>
                              )
                            )
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 设置数据采集员弹窗 */}
      <Modal
        title={`设置数据采集员 - ${settingTarget?.name || ''}`}
        open={!!settingTarget}
        onCancel={() => {
          setSettingTarget(null);
          setSelectedUserId(undefined);
          setApplyToChildren(false);
        }}
        onOk={() => {
          if (settingTarget && onSetCollector) {
            onSetCollector(
              settingTarget.type,
              settingTarget.id,
              selectedUserId || null,
              settingTarget.type === 'district' ? applyToChildren : false
            );
          }
          setSettingTarget(null);
          setSelectedUserId(undefined);
          setApplyToChildren(false);
        }}
        okText="确定"
        cancelText="取消"
        width={480}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, color: '#666' }}>选择数据采集员账号</div>
          <Select
            placeholder="请选择数据采集员"
            style={{ width: '100%' }}
            value={selectedUserId}
            onChange={setSelectedUserId}
            loading={loadingUsers}
            allowClear
            showSearch
            filterOption={(input, option) =>
              (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
            }
            options={userList
              .filter(u => u.status === 'active' && u.roles?.includes('data_collector'))
              .map(u => ({
                value: u.phone,
                label: `${u.name || u.phone}`,
              }))}
          />
          {userList.filter(u => u.status === 'active' && u.roles?.includes('data_collector')).length === 0 && (
            <p style={{ color: '#999', marginTop: 8, fontSize: 12 }}>
              暂无可用的数据采集员账号，请先在用户管理中创建数据采集员角色的账号
            </p>
          )}
        </div>

        {settingTarget?.type === 'district' && (
          <div>
            <Space>
              <Switch
                checked={applyToChildren}
                onChange={setApplyToChildren}
                size="small"
              />
              <span style={{ color: '#666', fontSize: 13 }}>同时应用到该区县下的所有学校</span>
            </Space>
          </div>
        )}
      </Modal>

      {/* 项目评估专家配置 */}
      <div className={styles.personnelHeader} style={{ marginTop: 24 }}>
        <h3 className={styles.sectionTitle}>项目评估专家</h3>
        <div className={styles.personnelActions}>
          {!disabled && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => onAddPerson('project_expert')}
            >
              添加专家
            </Button>
          )}
        </div>
      </div>

      {/* 项目评估专家列表 */}
      <Table
        rowKey="id"
        columns={personnelColumns}
        dataSource={projectExperts}
        pagination={{
          pageSize: 10,
          showTotal: (total) => `共 ${total} 人`,
          showSizeChanger: true,
        }}
        size="small"
        className={styles.personnelTable}
      />

      {/* 其他角色（旧角色兼容）折叠显示 */}
      <div style={{ marginTop: 24 }}>
        {['district_reporter', 'school_reporter', 'district_admin', 'city_admin', 'system_admin'].map(role => {
          const roleInfo = getRoleInfo(role);
          const rolePersonnel = personnel[role] || [];

          if (rolePersonnel.length === 0) return null;

          return (
            <div key={role} className={styles.roleSection} style={{ marginBottom: 16 }}>
              <div className={styles.roleTitleRow}>
                <div className={styles.roleTitle}>
                  <span className={styles.roleName}>{roleInfo.name}</span>
                  <span className={styles.roleDesc}>— {roleInfo.desc}</span>
                </div>
                <div className={styles.roleTitleActions}>
                  <span className={styles.roleCount}>{rolePersonnel.length} 人</span>
                  {!disabled && (
                    <Button
                      type="link"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => onAddPerson(role)}
                    >
                      添加
                    </Button>
                  )}
                </div>
              </div>
              <Table
                rowKey="id"
                columns={personnelColumns}
                dataSource={rolePersonnel.slice(0, 3)}
                pagination={false}
                size="small"
                className={styles.personnelTable}
              />
              {rolePersonnel.length > 3 && (
                <div className={styles.moreLink}>
                  <Button type="link" onClick={() => onOpenMore(role)}>
                    更多 <RightOutlined />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PersonnelTab;
