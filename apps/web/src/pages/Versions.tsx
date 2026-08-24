import { HistoryOutlined, SearchOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Card, Col, Input, Row, Select, Table, Typography } from 'antd';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { DataState, PageHeader, StatCard, VersionTag } from '../components/ui';
import { api, type DatasetVersion } from '../services/api';
import { bytes, date, shortHash } from '../services/format';

export function Versions() {
  const [params, setParams] = useSearchParams(); const navigate = useNavigate();
  const page = Number(params.get('page') ?? 1); const pageSize = Number(params.get('pageSize') ?? 20); const search = params.get('search') ?? ''; const status = params.get('status') ?? undefined; const sort = params.get('sort') ?? 'updatedAt:desc'; const legacyVersion = params.get('version') ?? undefined;
  const legacy = useQuery({ queryKey: ['datasets', 'legacy-version', legacyVersion], queryFn: () => api.version(legacyVersion!), enabled: Boolean(legacyVersion) });
  const versions = useQuery({ queryKey: ['versions', 'page', page, pageSize, search, status, sort], queryFn: () => { const [sortBy, sortOrder] = sort.split(':'); return api.versionPage({ page, pageSize, search, status, sortBy, sortOrder }); } });
  const dashboard = useQuery({ queryKey: ['dashboard', 7], queryFn: () => api.dashboard(7) });
  const update = (values: Record<string, string | number | undefined>) => setParams((current) => { for (const [key, value] of Object.entries(values)) { if (value === undefined || value === '') current.delete(key); else current.set(key, String(value)); } return current; });
  if (legacy.data) return <Navigate replace to={`/datasets/${legacy.data.datasetId}/versions/${legacy.data.id}`} />;
  const pipeline = dashboard.data?.pipeline;
  return <>
    <PageHeader eyebrow="VERSION MANAGEMENT" title="Dataset Versions" description="Server-backed lifecycle inventory with direct access to validation and comparison workspaces." />
    <Row gutter={[12, 12]} className="summary-row"><Col xs={12} md={6}><StatCard title="All Versions" value={pipeline ? Object.values(pipeline).reduce((sum, count) => sum + count, 0) : '--'} /></Col><Col xs={12} md={6}><StatCard title="Draft" value={pipeline?.DRAFT ?? '--'} /></Col><Col xs={12} md={6}><StatCard title="Frozen" value={pipeline?.FROZEN ?? '--'} tone="warning" /></Col><Col xs={12} md={6}><StatCard title="Published" value={pipeline?.PUBLISHED ?? '--'} tone="success" /></Col></Row>
    <Card variant="borderless" className="filter-bar"><div className="version-filter-grid"><Input.Search allowClear prefix={<SearchOutlined />} defaultValue={search} placeholder="Dataset, Git tag or commit" onSearch={(value) => update({ search: value, page: 1 })} /><Select allowClear value={status} placeholder="Lifecycle status" onChange={(value) => update({ status: value, page: 1 })} options={['DRAFT', 'FROZEN', 'PUBLISHED', 'ARCHIVED'].map((value) => ({ value, label: value }))} /><Select value={sort} onChange={(value) => update({ sort: value, page: 1 })} options={[{ value: 'updatedAt:desc', label: 'Recently updated' }, { value: 'createdAt:desc', label: 'Recently created' }, { value: 'version:desc', label: 'Highest version' }, { value: 'status:asc', label: 'Status' }]} /></div></Card>
    <DataState loading={versions.isLoading} error={(versions.error as Error | null)?.message} empty={!versions.data?.items.length} emptyTitle="No dataset versions found" emptyDescription="Create a version or adjust the filters.">
      <Card variant="borderless" className="table-panel"><Table rowKey="id" dataSource={versions.data?.items ?? []} scroll={{ x: 1320 }} onRow={(record) => ({ onClick: () => navigate(`/datasets/${record.datasetId}/versions/${record.id}`), className: 'clickable-row' })} pagination={{ current: page, pageSize, total: versions.data?.total, showSizeChanger: true, showTotal: (total) => `${total} versions`, onChange: (nextPage, nextSize) => update({ page: nextPage, pageSize: nextSize }) }} columns={[{ title: 'Dataset', width: 210, fixed: 'left', render: (_, row) => <span className="entity-name"><span className="entity-icon"><HistoryOutlined /></span><Typography.Text strong>{row.dataset.name}</Typography.Text></span> }, { title: 'Version', dataIndex: 'version', width: 85, render: (value) => <Typography.Text strong>v{value}</Typography.Text> }, { title: 'Status', dataIndex: 'status', width: 115, render: (value: DatasetVersion['status']) => <VersionTag status={value} /> }, { title: 'Files', dataIndex: 'fileCount', width: 75, align: 'right' }, { title: 'Size', dataIndex: 'totalSize', width: 110, align: 'right', render: bytes }, { title: 'Manifest', dataIndex: 'manifestChecksum', width: 150, render: (value) => shortHash(value) }, { title: 'Git Commit', dataIndex: 'gitCommit', width: 145, render: (value) => shortHash(value) }, { title: 'Git Tag', dataIndex: 'gitTag', width: 220, ellipsis: true, render: (value) => value ?? '--' }, { title: 'DVC Hash', dataIndex: 'dvcHash', width: 145, render: (value) => shortHash(value) }, { title: 'Updated', dataIndex: 'updatedAt', width: 175, render: date }]} /></Card>
    </DataState>
  </>;
}
