import { ArrowLeftOutlined, BranchesOutlined, CheckCircleOutlined, DatabaseOutlined, PlusOutlined, SafetyCertificateOutlined, SwapOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Descriptions, Modal, Row, Select, Tabs, Timeline, Typography, message } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { VersionBuilder } from '../components/VersionBuilder';
import { VersionCompare } from '../components/VersionCompare';
import { VersionValidation } from '../components/VersionValidation';
import { DataState, PageHeader, StatCard, VersionTag } from '../components/ui';
import { api, type Dataset, type DatasetVersion } from '../services/api';
import { bytes, date, shortHash } from '../services/format';
import { useUnsavedChanges } from '../components/UnsavedChanges';
import { useOptionalAuth } from '../auth/AuthContext';

export function DatasetWorkspace() {
  const auth = useOptionalAuth(); const canMutate = auth ? auth.hasRole('ADMIN', 'SUPER_ADMIN', 'TENANT_ADMIN', 'PROJECT_ADMIN', 'OPERATOR') : true;
  const { datasetId, versionId } = useParams(); const location = useLocation(); const navigate = useNavigate(); const [params] = useSearchParams(); const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false); const { setDirty, confirmDiscard } = useUnsavedChanges();
  const dataset = useQuery({ queryKey: ['datasets', 'detail', datasetId], queryFn: () => api.dataset(datasetId!), enabled: Boolean(datasetId) });
  const version = useQuery({ queryKey: ['versions', 'detail', versionId], queryFn: () => api.version(versionId!), enabled: Boolean(versionId) });
  const active = location.pathname.endsWith('/compare') ? 'compare' : params.get('tab') ?? 'overview';
  const guard = useCallback((action: () => void) => confirmDiscard(action), [confirmDiscard]);
  const selectVersion = (id: string) => guard(() => navigate(`/datasets/${datasetId}/versions/${id}`));
  const selectTab = (key: string) => guard(() => { if (key === 'overview') navigate(versionId ? `/datasets/${datasetId}/versions/${versionId}` : `/datasets/${datasetId}`); else if (key === 'compare') navigate(`/datasets/${datasetId}/compare${versionId ? `?target=${versionId}` : ''}`); else { const target = versionId ?? dataset.data?.versions[0]?.id; if (target) navigate(`/datasets/${datasetId}/versions/${target}?tab=${key}`); } });
  const refresh = async () => { await Promise.all([dataset.refetch(), versionId ? version.refetch() : Promise.resolve(), queryClient.invalidateQueries({ queryKey: ['versions', 'page'] })]); };
  const data = dataset.data; const selected = version.data;
  const latest = useMemo(() => data?.versions[0], [data]);
  return <>
    <PageHeader eyebrow="DATASET WORKSPACE" title={data?.name ?? 'Dataset'} description={data?.description ?? 'Versioned RobotFile curation, integrity and comparison workspace.'} actions={<><Button icon={<ArrowLeftOutlined />} onClick={() => guard(() => navigate('/datasets'))}>All Datasets</Button>{canMutate && <Button type="primary" icon={<PlusOutlined />} onClick={() => guard(() => setCreateOpen(true))}>Create Version</Button>}</>} />
    <DataState loading={dataset.isLoading} error={(dataset.error as Error | null)?.message} empty={!data} emptyTitle="Dataset unavailable" emptyDescription="The requested dataset could not be loaded.">
      {data && <><Row gutter={[12, 12]} className="summary-row"><Col xs={12} lg={6}><StatCard title="Versions" value={data.versions.length} /></Col><Col xs={12} lg={6}><StatCard title="Latest Version" value={latest ? `v${latest.version}` : '--'} /></Col><Col xs={12} lg={6}><StatCard title="Latest Files" value={latest?.fileCount ?? 0} /></Col><Col xs={12} lg={6}><StatCard title="Latest Size" value={bytes(latest?.totalSize ?? 0)} /></Col></Row>
        <div className="dataset-workspace-layout"><Card variant="borderless" className="workspace-sidebar"><div className="workspace-dataset-icon"><DatabaseOutlined /></div><Typography.Title level={4}>{data.name}</Typography.Title><Typography.Text type="secondary">Created {date(data.createdAt)}</Typography.Text><div className="workspace-version-label">VERSION TIMELINE</div>{data.versions.length ? <Timeline items={data.versions.map((item) => ({ color: item.id === versionId ? 'blue' : item.status === 'PUBLISHED' ? 'green' : 'gray', children: <button className={`workspace-version-button ${item.id === versionId ? 'active' : ''}`} onClick={() => selectVersion(item.id)}><span><strong>v{item.version}</strong><VersionTag status={item.status} /></span><small>{item.fileCount} files · {bytes(item.totalSize)}</small></button> }))} /> : <Alert type="info" showIcon message="No versions yet" />}</Card>
          <Card variant="borderless" className="workspace-main"><Tabs activeKey={active} onChange={selectTab} items={[{ key: 'overview', label: <span><BranchesOutlined /> Overview</span>, children: <WorkspaceOverview dataset={data} version={selected} onSelectVersion={selectVersion} /> }, { key: 'builder', disabled: !versionId, label: <span><SwapOutlined /> Builder</span>, children: selected ? <VersionBuilder version={selected} onDirtyChange={setDirty} /> : <WorkspacePrompt /> }, { key: 'validation', disabled: !versionId, label: <span><SafetyCertificateOutlined /> Validation</span>, children: selected ? <VersionValidation version={selected} onChanged={() => void refresh()} /> : <WorkspacePrompt /> }, { key: 'compare', label: <span><CheckCircleOutlined /> Compare</span>, children: <VersionCompare dataset={data} currentVersionId={versionId} /> }]} /></Card></div></>}
    </DataState>
    {canMutate && data && <CreateVersionModal dataset={data} open={createOpen} onClose={() => setCreateOpen(false)} onCreated={(created) => { setCreateOpen(false); void queryClient.invalidateQueries({ queryKey: ['datasets'] }); navigate(`/datasets/${data.id}/versions/${created.id}?tab=builder`); }} />}
  </>;
}

