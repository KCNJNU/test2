import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Descriptions, Empty, Flex, Modal, Progress, Row, Space, Statistic, Table, Tabs, Tag, Typography, message } from 'antd';
import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api, type PlatformRobot, type PlatformTask } from '../services/api';

const tone: Record<string, string> = { ONLINE: 'green', READY: 'green', RUNNING: 'blue', PAUSED: 'gold', BLOCKED: 'red', FAULT: 'red', OFFLINE: 'default', UNSTABLE: 'orange', COMPLETED: 'green', FAILED: 'red', REJECTED: 'red', TIMEOUT: 'orange', PUBLISHED: 'green', DRAFT: 'gold' };
const status = (value?: unknown) => <Tag color={tone[String(value)]}>{String(value ?? 'UNKNOWN')}</Tag>;
const stamp = (value?: unknown) => value ? new Date(String(value)).toLocaleString() : '暂无设备事实';

export function CommercialDashboard() {
  const dashboard = useQuery({ queryKey: ['platform-dashboard'], queryFn: () => api.platformResource<{robots:Record<string,number>;todayTasks:Array<{status:string;count:number}>}>('dashboard'), refetchInterval: 15_000 });
  const robots = dashboard.data?.robots ?? {};
  return <section className="page-stack"><Flex justify="space-between" align="center"><div><Typography.Title level={2}>运营工作台</Typography.Title><Typography.Text type="secondary">设备、任务与 SAFE 事件的事实视图</Typography.Text></div><Tag color="blue">实时更新 · 15s</Tag></Flex>
    {dashboard.isError && <Alert type="error" showIcon message="工作台暂不可用" description="统一 Java API 未连接，页面不会展示推测数据。" />}
    <Row gutter={[16, 16]}>{[['设备总数', robots.total], ['在线', robots.online], ['运行中', robots.running], ['离线', robots.offline], ['故障', robots.fault], ['维护中', robots.maintenance]].map(([title, value]) => <Col xs={12} lg={8} xl={4} key={String(title)}><Card><Statistic title={title} value={Number(value ?? 0)} /></Card></Col>)}</Row>
    <Row gutter={[16, 16]}><Col xs={24} lg={14}><Card title="今日任务"><Table size="small" rowKey="status" pagination={false} dataSource={dashboard.data?.todayTasks ?? []} columns={[{ title: '状态', dataIndex: 'status', render: status }, { title: '数量', dataIndex: 'count' }]} /></Card></Col><Col xs={24} lg={10}><Card title="清洁能力"><Empty description="设备尚未上报可验证的面积/利用率能力，不生成模拟指标" /></Card></Col></Row>
  </section>;
}

export function RobotOperations() {
  const query = useQuery({ queryKey: ['platform-robots'], queryFn: api.platformRobots, refetchInterval: 10_000 });
  const [selected, setSelected] = useState<PlatformRobot>();
  const columns = [{ title: '设备', render: (_: unknown, r: PlatformRobot) => <Space direction="vertical" size={0}><Typography.Text strong>{r.robotName}</Typography.Text><Typography.Text type="secondary">{r.robotSn}</Typography.Text></Space> }, { title: '位置', render: (_: unknown, r: PlatformRobot) => [r.projectName, r.siteName, r.floorName].filter(Boolean).join(' / ') || '--' }, { title: '在线', dataIndex: 'onlineStatus', render: status }, { title: '业务状态', dataIndex: 'operationalState', render: status }, { title: 'SAFE', dataIndex: 'safetyCode', render: (v: unknown) => v ? <Tag color="red">{String(v)}</Tag> : <Tag>正常/未知</Tag> }, { title: '电量', dataIndex: 'batteryPercent', render: (v: unknown) => v == null ? '--' : <Progress percent={Number(v)} size="small" /> }, { title: '最后更新', dataIndex: 'lastTelemetryAt', render: stamp }];
  return <section className="page-stack"><Typography.Title level={2}>设备中心</Typography.Title><Alert type="info" showIcon message="OFFLINE 仅表示云端通信离线，不代表机器人已物理停止。" /><Table rowKey="id" loading={query.isLoading} dataSource={query.data?.items ?? []} columns={columns} onRow={(row) => ({ onClick: () => setSelected(row) })} />
    <Modal width={900} open={Boolean(selected)} onCancel={() => setSelected(undefined)} footer={null} title={selected?.robotName}><Tabs items={['Overview','Realtime','Map','Health','Tasks','Faults','Maintenance','Versions','Data'].map((label) => ({ key: label, label, children: label === 'Overview' ? <Descriptions bordered column={2} items={[{ key:'sn',label:'Robot SN',children:selected?.robotSn },{key:'online',label:'Online',children:status(selected?.onlineStatus)},{key:'state',label:'State',children:status(selected?.operationalState)},{key:'updated',label:'Last updated',children:stamp(selected?.lastTelemetryAt)}]} /> : <Empty description={`${label} 暂无设备上报数据`} /> }))} /></Modal>
  </section>;
}

