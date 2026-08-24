# Web W1–W4 与 App W5 交付说明

Web 导航固定为工作台、设备、地图、任务、实时作业、告警、运维、报表、数据管理和系统管理；保留 Files、Datasets、Versions、Storage、System Status。设备详情使用 Overview/Realtime/Map/Health/Tasks/Faults/Maintenance/Versions/Data 九个 Tab。状态只消费 Java canonical state，所有实时页面显示更新时间和过期语义。

地图编辑器只允许 DRAFT 执行 Save → Validate → Publish。高风险操作要求权限、二次确认、原因和服务端审计。告警确认只改变处理状态，界面禁止“远程解除急停/安全复位”。默认中文，英文资源键作为后续本地化入口。

Expo App 底部固定设备、任务、告警、我的；opaque bearer token 存 SecureStore。离线只显示最近成功只读快照与时间，不排队控制命令。App 不包含安全参数、完整地图编辑、Keepout 删除、远程驾驶、强制运动或底层 MCU 配置。EAS 仅交付 development/preview 配置，不生成签名商店包。
