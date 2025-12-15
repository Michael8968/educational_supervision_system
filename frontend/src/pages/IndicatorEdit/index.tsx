import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button, Tag, Modal, Form, Input, Select, message, Radio } from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FileTextOutlined,
  SaveOutlined,
  LinkOutlined,
  FormOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import styles from './index.module.css';
import * as toolService from '../../services/toolService';
import type { DataTool, FormField, Element as ApiElement } from '../../services/toolService';

// 扁平化的表单字段项（用于选择器）
interface FlattenedField {
  id: string;
  label: string;
  type: string;
  path: string; // 完整路径，如 "分组名 > 字段名"
}

// 要素类型
type ElementType = '基础要素' | '派生要素';

// 数据类型
type DataType = '文本' | '数字' | '日期' | '时间' | '逻辑' | '数组' | '文件';

// 要素接口
// 页面内部要素结构（沿用后端字段；与 API 的 Element 基本一致）
interface Element extends ApiElement {
  elementType: ElementType;
  dataType: DataType;
}

// 要素库接口
interface ElementLibrary {
  id: string;
  name: string;
  description: string;
  status: '未发布' | '已发布' | 'published' | 'draft';
  elementCount: number;
  elements: Element[];
}

// 递归扁平化表单字段
const flattenFormFields = (fields: any[], parentPath: string = ''): FlattenedField[] => {
  const result: FlattenedField[] = [];

  fields.forEach(field => {
    const currentPath = parentPath ? `${parentPath} > ${field.label}` : field.label;

    // 跳过分组和分割线，只添加实际输入控件
    if (field.type !== 'group' && field.type !== 'divider') {
      result.push({
        id: field.id,
        label: field.label,
        type: field.type,
        path: currentPath,
      });
    }

    // 处理分组的子字段
    if (field.type === 'group' && field.children) {
      result.push(...flattenFormFields(field.children, field.label));
    }

    // 处理动态列表的子字段
    if (field.type === 'dynamicList') {
      const listFields = field.dynamicListFields || field.fields || [];
      listFields.forEach((childField: any) => {
        result.push({
          id: `${field.id}.${childField.id}`,
          label: childField.label,
          type: childField.type,
          path: `${currentPath} > ${childField.label}`,
        });
      });
    }
  });

  return result;
};

