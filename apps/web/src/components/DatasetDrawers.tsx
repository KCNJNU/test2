import { DeleteOutlined, LockOutlined, RocketOutlined } from '@ant-design/icons';
import { Button, Descriptions, Drawer, Form, Input, Modal, Popconfirm, Select, Space, Table, Timeline, Typography, message } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type Dataset, type DatasetVersion, type RobotFile } from '../services/api';
import { bytes, date, shortHash } from '../services/format';
import { DataState, VersionTag } from './ui';

export function CreateDatasetModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    const values = await form.validateFields(); setSaving(true);
    api.createDataset(values).then(() => { message.success('Dataset created'); onClose(); onDone(); }).catch((reason: Error) => message.error(reason.message)).finally(() => setSaving(false));
  };
  return <Modal open={open} title="Create Dataset" okText="Create Dataset" confirmLoading={saving} onCancel={onClose} onOk={() => void submit()} afterOpenChange={(visible) => { if (!visible) form.resetFields(); }}><Form form={form} layout="vertical"><Form.Item name="name" label="Dataset Name" rules={[{ required: true }]}><Input placeholder="Unique dataset name" /></Form.Item><Form.Item name="description" label="Description"><Input.TextArea rows={4} maxLength={500} showCount placeholder="Purpose, source and intended use" /></Form.Item></Form></Modal>;
}

