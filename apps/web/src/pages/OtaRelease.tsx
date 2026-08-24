import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Checkbox, Col, Form, Input, InputNumber, Modal, Progress, Row, Select, Space, Table, Tabs, Tag, Typography, message } from 'antd';
import { useState } from 'react';
import { api, type OtaCampaign, type OtaConfigVersion, type OtaJob, type OtaSoftwareVersion } from '../services/api';
import { requiresIndependentApproval, rolloutRobotIds, shortChecksum } from '../services/ota-ui';

const statusTone: Record<string, string> = { VERIFIED: 'green', APPROVED: 'green', PENDING_APPROVAL: 'gold', REJECTED: 'red', RUNNING: 'blue', SUCCEEDED: 'green', FAILED: 'red', PARTIALLY_FAILED: 'orange', ROLLED_BACK: 'purple' };
const state = (value: unknown) => <Tag color={statusTone[String(value)]}>{String(value ?? 'UNKNOWN')}</Tag>;
const date = (value?: string) => value ? new Date(value).toLocaleString() : '--';

export function OtaRelease() {
  const client = useQueryClient();
  const software = useQuery({ queryKey: ['d5', 'software'], queryFn: api.softwareVersions });
  const configs = useQuery({ queryKey: ['d5', 'configs'], queryFn: api.configVersions });
  const campaigns = useQuery({ queryKey: ['d5', 'campaigns'], queryFn: api.otaCampaigns, refetchInterval: 5_000 });
  const jobs = useQuery({ queryKey: ['d5', 'jobs'], queryFn: api.otaJobs, refetchInterval: 5_000 });
  const [softwareOpen, setSoftwareOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const refresh = async () => client.invalidateQueries({ queryKey: ['d5'] });

  return <section className="page-stack">
    <Space direction="vertical" size={2}><Typography.Title level={2}>版本、配置与 OTA</Typography.Title><Typography.Text type="secondary">D5 制品校验、单机灰度、状态回传和可恢复发布</Typography.Text></Space>
    <Alert type="warning" showIcon message="清洁运行中绝不强制升级" description="云端只会向满足在线、空闲、电量、维护与硬件兼容条件的机器人发布。Cloud Down ≠ Safety Down；设备端安全控制独立生效。" />
    <Row gutter={[16, 16]}>
      <Col xs={24} md={8}><Card><Typography.Text type="secondary">已验证制品</Typography.Text><Typography.Title level={3}>{software.data?.items.filter((item) => item.status === 'VERIFIED').length ?? 0}</Typography.Title></Card></Col>
      <Col xs={24} md={8}><Card><Typography.Text type="secondary">待审批 L4 配置</Typography.Text><Typography.Title level={3}>{configs.data?.items.filter((item) => item.approvalStatus === 'PENDING_APPROVAL').length ?? 0}</Typography.Title></Card></Col>
      <Col xs={24} md={8}><Card><Typography.Text type="secondary">运行中活动</Typography.Text><Typography.Title level={3}>{campaigns.data?.items.filter((item) => item.status === 'RUNNING').length ?? 0}</Typography.Title></Card></Col>
    </Row>
    <Tabs items={[
      { key: 'software', label: '软件制品', children: <SoftwarePanel items={software.data?.items ?? []} loading={software.isLoading} onCreate={() => setSoftwareOpen(true)} /> },
      { key: 'config', label: '配置版本', children: <ConfigPanel items={configs.data?.items ?? []} loading={configs.isLoading} onCreate={() => setConfigOpen(true)} onRefresh={refresh} /> },
      { key: 'campaigns', label: '灰度与任务', children: <CampaignPanel campaigns={campaigns.data?.items ?? []} jobs={jobs.data?.items ?? []} loading={campaigns.isLoading || jobs.isLoading} onCreate={() => setCampaignOpen(true)} /> },
    ]} />
    <SoftwareDialog open={softwareOpen} onClose={() => setSoftwareOpen(false)} onCreated={refresh} />
    <ConfigDialog open={configOpen} onClose={() => setConfigOpen(false)} onCreated={refresh} />
    <CampaignDialog open={campaignOpen} onClose={() => setCampaignOpen(false)} onCreated={refresh} software={software.data?.items ?? []} configs={configs.data?.items ?? []} />
  </section>;
}

function SoftwarePanel({ items, loading, onCreate }: { items: OtaSoftwareVersion[]; loading: boolean; onCreate: () => void }) {
  return <Card title="可发布制品" extra={<Button type="primary" onClick={onCreate}>登记并校验制品</Button>}><Table rowKey="id" loading={loading} dataSource={items} scroll={{ x: 1000 }} columns={[
    { title: '组件', dataIndex: 'component' }, { title: '版本', dataIndex: 'version' }, { title: '状态', dataIndex: 'status', render: state },
    { title: 'SHA-256', dataIndex: 'checksum', render: shortChecksum }, { title: '签名', dataIndex: 'signed', render: (value) => value ? <Tag color="green">Ed25519</Tag> : <Tag>DEV 可选</Tag> },
    { title: '最低电量', dataIndex: 'minBatteryPercent', render: (value) => `${value}%` }, { title: '验证时间', dataIndex: 'verifiedAt', render: date },
  ]} /></Card>;
}

function ConfigPanel({ items, loading, onCreate, onRefresh }: { items: OtaConfigVersion[]; loading: boolean; onCreate: () => void; onRefresh: () => Promise<unknown> }) {
  const approval = useMutation({ mutationFn: ({ id, decision }: { id: string; decision: 'APPROVED' | 'REJECTED' }) => api.decideConfigVersion(id, decision, 'Independent L4 review from D5 release console'), onSuccess: async () => { message.success('审批决定已审计记录'); await onRefresh(); }, onError: (error: Error) => message.error(error.message) });
  return <Card title="L1–L4 配置" extra={<Button type="primary" onClick={onCreate}>创建配置版本</Button>}><Table rowKey="id" loading={loading} dataSource={items} scroll={{ x: 1100 }} columns={[
    { title: '层级', dataIndex: 'category', render: (value) => <Space><Tag color={value === 'SAFETY' ? 'red' : 'blue'}>{value === 'SAFETY' ? 'L4 SAFETY' : value}</Tag></Space> },
    { title: '版本', dataIndex: 'version' }, { title: '审批', dataIndex: 'approvalStatus', render: state }, { title: 'SHA-256', dataIndex: 'checksum', render: shortChecksum },
    { title: '变更原因', dataIndex: 'reason' }, { title: '回滚版本', dataIndex: 'rollbackVersionId', render: (value) => value ?? '--' },
    { title: '动作', render: (_, row) => row.approvalStatus === 'PENDING_APPROVAL' ? <Space><Button size="small" type="primary" onClick={() => approval.mutate({ id: row.id, decision: 'APPROVED' })}>独立批准</Button><Button size="small" danger onClick={() => approval.mutate({ id: row.id, decision: 'REJECTED' })}>拒绝</Button></Space> : '--' },
  ]} /></Card>;
}

function CampaignPanel({ campaigns, jobs, loading, onCreate }: { campaigns: OtaCampaign[]; jobs: OtaJob[]; loading: boolean; onCreate: () => void }) {
  return <Space direction="vertical" size={16} style={{ width: '100%' }}>
    <Card title="灰度活动" extra={<Button type="primary" onClick={onCreate}>发起灰度</Button>}><Table rowKey="id" loading={loading} dataSource={campaigns} columns={[
      { title: '策略', dataIndex: 'strategy', render: (value) => <Tag color={value === 'SINGLE' ? 'green' : 'blue'}>{value}</Tag> }, { title: '状态', dataIndex: 'status', render: state },
      { title: '目标/可用/拦截', render: (_, row) => `${row.targetCount} / ${row.eligibleCount} / ${row.blockedCount}` }, { title: '原因', dataIndex: 'reason' }, { title: '开始', dataIndex: 'startedAt', render: date },
    ]} /></Card>
    <Card title="机器人 OTA 任务"><Table rowKey="id" loading={loading} dataSource={jobs} scroll={{ x: 1050 }} columns={[
      { title: '机器人', dataIndex: 'robotId' }, { title: '状态', dataIndex: 'status', render: state }, { title: '进度', dataIndex: 'progress', render: (value) => <Progress percent={Number(value)} size="small" status={Number(value) === 100 ? 'success' : 'active'} /> },
      { title: '目标校验和', dataIndex: 'targetChecksum', render: shortChecksum }, { title: '上一版本', dataIndex: 'previousVersion', render: (value) => value ?? '--' },
      { title: '回滚', render: (_, row) => row.rollbackStatus ? state(row.rollbackStatus) : row.rollbackReason ?? '--' }, { title: '失败原因', dataIndex: 'failureReason', render: (value) => value ?? '--' },
    ]} /></Card>
  </Space>;
}

function SoftwareDialog({ open, onClose, onCreated }: DialogProps) {
  const [form] = Form.useForm(); const [file, setFile] = useState<File>();
  const mutation = useMutation({ mutationFn: async (values: Record<string, string | number>) => { if (!file) throw new Error('请选择制品文件'); const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer()); const checksum = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join(''); const data = new FormData(); Object.entries(values).forEach(([key, value]) => value != null && data.append(key, String(value))); data.set('checksum', checksum); data.append('file', file); return api.uploadSoftwareVersion(data); }, onSuccess: async () => { message.success('校验和通过，制品已登记'); form.resetFields(); setFile(undefined); onClose(); await onCreated(); }, onError: (error: Error) => message.error(error.message) });
  return <Modal open={open} onCancel={onClose} onOk={() => form.submit()} confirmLoading={mutation.isPending} title="登记软件制品" destroyOnHidden><Form form={form} layout="vertical" onFinish={(values) => mutation.mutate(values)} initialValues={{ component: 'ROBOT_APPLICATION', minimumBatteryPercent: 30 }}><Form.Item name="component" label="组件" rules={[{ required: true }]}><Select options={['ROBOT_APPLICATION','ROBOT_AGENT','ROS_PACKAGE','MCU_FIRMWARE'].map((value) => ({ value }))} /></Form.Item><Form.Item name="version" label="SemVer" rules={[{ required: true }]}><Input placeholder="1.2.3" /></Form.Item><Form.Item name="minimumBatteryPercent" label="最低电量"><InputNumber min={1} max={100} /></Form.Item><Form.Item name="signature" label="Ed25519 签名（Base64；DEV 可选）"><Input.Password /></Form.Item><Form.Item name="releaseNotes" label="发布说明"><Input.TextArea /></Form.Item><Form.Item label="制品文件" required><input type="file" onChange={(event) => setFile(event.target.files?.[0])} /></Form.Item><Alert type="info" showIcon message="浏览器计算 SHA-256；服务端在存储前再次校验，下载与发布时继续复核。" /></Form></Modal>;
}