const IndicatorEdit: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [library, setLibrary] = useState<ElementLibrary | null>(null);
  const [selectedElement, setSelectedElement] = useState<Element | null>(null);

  // 采集工具列表和表单schema缓存
  const [dataTools, setDataTools] = useState<DataTool[]>([]);
  const [formSchemas, setFormSchemas] = useState<Record<string, FormField[]>>({});

  // 弹窗状态
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);

  // 筛选状态: 'all' | 'unlinked' | 'linked'
  const [filterType, setFilterType] = useState<'all' | 'unlinked' | 'linked'>('all');

  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();

  // 监听要素类型变化
  const [addFormElementType, setAddFormElementType] = useState<ElementType>('基础要素');
  const [editFormElementType, setEditFormElementType] = useState<ElementType>('基础要素');

  // 监听选中的工具变化（用于级联选择控件）
  const [addFormToolId, setAddFormToolId] = useState<string | undefined>();
  const [editFormToolId, setEditFormToolId] = useState<string | undefined>();

  // 加载工具的表单schema（带缓存）
  const loadToolSchema = useCallback(async (toolId: string) => {
    if (formSchemas[toolId]) return formSchemas[toolId];
    try {
      const result = await toolService.getSchema(toolId);
      if (result.schema) {
        setFormSchemas(prev => ({ ...prev, [toolId]: result.schema }));
        return result.schema;
      }
    } catch (error) {
      console.log('No schema found for tool:', toolId);
    }
    return [];
  }, [formSchemas]);

  // 根据选中的工具获取可用的字段列表
  const addFormFields = useMemo(() => {
    if (!addFormToolId) return [];
    const schema = formSchemas[addFormToolId];
    return schema ? flattenFormFields(schema) : [];
  }, [addFormToolId, formSchemas]);

  const editFormFields = useMemo(() => {
    if (!editFormToolId) return [];
    const schema = formSchemas[editFormToolId];
    return schema ? flattenFormFields(schema) : [];
  }, [editFormToolId, formSchemas]);

  // 根据筛选条件过滤要素列表
  const filteredElements = useMemo(() => {
    if (!library) return [];
    return library.elements.filter(element => {
      if (filterType === 'all') return true;
      // 未关联：基础要素且有toolId但没有fieldId
      const isUnlinked = element.elementType === '基础要素' && element.toolId && !element.fieldId;
      if (filterType === 'unlinked') return isUnlinked;
      // 已关联：基础要素且有fieldId，或者派生要素
      if (filterType === 'linked') return !isUnlinked;
      return true;
    });
  }, [library, filterType]);

  // 统计未关联要素数量
  const unlinkedCount = useMemo(() => {
    if (!library) return 0;
    return library.elements.filter(el =>
      el.elementType === '基础要素' && el.toolId && !el.fieldId
    ).length;
  }, [library]);

  useEffect(() => {
    // 加载要素库数据和采集工具列表
    const loadData = async () => {
      if (!id) return;
      try {
        // 并行加载要素库和工具列表
        const [libraryData, toolsData] = await Promise.all([
          toolService.getElementLibrary(id),
          toolService.getTools()
        ]);

        // 转换要素库数据格式
        const mappedLibrary: ElementLibrary = {
          id: libraryData.id,
          name: libraryData.name,
          description: libraryData.description || '',
          status: libraryData.status === 'published' ? '已发布' : '未发布',
          elementCount: libraryData.elements?.length || 0,
          elements: (libraryData.elements || []).map(el => ({
            id: el.id,
            code: el.code,
            name: el.name,
            elementType: el.elementType,
            dataType: el.dataType,
            formula: el.formula,
            toolId: el.toolId,
            fieldId: el.fieldId,
            fieldLabel: el.fieldLabel,
          })),
        };

        setLibrary(mappedLibrary);
        setDataTools(toolsData);
      } catch (error) {
        console.error('加载数据失败:', error);
        message.error('加载数据失败');
      }
    };

    loadData();
  }, [id]);

  const handleSelectElement = (element: Element) => {
    setSelectedElement(element);
  };

  const handleAddElement = () => {
    addForm.resetFields();
    setAddFormElementType('基础要素');
    setAddFormToolId(undefined);
    setAddModalVisible(true);
  };

  // 工具选择变化时加载schema
  const handleAddToolChange = async (toolId: string | undefined) => {
    setAddFormToolId(toolId);
    addForm.setFieldValue('fieldId', undefined);
    if (toolId) {
      await loadToolSchema(toolId);
    }
  };

  const handleEditToolChange = async (toolId: string | undefined) => {
    setEditFormToolId(toolId);
    editForm.setFieldValue('fieldId', undefined);
    if (toolId) {
      await loadToolSchema(toolId);
    }
  };

  const handleSaveAdd = async (values: any) => {
    if (!library || !id) return;

    try {
      // 获取选中字段的标签
      let fieldLabel: string | undefined;
      if (values.fieldId && addFormToolId) {
        const field = addFormFields.find(f => f.id === values.fieldId);
        fieldLabel = field?.path;
      }

      // 调用API添加要素
      const result = await toolService.addElement(id, {
        code: values.code,
        name: values.name,
        elementType: values.elementType,
        dataType: values.dataType,
        toolId: values.elementType === '基础要素' ? values.toolId : undefined,
        fieldId: values.elementType === '基础要素' ? values.fieldId : undefined,
        fieldLabel: values.elementType === '基础要素' ? fieldLabel : undefined,
        formula: values.elementType === '派生要素' ? values.formula : undefined,
      });

      // 基础要素：保存“表单字段 -> 要素”的映射（持久化）
      if (values.elementType === '基础要素' && values.toolId && values.fieldId) {
        await toolService.addFieldMapping(values.toolId, values.fieldId, 'element', result.id);
      }

      const newElement: Element = {
        id: result.id,
        code: values.code,
        name: values.name,
        elementType: values.elementType,
        dataType: values.dataType,
        formula: values.elementType === '派生要素' ? values.formula : undefined,
        toolId: values.elementType === '基础要素' ? values.toolId : undefined,
        fieldId: values.elementType === '基础要素' ? values.fieldId : undefined,
        fieldLabel: values.elementType === '基础要素' ? fieldLabel : undefined,
      };

      const updatedLibrary = {
        ...library,
        elements: [...library.elements, newElement],
        elementCount: library.elementCount + 1,
      };

      setLibrary(updatedLibrary);
      setAddModalVisible(false);
      setAddFormToolId(undefined);
      message.success('添加成功');
    } catch (error) {
      console.error('添加要素失败:', error);
      message.error('添加要素失败');
    }
  };

  const handleEditElement = async (element: Element) => {
    setSelectedElement(element);
    setEditFormElementType(element.elementType);
    setEditFormToolId(element.toolId);
    editForm.setFieldsValue({
      code: element.code,
      name: element.name,
      elementType: element.elementType,
      dataType: element.dataType,
      formula: element.formula,
      toolId: element.toolId,
      fieldId: element.fieldId,
    });
    // 如果有关联工具，预加载schema
    if (element.toolId) {
      await loadToolSchema(element.toolId);
    }
    setEditModalVisible(true);
  };

  const handleSaveEdit = async (values: any) => {
    if (!library || !selectedElement) return;

    try {
      // 获取选中字段的标签
      let fieldLabel: string | undefined;
      if (values.fieldId && editFormToolId) {
        const field = editFormFields.find(f => f.id === values.fieldId);
        fieldLabel = field?.path;
      }

      // 调用API更新要素
      await toolService.updateElement(selectedElement.id, {
        code: values.code,
        name: values.name,
        elementType: values.elementType,
        dataType: values.dataType,
        toolId: values.elementType === '基础要素' ? values.toolId : undefined,
        fieldId: values.elementType === '基础要素' ? values.fieldId : undefined,
        fieldLabel: values.elementType === '基础要素' ? fieldLabel : undefined,
        formula: values.elementType === '派生要素' ? values.formula : undefined,
      });

      // 处理“表单字段 -> 要素”的映射变更（持久化）
      const prevToolId = selectedElement.toolId;
      const prevFieldId = selectedElement.fieldId;
      const nextToolId = values.elementType === '基础要素' ? values.toolId : undefined;
      const nextFieldId = values.elementType === '基础要素' ? values.fieldId : undefined;

      // 如果之前存在映射，且本次更换/取消/类型变更，则删除旧映射
      if (prevToolId && prevFieldId) {
        const changed = prevToolId !== nextToolId || prevFieldId !== nextFieldId;
        if (changed) {
          await toolService.deleteFieldMapping(prevToolId, prevFieldId);
        }
      }

      // 如果本次为基础要素且提供了新映射，则保存/覆盖映射
      if (nextToolId && nextFieldId) {
        await toolService.addFieldMapping(nextToolId, nextFieldId, 'element', selectedElement.id);
      }

      const updatedElements = library.elements.map(el => {
        if (el.id === selectedElement.id) {
          return {
            ...el,
            code: values.code,
            name: values.name,
            elementType: values.elementType,
            dataType: values.dataType,
            formula: values.elementType === '派生要素' ? values.formula : undefined,
            toolId: values.elementType === '基础要素' ? values.toolId : undefined,
            fieldId: values.elementType === '基础要素' ? values.fieldId : undefined,
            fieldLabel: values.elementType === '基础要素' ? fieldLabel : undefined,
          };
        }
        return el;
      });

      const updatedElement = updatedElements.find(el => el.id === selectedElement.id);
      setLibrary({ ...library, elements: updatedElements });
      setSelectedElement(updatedElement || null);
      setEditModalVisible(false);
      setEditFormToolId(undefined);
      message.success('保存成功');
    } catch (error) {
      console.error('更新要素失败:', error);
      message.error('更新要素失败');
    }
  };

  const handleDeleteElement = (elementId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除该要素吗？删除后无法恢复。',
      okText: '确定',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        if (!library) return;

        try {
          await toolService.deleteElement(elementId);

          const updatedElements = library.elements.filter(el => el.id !== elementId);
          setLibrary({
            ...library,
            elements: updatedElements,
            elementCount: updatedElements.length,
          });

          if (selectedElement?.id === elementId) {
            setSelectedElement(null);
          }

          message.success('删除成功');
        } catch (error) {
          console.error('删除要素失败:', error);
          message.error('删除要素失败');
        }
      },
    });
  };

  const handleSaveLibrary = async () => {
    if (!library || !id) return;

    try {
      await toolService.updateElementLibrary(id, {
        name: library.name,
        description: library.description,
      });
      message.success('要素库保存成功');
    } catch (error) {
      console.error('保存要素库失败:', error);
      message.error('保存要素库失败');
    }
  };

  // 智能匹配要素名称和表单字段
  const matchElementToField = (elementName: string, fields: FlattenedField[]): FlattenedField | null => {
    // 清理要素名称（去除单位等）
    const cleanName = elementName
      .replace(/（[^）]*）/g, '') // 去除括号内容如（万人）、（元）
      .replace(/\([^)]*\)/g, '')  // 去除英文括号内容
      .trim();

    // 策略1: 精确匹配
    const exactMatch = fields.find(f => f.label === elementName || f.label === cleanName);
    if (exactMatch) return exactMatch;

    // 策略2: 字段标签包含要素名
    const fieldContainsElement = fields.find(f =>
      f.label.includes(cleanName) || cleanName.includes(f.label)
    );
    if (fieldContainsElement) return fieldContainsElement;

    // 策略3: 关键词匹配（至少3个字符的公共子串）
    for (const field of fields) {
      const fieldLabel = field.label;
      // 检查是否有足够长的公共子串
      for (let len = Math.min(cleanName.length, fieldLabel.length); len >= 3; len--) {
        for (let i = 0; i <= cleanName.length - len; i++) {
          const substr = cleanName.substring(i, i + len);
          if (fieldLabel.includes(substr)) {
            return field;
          }
        }
      }
    }

    return null;
  };

  // 自动关联要素到表单控件
  const handleAutoLink = async () => {
    if (!library) return;

    // 收集所有需要的工具ID
    const toolIds = new Set<string>();
    library.elements.forEach(element => {
      if (element.elementType === '基础要素' && element.toolId && !element.fieldId) {
        toolIds.add(element.toolId);
      }
    });

    // 预加载所有需要的schema
    const loadingMsg = message.loading('正在加载表单字段...');
    try {
      await Promise.all(Array.from(toolIds).map(toolId => loadToolSchema(toolId)));
    } catch (error) {
      console.error('加载schema失败:', error);
    }
    loadingMsg();

    let linkedCount = 0;
    let alreadyLinkedCount = 0;
    let noMatchCount = 0;

    const updatedElements = library.elements.map(element => {
      // 只处理基础要素且有toolId的
      if (element.elementType !== '基础要素' || !element.toolId) {
        return element;
      }

      // 已经关联的跳过
      if (element.fieldId) {
        alreadyLinkedCount++;
        return element;
      }

      // 获取该工具的表单字段
      const schema = formSchemas[element.toolId];
      if (!schema) {
        noMatchCount++;
        return element;
      }

      const fields = flattenFormFields(schema);
      const matchedField = matchElementToField(element.name, fields);

      if (matchedField) {
        linkedCount++;
        return {
          ...element,
          fieldId: matchedField.id,
          fieldLabel: matchedField.path,
        };
      } else {
        noMatchCount++;
        return element;
      }
    });

    setLibrary({ ...library, elements: updatedElements });

    // 更新选中的要素（如果有的话）
    if (selectedElement) {
      const updated = updatedElements.find(el => el.id === selectedElement.id);
      if (updated) setSelectedElement(updated);
    }

    message.success(
      `自动关联完成：成功关联 ${linkedCount} 个，已关联 ${alreadyLinkedCount} 个，未匹配 ${noMatchCount} 个`
    );
  };

  if (!library) {
    return <div className={styles.elementEditPage}>加载中...</div>;
  }

  return (
    <div className={styles.elementEditPage}>
      {/* 页面头部 */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <span className={styles.backBtn} onClick={() => navigate(-1)}>
            <ArrowLeftOutlined /> 返回
          </span>
          <h1 className={styles.pageTitle}>编辑评估要素</h1>
        </div>
        <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveLibrary}>
          保存要素库
        </Button>
      </div>

      {/* 要素库信息卡片 */}
      <div className={styles.libraryInfoCard}>
        <div className={styles.libraryInfoHeader}>
          <div className={styles.libraryInfoLeft}>
            <span className={styles.libraryName}>{library.name}</span>
            <Tag className={styles.statusTag}>{library.status}</Tag>
          </div>
          <span className={styles.elementCount}>{library.elementCount}个要素</span>
        </div>
        <p className={styles.libraryDescription}>{library.description}</p>
      </div>

      {/* 主内容区域 */}
      <div className={styles.mainContent}>
        {/* 左侧要素列表 */}
        <div className={styles.elementListSection}>
          <div className={styles.sectionHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <h3 style={{ margin: 0 }}>要素列表</h3>
              <Radio.Group
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                size="small"
                optionType="button"
                buttonStyle="solid"
              >
                <Radio.Button value="all">全部</Radio.Button>
                <Radio.Button value="unlinked">
                  未关联 {unlinkedCount > 0 && <span style={{ color: '#faad14' }}>({unlinkedCount})</span>}
                </Radio.Button>
                <Radio.Button value="linked">已关联</Radio.Button>
              </Radio.Group>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button icon={<ThunderboltOutlined />} onClick={handleAutoLink}>
                自动关联
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddElement}>
                添加要素
              </Button>
            </div>
          </div>

          <div className={styles.elementList}>
            {filteredElements.map(element => {
              // 判断是否为未关联的基础要素
              const isUnlinked = element.elementType === '基础要素' && element.toolId && !element.fieldId;
              return (
              <div
                key={element.id}
                className={`${styles.elementItem} ${selectedElement?.id === element.id ? styles.selected : ''} ${isUnlinked ? styles.unlinkedElement : ''}`}
                onClick={() => handleSelectElement(element)}
              >
                <div className={styles.elementMain}>
                  <Tag className={styles.elementCode}>{element.code}</Tag>
                  <span className={styles.elementName}>{element.name}</span>
                  <Tag
                    className={`${styles.elementTypeTag} ${element.elementType === '派生要素' ? styles.derived : styles.base}`}
                  >
                    {element.elementType}
                  </Tag>
                  <span className={styles.elementDataType}># {element.dataType}</span>
                  {element.elementType === '基础要素' && element.toolId && (
                    <LinkOutlined
                      className={element.fieldId ? styles.linkedIcon : styles.unlinkedIcon}
                      title={element.fieldId ? `已关联: ${element.fieldLabel}` : '未关联表单控件'}
                    />
                  )}
                </div>
                {element.fieldLabel && (
                  <div className={styles.elementFieldLink}>
                    <FormOutlined />
                    <span>{element.fieldLabel}</span>
                  </div>
                )}
                {element.formula && (
                  <div className={styles.elementFormula}>
                    <FileTextOutlined />
                    <span>{element.formula}</span>
                  </div>
                )}
                <div className={styles.elementActions}>
                  <EditOutlined
                    className={styles.actionIcon}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditElement(element);
                    }}
                  />
                  <DeleteOutlined
                    className={`${styles.actionIcon} ${styles.danger}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteElement(element.id);
                    }}
                  />
                </div>
              </div>
            );
            })}

            {filteredElements.length === 0 && (
              <div className={styles.emptyState}>
                {library.elements.length === 0
                  ? '暂无要素，请点击"添加要素"开始创建'
                  : filterType === 'unlinked'
                    ? '没有未关联的要素'
                    : filterType === 'linked'
                      ? '没有已关联的要素'
                      : '暂无要素'}
              </div>
            )}
          </div>
        </div>

        {/* 右侧要素属性面板 */}
        <div className={styles.elementPropertiesSection}>
          <h3>要素属性</h3>
          {selectedElement ? (
            <div className={styles.propertiesContent}>
              <div className={styles.propertyItem}>
                <label>要素编码</label>
                <span className={styles.propertyValue}>{selectedElement.code}</span>
              </div>
              <div className={styles.propertyItem}>
                <label>要素名称</label>
                <span className={styles.propertyValue}>{selectedElement.name}</span>
              </div>
              <div className={styles.propertyItem}>
                <label>要素类型</label>
                <Tag
                  className={`${styles.elementTypeTag} ${selectedElement.elementType === '派生要素' ? styles.derived : styles.base}`}
                >
                  {selectedElement.elementType}
                </Tag>
              </div>
              <div className={styles.propertyItem}>
                <label>数据类型</label>
                <span className={styles.propertyValue}>{selectedElement.dataType}</span>
              </div>
              {selectedElement.formula && (
                <div className={styles.propertyItem}>
                  <label>计算公式</label>
                  <div className={styles.formulaDisplay}>{selectedElement.formula}</div>
                </div>
              )}
              <div className={styles.propertyItem}>
                <label>关联采集工具</label>
                {selectedElement.toolId ? (
                  <div className={styles.toolLinkDisplay}>
                    <LinkOutlined className={styles.toolLinkIcon} />
                    <span className={styles.toolLinkName}>
                      {dataTools.find(t => t.id === selectedElement.toolId)?.name || '未知工具'}
                    </span>
                  </div>
                ) : (
                  <span className={styles.noToolLink}>未关联</span>
                )}
              </div>
              {selectedElement.toolId && (
                <div className={styles.propertyItem}>
                  <label>关联表单控件</label>
                  {selectedElement.fieldId ? (
                    <div className={styles.fieldLinkDisplay}>
                      <FormOutlined className={styles.fieldLinkIcon} />
                      <span className={styles.fieldLinkName}>
                        {selectedElement.fieldLabel || selectedElement.fieldId}
                      </span>
                    </div>
                  ) : (
                    <span className={styles.noToolLink}>未关联控件</span>
                  )}
                </div>
              )}

              <div className={styles.propertiesActions}>
                <Button
                  block
                  icon={<EditOutlined />}
                  onClick={() => handleEditElement(selectedElement)}
                >
                  编辑要素
                </Button>
                <Button
                  block
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDeleteElement(selectedElement.id)}
                >
                  删除要素
                </Button>
              </div>
            </div>
          ) : (
            <div className={styles.emptyProperties}>
              <FileTextOutlined className={styles.emptyIcon} />
              <span>选择一个要素查看详情</span>
            </div>
          )}
        </div>
      </div>

      {/* 添加要素弹窗 */}
      <Modal
        title="添加要素"
        open={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        footer={null}
        width={500}
        className={styles.elementModal}
      >
        <p className={styles.modalSubtitle}>创建一个新的评估要素</p>
        <Form form={addForm} onFinish={handleSaveAdd} layout="vertical">
          <div className={styles.formRowInline}>
            <Form.Item
              label="要素编码"
              name="code"
              rules={[{ required: true, message: '请输入要素编码' }]}
              className={styles.formItemHalf}
            >
              <Input placeholder="如：E001" />
            </Form.Item>
            <Form.Item
              label="要素名称"
              name="name"
              rules={[{ required: true, message: '请输入要素名称' }]}
              className={styles.formItemHalf}
            >
              <Input placeholder="如：学生总数" />
            </Form.Item>
          </div>
          <div className={styles.formHint}>建议使用字母+数字组合</div>

          <div className={styles.formRowInline}>
            <Form.Item
              label="要素类型"
              name="elementType"
              rules={[{ required: true, message: '请选择要素类型' }]}
              initialValue="基础要素"
              className={styles.formItemHalf}
            >
              <Select onChange={(value) => setAddFormElementType(value as ElementType)}>
                <Select.Option value="基础要素">基础要素</Select.Option>
                <Select.Option value="派生要素">派生要素</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item
              label="数据类型"
              name="dataType"
              rules={[{ required: true, message: '请选择数据类型' }]}
              initialValue="文本"
              className={styles.formItemHalf}
            >
              <Select>
                <Select.Option value="文本">文本</Select.Option>
                <Select.Option value="数字">数字</Select.Option>
                <Select.Option value="日期">日期</Select.Option>
                <Select.Option value="时间">时间</Select.Option>
                <Select.Option value="逻辑">逻辑</Select.Option>
                <Select.Option value="数组">数组</Select.Option>
                <Select.Option value="文件">文件</Select.Option>
              </Select>
            </Form.Item>
          </div>
          <div className={styles.formHint}>
            {addFormElementType === '基础要素' ? '直接采集的数据' : '通过计算得出的数据'}
          </div>

          {addFormElementType === '派生要素' && (
            <>
              <Form.Item
                label="计算公式"
                name="formula"
                rules={[{ required: true, message: '请输入计算公式' }]}
              >
                <Input placeholder="如：E003 / E004（使用要素编码进行计算）" />
              </Form.Item>
              <div className={styles.formHint}>使用要素编码和运算符（+ - * /）编写公式，支持括号</div>
            </>
          )}

          {addFormElementType === '基础要素' && (
            <>
              <Form.Item
                label="关联采集工具"
                name="toolId"
              >
                <Select
                  placeholder="请选择数据采集工具"
                  allowClear
                  onChange={handleAddToolChange}
                >
                  {dataTools.map(tool => (
                    <Select.Option key={tool.id} value={tool.id}>
                      {tool.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <div className={styles.formHint}>选择用于采集此要素数据的工具</div>

              {addFormToolId && addFormFields.length > 0 && (
                <>
                  <Form.Item
                    label="关联表单控件"
                    name="fieldId"
                  >
                    <Select placeholder="请选择表单控件" allowClear showSearch optionFilterProp="children">
                      {addFormFields.map(field => (
                        <Select.Option key={field.id} value={field.id}>
                          {field.path}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                  <div className={styles.formHint}>选择工具表单中要关联的具体控件</div>
                </>
              )}
            </>
          )}

          <Form.Item style={{ marginBottom: 0, textAlign: 'right', marginTop: 24 }}>
            <Button style={{ marginRight: 8 }} onClick={() => setAddModalVisible(false)}>
              取消
            </Button>
            <Button type="primary" htmlType="submit">
              添加
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑要素弹窗 */}
      <Modal
        title="编辑要素"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        footer={null}
        width={500}
        className={styles.elementModal}
      >
        <p className={styles.modalSubtitle}>修改评估要素的属性信息</p>
        <Form form={editForm} onFinish={handleSaveEdit} layout="vertical">
          <div className={styles.formRowInline}>
            <Form.Item
              label="要素编码"
              name="code"
              rules={[{ required: true, message: '请输入要素编码' }]}
              className={styles.formItemHalf}
            >
              <Input placeholder="如：E001" />
            </Form.Item>
            <Form.Item
              label="要素名称"
              name="name"
              rules={[{ required: true, message: '请输入要素名称' }]}
              className={styles.formItemHalf}
            >
              <Input placeholder="如：学生总数" />
            </Form.Item>
          </div>
          <div className={styles.formHint}>建议使用字母+数字组合</div>

          <div className={styles.formRowInline}>
            <Form.Item
              label="要素类型"
              name="elementType"
              rules={[{ required: true, message: '请选择要素类型' }]}
              className={styles.formItemHalf}
            >
              <Select onChange={(value) => setEditFormElementType(value as ElementType)}>
                <Select.Option value="基础要素">基础要素</Select.Option>
                <Select.Option value="派生要素">派生要素</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item
              label="数据类型"
              name="dataType"
              rules={[{ required: true, message: '请选择数据类型' }]}
              className={styles.formItemHalf}
            >
              <Select>
                <Select.Option value="文本">文本</Select.Option>
                <Select.Option value="数字">数字</Select.Option>
                <Select.Option value="日期">日期</Select.Option>
                <Select.Option value="时间">时间</Select.Option>
                <Select.Option value="逻辑">逻辑</Select.Option>
                <Select.Option value="数组">数组</Select.Option>
                <Select.Option value="文件">文件</Select.Option>
              </Select>
            </Form.Item>
          </div>
          <div className={styles.formHint}>
            {editFormElementType === '基础要素' ? '直接采集的数据' : '通过计算得出的数据'}
          </div>

          {editFormElementType === '派生要素' && (
            <>
              <Form.Item
                label="计算公式"
                name="formula"
                rules={[{ required: true, message: '请输入计算公式' }]}
              >
                <Input placeholder="如：E003 / E004（使用要素编码进行计算）" />
              </Form.Item>
              <div className={styles.formHint}>使用要素编码和运算符（+ - * /）编写公式，支持括号</div>
            </>
          )}

          {editFormElementType === '基础要素' && (
            <>
              <Form.Item
                label="关联采集工具"
                name="toolId"
              >
                <Select
                  placeholder="请选择数据采集工具"
                  allowClear
                  onChange={handleEditToolChange}
                >
                  {dataTools.map(tool => (
                    <Select.Option key={tool.id} value={tool.id}>
                      {tool.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <div className={styles.formHint}>选择用于采集此要素数据的工具</div>

              {editFormToolId && editFormFields.length > 0 && (
                <>
                  <Form.Item
                    label="关联表单控件"
                    name="fieldId"
                  >
                    <Select placeholder="请选择表单控件" allowClear showSearch optionFilterProp="children">
                      {editFormFields.map(field => (
                        <Select.Option key={field.id} value={field.id}>
                          {field.path}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                  <div className={styles.formHint}>选择工具表单中要关联的具体控件</div>
                </>
              )}
            </>
          )}

          <Form.Item style={{ marginBottom: 0, textAlign: 'right', marginTop: 24 }}>
            <Button style={{ marginRight: 8 }} onClick={() => setEditModalVisible(false)}>
              取消
            </Button>
            <Button type="primary" htmlType="submit">
              保存
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default IndicatorEdit;
