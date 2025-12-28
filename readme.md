# koishi-plugin-mk3s-hcrm

[![npm](https://img.shields.io/npm/v/koishi-plugin-mk3s-hcrm?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-mk3s-hcrm)

一个用于 Koishi 的系统状态卡片生成插件。支持生成包含 CPU/RAM 使用率、时间、农历、一言等信息的精美卡片。

##  功能特性

- **双渲染引擎支持**：
  -  **Puppeteer**：基于浏览器渲染，效果精美，支持高级 CSS 特性（如毛玻璃特效）。
  -  **Satori**：基于 React 组件转 SVG，速度极快，资源占用低，无需浏览器环境。
- **丰富的信息展示**：
  - 实时 CPU 和 RAM 使用率及进度条。
  - 操作系统版本及 CPU 型号。
  - 当前日期、时间、农历日期。
  - 智能问候语（根据时间段和星期几变化）。
  - **一言 (Hitokoto)**：支持多种分类，每次刷新。
- **高度可定制**：
  - 自定义背景图片及来源标注。
  - 自定义字体（标题、正文、手写体）。
  - 自定义底部版权文字及布局（合并/分离模式）。
- **灵活的指令控制**：
  - 支持通过命令行参数临时切换渲染引擎。

##  依赖说明

- **必选依赖**：
  - \koishi\ (^4.18.0+)
- **可选依赖**（推荐）：
  - \koishi-plugin-puppeteer\：如果你想使用 Puppeteer 渲染模式（默认模式），需要安装并配置此插件。
- **内置依赖**：
  - \satori\, \satori-html\, \@resvg/resvg-js\：用于 Satori 渲染模式，已包含在插件依赖中。

##  使用方法

### 指令

插件提供 \hcrm\ 指令用于生成状态卡片。

\\\ash
hcrm [options]
\\\`n
### 选项参数

- \-p, --puppeteer\：强制使用 Puppeteer 引擎渲染本次请求。
- \-s, --satori\：强制使用 Satori 引擎渲染本次请求。
- \-k, --keep\：仅返回反馈信息（不进行渲染），用于测试连通性。

**示例**：
\\\ash
hcrm -s  # 使用 Satori 快速生成
hcrm -p  # 使用 Puppeteer 生成高清图
\\\`n
##  配置项

可以在 Koishi 控制台的插件配置页进行修改：

| 配置项 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| \enderMode\ | \puppeteer\ \| \satori\ | \puppeteer\ | 默认使用的渲染引擎。 |
| \ackgroundImage\ | \string\ | - | 背景图片路径。留空则使用内置默认背景。 |
| \ackgroundSource\ | \string\ | - | 背景图片的来源/版权信息，显示在卡片右下角。 |
| \ooterText\ | \string\ | \ 2025 狼狼\ | 卡片底部的版权文字。 |
| \ooterLayout\ | \combined\ \| \split\ | \combined\ | 底部文字布局模式。<br>\combined\: 文字与引擎标识合并居中。<br>\split\: 引擎标识在左下角，文字居中。 |
| \hitokotoType\ | \rray\ | \['a']\ | 一言的分类（动画、漫画、游戏等），支持多选。 |
| \eedbackMessage\ | \string\ | \successful\ | 使用 \-k\ 参数时的返回消息。 |
| \ontAnurati\ | \string\ | - | 标题字体路径 (Anurati)。 |
| \ontChiMing\ | \string\ | - | 正文字体路径 (赤明工业革命)。 |
| \ontZcool\ | \string\ | - | 手写字体路径 (站酷快乐体)。 |

##  开发与贡献

欢迎提交 Issue 和 Pull Request！

### 本地开发

1. 克隆仓库
2. 安装依赖：\
pm install\`n3. 编译代码：\
pm run build\`n
---

**License**: MIT
