# 旦生计划官网素材需求

当前网站为沉浸式高保真原型。现有视觉均为原创暂定素材，不代表已确认的产品、设施、员工、部署或客户案例。正式素材到位后按以下固定路径替换，无需重新设计页面。所有全屏候选素材同时提供 `-1280.webp`、`-1920.webp`、`-3200.webp` 响应式版本；Hero 与三款产品另有 `-mobile.webp` 竖版构图。

| 素材位置 | 当前文件 | 建议交付规格 | 主要用途 |
| --- | --- | --- | --- |
| 首页 Hero | `assets/hero/hero-main.webp`、`hero-main-mobile.webp` | 桌面 3840×2160；移动端 1080×1440；主体位于中右侧，左下可承载白字 | 首页首屏 |
| 产品主视觉 01–03 | `assets/products/product-01-main.webp` 等及对应 `-mobile.webp` | 每款独立 3840×2160；移动端 1080×1440；另提供透明背景 PNG/WebP，≥2400px | 首页产品故事、产品列表、详情 Hero |
| 传感器特写 | `assets/product-details/sensor.webp` | 2560×1440，雷达/相机微距 | 首页、产品详情 |
| 清洁模组 | `assets/product-details/cleaning-module.webp` | 2560×1440，刷盘、吸水扒或底盘结构 | 首页、产品详情 |
| 自动基站 | `assets/product-details/base-station.webp` | 2560×1440，机器人与配套完整入镜 | 产品详情 |
| 导航视觉 | `assets/product-details/navigation.webp` | 2560×1440，可表现路径或空间理解 | Sticky 技术叙事 |
| 技术视觉 | `assets/technology/perception.webp`、`navigation.webp`、`cloud.webp` | 2560×1440；点云、路径、传感器视觉应克制 | 首页与技术页 |
| 场景视觉 | `assets/scenarios/{hotel,office,mall,hospital,airport,industrial}.webp` | 2560×1600 或更大，提供移动端焦点说明 | 场景图片墙、详情页、CTA |
| 平台界面 | `assets/cloud/platform-overview.webp` | 2560×1600，经确认的平台截图或营销级界面图 | 智能平台章节 |
| 公司视觉 | `assets/company/company-01.webp`、`company-02.webp` | 2400×1600，正式实验室、办公或团队照片 | 首页、About |
| 资讯封面 | `assets/news/news-01.webp` 等 | 1600×1000 | 资讯列表与详情 |
| 视频 | `assets/video/` | MP4/WebM，4K 母版，15–45 秒静音循环，无内嵌文字 | 后续 Hero/产品故事升级 |
| Logo | `assets/brand/` | SVG，横版/竖版及深浅色版本 | Header、Footer、favicon |

## 替换规则

- 禁止热链第三方图片；正式素材存入对应本地目录或经批准的品牌 CDN。
- 产品名称、性能参数、公司历史、团队、资讯、客户案例、联系信息与法律文本确认后，再移除暂定状态。
- 保持文件名、画幅比例和内在尺寸，避免素材替换造成布局偏移。
- Hero 和产品主体必须在 375×812 裁切下仍清晰可见。
- 公司、员工、客户和项目图片需确认使用授权。
- 正式照片优先提供 WebP/AVIF，同时在网站包之外保留高分辨率母版。

## 当前暂定素材状态

- 本轮新增原创暂定视觉：`hero/hero-main-mobile.webp`、`product-01-main.webp`、`product-02-main.webp`、`product-03-main.webp`、`technology/cloud.webp`、`company/company-01.webp`、`scenarios/industrial.webp`、`scenarios/mall.webp`。
- 以上视觉由图像生成工具创建，仅用于前端原型，不代表正式产品造型、真实研发设施或真实部署。
- `ResponsiveVisual` 会根据同一语义路径自动加载 `-1280`、`-1920`、`-3200` 文件；替换正式素材时应同步导出这三档尺寸。
- 移动端不依赖桌面画面的盲目居中裁切；Hero 与产品必须同步替换对应 `-mobile.webp`。
- Cloud 的最终平台画面应由已确认的真实产品界面重新截取；当前 HTML Dashboard 仅表达现有 Robots、Files、Datasets、Dataset Versions 与 Service Health 能力层级。
