/**
 * 项目配置页面弹窗组件集合
 */

import React from 'react';
import { Modal, Form, Input, Select, Button, Upload, Table, Space, Tag, Checkbox } from 'antd';
import type { FormInstance } from 'antd';
import {
  SearchOutlined,
  UploadOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type {
  Personnel,
  ImportRecord,
  ImportStatus,
  SampleDataConfig,
  RoleInfo,
  ImportStatusInfo,
  PersonnelFormValues,
  SampleFormValues,
  TeacherFormValues,
} from '../types';
import type { ImportFilter } from '../hooks';
import styles from '../index.module.css';

// 获取角色显示名和描述
const getRoleInfo = (role: string): RoleInfo => {
  const roleMap: Record<string, RoleInfo> = {
    'system_admin': { name: '项目创建者/系统管理员', desc: '项目创建者，拥有本项目的所有权限' },
    'project_manager': { name: '项目管理员', desc: '项目管理者，拥有本项目的所有权限' },
    'data_collector': { name: '数据采集员', desc: '负责项目数据填报和采集' },
    'expert': { name: '评估专家', desc: '负责项目评审和评估' },
  };
  return roleMap[role] || { name: role, desc: '' };
};

// 获取导入状态信息
const getImportStatusInfo = (status: ImportStatus): ImportStatusInfo => {
  const statusMap: Record<ImportStatus, ImportStatusInfo> = {
    'confirmed': { text: '已确认', color: 'success', icon: '✓' },
    'new': { text: '新用户', color: 'processing', icon: '⊕' },
    'name_conflict': { text: '重名冲突', color: 'warning', icon: '⚠' },
    'id_conflict': { text: '身份证冲突', color: 'warning', icon: '⚠' },
    'phone_conflict': { text: '手机冲突', color: 'warning', icon: '⚠' },
  };
  return statusMap[status];
};

// ==================== 添加人员弹窗 ====================

interface AddPersonModalProps {
  visible: boolean;
  onCancel: () => void;
  onSubmit: (values: PersonnelFormValues) => void;
  form: FormInstance;
}

export const AddPersonModal: React.FC<AddPersonModalProps> = ({
  visible,
  onCancel,
  onSubmit,
  form,
}) => (
  <Modal
    title="添加人员"
    open={visible}
    onCancel={onCancel}
    footer={null}
    width={480}
  >
    <p className={styles.modalSubtitle}>填写人员信息或从账号库/专家库中选择</p>
    <Form form={form} onFinish={onSubmit} layout="vertical">
      <Form.Item
        label="角色类型"
        name="role"
        rules={[{ required: true, message: '请选择角色类型' }]}
      >
        <Select placeholder="请选择角色类型">
          <Select.Option value="project_manager">项目管理员</Select.Option>
          <Select.Option value="data_collector">数据采集员</Select.Option>
          <Select.Option value="expert">评估专家</Select.Option>
        </Select>
      </Form.Item>
      <p className={styles.formHint}>将从账号库中选择或新建用户</p>
      <Form.Item
        label="姓名"
        name="name"
        rules={[{ required: true, message: '请输入姓名' }]}
      >
        <Input placeholder="输入姓名搜索" />
      </Form.Item>
      <Form.Item
        label="单位"
        name="organization"
        rules={[{ required: true, message: '请输入单位' }]}
      >
        <Input placeholder="请输入单位" />
      </Form.Item>
      <Form.Item
        label="电话号码（登录账号）"
        name="phone"
        rules={[{ required: true, message: '请输入电话号码' }]}
      >
        <Input placeholder="请输入电话号码" />
      </Form.Item>
      <Form.Item label="身份证件号码" name="idCard">
        <Input placeholder="请输入身份证件号码" />
      </Form.Item>
      <Form.Item className={styles.formFooter}>
        <Button onClick={onCancel}>取消</Button>
        <Button type="primary" htmlType="submit">确定</Button>
      </Form.Item>
    </Form>
  </Modal>
);

// ==================== 导入人员弹窗 ====================

interface ImportModalProps {
  visible: boolean;
  step: 'upload' | 'preview';
  importData: ImportRecord[];
  filteredImportData: ImportRecord[];
  importStats: { total: number; confirmed: number; new: number; conflict: number };
  importFilter: ImportFilter;
  onFilterChange: (filter: ImportFilter) => void;
  onCancel: () => void;
  onLoadSample: () => void;
  onConfirm: () => void;
  onReset: () => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  visible,
  step,
  importData,
  filteredImportData,
  importStats,
  importFilter,
  onFilterChange,
  onCancel,
  onLoadSample,
  onConfirm,
  onReset,
}) => {
  const importColumns: ColumnsType<ImportRecord> = [
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: ImportStatus) => {
        const info = getImportStatusInfo(status);
        return (
          <Tag color={info.color}>
            {info.icon} {info.text}
          </Tag>
        );
      },
    },
    { title: '角色', dataIndex: 'role', key: 'role', width: 100 },
    { title: '姓名', dataIndex: 'name', key: 'name', width: 80 },
    { title: '单位', dataIndex: 'organization', key: 'organization', width: 150 },
    { title: '电话', dataIndex: 'phone', key: 'phone', width: 120 },
    { title: '身份证', dataIndex: 'idCard', key: 'idCard', width: 160 },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Space>
          {record.status !== 'confirmed' && record.status !== 'new' && (
            <Button type="link" size="small">修正</Button>
          )}
          <Button type="text" danger size="small">×</Button>
        </Space>
      ),
    },
  ];

  return (
    <Modal
      title="导入人员"
      open={visible}
      onCancel={onCancel}
      footer={step === 'preview' ? [
        <Button key="back" onClick={onReset}>重新导入</Button>,
        <Button key="cancel" onClick={onCancel}>取消</Button>,
        <Button key="submit" type="primary" onClick={onConfirm}>
          确认导入
        </Button>,
      ] : null}
      width={step === 'preview' ? 1000 : 700}
    >
      <p className={styles.modalSubtitle}>批量导入人员信息，系统会自动比对账号库和专家库</p>

      {step === 'upload' ? (
        <>
          {/* 导入说明 */}
          <div className={styles.importGuide}>
            <h4 className={styles.guideTitle}>导入说明</h4>
            <ul className={styles.guideList}>
              <li>Excel文件应包含以下字段：<strong>角色类型、姓名、单位、电话号码、身份证件号码</strong></li>
              <li>角色类型可选：<strong>项目管理员、数据采集员、评估专家、报告决策者</strong></li>
              <li>系统会自动比对账号库（项目管理员、数据采集员、报告决策者）和专家库（评估专家）</li>
              <li className={styles.guideItem}>
                <span className={styles.guideIcon}>✓</span>
                <strong>已确认</strong>：姓名、手机、单位、身份证全部一致
              </li>
              <li className={styles.guideItem}>
                <span className={styles.guideIconNew}>⊕</span>
                <strong>新用户</strong>：姓名、身份证、手机都找不到
              </li>
              <li className={styles.guideItem}>
                <span className={styles.guideIconWarn}>⚠</span>
                <strong>重名冲突</strong>：姓名一致，但手机、单位、身份证部分不一致
              </li>
              <li className={styles.guideItem}>
                <span className={styles.guideIconWarn}>⚠</span>
                <strong>身份证冲突</strong>：身份证一致，但姓名、手机、单位部分不一致
              </li>
              <li className={styles.guideItem}>
                <span className={styles.guideIconWarn}>⚠</span>
                <strong>手机冲突</strong>：手机一致，但姓名、身份证、单位部分不一致
              </li>
            </ul>
            <p className={styles.guideNote}>
              • 冲突记录需要人工修正确认；新用户可直接导入；已确认记录可再次修正
            </p>
          </div>

          {/* 下载模板 */}
          <div className={styles.templateSection}>
            <div className={styles.templateInfo}>
              <h4>下载导入模板</h4>
              <p>包含正确的字段格式和示例数据</p>
            </div>
            <Button icon={<UploadOutlined />}>下载模板</Button>
          </div>

          {/* 文件上传区域 */}
          <div className={styles.uploadSection}>
            <Upload.Dragger
              accept=".xlsx,.xls,.csv"
              showUploadList={false}
              beforeUpload={() => false}
              className={styles.uploadDragger}
            >
              <p className={styles.uploadIcon}>📋</p>
              <p className={styles.uploadText}>点击选择Excel文件或拖拽文件到此处</p>
              <div className={styles.uploadButtons}>
                <Button icon={<UploadOutlined />}>选择文件</Button>
                <Button type="primary" icon={<FileTextOutlined />} onClick={(e) => {
                  e.stopPropagation();
                  onLoadSample();
                }}>加载示例数据</Button>
              </div>
              <p className={styles.uploadHint}>支持 .xlsx、.xls、.csv 格式，文件大小不超过5MB</p>
            </Upload.Dragger>
          </div>
        </>
      ) : (
        <>
          {/* 状态筛选 */}
          <div className={styles.importFilter}>
            <Space>
              <Tag
                color={importFilter === 'confirmed' ? 'success' : 'default'}
                className={styles.filterTag}
                onClick={() => onFilterChange(importFilter === 'confirmed' ? 'all' : 'confirmed')}
              >
                ✓ 已确认
              </Tag>
              <Tag
                color={importFilter === 'new' ? 'processing' : 'default'}
                className={styles.filterTag}
                onClick={() => onFilterChange(importFilter === 'new' ? 'all' : 'new')}
              >
                ⊕ 新用户
              </Tag>
              <Tag
                color={importFilter === 'conflict' ? 'warning' : 'default'}
                className={styles.filterTag}
                onClick={() => onFilterChange(importFilter === 'conflict' ? 'all' : 'conflict')}
              >
                ⚠ 信息冲突
              </Tag>
            </Space>
            <Input
              placeholder="搜索人员"
              prefix={<SearchOutlined />}
              style={{ width: 200 }}
            />
          </div>

          {/* 导入预览表格 */}
          <Table
            rowKey="id"
            columns={importColumns}
            dataSource={filteredImportData}
            pagination={false}
            size="small"
            scroll={{ y: 400 }}
          />

          {/* 统计信息 */}
          <div className={styles.importStats}>
            <span>共 {importStats.total} 条记录，</span>
            <span className={styles.statConfirmed}>{importStats.confirmed} 条已确认</span>
            <span className={styles.statNew}>{importStats.new} 条新用户</span>
            <span className={styles.statConflict}>{importStats.conflict} 条冲突</span>
          </div>
        </>
      )}
    </Modal>
  );
};

