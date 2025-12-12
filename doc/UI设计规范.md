# 教育督导系统 - UI设计规范

> 本文档用于项目创建时的提示词，确保UI风格一致性。

## 技术栈

- **框架**: React 19 + TypeScript 4.9
- **UI组件库**: Ant Design v6.1.0 (antd)
- **图标库**: @ant-design/icons v6.1.0
- **拖拽库**: @dnd-kit
- **样式方案**: CSS Modules (.module.css)
- **国际化**: Ant Design 中文语言包 (zh_CN)

---

## 颜色体系

### 主色调 - 蓝色系

| 变量名 | 色值 | 用途 |
|--------|------|------|
| --primary | #1890ff | 主色 |
| --primary-hover | #40a9ff | 悬停状态 |
| --primary-bg | #e6f4ff | 选中背景 |
| --primary-light-bg | #f0f7ff | 淡背景 |

### 功能色

| 变量名 | 色值 | 用途 |
|--------|------|------|
| --success | #52c41a | 成功/绿色 |
| --warning | #fa8c16 | 警告/橙色 |
| --danger | #ff4d4f | 危险/红色 |
| --purple | #722ed1 | 紫色/标签 |
| --cyan | #13c2c2 | 青色/图片 |

### 中性色

| 变量名 | 色值 | 用途 |
|--------|------|------|
| --bg-white | #fff | 卡片背景 |
| --bg-page | #f5f7fa | 页面背景 |
| --bg-section | #fafafa | 区块背景 |
| --border | #e8e8e8 | 边框 |
| --border-light | #f0f0f0 | 浅边框 |
| --text-primary | #333 | 主文字 |
| --text-secondary | #666 | 次要文字 |
| --text-tertiary | #999 | 辅助文字 |
| --text-placeholder | #d9d9d9 | 占位符 |

---

## 字体规范

### 字体堆栈

```css
/* 正文字体 */
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
             'Helvetica Neue', Arial, sans-serif;

/* 代码字体 */
font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New', monospace;
```

### 字体大小

| 级别 | 大小 | 用途 |
|------|------|------|
| --font-xxl | 28px | 登录页标题 |
| --font-xl | 18px | 页面标题 |
| --font-lg | 16px | 卡片标题、表单标题 |
| --font-md | 14px | 正文、按钮、表单内容 |
| --font-sm | 13px | 配置项、属性面板 |
| --font-xs | 12px | 标签、元数据、辅助信息 |

### 字体粗细

| 级别 | 值 | 用途 |
|------|------|------|
| --font-weight-bold | 600 | 大标题、页面标题 |
| --font-weight-medium | 500 | 小标题、卡片标题 |
| --font-weight-normal | 400 | 正文、描述文字 |

---

## 间距规范

### 基础间距（单位: 8px）

| 变量名 | 值 | 用途 |
|--------|------|------|
| --spacing-xs | 4px | 图标间距、字段间距 |
| --spacing-sm | 8px | 元素间最小间距 |
| --spacing-md | 12px | 卡片内间距、列表间距 |
| --spacing-lg | 16px | 页面内容间距、卡片间距 |
| --spacing-xl | 20px | 大卡片填充 |
| --spacing-xxl | 24px | 页面填充、主要分区间距 |
| --spacing-xxxl | 32px | 大标题下方间距 |

### 边框圆角

| 变量名 | 值 | 用途 |
|--------|------|------|
| --radius-sm | 4px | 标签、小框 |
| --radius-md | 6px | 配置卡片、内嵌框 |
| --radius-lg | 8px | 卡片、按钮 |
| --radius-xl | 12px | 登录卡片 |

---

## 布局规范

### 主布局结构

```
┌─────────────────────────────────────────────┐
│  Header (56px)                              │
├──────────────┬──────────────────────────────┤
│  Sider       │  Content                     │
│  (200px)     │  bg: #f5f7fa                 │
│  collapsed   │  padding: 24px               │
│  theme:light │  min-height: calc(100vh-56px)│
└──────────────┴──────────────────────────────┘
```

