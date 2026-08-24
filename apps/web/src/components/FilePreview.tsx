import { CodeOutlined, DownloadOutlined, FileTextOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Descriptions, Drawer, Image, Segmented, Skeleton, Space, Tabs, Tag, Tree, Typography } from 'antd';
import { useState } from 'react';
import { api } from '../services/api';
import { bytes, date } from '../services/format';

export function FilePreview({ fileId, onClose }: { fileId?: string; onClose: () => void }) {
  const [metadataView, setMetadataView] = useState<'tree' | 'code'>('tree');
  const file = useQuery({ queryKey: ['files', 'detail', fileId], queryFn: () => api.file(fileId!), enabled: Boolean(fileId) });
  const preview = useQuery({ queryKey: ['files', 'preview', fileId], queryFn: () => api.preview(file.data!), enabled: Boolean(file.data), retry: false });
  const download = async () => { if (!file.data) return; const { url } = await api.download(file.data.id); window.open(url, '_blank', 'noopener,noreferrer'); };
  const data = file.data;
  return <Drawer open={Boolean(fileId)} width={820} title={<div><Typography.Text strong>File Detail</Typography.Text>{data && <Typography.Text type="secondary" className="drawer-subtitle">{data.originalName}</Typography.Text>}</div>} onClose={onClose} extra={<Button icon={<DownloadOutlined />} onClick={() => void download()} disabled={!data}>Download</Button>} className="detail-drawer">
    {file.isLoading && <Skeleton active />}{file.isError && <Alert showIcon type="error" message="Unable to load file" description={(file.error as Error).message} />}
    {data && <Tabs items={[
      { key: 'preview', label: 'Preview', children: <PreviewContent preview={preview.data} loading={preview.isLoading} error={preview.error instanceof Error ? preview.error.message : undefined} /> },
      { key: 'metadata', label: 'Metadata', children: <><Space className="tab-toolbar"><Segmented size="small" value={metadataView} onChange={(value) => setMetadataView(value as 'tree' | 'code')} options={[{ label: 'Tree', value: 'tree' }, { label: 'Code', value: 'code' }]} /></Space>{metadataView === 'tree' ? <Tree showLine defaultExpandAll treeData={jsonTree(data.metadata ?? {}, 'metadata')} /> : <pre className="json-code">{JSON.stringify(data.metadata ?? {}, null, 2)}</pre>}<Descriptions className="detail-descriptions" size="small" bordered column={2} items={[{ key: 'id', label: 'ID', span: 2, children: <Typography.Text copyable>{data.id}</Typography.Text> }, { key: 'robot', label: 'Robot', children: data.robot?.externalId ?? data.robot?.name ?? data.robotId }, { key: 'type', label: 'File Type', children: data.fileType }, { key: 'mime', label: 'MIME Type', children: data.mimeType }, { key: 'size', label: 'File Size', children: bytes(data.fileSize) }, { key: 'recognition', label: 'Recognition', children: data.recognitionType }, { key: 'schema', label: 'Schema', children: data.schemaVersion }, { key: 'captured', label: 'Captured At', children: date(data.capturedAt) }, { key: 'uploaded', label: 'Uploaded At', children: date(data.createdAt) }]} /></> },
      { key: 'storage', label: 'Storage', children: <Descriptions bordered size="small" column={1} items={[{ key: 'key', label: 'Object Key', children: <Typography.Text copyable className="mono-value">{data.objectKey}</Typography.Text> }, { key: 'checksum', label: 'SHA-256', children: <Typography.Text copyable>{data.checksum}</Typography.Text> }, { key: 'provider', label: 'Provider', children: 'ObjectStorage / MinIO development adapter' }, { key: 'integrity', label: 'Stored Reference', children: <Tag color="success">Linked</Tag> }]} /> },
      { key: 'datasets', label: `Datasets (${data.datasetFiles?.length ?? 0})`, children: data.datasetFiles?.length ? <div className="relation-list">{data.datasetFiles.map((membership) => <div key={membership.datasetVersionId}><FileTextOutlined /><span><strong>{membership.datasetVersion.dataset.name}</strong><small>v{membership.datasetVersion.version} · {membership.datasetVersion.status}</small></span></div>)}</div> : <Typography.Text type="secondary">This file is not referenced by a dataset version.</Typography.Text> },
    ]} />}
  </Drawer>;
}

function PreviewContent({ preview, loading, error }: { preview?: Awaited<ReturnType<typeof api.preview>>; loading: boolean; error?: string }) {
  if (loading) return <Skeleton active />;
  if (error) return <Alert showIcon type="warning" message="Preview unavailable" description={error} />;
  if (!preview) return null;
  if (preview.kind === 'image') return <Image src={preview.url} className="file-image-preview" />;
  if (preview.kind === 'json') return <pre className="json-code preview-code">{JSON.stringify(preview.value, null, 2)}</pre>;
  if (preview.kind === 'text') return <pre className="json-code preview-code">{preview.value}</pre>;
  if (preview.kind === 'large') return <Alert showIcon type="info" message="Preview limited" description="This file is larger than the 1 MiB automatic preview limit. Download it for safe inspection." />;
  return <div className="inline-empty"><CodeOutlined /> This file type has no inline preview. Metadata and download remain available.</div>;
}
function jsonTree(value: unknown, key: string): Array<{ key: string; title: string; children?: ReturnType<typeof jsonTree> }> {
  if (value && typeof value === 'object') return [{ key, title: key, children: Object.entries(value).map(([childKey, child]) => jsonTree(child, `${key}.${childKey}`)[0]) }];
  return [{ key, title: `${key.split('.').at(-1)}: ${String(value)}` }];
}
