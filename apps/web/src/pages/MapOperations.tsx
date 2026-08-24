import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Empty, Input, Modal, Row, Select, Space, Table, Tag, Typography, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api, type PlatformMapVersion, type PlatformZone } from '../services/api';

const zoneColors: Record<string, string> = { CLEANING: '#4caf50', KEEP_OUT: '#ef5350', SLOW: '#ffb300', CHARGING: '#42a5f5', STANDBY: '#ab47bc' };

export function MapOperations() {
  const auth = useAuth();
  const client = useQueryClient();
  const maps = useQuery({ queryKey: ['platform-maps'], queryFn: api.platformMaps });
  const [mapId, setMapId] = useState<string>();
  const [versionId, setVersionId] = useState<string>();
  const [publishOpen, setPublishOpen] = useState(false);
  const [reason, setReason] = useState('');
  const detail = useQuery({ queryKey: ['platform-map', mapId], queryFn: () => api.platformMap(mapId!), enabled: Boolean(mapId) });
  const zones = useQuery({ queryKey: ['platform-map-zones', mapId, versionId], queryFn: () => api.platformMapZones(mapId!, versionId!), enabled: Boolean(mapId && versionId) });
  const publish = useMutation({
    mutationFn: () => api.publishPlatformMap(mapId!, versionId!, reason.trim()),
    onSuccess: async () => {
      message.success('地图版本已发布');
      setPublishOpen(false);
      setReason('');
      await Promise.all([client.invalidateQueries({ queryKey: ['platform-map', mapId] }), client.invalidateQueries({ queryKey: ['platform-maps'] })]);
    },
  });

  useEffect(() => {
    if (!mapId && maps.data?.items[0]) setMapId(maps.data.items[0].id);
  }, [mapId, maps.data]);
  useEffect(() => {
    const versions = detail.data?.versions ?? [];
    if (!versions.some((version) => version.id === versionId)) setVersionId(versions.find((version) => version.status === 'PUBLISHED')?.id ?? versions[0]?.id);
  }, [detail.data, versionId]);

  const selectedVersion = detail.data?.versions.find((version) => version.id === versionId);
  const canPublish = auth.hasRole('ADMIN', 'SUPER_ADMIN', 'TENANT_ADMIN', 'PROJECT_ADMIN') && ['DRAFT', 'VALIDATING'].includes(selectedVersion?.status ?? '');
  const error = maps.error ?? detail.error ?? zones.error ?? publish.error;

  return <section className="page-stack">
    <Typography.Title level={2}>地图管理</Typography.Title>
    <Alert type="info" showIcon message="仅展示 API 返回的 Map、Version 与 Zone 事实数据；当前 API 未提供底图下载，因此不绘制模拟底图或机器人轨迹。" />
    {error && <Alert type="error" showIcon message="地图数据或操作失败" description={error instanceof Error ? error.message : String(error)} />}
    <Card>
      <Space wrap>
        <Select style={{ minWidth: 260 }} loading={maps.isLoading} placeholder="选择地图" value={mapId} onChange={setMapId} options={(maps.data?.items ?? []).map((map) => ({ value: map.id, label: `${map.name} · ${map.floorName ?? map.floorId}` }))} />
        <Select style={{ minWidth: 220 }} loading={detail.isLoading} placeholder="选择版本" value={versionId} onChange={setVersionId} options={(detail.data?.versions ?? []).map((version) => ({ value: version.id, label: `v${version.version} · ${version.status}` }))} />
        {canPublish && <Button type="primary" onClick={() => setPublishOpen(true)}>发布所选版本</Button>}
      </Space>
    </Card>
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={15}><Card title="真实 Zone GeoJSON 预览"><ZonePreview zones={zones.data?.items ?? []} loading={zones.isLoading} /></Card></Col>
      <Col xs={24} xl={9}><Card title="版本信息"><VersionFacts version={selectedVersion} zoneCount={zones.data?.total} /></Card></Col>
    </Row>
    <Card title="地图清单"><Table rowKey="id" loading={maps.isLoading} dataSource={maps.data?.items ?? []} pagination={false} onRow={(row) => ({ onClick: () => setMapId(row.id), className: 'clickable-row' })} columns={[{ title: '地图', dataIndex: 'name' }, { title: '楼层', dataIndex: 'floorName' }, { title: '状态', dataIndex: 'status', render: (value) => <Tag>{String(value)}</Tag> }, { title: '更新时间', dataIndex: 'updatedAt', render: (value) => new Date(String(value)).toLocaleString() }]} /></Card>
    <Modal title="确认发布地图版本" open={publishOpen} confirmLoading={publish.isPending} okButtonProps={{ disabled: !reason.trim() }} onOk={() => publish.mutate()} onCancel={() => setPublishOpen(false)} okText="发布">
      <Typography.Paragraph type="secondary">发布会归档该地图当前的 PUBLISHED 版本。请填写可审计的发布原因。</Typography.Paragraph>
      <Input.TextArea value={reason} maxLength={500} showCount rows={4} onChange={(event) => setReason(event.target.value)} placeholder="发布原因（必填）" />
    </Modal>
  </section>;
}