### 侧边栏样式

- 宽度: 200px（展开），<60px（折叠）
- 背景: 白色 (#fff)
- Logo 高度: 56px
- 菜单项: 4px 8px margin，6px 边框圆角
- 选中状态: #e6f4ff 背景
- 阴影: 2px 0 8px rgba(0, 0, 0, 0.05)

### 顶部导航栏

- 高度: 56px
- 背景: 白色
- 内容对齐: 右对齐
- 阴影: 0 2px 8px rgba(0, 0, 0, 0.05)

### 内容区域

- 背景: #f5f7fa
- 填充: 24px
- 最小高度: calc(100vh - 56px)

### 页面内容结构

```css
/* 页面头部 */
.pageHeader {
  background: #fff;
  padding: 16px 24px;
  margin-bottom: 24px;
  border-radius: 8px;
}

/* 卡片样式 */
.card {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  border-left: 4px solid #1890ff;  /* 强调边框 */
}

/* 卡片头部 */
.cardHeader {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

/* 卡片操作区 */
.cardActions {
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}
```

### 网格布局

```css
/* 2列网格 - 模块卡片 */
.moduleGrid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  max-width: 800px;
}

/* 4列网格 - 表单设计器 */
.formFields {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  align-items: start;
}

/* 自适应网格 - 工具卡片 */
.toolCards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 16px;
}
```

### 三栏布局（编辑器）

```
┌───────────┬─────────────────────┬──────────────┐
│ 控件库    │ 表单设计区域        │ 属性面板     │
│ 240px     │ flex: 1             │ 280px        │
└───────────┴─────────────────────┴──────────────┘
```

---

## 组件设计模式

### 文件组织结构

```
frontend/src/
├── styles/
│   └── global.css          # 全局样式、utility 类
├── layouts/
│   ├── MainLayout.tsx
│   └── MainLayout.module.css
├── pages/
│   └── [PageName]/
│       ├── index.tsx
│       └── index.module.css
└── components/
    └── [ComponentName]/
        ├── index.tsx
        └── index.module.css
```

### CSS Module 命名规范

```css
/* 使用 camelCase 命名 */
.pageContainer { }
.pageHeader { }
.headerLeft { }
.headerRight { }
.cardTitle { }
.cardContent { }
.actionBtn { }
.formFieldItem { }

/* 状态类 */
.selected { }
.disabled { }
.dragging { }
.loading { }

/* 图标颜色类 */
.fileIconPdf { color: #ff4d4f; }
.fileIconWord { color: #1890ff; }
.fileIconExcel { color: #52c41a; }
```

### 组件 Props 接口模式

```typescript
interface Props {
  visible: boolean;
  onCancel: () => void;
  onSelect?: (data: any) => void;
  readonly?: boolean;
}

const Component: React.FC<Props> = ({
  visible,
  onCancel,
  onSelect,
  readonly = false,
}) => {
  // 组件逻辑
};
```

### 数据加载模式

```typescript
const [loading, setLoading] = useState(false);
const [data, setData] = useState<DataType[]>([]);

const loadData = useCallback(async () => {
  setLoading(true);
  try {
    const data = await apiService.getData();
    setData(data);
  } catch (error) {
    message.error('加载失败');
  } finally {
    setLoading(false);
  }
}, []);

useEffect(() => {
  if (visible) {
    loadData();
  }
}, [visible, loadData]);
```

---

## 交互状态

### 按钮状态

```css
/* 默认按钮 */
.btn {
  background: #fff;
  border: 1px solid #d9d9d9;
  color: #333;
}

.btn:hover {
  border-color: #1890ff;
  color: #1890ff;
}

/* 主要按钮 */
.btnPrimary {
  background: #4a5568;
  border-color: #4a5568;
  color: #fff;
}

.btnPrimary:hover {
  background: #2d3748;
  border-color: #2d3748;
}

/* 危险按钮 */
.btnDanger:hover {
  color: #ff4d4f;
}
```

### 卡片交互

```css
/* 默认卡片 */
.card {
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  transition: all 0.2s;
}

/* 悬停效果 */
.card:hover {
  border-color: #1890ff;
  box-shadow: 0 2px 8px rgba(24, 144, 255, 0.1);
}

/* 选中效果 */
.card.selected {
  border-color: #1890ff;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
}
```

### 拖拽交互

```css
/* 可拖拽项 */
.draggable {
  cursor: grab;
  user-select: none;
}

.draggable:active {
  cursor: grabbing;
}

/* 拖拽时 */
.dragging {
  opacity: 0.5;
  border-style: dashed;
  transform: scale(0.95);
}

/* 放置指示器 */
.dropIndicator {
  height: 4px;
  background: #1890ff;
  border-radius: 2px;
}
```

---

## 图标使用

### 文件类型图标色彩

| 类型 | 图标组件 | 颜色 |
|------|----------|------|
| PDF | FilePdfOutlined | #ff4d4f |
| Word | FileWordOutlined | #1890ff |
| Excel | FileExcelOutlined | #52c41a |
| PPT | FilePptOutlined | #fa8c16 |
| ZIP | FileZipOutlined | #722ed1 |
| 图片 | FileImageOutlined | #13c2c2 |
| 默认 | FileOutlined | #999 |

### 图标大小规范

| 用途 | 大小 |
|------|------|
| 菜单图标 | 16px |
| 操作按钮图标 | 14px |
| 模块卡片图标 | 24px |
| 文件图标 | 32px |

### 常用图标

```typescript
import {
  HomeOutlined,        // 首页
  SettingOutlined,     // 设置
  UserOutlined,        // 用户
  LogoutOutlined,      // 退出
  PlusOutlined,        // 新增
  DeleteOutlined,      // 删除
  EditOutlined,        // 编辑
  EyeOutlined,         // 预览
  DownloadOutlined,    // 下载
  UploadOutlined,      // 上传
  ArrowLeftOutlined,   // 返回
} from '@ant-design/icons';
```

---

## 响应式设计

### 断点定义

```css
/* 移动端 */
@media (max-width: 576px) {
  /* 单列布局 */
}

/* 平板 */
@media (max-width: 768px) {
  .moduleGrid {
    grid-template-columns: 1fr;
  }
}

/* 小屏桌面 */
@media (max-width: 900px) {
  /* 多列 -> 单列 */
}
```

### 响应式模式

```css
/* Flex 弹性布局 */
.headerActions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

/* Grid 自适应 */
.toolCards {
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
}

/* 最大宽度约束 */
.content {
  max-width: 1200px;
  margin: 0 auto;
}
```

---

## 常用 Ant Design 组件

### 布局类

- `Layout` - 页面布局（Header, Sider, Content）
- `Menu` - 导航菜单
- `Card` - 卡片容器
- `Space` - 间距组件

### 表单类

- `Form` - 表单
- `Input` - 文本输入
- `Select` - 下拉选择
- `DatePicker` - 日期选择

### 数据展示

- `Table` - 数据表格
- `Tree` - 树形结构
- `Tabs` - 选项卡
- `Tag` - 标签
- `Badge` - 徽章

### 反馈类

- `Modal` - 对话框
- `message` - 全局提示
- `Spin` - 加载旋转
- `Empty` - 空状态
- `Progress` - 进度条

### 其他

- `Button` - 按钮
- `Upload` - 文件上传
- `Tooltip` - 工具提示

---

## 设计原则

1. **简洁性**: 清晰的信息层级，避免视觉混乱
2. **一致性**: 统一的颜色、间距、排版规范
3. **可用性**: 充分的交互反馈和状态指示
4. **可访问性**: 充分的对比度、清晰的焦点指示
5. **响应式**: 支持多设备自适应显示
6. **避免过度设计**: 只做必要的修改，不添加多余功能