function ConfigDialog({ open, onClose, onCreated }: DialogProps) {
  const [form] = Form.useForm(); const category = Form.useWatch('category', form);
  const mutation = useMutation({ mutationFn: (values: Record<string, string>) => api.createConfigVersion({ ...values, content: JSON.parse(values.content) as Record<string, unknown>, projectId: values.projectId || null, rollbackVersionId: values.rollbackVersionId || null }), onSuccess: async () => { message.success(requiresIndependentApproval(category) ? 'L4 配置已进入独立审批' : '配置已生成不可变校验和'); form.resetFields(); onClose(); await onCreated(); }, onError: (error: Error) => message.error(error.message) });
  return <Modal open={open} onCancel={onClose} onOk={() => form.submit()} confirmLoading={mutation.isPending} title="创建配置版本" destroyOnHidden><Form form={form} layout="vertical" onFinish={(values) => mutation.mutate(values)} initialValues={{ category: 'BUSINESS', content: '{\n  "enabled": true\n}' }}><Form.Item name="tenantId" label="Tenant ID" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="projectId" label="Project ID（可选）"><Input /></Form.Item><Form.Item name="category" label="配置层级" rules={[{ required: true }]}><Select options={[['BUSINESS','L1 Business'],['CLEANING','L2 Cleaning'],['NAVIGATION','L3 Navigation'],['SAFETY','L4 Safety']].map(([value,label]) => ({ value, label }))} /></Form.Item>{requiresIndependentApproval(category) && <Alert type="warning" showIcon message="L4 安全配置需另一名授权用户审批，创建者不能自批。" style={{ marginBottom: 16 }} />}<Form.Item name="version" label="SemVer" rules={[{ required: true }]}><Input placeholder="1.0.0" /></Form.Item><Form.Item name="reason" label="变更原因" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="rollbackVersionId" label="已批准回滚版本 ID"><Input /></Form.Item><Form.Item name="content" label="配置 JSON" rules={[{ required: true }]}><Input.TextArea rows={8} /></Form.Item></Form></Modal>;
}

