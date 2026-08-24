import { ApiOutlined, DatabaseOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Empty, Flex, Skeleton, Tag, Typography } from 'antd';
import type { ReactNode } from 'react';
import type { DatasetVersion, HealthStatus } from '../services/api';

export type ServiceState = HealthStatus;

const statusConfig: Record<ServiceState, { color: string; label: string }> = {
  healthy: { color: 'success', label: 'Healthy' },
  degraded: { color: 'warning', label: 'Degraded' },
  unhealthy: { color: 'error', label: 'Unhealthy' },
  not_checked: { color: 'default', label: 'Not Checked' },
};

export function StatusBadge({ status, label }: { status: ServiceState; label?: string }) {
  const config = statusConfig[status];
  return <Tag bordered={false} color={config.color} className={`status-tag status-${status}`}><span className="status-dot" />{label ?? config.label}</Tag>;
}

const versionColors: Record<DatasetVersion['status'], string> = {
  DRAFT: 'gold',
  FROZEN: 'blue',
  PUBLISHED: 'green',
  ARCHIVED: 'default',
};

export function VersionTag({ status }: { status: DatasetVersion['status'] }) {
  return <Tag bordered={false} color={versionColors[status]}>{status}</Tag>;
}

export function PageHeader({ title, eyebrow, description, actions }: { title: string; eyebrow?: string; description?: string; actions?: ReactNode }) {
  return <div className="page-header">
    <div>
      {eyebrow && <Typography.Text className="eyebrow">{eyebrow}</Typography.Text>}
      <Typography.Title level={2}>{title}</Typography.Title>
      {description && <Typography.Paragraph type="secondary">{description}</Typography.Paragraph>}
    </div>
    {actions && <Flex gap={8} wrap="wrap">{actions}</Flex>}
  </div>;
}

const statIcons = {
  api: <ApiOutlined />,
  database: <DatabaseOutlined />,
  storage: <FolderOpenOutlined />,
};

export function StatCard({ title, value, suffix, caption, tone = 'default', icon }: { title: string; value: ReactNode; suffix?: string; caption?: ReactNode; tone?: 'default' | 'success' | 'warning' | 'error'; icon?: keyof typeof statIcons }) {
  return <Card className={`stat-card stat-card-${tone}`} variant="borderless">
    <Flex justify="space-between" align="flex-start">
      <div>
        <Typography.Text type="secondary">{title}</Typography.Text>
        <div className="stat-value">{value}{suffix && <span>{suffix}</span>}</div>
      </div>
      {icon && <div className="stat-icon">{statIcons[icon]}</div>}
    </Flex>
    {caption && <div className="stat-caption">{caption}</div>}
  </Card>;
}

export function DataState({ loading, error, empty, emptyTitle, emptyDescription, action, children }: { loading: boolean; error?: string; empty: boolean; emptyTitle: string; emptyDescription: string; action?: ReactNode; children: ReactNode }) {
  if (loading) return <Card variant="borderless"><Skeleton active paragraph={{ rows: 6 }} /></Card>;
  if (error) return <Alert type="error" showIcon message="Unable to load data" description={error} />;
  if (empty) return <Card variant="borderless" className="empty-panel"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<div><Typography.Title level={4}>{emptyTitle}</Typography.Title><Typography.Text type="secondary">{emptyDescription}</Typography.Text></div>}>{action}</Empty></Card>;
  return <>{children}</>;
}

export function PanelHeader({ title, extra }: { title: string; extra?: ReactNode }) {
  return <Flex className="panel-header" justify="space-between" align="center"><Typography.Title level={4}>{title}</Typography.Title>{extra}</Flex>;
}

export function UnavailableAction({ onClick }: { onClick?: () => void }) {
  return onClick ? <Button type="link" onClick={onClick}>View details</Button> : null;
}