export function DatasetDrawer({ datasetId, onClose, onVersion, onChanged }: { datasetId?: string; onClose: () => void; onVersion: (id: string) => void; onChanged: () => void }) {
  const [dataset, setDataset] = useState<Dataset>();
  const [files, setFiles] = useState<RobotFile[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const load = useCallback(() => datasetId && api.dataset(datasetId).then(setDataset).catch((reason: Error) => setError(reason.message)), [datasetId]);
  useEffect(() => {
    if (!datasetId) return;
    setDataset(undefined); setSelected([]); setError(undefined); void load();
    api.allFiles().then(setFiles).catch(() => setFiles([]));
  }, [datasetId, load]);
  const create = () => {
    if (!dataset) return;
    api.createVersion(dataset.id, selected).then((version) => { message.success(`Draft v${version.version} created`); setSelected([]); void load(); onChanged(); onVersion(version.id); }).catch((reason: Error) => message.error(reason.message));
  };
  return <Drawer open={Boolean(datasetId)} width={880} title={<div><Typography.Text strong>Dataset Management</Typography.Text>{dataset && <Typography.Text type="secondary" className="drawer-subtitle">{dataset.name}</Typography.Text>}</div>} onClose={onClose}>
    <DataState loading={!dataset && !error} error={error} empty={false} emptyTitle="Dataset unavailable" emptyDescription="The dataset could not be loaded.">
      {dataset && <>
        <Descriptions bordered size="small" column={2} items={[
          { key: 'name', label: 'Dataset', children: dataset.name, span: 2 },
          { key: 'description', label: 'Description', children: dataset.description || '--', span: 2 },
          { key: 'created', label: 'Created At', children: date(dataset.createdAt) },
          { key: 'updated', label: 'Updated At', children: date(dataset.updatedAt) },
        ]} />
        <section className="drawer-section"><Typography.Title level={4}>Create Next Version</Typography.Title><Typography.Paragraph type="secondary">Select RobotFiles for a new mutable DRAFT version.</Typography.Paragraph>
          <Table size="small" rowKey="id" dataSource={files} rowSelection={{ selectedRowKeys: selected, onChange: (keys) => setSelected(keys.map(String)) }} pagination={{ pageSize: 6, showSizeChanger: false }} columns={[
            { title: 'File', dataIndex: 'originalName', ellipsis: true }, { title: 'Recognition', dataIndex: 'recognitionType' }, { title: 'Size', dataIndex: 'fileSize', render: bytes }, { title: 'Captured At', dataIndex: 'capturedAt', render: date },
          ]} />
          <Button type="primary" disabled={!selected.length} onClick={create}>Create Version with {selected.length} File{selected.length === 1 ? '' : 's'}</Button>
        </section>
        <section className="drawer-section"><Typography.Title level={4}>Version History</Typography.Title><Table size="small" rowKey="id" dataSource={dataset.versions} pagination={false} columns={[
          { title: 'Version', dataIndex: 'version', render: (value) => <Typography.Text strong>v{value}</Typography.Text> },
          { title: 'Status', dataIndex: 'status', render: (value) => <VersionTag status={value} /> },
          { title: 'Files', dataIndex: 'fileCount' }, { title: 'Size', dataIndex: 'totalSize', render: bytes },
          { title: 'Created At', dataIndex: 'createdAt', render: date },
          { title: '', width: 75, render: (_, version) => <Button type="link" onClick={() => onVersion(version.id)}>Open</Button> },
        ]} /></section>
      </>}
    </DataState>
  </Drawer>;
}

export function VersionDrawer({ versionId, datasetName, onClose, onChanged }: { versionId?: string; datasetName?: string; onClose: () => void; onChanged: () => void }) {
  const [version, setVersion] = useState<DatasetVersion>();
  const [files, setFiles] = useState<RobotFile[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const load = useCallback(() => versionId && api.version(versionId).then(setVersion).catch((reason: Error) => setError(reason.message)), [versionId]);
  useEffect(() => {
    if (!versionId) return;
    setVersion(undefined); setSelected([]); setError(undefined); void load();
    api.allFiles().then(setFiles).catch(() => setFiles([]));
  }, [versionId, load]);
  const draft = version?.status === 'DRAFT';
  const available = useMemo(() => files.filter((file) => !version?.files?.some((member) => member.robotFileId === file.id)), [files, version]);
  const refresh = () => { void load(); onChanged(); };
  return <Drawer open={Boolean(versionId)} width={920} title={<div><Typography.Text strong>Dataset Version</Typography.Text>{version && <Typography.Text type="secondary" className="drawer-subtitle">{datasetName ?? 'Dataset'} · v{version.version}</Typography.Text>}</div>} onClose={onClose}>
    <DataState loading={!version && !error} error={error} empty={false} emptyTitle="Version unavailable" emptyDescription="The version could not be loaded.">
      {version && <>
        <div className="version-hero"><div><span>VERSION</span><strong>v{version.version}</strong></div><VersionTag status={version.status} /></div>
        <Descriptions bordered size="small" column={2} items={[
          { key: 'files', label: 'File Count', children: version.fileCount }, { key: 'size', label: 'Total Size', children: bytes(version.totalSize) },
          { key: 'manifest', label: 'Manifest Path', children: <Mono value={version.manifestKey} />, span: 2 },
          { key: 'manifestChecksum', label: 'Manifest SHA-256', children: <Mono value={version.manifestChecksum} copyable />, span: 2 },
          { key: 'commit', label: 'Git Commit', children: <Mono value={version.gitCommit} copyable /> }, { key: 'tag', label: 'Git Tag', children: <Mono value={version.gitTag} copyable /> },
          { key: 'dvcPath', label: 'DVC Path', children: <Mono value={version.dvcPath} /> }, { key: 'dvcHash', label: 'DVC Hash', children: <Mono value={version.dvcHash} copyable /> },
          { key: 'created', label: 'Created At', children: date(version.createdAt) }, { key: 'frozen', label: 'Frozen At', children: date(version.frozenAt) },
        ]} />
        <section className="drawer-section"><Typography.Title level={4}>Lifecycle</Typography.Title><Timeline className="version-timeline" items={[
          { color: 'green', children: <><strong>Draft created</strong><small>{date(version.createdAt)}</small></> },
          { color: version.frozenAt ? 'green' : 'gray', children: <><strong>Membership frozen</strong><small>{version.frozenAt ? date(version.frozenAt) : 'Pending'}</small></> },
          { color: version.status === 'PUBLISHED' ? 'green' : 'gray', children: <><strong>DVC snapshot published</strong><small>{version.status === 'PUBLISHED' ? version.gitTag ?? 'Published' : 'Pending'}</small></> },
        ]} /></section>
        {draft && <section className="drawer-section"><Typography.Title level={4}>Add RobotFiles</Typography.Title><Space.Compact block><Select mode="multiple" value={selected} maxTagCount="responsive" onChange={setSelected} placeholder="Select available files" options={available.map((file) => ({ value: file.id, label: file.originalName }))} /><Button type="primary" disabled={!selected.length} onClick={() => api.addFiles(version.id, selected).then(() => { setSelected([]); refresh(); }).catch((reason: Error) => message.error(reason.message))}>Add</Button></Space.Compact></section>}
        <section className="drawer-section"><Typography.Title level={4}>Version Files</Typography.Title><Table rowKey="robotFileId" size="small" dataSource={version.files} pagination={{ pageSize: 8, showSizeChanger: false }} columns={[
          { title: 'File', render: (_, member) => member.robotFile.originalName, ellipsis: true },
          { title: 'Recognition', render: (_, member) => member.robotFile.recognitionType },
          { title: 'Checksum', render: (_, member) => <Typography.Text className="mono-value">{shortHash(member.robotFile.checksum)}</Typography.Text> },
          { title: 'Size', render: (_, member) => bytes(member.robotFile.fileSize) },
          { title: '', width: 70, render: (_, member) => draft ? <Popconfirm title="Remove this file from the draft?" onConfirm={() => api.removeFile(version.id, member.robotFileId).then(refresh).catch((reason: Error) => message.error(reason.message))}><Button danger type="text" icon={<DeleteOutlined />} /></Popconfirm> : <Typography.Text type="secondary">Locked</Typography.Text> },
        ]} /></section>
        <div className="drawer-actions">
          {draft && <Popconfirm title="Freeze this version?" description="File membership will become immutable." onConfirm={() => api.freeze(version.id).then(() => { message.success('Version frozen'); refresh(); }).catch((reason: Error) => message.error(reason.message))}><Button type="primary" icon={<LockOutlined />}>Freeze Version</Button></Popconfirm>}
          {version.status === 'FROZEN' && <Popconfirm title="Publish this frozen version?" description="This runs the existing DVC push and Git tag workflow." onConfirm={() => api.publish(version.id).then(() => { message.success('Version published'); refresh(); }).catch((reason: Error) => message.error(reason.message))}><Button type="primary" icon={<RocketOutlined />}>Publish with DVC</Button></Popconfirm>}
        </div>
      </>}
    </DataState>
  </Drawer>;
}

function Mono({ value, copyable = false }: { value?: string | null; copyable?: boolean }) { return value ? <Typography.Text className="mono-value" copyable={copyable}>{value}</Typography.Text> : <Typography.Text type="secondary">--</Typography.Text>; }
