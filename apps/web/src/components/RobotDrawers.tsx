import { RobotOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Descriptions, Drawer, Form, Input, Modal, Space, Table, Tabs, Tag, Typography, message } from 'antd';
import { api, type ActivityStatus } from '../services/api';
import { bytes, date } from '../services/format';

const activityText: Record<ActivityStatus, string> = { ACTIVE: 'Data Active', IDLE: 'Idle', NO_DATA: 'No Data' };
export function CreateRobotModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form] = Form.useForm(); const queryClient = useQueryClient();
  const create = useMutation({ mutationFn: (values: { name: string; externalId?: string; metadata?: string }) => api.createRobot({ name: values.name, externalId: values.externalId, metadata: values.metadata ? JSON.parse(values.metadata) as Record<string, unknown> : undefined }), onSuccess: () => { message.success('Robot created'); void queryClient.invalidateQueries({ queryKey: ['robots'] }); void queryClient.invalidateQueries({ queryKey: ['dashboard'] }); onClose(); }, onError: (reason: Error) => message.error(reason.message) });
  const submit = async () => { const values = await form.validateFields(); try { if (values.metadata) { const parsed: unknown = JSON.parse(values.metadata); if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('not an object'); } } catch { form.setFields([{ name: 'metadata', errors: ['Enter a valid JSON object'] }]); return; } create.mutate(values); };
  return <Modal open={open} title="Add Robot" okText="Create Robot" confirmLoading={create.isPending} onCancel={onClose} onOk={() => void submit()} afterOpenChange={(visible) => { if (!visible) form.resetFields(); }}><Form form={form} layout="vertical"><Form.Item name="name" label="Name" rules={[{ required: true }]}><Input placeholder="Cleaning Robot CR-004" /></Form.Item><Form.Item name="externalId" label="Robot Code"><Input placeholder="CR-004" /></Form.Item><Form.Item name="metadata" label="Metadata JSON"><Input.TextArea rows={5} placeholder={'{\n  "model": "..."\n}'} /></Form.Item></Form></Modal>;
}

export function RobotDetailDrawer({ robotId, onClose, onFile }: { robotId?: string; onClose: () => void; onFile: (id: string) => void }) {
  const robot = useQuery({ queryKey: ['robots', 'detail', robotId], queryFn: () => api.robot(robotId!), enabled: Boolean(robotId) });
  const data = robot.data;
  return <Drawer open={Boolean(robotId)} onClose={onClose} width={800} className="detail-drawer" title={<Space><RobotOutlined /><span>Robot Detail</span>{data && <Typography.Text type="secondary">{data.externalId ?? data.name}</Typography.Text>}</Space>}>
    {robot.isError && <Alert type="error" showIcon message="Unable to load robot" description={(robot.error as Error).message} />}
    {data && <Tabs items={[
      { key: 'overview', label: 'Overview', children: <><div className="detail-kpis"><div><span>Activity</span><strong>{activityText[data.stats.activityStatus]}</strong></div><div><span>Total Files</span><strong>{data.stats.totalFiles}</strong></div><div><span>Storage</span><strong>{bytes(data.stats.totalBytes)}</strong></div><div><span>Files 24h</span><strong>{data.stats.files24h}</strong></div></div><Descriptions size="small" bordered column={2} items={[{ key: 'id', label: 'Robot ID', children: <Typography.Text copyable>{data.id}</Typography.Text> }, { key: 'code', label: 'Robot Code', children: data.externalId ?? '--' }, { key: 'name', label: 'Name', children: data.name }, { key: 'last', label: 'Last Upload', children: data.stats.lastUpload ? date(data.stats.lastUpload) : '--' }, { key: 'types', label: 'Recognition Types', span: 2, children: data.stats.recognitionTypes.length ? data.stats.recognitionTypes.map((value) => <Tag key={value}>{value}</Tag>) : '--' }, { key: 'created', label: 'Created', children: date(data.createdAt) }]} /></> },
      { key: 'files', label: `Files (${data.stats.totalFiles})`, children: <Table size="small" rowKey="id" dataSource={data.recentFiles} pagination={false} onRow={(row) => ({ onClick: () => onFile(row.id), className: 'clickable-row' })} columns={[{ title: 'File', dataIndex: 'originalName' }, { title: 'Recognition', dataIndex: 'recognitionType' }, { title: 'Size', dataIndex: 'fileSize', render: bytes }, { title: 'Uploaded', dataIndex: 'createdAt', render: date }]} /> },
      { key: 'datasets', label: 'Datasets', children: data.datasets.length ? <Table size="small" rowKey="id" dataSource={data.datasets} pagination={false} columns={[{ title: 'Dataset', dataIndex: 'name' }, { title: 'Versions', render: (_, row) => row.versions.map((version) => <Tag key={version.id}>v{version.version} · {version.status}</Tag>) }]} /> : <Typography.Text type="secondary">No dataset currently references this robot's files.</Typography.Text> },
      { key: 'activity', label: 'Activity', children: <div className="activity-feed">{data.recentFiles.map((file) => <div key={file.id}><span className="activity-dot" /><div><strong>File uploaded</strong><Typography.Text>{file.originalName}</Typography.Text><small>{date(file.createdAt)}</small></div></div>)}</div> },
      { key: 'metadata', label: 'Metadata', children: <pre className="json-code">{JSON.stringify(data.metadata ?? {}, null, 2)}</pre> },
    ]} />}
  </Drawer>;
}
