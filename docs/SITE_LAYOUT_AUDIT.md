# 旦生计划官网布局审计

审计对象：`apps/site` 第二轮版本  
审计视口：1280 × 720（浏览器内容宽度 1265px）  
审计原则：本文件记录修改前基线；所有数量均来自实际路由渲染与样式扫描。

## 全站基线

- 路由：14 个可访问路径模板，另有通配 404；当前缺少 `/support`。
- 首页：15 个主要 Section、21 张图片、13 个接近或超过一屏高度的 Section、14 个满宽 Section。
- 产品详情：11 个主要 Section、11 张图片、10 个接近或超过一屏高度的 Section、1 个 sticky 故事模块。
- CSS 全屏规则：`100svh`/`100vh` 直接用于首页 Hero、3 个产品故事、首页终章、产品 Hero、产品整机、产品场景、sticky 视觉、404 等。
- Sticky：实际渲染共 2 处——首页技术叙事 1 处、产品详情技术叙事 1 处。
- Parallax：没有独立滚动计算，但 6 类持续缩放、扫描或位移动画营造了类似滚动联动的持续运动感；首页同时存在大量图片 hover scale。
- 动画体系：6 个关键帧/持续动画用途（Hero scale、文字 rise、滚动提示、扫描线等）及通用 IntersectionObserver reveal。首页首屏可同时检测到 4 个运行中动画。
- 容器问题：虽然存在 1280px token，但大量新版 Section 直接使用 100% 宽度；旧版与新版 CSS 并存，形成两套间距、字号和卡片规则。
- 核心原因：强视觉连续出现、Section 高度由视口而非内容决定、产品/新闻/About 共用宣传片式语法、页面职责缺少差异。

## Route 审计与修改计划

| Route | 当前 Section / 高度基线 | 图片 | 当前 Layout | 主要问题 | 修改计划 |
| --- | --- | ---: | --- | --- | --- |
| `/` | 15；720、590、720×3、662、2074、2290、662、1914、1547、132、662、1608、720px | 21 | 连续沉浸式视觉 | 13 段接近/超过一屏，Hero 后连续 3 个全屏产品，技术、场景、Cloud、News 都过长 | 收敛到 8 段：Hero、产品选择、精选产品×2、技术、About、News、CTA；仅 Hero 保留全屏 |
| `/products` | 4；532、720×3px | 3 | 产品发布式列表 | 三个产品各占一屏，缺少总览效率 | 改为普通 Page Hero + 统一比例产品 Grid/列表 |
| `/products/:slug` | 11；720、590、720、2117、677×3、720、822、1072、720px | 11 | 全站最强视觉长页 | 10 段接近/超过一屏，终章 CTA 仍为全屏；图片裁切与 scale 偏激进 | 保留产品页为最丰富模板，但只有 Hero 近全屏；保留唯一 sticky；功能图统一 16:10/3:2；规格、场景、CTA 回归容器 |
| `/news` | 2；475、1386px | 3 | Editorial 大图列表 | 列表整体满宽，单篇视觉过强，缺少分类和分页 | 改为白色 Header、标题区、分类 Tabs、1200px 新闻 Grid、静态分页 |
| `/news/:slug` | 2；648、422px | 1 | 图片型 Page Hero + 简短内容 | 复用了品牌 Hero，缺少真正阅读栏和相关文章 | 建立独立 Article Layout：820px 正文、16:9 主图、metadata、富文本与 Related News |
| `/about` | 5；656、590、677、822、720px | 3 | 产品宣传式企业页 | 4 段接近/超过一屏，缺 Team/Culture/Timeline/Honors 的企业信息层级 | 仅保留 60–70vh About Hero；其余使用标准容器，补齐团队、文化、时间线、荣誉结构 |
| `/support` | 当前不存在 | 0 | 无 | Footer 支持入口分散到 Technology/Contact | 新建工具型 Support：标题、搜索、分类导航、指南列表、视频列表；不使用品牌大图 |
| `/contact` | 2；532、862px | 0 | Page Hero + 表单 | 初始透明 Header 与浅色内容不匹配；首段偏高 | 使用白色 Header、紧凑标题区、标准 2 列表单布局 |

## 其他现有路由