// ==================== 查看更多人员弹窗 ====================

interface MorePersonModalProps {
  visible: boolean;
  role: string;
  personnel: Personnel[];
  onCancel: () => void;
  onDeletePerson: (person: Personnel) => void;
}

export const MorePersonModal: React.FC<MorePersonModalProps> = ({
  visible,
  role,
  personnel,
  onCancel,
  onDeletePerson,
}) => {
  const personnelColumns: ColumnsType<Personnel> = [
    { title: '姓名', dataIndex: 'name', key: 'name', width: 100 },
    { title: '单位', dataIndex: 'organization', key: 'organization', width: 180 },
    { title: '电话号码', dataIndex: 'phone', key: 'phone', width: 140 },
    { title: '身份证件号码', dataIndex: 'idCard', key: 'idCard', width: 180 },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Button
          type="text"
          danger
          icon={<span>×</span>}
          onClick={() => onDeletePerson(record)}
        />
      ),
    },
  ];

  return (
    <Modal
      title={getRoleInfo(role).name}
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button key="close" onClick={onCancel}>关闭</Button>
      ]}
      width={800}
    >
      <p className={styles.modalSubtitle}>查看和管理该角色的所有人员</p>
      <div className={styles.moreModalSearch}>
        <Input
          placeholder="搜索人员"
          prefix={<SearchOutlined />}
          style={{ width: 200 }}
        />
      </div>
      <Table
        rowKey="id"
        columns={personnelColumns}
        dataSource={personnel}
        pagination={{
          total: personnel.length,
          pageSize: 10,
          showTotal: (total, range) => `共 ${total} 条记录，第 ${range[0]} / ${range[1]} 页`,
        }}
        size="small"
      />
    </Modal>
  );
};

