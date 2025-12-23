import React, { useState, useEffect } from 'react';
import { Button, Input, Table, Tag, Modal, Form, Select, message, Space, Upload, InputNumber, Progress } from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import * as XLSX from 'xlsx';
import {
  getSchools,
  createSchool,
  updateSchool,
  deleteSchool,
  importSchools,
  School,
  SchoolListResponse,
  SchoolImportResult,
  SCHOOL_TYPES,
  URBAN_RURAL_TYPES,
  SCHOOL_CATEGORIES,
} from '../../services/schoolService';
import { getDistricts, District } from '../../services/districtService';
import styles from './index.module.css';

const { Search } = Input;

const SchoolManagement: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const districtIdFromUrl = searchParams.get('districtId');

  const [schools, setSchools] = useState<School[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<SchoolImportResult | null>(null);
  const [currentSchool, setCurrentSchool] = useState<School | null>(null);
  const [filters, setFilters] = useState({
    districtId: districtIdFromUrl || '',
    schoolType: '',
    urbanRural: '',
    keyword: '',
    page: 1,
    pageSize: 10,
  });
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  // 加载区县列表
  useEffect(() => {
    getDistricts().then(setDistricts).catch(() => message.error('加载区县列表失败'));
  }, []);

  // 加载学校列表
  const loadSchools = async () => {
    setLoading(true);
    try {
      const result: SchoolListResponse = await getSchools(filters);
      setSchools(result.list);
      setTotal(result.total);
    } catch (error) {
      message.error('加载学校列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchools();
  }, [filters]);

  const handleSearch = (value: string) => {
    setFilters(prev => ({ ...prev, keyword: value, page: 1 }));
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handlePageChange = (page: number, pageSize: number) => {
    setFilters(prev => ({ ...prev, page, pageSize }));
  };

  const handleCreate = async (values: Record<string, unknown>) => {
    try {
      await createSchool(values as Parameters<typeof createSchool>[0]);
      message.success('创建成功');
      setCreateModalVisible(false);
      form.resetFields();
      loadSchools();
    } catch (error: unknown) {
      message.error((error as Error).message || '创建失败');
    }
  };

  const handleEdit = (school: School) => {
    setCurrentSchool(school);
    editForm.setFieldsValue({
      code: school.code,
      name: school.name,
      districtId: school.districtId,
      schoolType: school.schoolType,
      schoolCategory: school.schoolCategory,
      urbanRural: school.urbanRural,
      address: school.address,
      principal: school.principal,
      contactPhone: school.contactPhone,
      studentCount: school.studentCount,
      teacherCount: school.teacherCount,
    });
    setEditModalVisible(true);
  };

  const handleSaveEdit = async (values: Record<string, unknown>) => {
    if (!currentSchool) return;
    try {
      await updateSchool(currentSchool.id, values as Parameters<typeof updateSchool>[1]);
      message.success('保存成功');
      setEditModalVisible(false);
      editForm.resetFields();
      setCurrentSchool(null);
      loadSchools();
    } catch (error: unknown) {
      message.error((error as Error).message || '保存失败');
    }
  };

  const handleDelete = (school: School) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除学校"${school.name}"吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteSchool(school.id);
          message.success('删除成功');
          loadSchools();
        } catch (error: unknown) {
          message.error((error as Error).message || '删除失败');
        }
      },
    });
  };

  // Excel 列名到字段名的映射
  const columnMapping: Record<string, string> = {
    '学校代码': 'code',
    '学校名称': 'name',
    '区县名称': 'districtName',
    '区县ID': 'districtId',
    '学校类型': 'schoolType',
    '办学性质': 'schoolCategory',
    '城乡类型': 'urbanRural',
    '地址': 'address',
    '校长': 'principal',
    '联系电话': 'contactPhone',
    '学生数': 'studentCount',
    '教师数': 'teacherCount',
  };

  // 解析 Excel 文件
  const parseExcelFile = (file: File): Promise<Array<Record<string, unknown>>> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];

          if (jsonData.length < 2) {
            reject(new Error('文件中没有数据'));
            return;
          }

          // 第一行是表头
          const headers = jsonData[0] as string[];
          const rows = jsonData.slice(1);

          const result = rows
            .filter(row => row.some(cell => cell !== null && cell !== undefined && cell !== ''))
            .map(row => {
              const obj: Record<string, unknown> = {};
              headers.forEach((header, index) => {
                const fieldName = columnMapping[header] || header;
                let value = (row as unknown[])[index];

                // 处理数字类型
                if (fieldName === 'studentCount' || fieldName === 'teacherCount') {
                  value = value ? Number(value) : 0;
                }

                obj[fieldName] = value;
              });
              return obj;
            });

          resolve(result);
        } catch (error) {
          reject(new Error('文件解析失败，请检查文件格式'));
        }
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsBinaryString(file);
    });
  };

  // 根据区县名称查找区县ID
  const findDistrictIdByName = (name: string): string | undefined => {
    const district = districts.find(d => d.name === name || d.name.includes(name) || name.includes(d.name));
    return district?.id;
  };

  // 处理导入
  const handleImportFile = async (file: File) => {
    if (districts.length === 0) {
      message.error('请等待区县数据加载完成');
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const data = await parseExcelFile(file);

      if (data.length === 0) {
        message.error('文件中没有有效数据');
        setImporting(false);
        return;
      }

      if (data.length > 500) {
        message.error('单次最多导入 500 条记录');
        setImporting(false);
        return;
      }

      // 处理数据：如果没有区县ID但有区县名称，尝试匹配
      const processedData = data.map(item => {
        const processed = { ...item };

        // 如果没有 districtId 但有 districtName，尝试匹配
        if (!processed.districtId && processed.districtName) {
          const districtId = findDistrictIdByName(String(processed.districtName));
          if (districtId) {
            processed.districtId = districtId;
          }
        }

        return processed;
      });

      // 调用导入 API
      const result = await importSchools(processedData as Parameters<typeof importSchools>[0]);
      setImportResult(result);

      if (result.success > 0) {
        message.success(`成功导入 ${result.success} 所学校`);
        loadSchools();
      }

      if (result.failed > 0) {
        message.warning(`${result.failed} 条记录导入失败`);
      }
    } catch (error) {
      message.error((error as Error).message || '导入失败');
    } finally {
      setImporting(false);
    }
  };

  // 下载 Excel 模板
  const handleDownloadTemplate = () => {
    // 创建示例数据
    const templateData = [
      {
        '学校代码': '2101020001',
        '学校名称': '示例小学',
        '区县名称': districts[0]?.name || '和平区',
        '学校类型': '小学',
        '办学性质': '公办',
        '城乡类型': '城区',
        '地址': '示例路1号',
        '校长': '张三',
        '联系电话': '024-12345678',
        '学生数': 1000,
        '教师数': 80,
      },
    ];

    // 创建工作簿和工作表
    const worksheet = XLSX.utils.json_to_sheet(templateData);

    // 设置列宽
    worksheet['!cols'] = [
      { wch: 15 }, // 学校代码
      { wch: 20 }, // 学校名称
      { wch: 12 }, // 区县名称
      { wch: 12 }, // 学校类型
      { wch: 10 }, // 办学性质
      { wch: 10 }, // 城乡类型
      { wch: 25 }, // 地址
      { wch: 10 }, // 校长
      { wch: 15 }, // 联系电话
      { wch: 10 }, // 学生数
      { wch: 10 }, // 教师数
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '学校导入模板');

    // 添加说明工作表
    const instructionData = [
      ['字段说明'],
      [''],
      ['学校代码', '必填，学校的唯一标识代码'],
      ['学校名称', '必填，学校的正式名称'],
      ['区县名称', '必填，学校所属区县名称（如：和平区、沈河区）'],
      ['学校类型', '必填，可选值：幼儿园、小学、初中、九年一贯制、完全中学'],
      ['办学性质', '可选，可选值：公办、民办，默认为公办'],
      ['城乡类型', '可选，可选值：城区、镇区、乡村，默认为城区'],
      ['地址', '可选，学校地址'],
      ['校长', '可选，校长姓名'],
      ['联系电话', '可选，学校联系电话'],
      ['学生数', '可选，学生总数，默认为0'],
      ['教师数', '可选，教师总数，默认为0'],
      [''],
      ['当前可用区县列表：'],
      ...districts.map(d => [d.name, `ID: ${d.id}`]),
    ];
    const instructionSheet = XLSX.utils.aoa_to_sheet(instructionData);
    instructionSheet['!cols'] = [{ wch: 15 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(workbook, instructionSheet, '填写说明');

    // 下载文件
    XLSX.writeFile(workbook, '学校导入模板.xlsx');
  };

  const getSchoolTypeTag = (type: string) => {
    const colors: Record<string, string> = {
      '小学': 'blue',
      '初中': 'green',
      '九年一贯制': 'purple',
      '完全中学': 'orange',
    };
    return <Tag color={colors[type] || 'default'}>{type}</Tag>;
  };

  const getUrbanRuralTag = (type: string) => {
    const colors: Record<string, string> = {
      '城区': 'blue',
      '镇区': 'cyan',
      '乡村': 'green',
    };
    return <Tag color={colors[type] || 'default'}>{type}</Tag>;
  };

  const columns: ColumnsType<School> = [
    {
      title: '学校代码',
      dataIndex: 'code',
      key: 'code',
      width: 120,
    },
    {
      title: '学校名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: '所属区县',
      dataIndex: 'districtName',
      key: 'districtName',
      width: 100,
    },
    {
      title: '学校类型',
      dataIndex: 'schoolType',
      key: 'schoolType',
      width: 100,
      render: (type: string) => getSchoolTypeTag(type),
    },
    {
      title: '城乡类型',
      dataIndex: 'urbanRural',
      key: 'urbanRural',
      width: 80,
      render: (type: string) => getUrbanRuralTag(type),
    },
    {
      title: '学生数',
      dataIndex: 'studentCount',
      key: 'studentCount',
      width: 80,
      render: (count: number) => `${count} 人`,
    },
    {
      title: '教师数',
      dataIndex: 'teacherCount',
      key: 'teacherCount',
      width: 80,
      render: (count: number) => `${count} 人`,
    },
    {
      title: '生师比',
      key: 'ratio',
      width: 80,
      render: (_: unknown, record: School) => {
        if (record.teacherCount === 0) return '-';
        return (record.studentCount / record.teacherCount).toFixed(1) + ':1';
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_: unknown, record: School) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const formFields = (
    <>
      <Form.Item
        name="code"
        label="学校代码"
        rules={[{ required: true, message: '请输入学校代码' }]}
      >
        <Input placeholder="请输入学校代码" />
      </Form.Item>
      <Form.Item
        name="name"
        label="学校名称"
        rules={[{ required: true, message: '请输入学校名称' }]}
      >
        <Input placeholder="请输入学校名称" />
      </Form.Item>
      <Form.Item
        name="districtId"
        label="所属区县"
        rules={[{ required: true, message: '请选择所属区县' }]}
      >
        <Select placeholder="请选择所属区县">
          {districts.map(d => (
            <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>
          ))}
        </Select>
      </Form.Item>
      <Form.Item
        name="schoolType"
        label="学校类型"
        rules={[{ required: true, message: '请选择学校类型' }]}
      >
        <Select placeholder="请选择学校类型">
          {SCHOOL_TYPES.map(t => (
            <Select.Option key={t.value} value={t.value}>{t.label}</Select.Option>
          ))}
        </Select>
      </Form.Item>
      <Form.Item name="schoolCategory" label="办学性质" initialValue="公办">
        <Select>
          {SCHOOL_CATEGORIES.map(c => (
            <Select.Option key={c.value} value={c.value}>{c.label}</Select.Option>
          ))}
        </Select>
      </Form.Item>
      <Form.Item name="urbanRural" label="城乡类型" initialValue="城区">
        <Select>
          {URBAN_RURAL_TYPES.map(t => (
            <Select.Option key={t.value} value={t.value}>{t.label}</Select.Option>
          ))}
        </Select>
      </Form.Item>
      <Form.Item name="address" label="学校地址">
        <Input placeholder="请输入学校地址" />
      </Form.Item>
      <Form.Item name="principal" label="校长姓名">
        <Input placeholder="请输入校长姓名" />
      </Form.Item>
      <Form.Item name="contactPhone" label="联系电话">
        <Input placeholder="请输入联系电话" />
      </Form.Item>
      <Form.Item name="studentCount" label="学生数" initialValue={0}>
        <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入学生数" />
      </Form.Item>
      <Form.Item name="teacherCount" label="教师数" initialValue={0}>
        <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入教师数" />
      </Form.Item>
    </>
  );

  return (
    <div className={styles.schoolPage}>
      <div className={styles.pageHeader}>
        <span className={styles.backBtn} onClick={() => navigate(-1)}>
          <ArrowLeftOutlined /> 返回
        </span>
        <h2 className={styles.pageTitle}>学校管理</h2>
      </div>

      {/* 筛选区域 */}
      <div className={styles.filterSection}>
        <Space wrap>
          <Select
            style={{ width: 150 }}
            placeholder="选择区县"
            allowClear
            value={filters.districtId || undefined}
            onChange={value => handleFilterChange('districtId', value || '')}
          >
            {districts.map(d => (
              <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>
            ))}
          </Select>
          <Select
            style={{ width: 120 }}
            placeholder="学校类型"
            allowClear
            value={filters.schoolType || undefined}
            onChange={value => handleFilterChange('schoolType', value || '')}
          >
            {SCHOOL_TYPES.map(t => (
              <Select.Option key={t.value} value={t.value}>{t.label}</Select.Option>
            ))}
          </Select>
          <Select
            style={{ width: 120 }}
            placeholder="城乡类型"
            allowClear
            value={filters.urbanRural || undefined}
            onChange={value => handleFilterChange('urbanRural', value || '')}
          >
            {URBAN_RURAL_TYPES.map(t => (
              <Select.Option key={t.value} value={t.value}>{t.label}</Select.Option>
            ))}
          </Select>
          <Search
            placeholder="搜索学校名称、代码或校长"
            allowClear
            onSearch={handleSearch}
            style={{ width: 280 }}
          />
        </Space>
        <Space>
          <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
            下载模板
          </Button>
          <Button icon={<UploadOutlined />} onClick={() => setImportModalVisible(true)}>
            批量导入
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
            新增学校
          </Button>
        </Space>
      </div>

      {/* 列表区域 */}
      <div className={styles.listSection}>
        <Table
          columns={columns}
          dataSource={schools}
          rowKey="id"
          loading={loading}
          pagination={{
            current: filters.page,
            pageSize: filters.pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 所学校`,
            onChange: handlePageChange,
          }}
          scroll={{ x: 1200 }}
        />
      </div>

      {/* 新增学校弹窗 */}
      <Modal
        title="新增学校"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          {formFields}
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setCreateModalVisible(false);
                form.resetFields();
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                确认
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑学校弹窗 */}
      <Modal
        title="编辑学校"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          editForm.resetFields();
          setCurrentSchool(null);
        }}
        footer={null}
        width={600}
      >
        <Form form={editForm} layout="vertical" onFinish={handleSaveEdit}>
          {formFields}
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setEditModalVisible(false);
                editForm.resetFields();
                setCurrentSchool(null);
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量导入弹窗 */}
      <Modal
        title="批量导入学校"
        open={importModalVisible}
        onCancel={() => {
          if (!importing) {
            setImportModalVisible(false);
            setImportResult(null);
          }
        }}
        footer={null}
        width={600}
        maskClosable={!importing}
      >
        <div className={styles.importContent}>
          {!importResult ? (
            <>
              <p>请按照模板格式准备 Excel 文件，然后上传导入。</p>
              <p style={{ color: '#999', fontSize: 12, marginBottom: 16 }}>
                支持格式：.xlsx, .xls<br/>
                单次最多导入 500 条记录<br/>
                模板中包含字段说明和区县列表，请先下载模板查看
              </p>
              <Upload.Dragger
                name="file"
                accept=".xlsx,.xls"
                maxCount={1}
                showUploadList={false}
                disabled={importing}
                beforeUpload={(file) => {
                  handleImportFile(file);
                  return false;
                }}
              >
                {importing ? (
                  <div style={{ padding: '20px 0' }}>
                    <Progress type="circle" percent={99} status="active" />
                    <p style={{ marginTop: 16 }}>正在导入中，请稍候...</p>
                  </div>
                ) : (
                  <>
                    <p className="ant-upload-drag-icon">
                      <UploadOutlined style={{ fontSize: 48, color: '#1677ff' }} />
                    </p>
                    <p className="ant-upload-text">点击或拖拽 Excel 文件到此区域上传</p>
                    <p className="ant-upload-hint">支持 .xlsx, .xls 格式</p>
                  </>
                )}
              </Upload.Dragger>
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between' }}>
                <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
                  下载导入模板
                </Button>
                <Button onClick={() => setImportModalVisible(false)} disabled={importing}>
                  关闭
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* 导入结果展示 */}
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                {importResult.failed === 0 ? (
                  <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />
                ) : importResult.success === 0 ? (
                  <CloseCircleOutlined style={{ fontSize: 48, color: '#ff4d4f' }} />
                ) : (
                  <CheckCircleOutlined style={{ fontSize: 48, color: '#faad14' }} />
                )}
                <h3 style={{ marginTop: 16, marginBottom: 8 }}>导入完成</h3>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: 48, marginBottom: 24 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 32, fontWeight: 'bold', color: '#52c41a' }}>
                    {importResult.success}
                  </div>
                  <div style={{ color: '#666' }}>成功</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 32, fontWeight: 'bold', color: '#ff4d4f' }}>
                    {importResult.failed}
                  </div>
                  <div style={{ color: '#666' }}>失败</div>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <h4 style={{ marginBottom: 8 }}>失败详情：</h4>
                  <div style={{
                    maxHeight: 200,
                    overflowY: 'auto',
                    background: '#fafafa',
                    borderRadius: 4,
                    padding: 12
                  }}>
                    {importResult.errors.map((err, index) => (
                      <div key={index} style={{
                        padding: '8px 0',
                        borderBottom: index < importResult.errors.length - 1 ? '1px solid #f0f0f0' : 'none',
                        fontSize: 13
                      }}>
                        <Tag color="error">{err.code || `第${index + 1}条`}</Tag>
                        <span style={{ color: '#666' }}>{err.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ textAlign: 'right' }}>
                <Space>
                  <Button onClick={() => setImportResult(null)}>
                    继续导入
                  </Button>
                  <Button type="primary" onClick={() => {
                    setImportModalVisible(false);
                    setImportResult(null);
                  }}>
                    完成
                  </Button>
                </Space>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default SchoolManagement;