- `/solutions`、`/cases`：当前复用大型 Mosaic；将统一为 Standard/Wide 容器内的 2×2 或 3×2 场景 Grid。
- `/solutions/:slug`：当前包含大图宣传式 Feature；将改为中等 Hero + 场景说明 + 相关能力。
- `/technology`：当前复用产品 sticky 和大图 Cinema；将改为深色 Standard Container 两列技术列表，取消该页 sticky。
- `/privacy`、`/terms`、`/404`：保留功能，统一 Header/Footer 与正文宽度。

## 重构后的固定体系

- Narrow：`820px`，用于文章与说明文字。
- Standard：`1280px`，12 列、32px gap，用于绝大多数内容。
- Wide：`1520px`，用于产品与 Gallery。
- 页面边距：≥1440px 为 64px；1024–1439px 为 40px；≤768px 为 20px。
- Section 间距：64 / 96 / 128px 三档。
- 高度：Hero 90–100vh；Major Visual 720–900px；Feature 600–800px；Standard 480–680px；Text 360–520px；News/Utility 自动。
- 首页不保留 sticky；全站只保留产品详情页 1 个 sticky。
- 仅 Hero 保留持续 slow scale；其他区域使用一次性 reveal 与 200–300ms hover。

## 修改优先级

1. 删除首页连续全屏产品、三段 Detail Reel、首页 sticky、两段 Cinematic、超长场景 Mosaic、全屏 About、全屏 CTA。
2. 将产品选择、Featured Product、Technology、Cloud、About、News 重新组织为强—弱—中交替节奏。
3. 为 Product、News/Article、About、Support 建立不同页面模板。
4. 统一 Header 状态、Footer 链接、网格、间距、字号、图片比例与 object-position。
5. 在七档视口完成无横向滚动、主体裁切、Header/Drawer 和控制台验收。

## 参考站页面体系复核

已复核参考站公开可达的主要页面与子页面，包括：首页、两种产品详情模板、使用指导及分类、资讯列表、资讯文章、客户案例入口、关于我们。布局结论如下：

- 首页并非连续全屏画面，而是 Hero、编号产品选择、少量重点产品、品牌信息与紧凑资讯列表组成。
- 产品页长度主要来自“功能主题 + 对应图片”的连续内容，而不是所有 Section 强制一屏高度；功能、场景、外观与智能能力分别成组。
- 使用指导是搜索、分类与视频/条目列表构成的工具页，不采用产品宣传页模板。
- 资讯列表以标题、分类和规则网格为主；文章详情使用标题、metadata、正文图片、上一篇/下一篇与相关资讯的阅读结构。
- 关于我们以企业介绍、团队、企业文化、时间线与荣誉为主，除首部视觉外均使用常规内容容器。
- 产品、资讯、About、Support 的 Header/Footer 语言一致，但主体模板和视觉强度明显不同。

本项目只吸收上述信息层级、模块顺序、图片比例和强弱节奏；不使用参考站的品牌、产品名、事实、文案、图片、视频或源码。

## 重构完成结果

| Route 类型 | 新结构 | 全屏 / Sticky | 图片与容器 |
| --- | --- | --- | --- |
| 首页 | Hero → 产品选择器 → Featured Product ×2 → Cinematic → Technology → Cloud → About Preview → News | Hero 近全屏 + 1 个 80svh Cinematic；0 sticky | 9 个主要 Section；Standard/Wide 容器与单一沉浸画面交替 |
| 产品列表 | 标题区 → 3 列产品目录 | 0 / 0 | 统一 4:3 产品图 |
| 产品详情 | Product Hero → 定位 → 核心能力 → 场景 → Feature ×3 → 智能能力 → 外观 → 参数 → CTA | Hero 近全屏；1 个功能 sticky | 3:2、16:10、4:5 按模块统一 |
| 资讯列表 | 标题 → 分类 Tabs → 3 列 Grid → Pagination | 0 / 0 | 1200–1280px 容器；统一 16:9 |
| 文章详情 | Article Header → 16:9 主图 → 820px 正文 → Related News | 0 / 0 | 阅读栏 820px；正文行高 1.85 |
| About | 66vh Hero → 企业介绍 → 团队 → 文化 → 时间线 → 荣誉 → CTA | 仅 About Hero 为中大型视觉；0 sticky | Team/Culture/Timeline/Honors 均回归规则容器 |
| Support | 标题与搜索 → 分类 → 指南列表 → 16:9 视频列表 | 0 全屏；桌面分类导航 1 个 utility sticky | 无品牌大图，强调查找效率 |