function WorkspaceOverview({ dataset, version, onSelectVersion }: { dataset: Dataset; version?: DatasetVersion; onSelectVersion: (id: string) => void }) {
  if (!version) return <div className="workspace-overview"><Typography.Title level={4}>Dataset Overview</Typography.Title><Typography.Paragraph type="secondary">Select a version from the timeline to inspect membership and lifecycle details.</Typography.Paragraph><Descriptions bordered size="small" column={2} items={[{ key: 'name', label: 'Dataset', children: dataset.name }, { key: 'versions', label: 'Versions', children: dataset.versions.length }, { key: 'description', label: 'Description', span: 2, children: dataset.description ?? '--' }, { key: 'created', label: 'Created', children: date(dataset.createdAt) }, { key: 'updated', label: 'Updated', children: date(dataset.updatedAt) }]} />{dataset.versions[0] && <Button className="workspace-primary-action" type="primary" onClick={() => onSelectVersion(dataset.versions[0].id)}>Open Latest Version</Button>}</div>;
  return <div className="workspace-overview"><div className="version-overview-heading"><div><Typography.Text type="secondary">SELECTED VERSION</Typography.Text><Typography.Title level={3}>v{version.version}</Typography.Title></div><VersionTag status={version.status} /></div><Descriptions bordered size="small" column={2} items={[{ key: 'status', label: 'Lifecycle', children: <VersionTag status={version.status} /> }, { key: 'files', label: 'Files', children: version.fileCount }, { key: 'size', label: 'Total Size', children: bytes(version.totalSize) }, { key: 'created', label: 'Created', children: date(version.createdAt) }, { key: 'manifest', label: 'Manifest Key', span: 2, children: version.manifestKey ?? '--' }, { key: 'checksum', label: 'Manifest SHA-256', span: 2, children: shortHash(version.manifestChecksum) }, { key: 'git', label: 'Git Tag', children: version.gitTag ?? '--' }, { key: 'dvc', label: 'DVC Hash', children: shortHash(version.dvcHash) }]} /></div>;
}

function WorkspacePrompt() { return <Alert type="info" showIcon message="Select a dataset version" description="Choose a version from the timeline before opening this workspace." />; }

function CreateVersionModal({ dataset, open, onClose, onCreated }: { dataset: Dataset; open: boolean; onClose: () => void; onCreated: (version: DatasetVersion) => void }) {
  const latest = dataset.versions[0]?.id ?? '__EMPTY__'; const [source, setSource] = useState(latest);
  useEffect(() => { if (open) setSource(latest); }, [latest, open]);
  const create = useMutation({ mutationFn: () => api.createVersion(dataset.id, source === '__EMPTY__' ? { fileIds: [] } : { sourceVersionId: source }), onSuccess: (created) => { message.success(`Draft v${created.version} created`); onCreated(created); }, onError: (reason: Error) => message.error(reason.message) });
  return <Modal open={open} title="Create Dataset Version" okText="Create Draft" confirmLoading={create.isPending} onCancel={onClose} onOk={() => create.mutate()}><Typography.Paragraph type="secondary">Choose the membership starting point. The new version remains mutable until Freeze.</Typography.Paragraph><div className="create-version-source"><span>STARTING MEMBERSHIP</span><Select value={source} onChange={setSource} options={[...dataset.versions.map((version, index) => ({ value: version.id, label: `Copy v${version.version} · ${version.status}${index === 0 ? ' · Latest' : ''}` })), { value: '__EMPTY__', label: 'Start with an empty version' }]} /></div></Modal>;
}