export function TaskOperations() {
  const client = useQueryClient(); const tasks = useQuery({ queryKey: ['platform-tasks'], queryFn: api.platformTasks, refetchInterval: 5_000 });
  const action = useMutation({ mutationFn: ({ id, name }: { id: string; name: 'start'|'pause'|'resume'|'cancel' }) => api.platformTaskAction(id, name), onSuccess: () => { message.success('命令已受理，等待设备 ACK'); void client.invalidateQueries({ queryKey: ['platform-tasks'] }); } });
  const buttons = (row: PlatformTask) => <Space>{row.status === 'DRAFT' && <Button type="primary" onClick={() => action.mutate({id:row.id,name:'start'})}>Start</Button>}{row.status === 'RUNNING' && <Button onClick={() => action.mutate({id:row.id,name:'pause'})}>Pause</Button>}{row.status === 'PAUSED' && <Button onClick={() => action.mutate({id:row.id,name:'resume'})}>Resume</Button>}{!['COMPLETED','FAILED','CANCELED'].includes(row.status) && <Button danger onClick={() => action.mutate({id:row.id,name:'cancel'})}>Cancel</Button>}</Space>;
  return <section className="page-stack"><Typography.Title level={2}>任务中心</Typography.Title><Alert type="warning" showIcon message="HTTP 成功仅表示命令已受理；最终状态以 ACK 和 Robot Event 为准。BLOCKED 不提供普通 Resume。" /><Table rowKey="id" loading={tasks.isLoading} dataSource={tasks.data?.items ?? []} columns={[{title:'任务',dataIndex:'name'},{title:'机器人',dataIndex:'robotId'},{title:'状态',dataIndex:'status',render:status},{title:'进度',dataIndex:'currentProgress',render:(v)=>v==null?'--':<Progress percent={v}/>},{title:'动作',render:(_,r)=>buttons(r)}]} /></section>;
}

const configs: Record<string, { title: string; endpoint: string; description: string }> = {
  '/realtime': { title:'实时作业', endpoint:'commands', description:'Canonical state、Command ACK 与超时状态' }, '/faults':{title:'告警中心',endpoint:'faults',description:'SAFE 原始事件与处理状态；确认不会改变机器人安全状态'}, '/maintenance':{title:'运维管理',endpoint:'maintenance',description:'维护状态与任务状态相互独立'}, '/versions-platform':{title:'版本与 OTA',endpoint:'ota',description:'软件、配置与 OTA 生命周期'}, '/reports':{title:'运营报表',endpoint:'reports',description:'只汇总真实 TaskRun / Fault 数据'}, '/system-platform':{title:'系统管理',endpoint:'tenants',description:'Tenant / Project / Site / Floor、用户与审计'}
};
export function OperationsPage() {
  const location=useLocation(); const cfg=configs[location.pathname] ?? configs['/realtime']; const query=useQuery({queryKey:['platform',cfg.endpoint],queryFn:()=>api.platformResource<Record<string,unknown>|Array<Record<string,unknown>>|{items:Array<Record<string,unknown>>}>(cfg.endpoint),refetchInterval:cfg.endpoint==='commands'?5000:false});
  const items=useMemo<Array<Record<string,unknown>>>(()=>{const data=query.data;if(Array.isArray(data))return data;if(data&&'items' in data&&Array.isArray(data.items))return data.items;if(data)return[data];return[];},[query.data]); const columns=useMemo(()=>{const keys: string[]=Array.from(new Set<string>(items.flatMap(item=>Object.keys(item)))).filter(k=>!['before','after','payload','geometry'].includes(k)).slice(0,8);return keys.map(key=>({title:key,dataIndex:key,render:(v:unknown)=>key.toLowerCase().includes('status')?status(v):typeof v==='object'?JSON.stringify(v):String(v??'--')}));},[items]);
  return <section className="page-stack"><Typography.Title level={2}>{cfg.title}</Typography.Title><Alert type="info" showIcon message={cfg.description} /><Card title="事实数据" extra={<Tag>Last updated {new Date().toLocaleTimeString()}</Tag>}><Table rowKey={(row:Record<string,unknown>)=>String(row.id??JSON.stringify(row))} loading={query.isLoading} dataSource={items} columns={columns} locale={{emptyText:<Empty description="暂无事实数据"/>}} scroll={{x:true}} /></Card>{location.pathname==='/faults'&&<Alert type="warning" showIcon message="平台不提供远程解除急停或安全复位。未知 SAFE 策略默认禁止 Start/Resume。" />}</section>;
}