// ==================== 配置样本数据对象弹窗 ====================

interface SampleConfigModalProps {
  visible: boolean;
  config: SampleDataConfig;
  onChange: (config: SampleDataConfig) => void;
  onOk: () => void;
  onCancel: () => void;
}

export const SampleConfigModal: React.FC<SampleConfigModalProps> = ({
  visible,
  config,
  onChange,
  onOk,
  onCancel,
}) => (
  <Modal
    title="配置样本数据对象"
    open={visible}
    onOk={onOk}
    onCancel={onCancel}
    okText="确定"
    cancelText="取消"
    width={520}
  >
    <p className={styles.modalSubtitle}>选择需要采集的数据对象层级，上级对象可能由下级对象计算得出。</p>
    <div className={styles.sampleConfigList}>
      <div className={styles.configItem}>
        <Checkbox
          checked={config.district}
          onChange={e => onChange({ ...config, district: e.target.checked })}
        />
        <Tag color="blue">区</Tag>
        <span>表明需要采集区相关数据</span>
      </div>
      <div className={styles.configItem} style={{ marginLeft: 24 }}>
        <Checkbox
          checked={config.school}
          onChange={e => onChange({ ...config, school: e.target.checked })}
        />
        <span className={styles.levelLine}>└─</span>
        <Tag color="green">校</Tag>
        <span>表明需要采集校相关数据</span>
      </div>
      <div className={styles.configItem} style={{ marginLeft: 48 }}>
        <Checkbox
          checked={config.grade}
          onChange={e => onChange({ ...config, grade: e.target.checked })}
        />
        <span className={styles.levelLine}>└─</span>
        <Tag>年级</Tag>
        <span>表明需要采集年级相关数据</span>
      </div>
      <div className={styles.configItem} style={{ marginLeft: 72 }}>
        <Checkbox
          checked={config.class}
          onChange={e => onChange({ ...config, class: e.target.checked })}
        />
        <span className={styles.levelLine}>└─</span>
        <Tag>班级</Tag>
        <span>表明需要采集班级相关数据</span>
      </div>
      <div className={styles.configItem} style={{ marginLeft: 96 }}>
        <Checkbox
          checked={config.student}
          onChange={e => onChange({ ...config, student: e.target.checked })}
        />
        <span className={styles.levelLine}>└─</span>
        <Tag>学生</Tag>
        <span>表明需要采集学生相关数据</span>
      </div>
      <div className={styles.configItem} style={{ marginLeft: 96 }}>
        <Checkbox
          checked={config.parent}
          onChange={e => onChange({ ...config, parent: e.target.checked })}
        />
        <span className={styles.levelLine}>└─</span>
        <Tag>家长</Tag>
        <span>表明需要采集家长相关数据</span>
      </div>
      <div className={styles.configItem} style={{ marginLeft: 48 }}>
        <Checkbox
          checked={config.department}
          onChange={e => onChange({ ...config, department: e.target.checked })}
        />
        <span className={styles.levelLine}>└─</span>
        <Tag>部门</Tag>
        <span>表明需要采集部门相关数据</span>
      </div>
      <div className={styles.configItem} style={{ marginLeft: 48 }}>
        <Checkbox
          checked={config.teacher}
          onChange={e => onChange({ ...config, teacher: e.target.checked })}
        />
        <span className={styles.levelLine}>└─</span>
        <Tag color="orange">教师</Tag>
        <span>表明需要采集教师相关数据</span>
      </div>
    </div>
    <div className={styles.configTip}>
      💡 提示：可以跳过中间层级，如直接选择【校】和【学生】，表示不需要年级和班级的数据。
    </div>
  </Modal>
);

