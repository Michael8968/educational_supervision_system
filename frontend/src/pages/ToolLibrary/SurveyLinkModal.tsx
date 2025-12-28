import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Form,
  Select,
  Button,
  Table,
  message,
  Spin,
  InputNumber,
  Space,
  Typography,
  Alert,
  Tooltip,
} from 'antd';
import {
  CopyOutlined,
  DownloadOutlined,
  LinkOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import type { DataTool, SurveyAccessLink } from '../../services/toolService';
import * as toolService from '../../services/toolService';
import * as projectService from '../../services/projectService';
import * as schoolService from '../../services/schoolService';

const { Text } = Typography;

interface SurveyLinkModalProps {
  visible: boolean;
  tool: DataTool | null;
  onClose: () => void;
}

interface Project {
  id: string;
  name: string;
  status: string;
}

interface School {
  id: string;
  name: string;
  districtId?: string;
  districtName?: string;
}

const SurveyLinkModal: React.FC<SurveyLinkModalProps> = ({
  visible,
  tool,
  onClose,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [generatedLinks, setGeneratedLinks] = useState<SurveyAccessLink[]>([]);
  const [step, setStep] = useState<'form' | 'result'>('form');

  // 加载项目列表
  const loadProjects = useCallback(async () => {
    try {
      const data = await projectService.getProjects({ status: '填报中' });
      setProjects(data as Project[]);
    } catch (error) {
      console.error('加载项目失败:', error);
      message.error('加载项目列表失败');
    }
  }, []);

  // 加载学校列表
  const loadSchools = useCallback(async () => {
    try {
      const response = await schoolService.getSchools({});
      setSchools(response.list as School[]);
    } catch (error) {
      console.error('加载学校失败:', error);
      message.error('加载学校列表失败');
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      Promise.all([loadProjects(), loadSchools()]).finally(() => {
        setLoading(false);
      });
      setStep('form');
      setGeneratedLinks([]);
      form.resetFields();
    }
  }, [visible, loadProjects, loadSchools, form]);

  // 生成链接
  const handleGenerate = async (values: {
    projectId: string;
    schoolIds: string[];
    targetAudience: 'parent' | 'teacher' | 'student' | 'principal';
    linkType: 'url' | 'qrcode' | 'shortlink';
    expiresIn: number;
  }) => {
    if (!tool) return;

    try {
      setGenerating(true);
      const result = await toolService.generateAccessLinks(tool.id, {
        projectId: values.projectId,
        schoolIds: values.schoolIds,
        targetAudience: values.targetAudience,
        linkType: values.linkType || 'url',
        expiresIn: values.expiresIn || 168, // 默认7天
      });

      if (result.success) {
        // 为链接添加学校名称
        const linksWithNames = result.links.map((link) => {
          const school = schools.find((s) => s.id === link.schoolId);
          return {
            ...link,
            schoolName: school?.name || link.schoolId,
            districtName: school?.districtName,
          };
        });
        setGeneratedLinks(linksWithNames);
        setStep('result');
        message.success(`成功生成 ${result.totalGenerated} 个访问链接`);
      } else {
        message.error('生成链接失败');
      }
    } catch (error) {
      console.error('生成链接失败:', error);
      message.error('生成链接失败，请稍后重试');
    } finally {
      setGenerating(false);
    }
  };

  // 复制链接
  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      message.success('链接已复制');
    } catch {
      message.error('复制失败');
    }
  };

  // 批量复制所有链接
  const handleCopyAll = async () => {
    try {
      const allLinks = generatedLinks
        .map((link) => `${link.schoolName}: ${link.accessUrl}`)
        .join('\n');
      await navigator.clipboard.writeText(allLinks);
      message.success('所有链接已复制');
    } catch {
      message.error('复制失败');
    }
  };

  // 导出Excel
  const handleExport = () => {
    const csvContent = [
      ['学校名称', '区县', '访问链接', '目标受众', '过期时间', '创建时间'].join(','),
      ...generatedLinks.map((link) =>
        [
          link.schoolName || '',
          link.districtName || '',
          link.accessUrl,
          link.targetAudience,
          link.expiresAt || '',
          link.createdAt,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `问卷访问链接_${tool?.name}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    message.success('导出成功');
  };

  // 返回表单
  const handleBack = () => {
    setStep('form');
    setGeneratedLinks([]);
  };

  // 关闭弹窗
  const handleClose = () => {
    setStep('form');
    setGeneratedLinks([]);
    form.resetFields();
    onClose();
  };

  // 表格列定义
  const columns = [
    {
      title: '学校名称',
      dataIndex: 'schoolName',
      key: 'schoolName',
      width: 180,
    },
    {
      title: '区县',
      dataIndex: 'districtName',
      key: 'districtName',
      width: 100,
    },
    {
      title: '访问链接',
      dataIndex: 'accessUrl',
      key: 'accessUrl',
      ellipsis: true,
      render: (url: string) => (
        <Tooltip title={url}>
          <Text style={{ maxWidth: 300 }} ellipsis>
            {url}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: unknown, record: SurveyAccessLink) => (
        <Button
          type="link"
          size="small"
          icon={<CopyOutlined />}
          onClick={() => handleCopyLink(record.accessUrl)}
        >
          复制
        </Button>
      ),
    },
  ];

  const targetAudienceOptions = [
    { value: 'parent', label: '家长' },
    { value: 'teacher', label: '教师' },
    { value: 'student', label: '学生' },
    { value: 'principal', label: '校长' },
  ];

  return (
    <Modal
      title={
        <span>
          <LinkOutlined style={{ marginRight: 8 }} />
          生成问卷访问链接 - {tool?.name}
        </span>
      }
      open={visible}
      onCancel={handleClose}
      footer={null}
      width={step === 'result' ? 800 : 520}
      destroyOnClose
    >
      <Spin spinning={loading}>
        {step === 'form' ? (
          <Form
            form={form}
            layout="vertical"
            onFinish={handleGenerate}
            initialValues={{
              linkType: 'url',
              expiresIn: 168,
            }}
          >
            {!tool?.externalSurveyId && (
              <Alert
                message="提示"
                description="该工具尚未关联第三方问卷，请先在问卷系统中创建问卷。"
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            <Form.Item
              label="选择项目"
              name="projectId"
              rules={[{ required: true, message: '请选择项目' }]}
            >
              <Select
                placeholder="请选择项目"
                showSearch
                optionFilterProp="label"
                options={projects.map((p) => ({ value: p.id, label: p.name }))}
              />
            </Form.Item>

            <Form.Item
              label="选择学校"
              name="schoolIds"
              rules={[{ required: true, message: '请选择至少一所学校' }]}
            >
              <Select
                mode="multiple"
                placeholder="请选择学校（可多选）"
                showSearch
                optionFilterProp="label"
                maxTagCount="responsive"
                options={schools.map((s) => ({
                  value: s.id,
                  label: `${s.name}${s.districtName ? ` (${s.districtName})` : ''}`,
                }))}
              />
            </Form.Item>

            <Form.Item
              label="目标受众"
              name="targetAudience"
              rules={[{ required: true, message: '请选择目标受众' }]}
            >
              <Select placeholder="请选择目标受众" options={targetAudienceOptions} />
            </Form.Item>

            <Form.Item label="链接类型" name="linkType">
              <Select
                options={[
                  { value: 'url', label: '普通链接' },
                  { value: 'shortlink', label: '短链接' },
                  { value: 'qrcode', label: '二维码' },
                ]}
              />
            </Form.Item>

            <Form.Item label="有效期（小时）" name="expiresIn">
              <InputNumber min={1} max={8760} style={{ width: '100%' }} placeholder="默认168小时（7天）" />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={handleClose}>取消</Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={generating}
                  disabled={!tool?.externalSurveyId}
                >
                  生成链接
                </Button>
              </Space>
            </Form.Item>
          </Form>
        ) : (
          <div>
            <Alert
              message={
                <span>
                  <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                  成功生成 {generatedLinks.length} 个访问链接
                </span>
              }
              type="success"
              style={{ marginBottom: 16 }}
            />

            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button icon={<CopyOutlined />} onClick={handleCopyAll}>
                复制全部
              </Button>
              <Button icon={<DownloadOutlined />} onClick={handleExport}>
                导出CSV
              </Button>
            </div>

            <Table
              columns={columns}
              dataSource={generatedLinks}
              rowKey="id"
              size="small"
              pagination={generatedLinks.length > 10 ? { pageSize: 10 } : false}
              scroll={{ y: 300 }}
            />

            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <Space>
                <Button onClick={handleBack}>返回</Button>
                <Button type="primary" onClick={handleClose}>
                  完成
                </Button>
              </Space>
            </div>
          </div>
        )}
      </Spin>
    </Modal>
  );
};

export default SurveyLinkModal;
