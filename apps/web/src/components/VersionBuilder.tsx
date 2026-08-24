import { DeleteOutlined, PlusOutlined, SaveOutlined, SearchOutlined, UndoOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Input, Space, Table, Tag, Typography, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, type DatasetVersion, type RobotFile } from '../services/api';
import { bytes, date } from '../services/format';
import { useOptionalAuth } from '../auth/AuthContext';

export function VersionBuilder({ version, onDirtyChange }: { version: DatasetVersion; onDirtyChange: (dirty: boolean) => void }) {
  const auth = useOptionalAuth(); const canMutate = auth ? auth.hasRole('ADMIN', 'SUPER_ADMIN', 'TENANT_ADMIN', 'PROJECT_ADMIN', 'OPERATOR') : true;
  const [params, setParams] = useSearchParams(); const queryClient = useQueryClient();
  const search = params.get('candidateSearch') ?? ''; const page = Number(params.get('candidatePage') ?? 1);
  const initial = useMemo(() => version.files?.map((membership) => membership.robotFile) ?? [], [version.files]);
  const [selected, setSelected] = useState<RobotFile[]>(initial);
  useEffect(() => setSelected(initial), [initial, version.id]);
  const initialKey = useMemo(() => initial.map((file) => file.id).sort().join(','), [initial]); const selectedKey = useMemo(() => selected.map((file) => file.id).sort().join(','), [selected]); const dirty = initialKey !== selectedKey;
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
  useEffect(() => { const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); }; window.addEventListener('beforeunload', beforeUnload); return () => window.removeEventListener('beforeunload', beforeUnload); }, [dirty]);
  const candidates = useQuery({ queryKey: ['datasets', 'version-candidates', version.id, search, page], queryFn: () => api.versionCandidates(version.id, { search, page, pageSize: 8 }), enabled: version.status === 'DRAFT' });
  const save = useMutation({ mutationFn: () => api.replaceVersionFiles(version.id, selected.map((file) => file.id)), onSuccess: async () => { message.success('Draft membership saved'); await Promise.all([queryClient.invalidateQueries({ queryKey: ['datasets'] }), queryClient.invalidateQueries({ queryKey: ['versions'] })]); }, onError: (reason: Error) => message.error(reason.message) });
  const updateSearch = (value: string) => setParams((current) => { if (value) current.set('candidateSearch', value); else current.delete('candidateSearch'); current.set('candidatePage', '1'); return current; });
  if (!canMutate) return <Alert showIcon type="info" message="Read-only access" description="Viewer accounts can inspect and compare dataset versions but cannot change membership." />;
  if (version.status !== 'DRAFT') return <Alert showIcon type="info" message="This version is immutable" description="Frozen, published and archived versions can be inspected and compared, but their membership cannot be edited." />;
  const selectedIds = new Set(selected.map((file) => file.id));
  return <div className="version-builder">
    <div className="builder-toolbar"><div><Typography.Title level={4}>Version Builder</Typography.Title><Typography.Text type="secondary">Stage RobotFiles locally, then save the complete DRAFT membership atomically.</Typography.Text></div><Space><Button icon={<UndoOutlined />} disabled={!dirty} onClick={() => setSelected(initial)}>Reset</Button><Button type="primary" icon={<SaveOutlined />} loading={save.isPending} disabled={!dirty} onClick={() => save.mutate()}>Save Changes</Button></Space></div>
    {dirty && <Alert className="builder-dirty-alert" type="warning" showIcon message="Unsaved membership changes" description="Leaving or selecting another version will discard the staged selection." />}
    <div className="builder-columns">
      <Card variant="borderless" className="builder-pane"><div className="builder-pane-header"><div><strong>Available Files</strong><small>{candidates.data?.total ?? '--'} candidates</small></div><Input.Search allowClear prefix={<SearchOutlined />} defaultValue={search} placeholder="Search candidates" onSearch={updateSearch} /></div><Table size="small" rowKey="id" loading={candidates.isLoading} dataSource={candidates.data?.items ?? []} pagination={{ current: page, pageSize: 8, total: candidates.data?.total, showSizeChanger: false, onChange: (next) => setParams((current) => { current.set('candidatePage', String(next)); return current; }) }} columns={[{ title: 'File', render: (_, file) => <div><Typography.Text strong>{file.originalName}</Typography.Text><small className="table-secondary">{file.robot?.externalId ?? file.robot?.name}</small></div> }, { title: 'Type', dataIndex: 'recognitionType', width: 120, render: (value) => <Tag>{value}</Tag> }, { title: 'Size', dataIndex: 'fileSize', width: 85, render: bytes }, { title: '', width: 44, render: (_, file) => <Button aria-label={`Add ${file.originalName}`} type="text" icon={<PlusOutlined />} disabled={selectedIds.has(file.id)} onClick={() => setSelected((current) => [...current, file])} /> }]} /></Card>
      <Card variant="borderless" className="builder-pane selected-pane"><div className="builder-pane-header"><div><strong>Selected Membership</strong><small>{selected.length} files · {bytes(selected.reduce((sum, file) => sum + BigInt(file.fileSize), 0n).toString())}</small></div></div><Table size="small" rowKey="id" dataSource={selected} pagination={{ pageSize: 8, showSizeChanger: false }} columns={[{ title: 'File', render: (_, file) => <div><Typography.Text strong>{file.originalName}</Typography.Text><small className="table-secondary">Captured {date(file.capturedAt)}</small></div> }, { title: 'Schema', dataIndex: 'schemaVersion', width: 85 }, { title: 'Size', dataIndex: 'fileSize', width: 85, render: bytes }, { title: '', width: 44, render: (_, file) => <Button aria-label={`Remove ${file.originalName}`} danger type="text" icon={<DeleteOutlined />} onClick={() => setSelected((current) => current.filter((item) => item.id !== file.id))} /> }]} /></Card>
    </div>
  </div>;
}