function CampaignDialog({ open, onClose, onCreated, software, configs }: DialogProps & { software: OtaSoftwareVersion[]; configs: OtaConfigVersion[] }) {
  const [form] = Form.useForm(); const strategy = Form.useWatch('strategy', form); const targetType = Form.useWatch('targetType', form);
  const mutation = useMutation({ mutationFn: (values: Record<string, string | number | boolean>) => { const robotIds = rolloutRobotIds(String(values.strategy), String(values.robotIds ?? '')); return api.createOtaCampaign({ projectId: values.projectId, strategy: values.strategy, percentage: values.strategy === 'PERCENTAGE' ? values.percentage : null, robotIds, confirmProjectRollout: values.strategy === 'PROJECT' ? values.confirmProjectRollout === true : false, softwareVersionId: values.targetType === 'software' ? values.targetId : null, configVersionId: values.targetType === 'config' ? values.targetId : null, reason: values.reason }); }, onSuccess: async () => { message.success('灰度活动已创建，等待机器人回传事实状态'); form.resetFields(); onClose(); await onCreated(); }, onError: (error: Error) => message.error(error.message) });
  const targets = targetType === 'config' ? configs.filter((item) => item.approvalStatus === 'APPROVED').map((item) => ({ value: item.id, label: `${item.category} ${item.version}` })) : software.filter((item) => item.status === 'VERIFIED').map((item) => ({ value: item.id, label: `${item.component} ${item.version}` }));
  return <Modal open={open} onCancel={onClose} onOk={() => form.submit()} confirmLoading={mutation.isPending} title="发起 OTA 灰度" destroyOnHidden><Form form={form} layout="vertical" onFinish={(values) => mutation.mutate(values)} initialValues={{ strategy: 'SINGLE', targetType: 'software' }}><Form.Item name="projectId" label="Project ID" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="targetType" label="目标类型"><Select options={[{ value:'software',label:'软件制品' },{ value:'config',label:'已批准配置' }]} onChange={() => form.setFieldValue('targetId', undefined)} /></Form.Item><Form.Item name="targetId" label="目标版本" rules={[{ required: true }]}><Select options={targets} /></Form.Item><Form.Item name="strategy" label="灰度策略"><Select options={['SINGLE','SELECTED_BATCH','PROJECT','PERCENTAGE'].map((value) => ({ value }))} /></Form.Item>{(strategy === 'SINGLE' || strategy === 'SELECTED_BATCH') && <Form.Item name="robotIds" label={strategy === 'SINGLE' ? '单台 Robot ID' : 'Robot IDs（逗号分隔）'} rules={[{ required: true }]}><Input /></Form.Item>}{strategy === 'PERCENTAGE' && <Form.Item name="percentage" label="比例（1–99）" rules={[{ required: true }]}><InputNumber min={1} max={99} /></Form.Item>}{strategy === 'PROJECT' && <Form.Item name="confirmProjectRollout" valuePropName="checked" rules={[{ validator: (_, value) => value ? Promise.resolve() : Promise.reject(new Error('必须明确确认项目发布')) }]}><Checkbox>我确认在成功单机/小批量灰度后发布到整个项目</Checkbox></Form.Item>}<Form.Item name="reason" label="发布原因" rules={[{ required: true }]}><Input /></Form.Item><Alert type="info" showIcon message="PROJECT 发布必须先有相同目标版本的 SINGLE 或 SELECTED_BATCH 成功记录。" /></Form></Modal>;
}

type DialogProps = { open: boolean; onClose: () => void; onCreated: () => Promise<unknown> };