// ==================== 添加样本弹窗 ====================

interface AddSampleModalProps {
  visible: boolean;
  onCancel: () => void;
  onSubmit: (values: SampleFormValues) => void;
  form: FormInstance;
}

export const AddSampleModal: React.FC<AddSampleModalProps> = ({
  visible,
  onCancel,
  onSubmit,
  form,
}) => (
  <Modal
    title="添加样本"
    open={visible}
    onCancel={onCancel}
    footer={null}
    width={400}
  >
    <p className={styles.modalSubtitle}>添加新的评估样本（区或学校）</p>
    <Form form={form} onFinish={onSubmit} layout="vertical">
      <Form.Item
        label="样本类型"
        name="type"
        rules={[{ required: true, message: '请选择样本类型' }]}
      >
        <Select placeholder="请选择">
          <Select.Option value="district">区</Select.Option>
          <Select.Option value="school">学校</Select.Option>
        </Select>
      </Form.Item>
      <Form.Item
        label="样本名称"
        name="name"
        rules={[{ required: true, message: '请输入样本名称' }]}
      >
        <Input placeholder="如：和平区" />
      </Form.Item>
      <Form.Item className={styles.formFooter}>
        <Button onClick={onCancel}>取消</Button>
        <Button type="primary" htmlType="submit">确定添加</Button>
      </Form.Item>
    </Form>
  </Modal>
);

// ==================== 添加教师样本弹窗 ====================

interface AddTeacherModalProps {
  visible: boolean;
  schoolName: string;
  onCancel: () => void;
  onSubmit: (values: TeacherFormValues) => void;
  form: FormInstance;
}

export const AddTeacherModal: React.FC<AddTeacherModalProps> = ({
  visible,
  schoolName,
  onCancel,
  onSubmit,
  form,
}) => (
  <Modal
    title="添加教师样本"
    open={visible}
    onCancel={onCancel}
    footer={null}
    width={400}
  >
    <p className={styles.modalSubtitle}>
      为 {schoolName} 添加具体人员
    </p>
    <Form form={form} onFinish={onSubmit} layout="vertical">
      <Form.Item
        label="姓名"
        name="name"
        rules={[{ required: true, message: '请输入姓名' }]}
      >
        <Input placeholder="请输入姓名" />
      </Form.Item>
      <Form.Item label="电话" name="phone">
        <Input placeholder="请输入电话号码" />
      </Form.Item>
      <Form.Item label="身份证号" name="idCard">
        <Input placeholder="请输入身份证号（选填）" />
      </Form.Item>
      <Form.Item className={styles.formFooter}>
        <Button onClick={onCancel}>取消</Button>
        <Button type="primary" htmlType="submit">确定添加</Button>
      </Form.Item>
    </Form>
  </Modal>
);
