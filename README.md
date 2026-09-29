# 网页在线编辑器

基于 [轻页 AirPage](https://github.com/quqxui/air-html-editor) 增强的**本地 HTML 可视化编辑器**。

用 Chrome / Edge 打开即可编辑本地网页：点选布局、WPS 式排版、多标签、复制粘贴，以及微信公众号 SingleFile 导出清理。**纯前端、不上传服务器。**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-html--online--editor-181717?logo=github)](https://github.com/yk2408162174/html-online-editor)

---

## 特性

- **本地单文件**：打开 `editor.html` 即可，无需构建与后端
- **多标签编辑**：同时打开多个 HTML，标签切换；未保存更改有提示
- **双编辑模式**：组件（点选 / 拖拽 / 缩放）与文字（光标输入 / 排版）一键切换
- **WPS 式功能区**：开始 / 插入 / 文档 三页，覆盖字体、对齐、列表、媒体与文档拷贝
- **多格式导出**：HTML、Markdown、纯文本、PDF（打印另存）
- **微信文章清理**：浏览器内清理 SingleFile 导出；可选 Python 命令行脚本
- **File System Access**：Chrome / Edge 可直接写回原文件

---

## 快速开始

### 1. 获取项目

```bash
git clone https://github.com/yk2408162174/html-online-editor.git
cd html-online-editor
```

或直接下载 [ZIP](https://github.com/yk2408162174/html-online-editor/archive/refs/heads/master.zip) 并解压。

### 2. 打开编辑器

用 **Chrome** 或 **Edge** 打开同目录下的：

```
editor.html
```

请保持 `editor.html` 与 `wechat-clean.js` 在同一文件夹（清理功能依赖后者）。

### 3. 开始编辑

1. **打开文件** / 拖入 HTML，或点 **新建** / **载入示例**
2. 顶部切换 **组件** / **文字**（也可用 `Tab`）
3. `Ctrl+S`（macOS：`⌘S`）保存 HTML；`Ctrl+Shift+S` 另存为其他格式

---

## 编辑模式

| 模式 | 用途 | 操作要点 |
|------|------|----------|
| **组件** | 改布局与结构 | 点选、拖拽换位、缩放手柄、父级/子级、复制/删除 |
| **文字** | 改文案与排版 | 点击落光标或新建段落；功能区与浮动工具栏排版 |
| **浏览** | 试用页面交互 | 放行页面自身点击；按住 `Alt` 点击亦可临时浏览 |

组件模式下双击文字块会自动切到文字模式。`Esc`：退出编辑 / 切回组件 / 取消选中。

---

## 功能区

### 开始（文字 / 段落）

- 标题样式、字体、字号、颜色、高亮
- 加粗 / 斜体 / 下划线 / 删除线 / 上标 / 下标
- 对齐、行距、项目符号 / 编号、缩进
- 插入或取消链接、清除格式

### 插入（媒体 / 内容）

- 本地图片 / 视频 / 音频（写入 data URL，建议单文件 &lt; 12MB）
- 媒体 URL、段落、段落分割、分隔线、表格、代码块

### 文档（跨页复制）

1. 打开源 HTML → **复制正文**（或复制选中 / 整页）
2. **新建空白** 或打开目标页
3. **粘贴内容…** → 追加文末 / 插入选中后 / 替换正文 / 粘贴到新文档  
   也可 **从文件导入**，或从系统剪贴板粘贴  
4. **显示空白**：高亮无文字、无媒体的空白组件，便于点选清理

---

## 保存与导出

点击 **保存** 旁的 **▾** 选择格式：

| 格式 | 说明 |
|------|------|
| **HTML** | 完整网页（默认可再次编辑） |
| **Markdown** | 标题、列表、链接、图片等常见结构 |
| **纯文本** | 仅正文文字 |
| **PDF** | 打开系统打印对话框 →「另存为 PDF」 |

有写回权限时，`Ctrl+S` 会写回当前标签对应的本地文件。

---

## 微信文章清理

针对微信公众号 **SingleFile** 导出：去掉 chrome 壳、冗余属性，内联样式，便于再编辑。

顶部 **清理微信** 提供三种方式：

| 方式 | 说明 |
|------|------|
| 清理当前文档 | 对已打开的 HTML 就地清理 |
| 选择文章文件夹并清理 | 写回 `index.html`、备份 `.bak`、删除无用图与 css/partials（需授权文件夹） |
| 打开 HTML 文件并清理 | 选单个导出文件，清理后载入编辑器 |

可选保留：**原创/作者/时间**、**底栏**、**合集导航**。

### 命令行（可选）

与浏览器清理同逻辑，适合批量处理：

```bash
pip install beautifulsoup4 lxml
py scripts/clean.py 路径/到/文章文件夹
```

常用参数：

```bash
py scripts/clean.py 文章目录 --keep-meta      # 保留元信息
py scripts/clean.py 文章目录 --keep-bottom    # 保留底栏
py scripts/clean.py 文章目录 --keep-album     # 保留合集导航
```

---

## 快捷键

> macOS 将 `Ctrl` 换为 `⌘`。

| 快捷键 | 作用 |
|--------|------|
| `Ctrl+S` | 保存当前标签为 HTML |
| `Ctrl+Shift+S` | 另存为（多格式） |
| `Ctrl+Z` | 撤销 |
| `Ctrl+Y` / `Ctrl+Shift+Z` | 重做 |
| `Tab` | 组件 ↔ 文字模式 |
| `Esc` | 退出文字编辑 / 浏览模式 / 取消选中 |
| `Ctrl+B` / `I` / `U` | 加粗 / 斜体 / 下划线（文字相关） |
| `Ctrl+D` | 复制选中组件 |
| `Ctrl+V` | 粘贴组件（组件模式、非编辑文字时） |
| `Delete` / `Backspace` | 删除选中组件 |
| `方向键` | 微调位置（`Shift` 步进 10px） |
| `Alt` + 点击 | 临时浏览页面自身交互 |

---

## 浏览器要求

| 能力 | 建议环境 |
|------|----------|
| 基本编辑 | 现代 Chromium 内核浏览器 |
| 写回原文件 / 文件夹清理 | **Chrome** 或 **Edge**（File System Access API） |
| Firefox / Safari | 可打开编辑；保存多为下载，文件夹级清理可能不可用 |

---

## 目录结构

```
html-online-editor/
├── editor.html            # 主界面（打开即可用）
├── wechat-clean.js        # 浏览器内微信清理（editor 依赖）
├── scripts/
│   └── clean.py           # 同逻辑命令行清理
├── airpage-original.html  # 上游 AirPage 原版备份
├── LICENSE                # MIT
└── README.md
```

---

## 与上游的关系

本项目在 [quqxui/air-html-editor](https://github.com/quqxui/air-html-editor)（轻页 AirPage）基础上增强，主要包括：

- WPS 风格功能区与文字排版
- 多标签与文档级复制粘贴
- 媒体插入与多格式导出
- 微信 SingleFile 清理（浏览器 + Python）

上游原版保存在 `airpage-original.html`，便于对照。

---

## 贡献

欢迎 Issue / PR：缺陷修复、文档改进、功能建议均可。提交前请用 Chrome / Edge 本地打开 `editor.html` 自测主要流程（打开 → 编辑 → 保存 / 清理）。

---

## License

[MIT](LICENSE) © 本仓库贡献者

上游 AirPage 亦为 MIT（© quqxui）。在衍生与分发时请保留相应版权与许可声明。
