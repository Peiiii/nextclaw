# v0.4.3 设计系统重构

## 迭代说明

参考"推理时代"等现代 SaaS 产品的设计风格，建立了一套完整一致的设计系统，并应用到 NextClaw UI 前端项目中。

## 设计要素提取

### 颜色系统

| Token | 值 | 用途 |
|-------|-----|------|
| `--primary` | `#2563EB` (HSL 217 80% 55%) | 品牌主色（蓝色） |
| `--background` | `#F8FAFC` (HSL 210 20% 98%) | 页面背景 |
| `--foreground` | `#0F172A` (HSL 221 39% 11%) | 主要文字 |
| `--gray-500` | `#6B7280` | 次要文字 |
| `--border` | `#E2E8F0` | 边框颜色 |
| `--card` | `#FFFFFF` | 卡片背景 |

### 设计特点

1. **干净简洁**：大量留白，内容清晰
2. **蓝色主色调**：专业、可信的品牌感
3. **圆角设计**：统一的 12px-16px 圆角
4. **微妙阴影**：轻度阴影增加层次感
5. **一致间距**：4px 基准的间距系统

## 文件变更

### 新增文件

- `src/styles/design-system.css` - 完整的设计系统变量定义

### 修改文件

#### UI 组件
- `src/components/ui/button.tsx` - 更新按钮样式，新增变体，使用蓝色主色
- `src/components/ui/card.tsx` - 更新卡片样式
- `src/components/ui/dialog.tsx` - 更新对话框样式
- `src/components/ui/input.tsx` - 更新输入框样式，移除 focus 边框高亮
- `src/components/ui/tabs.tsx` - 更新标签页样式
- `src/components/ui/tabs-custom.tsx` - 更新自定义标签样式，使用蓝色下划线
- `src/components/ui/switch.tsx` - 更新开关样式
- `src/components/ui/label.tsx` - 更新标签样式
- `src/components/ui/HighlightCard.tsx` - 更新高亮卡片样式

#### 布局组件
- `src/components/layout/Header.tsx` - 更新头部样式
- `src/components/layout/Sidebar.tsx` - 更新侧边栏样式，使用蓝色激活状态

#### 配置组件
- `src/components/config/ModelConfig.tsx` - 更新模型配置页面，按钮改为蓝色
- `src/components/config/ChannelsList.tsx` - 更新频道列表，按钮改为蓝色
- `src/components/config/ProvidersList.tsx` - 更新提供商列表，按钮改为蓝色
- `src/components/config/ProviderForm.tsx` - 更新提供商表单，统一样式
- `src/components/config/ChannelForm.tsx` - 更新频道表单，统一样式

#### 通用组件
- `src/components/common/StatusBadge.tsx` - 更新状态徽章样式

#### 样式配置
- `src/index.css` - 整合设计系统，更新 CSS 变量
- `tailwind.config.js` - 扩展 Tailwind 配置，添加设计系统颜色和动画

## 主要变更说明

### 移除黑色背景按钮
将所有使用 `bg-[hsl(30,15%,10%)]`（深棕色/近黑色）的按钮改为：
- 主要按钮：使用 `bg-primary`（蓝色）
- 次要按钮：使用 `variant="ghost"` 或 `variant="secondary"`

### 移除输入框 Focus 边框高亮
- 移除 `focus-visible:ring-2` 和 `focus-visible:ring-primary` 效果
- 改为仅改变边框颜色 `focus:border-gray-400`
- 保持简洁的视觉反馈

### 统一颜色系统
- 所有主要操作按钮使用蓝色 (`primary`)
- 所有边框使用 `gray-200`
- 所有文字使用 `gray-900`（标题）和 `gray-500`（正文）
- 激活状态使用蓝色指示器

## 验证方式

```bash
# 构建项目
cd packages/nextclaw-ui && npm run build

# 代码检查
npm run lint
```

## 发布方式

设计系统已整合到前端构建中，随前端版本一起发布。

```bash
# 构建并复制到 CLI 包
cd packages/nextclaw-ui
npm run build

# 复制构建产物
cp -r dist/* ../nextclaw/ui-dist/
```