最终全站保留 2 个 sticky：产品详情功能故事、Support 桌面分类导航。第四轮仅首页 Cinematic 保留 32px 小幅滚动视差，Hero 与产品 Hero 保留 slow scale；持续扫描线、连续滚动联动和首页 sticky 均未恢复。

## 第四轮 Motion Overlay 审计

本轮遵守 `Layout first, Motion second`。不改变第三轮已经确定的内容宽度、Section 高度、网格、页面职责和信息顺序；动效只作用于 `opacity`、`transform`、`filter`、`clip-path`、`mask` 与渐变位置，不参与布局计算。

### 首页动效强度矩阵

| Section | Visual Intensity | Motion Intensity | Full-Bleed? | Sticky? | Parallax? | Gradient? | Reveal Type |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| Hero | 5 | High | Yes | No | Small | Animated hero lighting | First-load mask + stagger |
| Product Overview | 3 | Medium | No | No | No | Product tone crossfade | Image crossfade + text reveal |
| Featured Product 01 | 4 | Medium | No | No | Small | Product edge glow | Mask reveal + scale-in |
| Featured Product 02 | 3 | Medium | No | No | Small | Light product wash | Mask reveal + fade-up |
| Cinematic Visual | 5 | High | Yes | No | Small, 32px | Dark overlay transition | Fade-up |
| Technology | 3 | Medium | No | No | No | Technical grid + radar | Scale-in + SVG draw |
| Cloud | 3 | Medium | No | No | No | Screen radial glow | Perspective reveal + delayed layers |
| About Preview | 2 | Low | No | No | No | Light blue-gray | Image mask + text fade-up |
| News Preview | 2 | Low | No | No | No | None | Small stagger + hover micro-motion |

首页保留一个近全屏 Hero 和一个 75–85vh Cinematic Visual；Featured Product 仍在 Wide Container 中，不改成全屏。首页不增加 sticky，只有 Cinematic 使用 32px 以内的小幅视差。

### 页面级动效边界

| Route type | Visual Intensity | Motion Intensity | Full-Bleed? | Sticky? | Parallax? | Gradient? | Reveal Type |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| `/products/:slug` | 4–5 | High | Hero + limited close-up | One story only | Hero/feature small | Product lighting | Hero stagger, image mask, feature fade |
| `/about` | 2–3 | Medium | About Hero only | No | No | Subtle section wash | Image mask, team/culture stagger, timeline draw |
| `/news` | 2 | Low | No | No | No | No | Card fade-up + restrained hover |
| `/news/:slug` | 1 | Very Low | No | No | No | No | Article header/image opacity only |
| `/support` | 1 | Low | No | Desktop category navigation | No | Static light wash | Search/category opacity only |

### 固定动效语言

- Heading：`fade-up`；正文：`fade-up` 并延迟一档；重点图片：`mask-reveal` 或 `scale-in`；小型列表：低强度 stagger。
- 统一时长：fast / base / slow；统一缓动：premium ease-out / ease-in-out；统一位移：28px，视差仅 24px 或 40px 两档。
- Mobile 取消滚动视差、透视和复杂 mask；保留简单 fade-up。`prefers-reduced-motion` 下取消视差、背景运动和 clip reveal，仅保留瞬时 opacity。

## 第五轮 Visual Enhancement 边界

本轮启用 `Layout Freeze`：首页 Section 顺序、9 个主要 Section、12 栏网格、Standard/Wide/Narrow 宽度、Header/Footer、页面类型与图片比例均不变。没有新增全屏 Section、没有重新排列 DOM 主结构、没有增加图片素材。

### 科技视觉母题

| 母题 | 使用位置 | 视觉实现 | 强度边界 |
| --- | --- | --- | --- |
| Spatial Perception | Hero、Technology、产品 Sticky Story | 低透明点阵、感知区域、2 处扫描波 | 不进入 About/News/Support |
| Navigation | Hero、Technology | SVG 路径一次性绘制、极弱地面路径 | 无地图参数、无随机数字 |
| Intelligent Cleaning | Product Overview、Feature Story | 产品 Spotlight、接触阴影、局部 Callout | 每图最多 2 个标注 |
| Data Connection | Cloud 背景 | 稀疏节点、静态连线、慢速背景位移 | 无粒子系统 |
| Cloud Intelligence | Cloud Dashboard | 3° 以内透视、屏幕反射、2 个浮层 | 未确认状态统一显示 `--` |

