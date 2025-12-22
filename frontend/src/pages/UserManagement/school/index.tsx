import React, { useState, useEffect } from 'react';
import { Button, Table, Space, message, Modal, Form, Input, Select, Tag, Upload, Progress } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined, DownloadOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as XLSX from 'xlsx';
import styles from './index.module.css';
import {
  getSchools,
  createSchool,
  updateSchool,
  deleteSchool,
  importSchools,
  School,
  SchoolImportResult,
  SCHOOL_TYPES,
  SCHOOL_CATEGORIES,
  URBAN_RURAL_TYPES,
} from '../../../services/schoolService';
import { getDistricts, District } from '../../../services/districtService';

const { Search } = Input;

const SchoolManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState<School[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState<{
    keyword: string;
    schoolType: string;
    status: string;
  }>({
    keyword: '',
    schoolType: '',
    status: '',
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<SchoolImportResult | null>(null);
  const [current, setCurrent] = useState<School | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  // 加载区县列表
  useEffect(() => {
    getDistricts().then(setDistricts).catch(() => message.error('加载区县列表失败'));
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await getSchools({
        keyword: filters.keyword || undefined,
        schoolType: filters.schoolType || undefined,
        status: filters.status || undefined,
        page,
        pageSize,
      });
      setDataSource(response.list);
      setTotal(response.total);
    } catch (error) {
      console.error('加载学校数据失败:', error);
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, filters.schoolType, filters.status]);

  const handleSearch = (value: string) => {
    setFilters(prev => ({ ...prev, keyword: value }));
    setPage(1);
    setTimeout(() => loadData(), 0);
  };

  const handleCreate = async (values: any) => {
    try {
      await createSchool(values);
      message.success('创建成功');
      setCreateOpen(false);
      createForm.resetFields();
      loadData();
    } catch (e: unknown) {
      message.error((e as Error).message || '创建失败');
    }
  };

  const openEdit = (record: School) => {
    setCurrent(record);
    editForm.setFieldsValue({
      code: record.code,
      name: record.name,
      schoolType: record.schoolType,
      schoolCategory: record.schoolCategory,
      urbanRural: record.urbanRural,
      address: record.address,
      principal: record.principal,
      contactPhone: record.contactPhone,
      studentCount: record.studentCount,
      teacherCount: record.teacherCount,
      status: record.status,
    });
    setEditOpen(true);
  };

  const handleEdit = async (values: any) => {
    if (!current) return;
    try {
      await updateSchool(current.id, values);
      message.success('保存成功');
      setEditOpen(false);
      editForm.resetFields();
      setCurrent(null);
      loadData();
    } catch (e: unknown) {
      message.error((e as Error).message || '保存失败');
    }
  };

  const handleDelete = (record: School) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除学校 "${record.name}" 吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteSchool(record.id);
          message.success('删除成功');
          loadData();
        } catch (e: unknown) {
          message.error((e as Error).message || '删除失败');
        }
      },
    });
  };

  const handleStatusChange = async (record: School, newStatus: 'active' | 'inactive') => {
    try {
      await updateSchool(record.id, { status: newStatus });
      message.success(newStatus === 'active' ? '启用成功' : '停用成功');
      loadData();
    } catch (e: unknown) {
      message.error((e as Error).message || '更新状态失败');
    }
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

          const headers = jsonData[0] as string[];
          const rows = jsonData.slice(1);

          const result = rows
            .filter(row => row.some(cell => cell !== null && cell !== undefined && cell !== ''))
            .map(row => {
              const obj: Record<string, unknown> = {};
              headers.forEach((header, index) => {
                const fieldName = columnMapping[header] || header;
                let value = (row as unknown[])[index];
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

      const processedData = data.map(item => {
        const processed = { ...item };
        if (!processed.districtId && processed.districtName) {
          const districtId = findDistrictIdByName(String(processed.districtName));
          if (districtId) {
            processed.districtId = districtId;
          }
        }
        return processed;
      });

      const result = await importSchools(processedData as Parameters<typeof importSchools>[0]);
      setImportResult(result);

      if (result.success > 0) {
        message.success(`成功导入 ${result.success} 所学校`);
        loadData();
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

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    worksheet['!cols'] = [
      { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 12 },
      { wch: 10 }, { wch: 10 }, { wch: 25 }, { wch: 10 },
      { wch: 15 }, { wch: 10 }, { wch: 10 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '学校导入模板');

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

    XLSX.writeFile(workbook, '学校导入模板.xlsx');
  };

  const columns: ColumnsType<School> = [
    {
      title: '学校编码',
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
      title: '学校类型',
      dataIndex: 'schoolType',
      key: 'schoolType',
      width: 120,
    },
    {
      title: '办学性质',
      dataIndex: 'schoolCategory',
      key: 'schoolCategory',
      width: 100,
    },
    {
      title: '城乡类型',
      dataIndex: 'urbanRural',
      key: 'urbanRural',
      width: 100,
    },
    {
      title: '校长',
      dataIndex: 'principal',
      key: 'principal',
      width: 100,
    },
    {
      title: '联系电话',
      dataIndex: 'contactPhone',
      key: 'contactPhone',
      width: 130,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'default'}>
          {status === 'active' ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record: School) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEdit(record)}
          >
            编辑
          </Button>
          {record.status === 'active' ? (
            <Button
              type="link"
              size="small"
              danger
              onClick={() => handleStatusChange(record, 'inactive')}
            >
              停用
            </Button>
          ) : (
            <Button
              type="link"
              size="small"
              onClick={() => handleStatusChange(record, 'active')}
            >
              启用
            </Button>
          )}
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.schoolManagement}>
      <div className={styles.listSection}>
        <div className={styles.listHeader}>
          <h3>学校列表</h3>
          <div className={styles.filters}>
            <Select
              style={{ width: 140 }}
              placeholder="学校类型"
              allowClear
              value={filters.schoolType || undefined}
              options={SCHOOL_TYPES}
              onChange={(v) => setFilters(prev => ({ ...prev, schoolType: v || '' }))}
            />
            <Select
              style={{ width: 120 }}
              placeholder="状态筛选"
              allowClear
              value={filters.status || undefined}
              options={[
                { label: '启用', value: 'active' },
                { label: '停用', value: 'inactive' },
              ]}
              onChange={(v) => setFilters(prev => ({ ...prev, status: v || '' }))}
            />
            <Search
              placeholder="搜索学校名称/编码"
              allowClear
              onSearch={handleSearch}
              style={{ width: 240 }}
            />
          </div>
          <div className={styles.actions}>
            <Button onClick={loadData}>刷新</Button>
            <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
              下载模板
            </Button>
            <Button icon={<UploadOutlined />} onClick={() => setImportModalVisible(true)}>
              批量导入
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              新增学校
            </Button>
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={dataSource}
          loading={loading}
          rowKey="id"
          pagination={{
            total,
            current: page,
            pageSize,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条数据`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          scroll={{ x: 1200 }}
        />
      </div>

      {/* 新增学校 */}
      <Modal
        title="新增学校"
        open={createOpen}
        onCancel={() => {
          setCreateOpen(false);
          createForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreate}
        >
          <Form.Item name="code" label="学校编码" rules={[{ required: true, message: '请输入学校编码' }]}>
            <Input placeholder="请输入学校编码" />
          </Form.Item>
          <Form.Item name="name" label="学校名称" rules={[{ required: true, message: '请输入学校名称' }]}>
            <Input placeholder="请输入学校名称" />
          </Form.Item>
          <Form.Item name="schoolType" label="学校类型" rules={[{ required: true, message: '请选择学校类型' }]}>
            <Select options={SCHOOL_TYPES} placeholder="请选择学校类型" />
          </Form.Item>
          <Form.Item name="schoolCategory" label="办学性质">
            <Select options={SCHOOL_CATEGORIES} placeholder="请选择办学性质" allowClear />
          </Form.Item>
          <Form.Item name="urbanRural" label="城乡类型">
            <Select options={URBAN_RURAL_TYPES} placeholder="请选择城乡类型" allowClear />
          </Form.Item>
          <Form.Item name="address" label="地址">
            <Input placeholder="请输入学校地址" />
          </Form.Item>
          <Form.Item name="principal" label="校长">
            <Input placeholder="请输入校长姓名" />
          </Form.Item>
          <Form.Item name="contactPhone" label="联系电话">
            <Input placeholder="请输入联系电话" />
          </Form.Item>
          <Form.Item name="studentCount" label="学生人数">
            <Input type="number" placeholder="请输入学生人数" />
          </Form.Item>
          <Form.Item name="teacherCount" label="教师人数">
            <Input type="number" placeholder="请输入教师人数" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setCreateOpen(false); createForm.resetFields(); }}>取消</Button>
              <Button type="primary" htmlType="submit">确认</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑学校 */}
      <Modal
        title={current ? `编辑学校：${current.name}` : '编辑学校'}
        open={editOpen}
        onCancel={() => {
          setEditOpen(false);
          editForm.resetFields();
          setCurrent(null);
        }}
        footer={null}
        width={600}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEdit}>
          <Form.Item name="code" label="学校编码" rules={[{ required: true, message: '请输入学校编码' }]}>
            <Input placeholder="请输入学校编码" />
          </Form.Item>
          <Form.Item name="name" label="学校名称" rules={[{ required: true, message: '请输入学校名称' }]}>
            <Input placeholder="请输入学校名称" />
          </Form.Item>
          <Form.Item name="schoolType" label="学校类型" rules={[{ required: true, message: '请选择学校类型' }]}>
            <Select options={SCHOOL_TYPES} placeholder="请选择学校类型" />
          </Form.Item>
          <Form.Item name="schoolCategory" label="办学性质">
            <Select options={SCHOOL_CATEGORIES} placeholder="请选择办学性质" allowClear />
          </Form.Item>
          <Form.Item name="urbanRural" label="城乡类型">
            <Select options={URBAN_RURAL_TYPES} placeholder="请选择城乡类型" allowClear />
          </Form.Item>
          <Form.Item name="address" label="地址">
            <Input placeholder="请输入学校地址" />
          </Form.Item>
          <Form.Item name="principal" label="校长">
            <Input placeholder="请输入校长姓名" />
          </Form.Item>
          <Form.Item name="contactPhone" label="联系电话">
            <Input placeholder="请输入联系电话" />
          </Form.Item>
          <Form.Item name="studentCount" label="学生人数">
            <Input type="number" placeholder="请输入学生人数" />
          </Form.Item>
          <Form.Item name="teacherCount" label="教师人数">
            <Input type="number" placeholder="请输入教师人数" />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={[{ label: '启用', value: 'active' }, { label: '停用', value: 'inactive' }]} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setEditOpen(false); editForm.resetFields(); setCurrent(null); }}>取消</Button>
              <Button type="primary" htmlType="submit">保存</Button>
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
        <div style={{ padding: '8px 0' }}>
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
