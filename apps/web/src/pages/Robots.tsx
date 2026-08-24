import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Input, Select, Space, Table, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CreateRobotModal, RobotDetailDrawer } from '../components/RobotDrawers';
import { DataState, PageHeader } from '../components/ui';
import { api, type ActivityStatus } from '../services/api';
import { bytes, date } from '../services/format';
import { useOptionalAuth } from '../auth/AuthContext';

const statusConfig: Record<ActivityStatus, { label: string; color: string }> = { ACTIVE: { label: 'Data Active', color: 'success' }, IDLE: { label: 'Idle', color: 'warning' }, NO_DATA: { label: 'No Data', color: 'default' } };
export function Robots() {
  const auth = useOptionalAuth(); const canMutate = auth ? auth.hasRole('ADMIN', 'SUPER_ADMIN', 'TENANT_ADMIN', 'PROJECT_ADMIN', 'OPERATOR') : true;
  const [params, setParams] = useSearchParams(); const navigate = useNavigate(); const [createOpen, setCreateOpen] = useState(false);
  const page = Number(params.get('page') ?? 1); const pageSize = Number(params.get('pageSize') ?? 20); const search = params.get('search') ?? ''; const activity = params.get('activity') ?? undefined; const sortBy = params.get('sortBy') ?? 'createdAt'; const sortOrder = params.get('sortOrder') ?? 'desc';
  const robots = useQuery({ queryKey: ['robots', 'page', page, pageSize, search, activity, sortBy, sortOrder], queryFn: () => api.robotPage({ page, pageSize, search, activity, sortBy, sortOrder }) });
  const update = (values: Record<string, string | number | undefined>) => setParams((current) => { for (const [key, value] of Object.entries(values)) { if (value === undefined || value === '') current.delete(key); else current.set(key, String(value)); } return current; });
  return <>
    <PageHeader eyebrow="FLEET MANAGEMENT" title="Robots" description="Monitor robot data contribution and inspect files without leaving the fleet table." actions={canMutate ? <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>Add Robot</Button> : undefined} />
    <Card variant="borderless" className="filter-bar"><Space wrap><Input.Search allowClear prefix={<SearchOutlined />} defaultValue={search} placeholder="Search robot code or name" onSearch={(value) => update({ search: value, page: 1 })} className="wide-search" /><Select allowClear value={activity} placeholder="Data activity" onChange={(value) => update({ activity: value, page: 1 })} options={[{ value: 'ACTIVE', label: 'Data Active · last 24h' }, { value: 'IDLE', label: 'Idle · no upload 24h' }, { value: 'NO_DATA', label: 'No Data' }]} /><Select value={`${sortBy}:${sortOrder}`} onChange={(value) => { const [nextSortBy, nextSortOrder] = value.split(':'); update({ sortBy: nextSortBy, sortOrder: nextSortOrder, page: 1 }); }} options={[{ value: 'createdAt:desc', label: 'Newest registered' }, { value: 'name:asc', label: 'Name A–Z' }, { value: 'externalId:asc', label: 'Robot code A–Z' }]} /><Button icon={<ReloadOutlined />} onClick={() => void robots.refetch()}>Refresh</Button></Space></Card>
    <DataState loading={robots.isLoading} error={robots.error instanceof Error ? robots.error.message : undefined} empty={!robots.data?.items.length} emptyTitle={search || activity ? 'No robots match this view' : 'No robots registered'} emptyDescription="Create a robot or change the current filters." action={canMutate ? <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>Add Robot</Button> : undefined}>
      <Card variant="borderless" className="table-panel"><Table rowKey="id" dataSource={robots.data?.items ?? []} scroll={{ x: 1120 }} onRow={(row) => ({ onClick: () => update({ robot: row.id }), className: 'clickable-row' })} pagination={{ current: page, pageSize, total: robots.data?.total, showSizeChanger: true, showTotal: (total) => `${total} robots`, onChange: (nextPage, nextSize) => update({ page: nextPage, pageSize: nextSize }) }} columns={[{ title: 'Robot', width: 190, render: (_, row) => <div><Typography.Text strong>{row.externalId ?? row.id.slice(0, 8)}</Typography.Text><small className="table-secondary">{row.name}</small></div> }, { title: 'Data Activity', width: 125, render: (_, row) => row.stats && <Tag color={statusConfig[row.stats.activityStatus].color}>{statusConfig[row.stats.activityStatus].label}</Tag> }, { title: 'Last Upload', width: 175, render: (_, row) => row.stats?.lastUpload ? date(row.stats.lastUpload) : '--' }, { title: 'Files 24h', width: 100, align: 'right', render: (_, row) => row.stats?.files24h ?? 0 }, { title: 'Total Files', width: 100, align: 'right', render: (_, row) => row.stats?.totalFiles ?? 0 }, { title: 'Storage', width: 110, align: 'right', render: (_, row) => bytes(row.stats?.totalBytes) }, { title: 'Recognition Types', width: 240, render: (_, row) => row.stats?.recognitionTypes.length ? row.stats.recognitionTypes.slice(0, 3).map((value) => <Tag key={value}>{value}</Tag>) : '--' }, { title: 'Created', dataIndex: 'createdAt', width: 175, render: date }]} /></Card>
    </DataState>
    {canMutate && <CreateRobotModal open={createOpen} onClose={() => setCreateOpen(false)} />}
    <RobotDetailDrawer robotId={params.get('robot') ?? undefined} onClose={() => update({ robot: undefined })} onFile={(id) => navigate(`/files?file=${id}`)} />
  </>;
}