### 动效语言与数量

- 基础语言固定为 Reveal、Mask、Stagger、Parallax、Crossfade、Draw、Glow 七类。
- 首页指针深度仅用于 Hero，背景 6px、技术层 14px；首页滚动视差仍仅 Cinematic 32px。
- 周期性扫描全站 2 处：Homepage Technology、Product Detail Sticky Story。
- Light Sweep 仅用于产品选择、2 个 Featured Product 与 Cloud 屏幕首次进入；均低透明、单次播放。
- Product Detail 每张 Feature 图片最多 2 个 Callout；移动端全部隐藏。
- About 保持 Medium/Low，News/Article/Support 不增加技术背景或 HUD。

## 第六轮 Visual Coverage 审计

本轮继续执行 `Layout Freeze`。首页、产品详情、About、News、Support 的 Section 顺序、页面职责、Header/Footer、Typography 层级和动效体系均未调整；仅把视觉画布从 Standard Container 中适度释放到 Wide Container，并提高既有图文模块中的媒体比例。

### 首页视觉覆盖调整

| Section | 调整前 | 调整后 | Section 高度策略 |
| --- | --- | --- | --- |
| Hero | 94svh 全幅视觉 | 保持不变 | 唯一近全屏首屏 |
| Product Overview | Standard、5/7、390px 视觉 | Wide、约 30/70、460–540px 视觉 | 正常内容高度，不使用 100vh |
| Featured Product ×2 | 7/5 与 5/7 | 8/4 与 4/8，视觉约 65–70% | 540–700px 媒体，保持 Wide 边界 |
| Cinematic | 80svh | 保持不变 | 首页唯一额外沉浸式场景 |
| Technology | Standard、7/5 | Wide、约 70/30 | 16:10 技术画布，非全屏 |
| Cloud | Standard、4/6 | Wide、约 25/75 | Dashboard 最低 390px，非全屏 |
| About Preview | Standard、6/5 | Wide、约 62/38 | 16:10 公司视觉，详情页不变 |
| News | Standard 3 列信息模块 | 保持不变 | 信息密度优先 |

首页仍是原有 9 个主要 Section，没有新增 full-bleed 区域，没有恢复连续 `100vh`，所有上一轮 Reveal、Mask、Crossfade、Lighting、Technology Motion 与 reduced-motion 降级均保留。

### 产品与场景页面

- Product Detail 三段 Feature Story 改为约 70/30 的大图与精简文字，图片高度控制在 540–760px；通过左右交替保持编辑式节奏，没有新增 Section。
- Product Detail 唯一 Sticky Story 使用 Wide Container 与 2/3 产品视觉；产品外观画布扩大为近 16:8.5，规格区保持正常内容高度。
- Solutions / Cases 的场景区使用 Wide Container；首张场景为 2×2 Featured Visual，其余场景保持规则网格，移动端自动恢复统一单列比例。
- Solution Hero、Technology Page 与 Cloud Page 仅扩大既有媒体列；About Detail、News、Article、Support、Contact 的内容宽度和结构不变。

### 素材与裁切

- 本轮复用所有现有素材，没有新增、生成或替换图片。
- Hero、三款产品、Featured Product 分别设置独立 focal position；机械特写使用 `object-fit: cover`，整机外观仍使用 `contain`，避免无意裁掉主体。
- Desktop 视觉背景可延展至 Wide Container；文字继续受 Standard/Narrow 宽度约束。移动端取消媒体溢出和固定高度，恢复 4:3 或 3:2 的稳定比例。

## 全屏沉浸式升级结果

本轮执行 `Full Visual + Controlled Content`：页面主顺序、Header/Footer、Typography 与资讯/支持页面职责保持不变；背景媒体释放到视口宽度，正文仍由 1180–1280px Grid 约束。

