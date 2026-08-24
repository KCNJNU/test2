import { DatabaseOutlined, HistoryOutlined } from '@ant-design/icons';
import { Button, Card, Flex, Progress, Tag, Typography } from 'antd';
import type { Dataset } from '../services/api';
import { bytes, date } from '../services/format';
import { VersionTag } from './ui';

export function DatasetCard({ dataset, onOpen, onVersion }: { dataset: Dataset; onOpen: () => void; onVersion: (id: string) => void }) {
  const latest = dataset.versions[0];
  return <Card variant="borderless" className="dataset-card" actions={[
    <Button type="link" key="manage" onClick={onOpen}>Manage dataset</Button>,
    <Button type="link" key="history" icon={<HistoryOutlined />} disabled={!latest} onClick={() => latest && onVersion(latest.id)}>Latest version</Button>,
  ]}>
    <Flex justify="space-between" align="flex-start" gap={16}>
      <span className="dataset-icon"><DatabaseOutlined /></span>
      {latest ? <VersionTag status={latest.status} /> : <Tag bordered={false}>NO VERSION</Tag>}
    </Flex>
    <Typography.Title level={4} ellipsis={{ tooltip: dataset.name }}>{dataset.name}</Typography.Title>
    <Typography.Paragraph type="secondary" ellipsis={{ rows: 2, tooltip: dataset.description }}>{dataset.description || 'No description provided.'}</Typography.Paragraph>
    <div className="dataset-stats">
      <div><span>Latest Version</span><strong>{latest ? `v${latest.version}` : '--'}</strong></div>
      <div><span>File Count</span><strong>{latest?.fileCount ?? 0}</strong></div>
      <div><span>Total Size</span><strong>{bytes(latest?.totalSize)}</strong></div>
    </div>
    <Progress percent={latest?.status === 'PUBLISHED' ? 100 : latest?.status === 'FROZEN' ? 70 : latest ? 35 : 0} showInfo={false} strokeColor={latest?.status === 'PUBLISHED' ? '#2f855a' : '#3569a8'} trailColor="#edf1f5" size="small" />
    <Typography.Text type="secondary" className="dataset-updated">Updated {date(dataset.updatedAt)}</Typography.Text>
  </Card>;
}
