import { ArrowRightOutlined, MinusCircleOutlined, PlusCircleOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Alert, Card, Col, Row, Select, Table, Tabs, Tag, Typography } from 'antd';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, type CompareFile, type Dataset } from '../services/api';
import { bytes, date, shortHash } from '../services/format';
import { DataState, StatCard, VersionTag } from './ui';

export function VersionCompare({ dataset, currentVersionId }: { dataset: Dataset; currentVersionId?: string }) {
  const [params, setParams] = useSearchParams();
  const versions = dataset.versions; const currentIndex = Math.max(0, versions.findIndex((version) => version.id === currentVersionId));
  const defaultTarget = versions[currentIndex]?.id ?? versions[0]?.id; const defaultBase = versions[currentIndex + 1]?.id ?? versions[1]?.id ?? versions[0]?.id;
  const base = params.get('base') ?? defaultBase; const target = params.get('target') ?? defaultTarget;
  useEffect(() => { if (base && target && (!params.get('base') || !params.get('target'))) setParams((current) => { current.set('base', base); current.set('target', target); return current; }, { replace: true }); }, [base, params, setParams, target]);
  const comparison = useQuery({ queryKey: ['datasets', 'compare', dataset.id, base, target], queryFn: () => api.compareVersions(dataset.id, base!, target!), enabled: Boolean(base && target && base !== target) });
  const options = versions.map((version) => ({ value: version.id, label: `v${version.version} · ${version.status}` }));
  const setVersion = (key: 'base' | 'target', value: string) => setParams((current) => { current.set(key, value); return current; });
  if (versions.length < 2) return <Alert type="info" showIcon message="A second version is required" description="Create another version to compare membership changes." />;
  return <div className="compare-workspace">
    <div className="compare-selectors"><div><span>BASE VERSION</span><Select value={base} options={options} onChange={(value) => setVersion('base', value)} /></div><ArrowRightOutlined /><div><span>TARGET VERSION</span><Select value={target} options={options} onChange={(value) => setVersion('target', value)} /></div></div>
    {base === target ? <Alert type="warning" showIcon message="Choose two different versions" /> : <DataState loading={comparison.isLoading} error={(comparison.error as Error | null)?.message} empty={false} emptyTitle="No comparison" emptyDescription="Select two versions.">
      {comparison.data && <><div className="comparison-heading"><div><Typography.Title level={4}>v{comparison.data.base.version} <ArrowRightOutlined /> v{comparison.data.target.version}</Typography.Title><Typography.Text type="secondary">RobotFile identity comparison · no inferred modifications</Typography.Text></div><div><VersionTag status={comparison.data.base.status} /> <ArrowRightOutlined /> <VersionTag status={comparison.data.target.status} /></div></div>
        <Row gutter={[12, 12]} className="summary-row"><Col xs={12} lg={6}><StatCard title="Added" value={comparison.data.summary.added} tone="success" /></Col><Col xs={12} lg={6}><StatCard title="Removed" value={comparison.data.summary.removed} tone="error" /></Col><Col xs={12} lg={6}><StatCard title="Unchanged" value={comparison.data.summary.unchanged} /></Col><Col xs={12} lg={6}><StatCard title="Size Delta" value={`${Number(comparison.data.summary.totalSizeDelta) >= 0 ? '+' : ''}${bytes(comparison.data.summary.totalSizeDelta)}`} /></Col></Row>
        <Card variant="borderless" className="table-panel"><Tabs items={[{ key: 'added', label: <span><PlusCircleOutlined /> Added ({comparison.data.files.added.length})</span>, children: <CompareTable files={comparison.data.files.added} tone="success" /> }, { key: 'removed', label: <span><MinusCircleOutlined /> Removed ({comparison.data.files.removed.length})</span>, children: <CompareTable files={comparison.data.files.removed} tone="error" /> }, { key: 'unchanged', label: `Unchanged (${comparison.data.files.unchanged.length})`, children: <CompareTable files={comparison.data.files.unchanged} /> }]} /></Card></>}
    </DataState>}
  </div>;
}

function CompareTable({ files, tone }: { files: CompareFile[]; tone?: 'success' | 'error' }) {
  return <Table size="small" rowKey="id" dataSource={files} pagination={{ pageSize: 10, showSizeChanger: false }} columns={[{ title: 'File', dataIndex: 'originalName', render: (value) => <Typography.Text strong>{value}</Typography.Text> }, { title: 'Robot', render: (_, file) => file.robot.externalId ?? file.robot.name }, { title: 'Recognition', dataIndex: 'recognitionType', render: (value) => <Tag color={tone}>{value}</Tag> }, { title: 'Schema', dataIndex: 'schemaVersion' }, { title: 'Size', dataIndex: 'fileSize', render: bytes }, { title: 'Checksum', dataIndex: 'checksum', render: (value) => shortHash(value) }, { title: 'Captured', dataIndex: 'capturedAt', render: date }]} />;
}