| Route / Section | Visual | Motion | Full-Bleed | Sticky | Parallax | Gradient | Reveal |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| `/` Hero | 5 | High | Yes / 100svh | No | Small | Local radial lighting | First-load mask + stagger |
| `/` Product Overview | 4 | Medium | Yes / 94svh | No | No | Product tone crossfade | Crossfade + blur |
| `/` Featured ×2 | 4 | Medium | Yes / 94svh | No | Small | Local copy overlay | Scroll scale + text reveal |
| `/` Scenario Explorer | 5 | Medium | Yes / 90svh | No | No | Bottom/left local overlay | Scene crossfade |
| `/` Technology | 5 | High | Yes / 96svh | No | Small | Navy ambient light | Route draw + perception pulse |
| `/` Cloud | 4 | Medium | Yes / 90svh | No | No | Screen atmosphere | Perspective dashboard reveal |
| `/` About Preview | 3 | Low | Yes / 86svh | No | No | Light local overlay | Copy reveal |
| `/products/:slug` Intelligence | 5 | High | Visual fixed 100svh | One / 260svh story | No | Tech navy | Existing sequential reveal |
| `/news`, article, support content | 1–2 | Low | No | Support navigation only | No | Static only | Low intensity |

### 页面模板

- 首页：Hero → Product Overview → Featured ×2 → Scenario Explorer → Technology → Cloud → About → News；没有新增 Section。
- 产品列表：88svh Hero → 三个 80svh 产品视觉条目。
- 产品详情：100svh Hero → 90svh Positioning → 88svh Core → 90svh Application → Feature ×3 → 唯一 Sticky Story → 90svh Appearance → 标准规格 → 85svh CTA。
- Solutions / Cases：90svh Hero → 90svh Scenario Explorer；详情页增加 82svh 运营场景与视觉 CTA。
- Technology：76svh Intro → 三段 92svh 技术视觉 → 90svh Cloud。
- About：95svh Hero 与 85svh Company Story；Team、Culture、Timeline、Honors 保持标准 Grid。
- Contact：单个 100svh 品牌空间内完成左侧沟通语义与右侧表单。
- Support：62–66svh 操作场景 Hero；搜索、分类与 Guide List 不做宣传化改造。

### 性能与降级

- 统一 `ResponsiveVisual` 负责 1280/1920/3200 WebP、固定尺寸、Hero 优先级和非首屏 lazy loading。
- 移动端使用独立 Hero/产品 4:5 资源或 `focalMobile`；取消复杂视差并将 Sticky Story 改为纵向内容。
- `prefers-reduced-motion` 关闭 scroll scale、技术扫描、路径绘制与交叉运动，只保留即时透明度状态。

## 最终 Motion & Interaction Enhancement

本轮继续执行 `Layout Freeze`：没有调整任何主要 Route 的 Section 顺序、Grid、内容宽度、图片数量、Header/Footer 或页面职责。所有新增变化均位于视觉和交互层，仅写入 CSS 自定义属性并作用于 `opacity`、`transform`、`filter`、`clip-path`、渐变位置及 SVG stroke。

| Area | Visual | Motion | Pointer depth | Scroll linked | Interaction |
| --- | ---: | --- | --- | --- | --- |
| Homepage Hero | 5 | High | Background 7px / light 12px / technical 18px | image scale + copy exit | CTA 轻磁性、Scroll cue |
| Product Overview | 4 | High | media + ambient light | no layout change | whole-space crossfade、active line |
| Featured Product | 4 | Medium | local light only | 44px image travel | horizontal/vertical mask、single light sweep |
| Scenario Explorer | 5 | Medium | background + atmosphere | no layout change | scene crossfade、depth zoom、active underline |
| Technology | 5 | High | technical layer 18px | no layout change | hover/focus 切换 navigation/perception/cloud path |
| Cloud Platform | 4 | Medium/High | ≤1.8° perspective | no layout change | screen depth、two delayed panels |
| Product Sticky Story | 5 | High | no pointer dependency | existing 260svh story | four visual crossfades driven by visible text step |
| About / Contact | 2–3 | Low | Contact background only | very small image motion | focus state、restrained reveal |
| News / Article / Support | 1–2 | Low / Very Low | No | No | existing hover/focus only |

统一动效语言仍为 Reveal、Mask、Stagger、Parallax、Crossfade、Draw、Glow。新增的惯性指针与滚动计算使用同一个 `requestAnimationFrame` Hook，每个 Section 只写 CSS 变量，不改变文档流；移动端、粗指针和 `prefers-reduced-motion` 均取消视差、透视和持续环境运动。