function VersionFacts({ version, zoneCount }: { version?: PlatformMapVersion; zoneCount?: number }) {
  if (!version) return <Empty description="没有可用版本" />;
  return <Space direction="vertical"><Typography.Text>版本：v{version.version}</Typography.Text><Typography.Text>状态：<Tag>{version.status}</Tag></Typography.Text><Typography.Text>Zone：{zoneCount ?? '--'}</Typography.Text><Typography.Text>类型：{version.mimeType}</Typography.Text><Typography.Text copyable={{ text: version.checksum }}>校验和：{version.checksum}</Typography.Text><Typography.Text copyable={{ text: version.mapObjectKey }}>对象键：{version.mapObjectKey}</Typography.Text></Space>;
}

function ZonePreview({ zones, loading }: { zones: PlatformZone[]; loading: boolean }) {
  const points = useMemo(() => zones.flatMap((zone) => coordinates(zone.geometry.coordinates)), [zones]);
  if (loading) return <Typography.Text type="secondary">正在加载 Zone…</Typography.Text>;
  if (!points.length) return <Empty description="所选版本没有可渲染的 Point/Polygon Zone" />;
  const xs = points.map(([x]) => x); const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs); const maxX = Math.max(...xs); const minY = Math.min(...ys); const maxY = Math.max(...ys);
  const project = ([x, y]: [number, number]) => `${40 + (x - minX) / Math.max(maxX - minX, 1) * 720},${320 - (y - minY) / Math.max(maxY - minY, 1) * 280}`;
  return <><svg viewBox="0 0 800 360" style={{ width: '100%', background: '#0c1622', borderRadius: 8 }} aria-label="API Zone GeoJSON preview">
    {zones.map((zone) => {
      const shape = coordinates(zone.geometry.coordinates);
      const color = zoneColors[zone.type] ?? '#90a4ae';
      if (!shape.length) return null;
      if (zone.geometry.type === 'Point') { const [cx, cy] = project(shape[0]).split(','); return <g key={zone.id}><circle cx={cx} cy={cy} r="8" fill={color} /><title>{zone.name} · {zone.type}</title></g>; }
      return <polygon key={zone.id} points={shape.map(project).join(' ')} fill={`${color}33`} stroke={color} strokeWidth="3"><title>{zone.name} · {zone.type}</title></polygon>;
    })}
  </svg><Space wrap style={{ marginTop: 12 }}>{zones.map((zone) => <Tag key={zone.id} color={zoneColors[zone.type]}>{zone.name} · {zone.type}</Tag>)}</Space></>;
}

function coordinates(value: unknown): Array<[number, number]> {
  if (!Array.isArray(value)) return [];
  if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') return [[value[0], value[1]]];
  return value.flatMap(coordinates);
}
