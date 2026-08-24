import { ApiOutlined, CheckCircleOutlined, CloudServerOutlined, DatabaseOutlined, HddOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { Card, Col, Row, Timeline, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { PageHeader, StatCard, StatusBadge } from '../components/ui';
import { api, pendingHealth, unreachableHealth, type Health, type HealthStatus, type ObservabilitySummary, type ServiceHealth } from '../services/api';
import { statusTone } from '../services/health';

export function SystemStatus() {
  const [health, setHealth] = useState<Health>(pendingHealth);
  const [summary, setSummary] = useState<ObservabilitySummary>();
  useEffect(() => { api.health().then(setHealth).catch(() => setHealth(unreachableHealth())); }, []);
  useEffect(() => { api.observabilitySummary().then(setSummary).catch(() => setSummary(undefined)); }, []);
  const { services } = health;
  return <>
    <PageHeader eyebrow="INFRASTRUCTURE" title="System Status" description="Live dependency health reported by the unified platform API." />
    <Row gutter={[14, 14]} className="summary-row">
      <HealthCard title="API" service={services.api} icon="api" />
      <HealthCard title="PostgreSQL" service={services.postgresql} icon="database" />
      <HealthCard title="Redis" service={services.redis} />
      <HealthCard title="EMQX" service={services.mqtt} />
      <HealthCard title="Object Storage" service={services.objectStorage} icon="storage" />
      <HealthCard title="Job Queue" service={services.messageQueue} />
      <HealthCard title="DVC Remote" service={services.dvcRemote} />
      <HealthCard title="Worker" service={services.worker} />
      <HealthCard title="Device PKI" service={services.certificate} />
      <HealthCard title="Backups" service={services.backup} icon="storage" />
      <HealthCard title="Restore Drill" service={services.restoreDrill} />
      <HealthCard title="Retention" service={services.retention} />
    </Row>
    <Card variant="borderless" className="status-detail-card observability-card" title="Fleet & Command Signals" extra={<Typography.Text type="secondary">Tenant scoped · last refresh {summary ? new Date(summary.timestamp).toLocaleTimeString() : 'unavailable'}</Typography.Text>}>
      <Row gutter={[12, 12]}>
        <Signal title="Robots Online" value={summary?.fleet.online} tone="success" />
        <Signal title="Robots Offline" value={summary?.fleet.offline} tone={summary?.fleet.offline ? 'warning' : 'default'} />
        <Signal title="Running" value={summary?.fleet.running} />
        <Signal title="Blocked" value={summary?.fleet.blocked} tone={summary?.fleet.blocked ? 'error' : 'default'} />
        <Signal title="Fault" value={summary?.fleet.fault} tone={summary?.fleet.fault ? 'error' : 'default'} />
        <Signal title="SAFE Events / 1h" value={summary?.fleet.safeEventsHour} tone={summary?.fleet.safeEventsHour ? 'warning' : 'default'} />
        <Signal title="Commands Sent" value={summary?.commands.sent} />
        <Signal title="Accepted" value={summary?.commands.accepted} tone="success" />
        <Signal title="Rejected" value={summary?.commands.rejected} tone={summary?.commands.rejected ? 'warning' : 'default'} />
        <Signal title="Timeout" value={summary?.commands.timeout} tone={summary?.commands.timeout ? 'error' : 'default'} />
        <Signal title="Failed" value={summary?.commands.failed} tone={summary?.commands.failed ? 'error' : 'default'} />
        <Signal title="Tasks Blocked" value={summary?.tasks.blocked} tone={summary?.tasks.blocked ? 'warning' : 'default'} />
      </Row>
    </Card>
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={15}><Card variant="borderless" className="status-detail-card" title="Service Health"><div className="service-status-list">
        <ServiceRow icon={<ApiOutlined />} name="Platform API" description="Unified REST API liveness" service={services.api} />
        <ServiceRow icon={<DatabaseOutlined />} name="PostgreSQL" description="Application database connection" service={services.postgresql} />
        <ServiceRow icon={<DatabaseOutlined />} name="Redis" description="Cache and coordination service" service={services.redis} />
        <ServiceRow icon={<ApiOutlined />} name="EMQX MQTT" description="Development MQTT broker connectivity" service={services.mqtt} />
        <ServiceRow icon={<HddOutlined />} name="MinIO Object Storage" description="Raw recognition file bucket" service={services.objectStorage} />
        <ServiceRow icon={<CloudServerOutlined />} name="PostgreSQL Job Queue" description="Durable background job queue storage" service={services.messageQueue} />
        <ServiceRow icon={<SafetyCertificateOutlined />} name="DVC Remote" description="Published dataset snapshot bucket" service={services.dvcRemote} />
        <ServiceRow icon={<CloudServerOutlined />} name="Operations Worker" description="PostgreSQL job queue consumer" service={services.worker} />
        <ServiceRow icon={<SafetyCertificateOutlined />} name="Device Certificate Inventory" description="Vault PKI registration and expiry window" service={services.certificate} />
        <ServiceRow icon={<HddOutlined />} name="Encrypted Backups" description="PostgreSQL and object snapshots within RPO" service={services.backup} />
        <ServiceRow icon={<CheckCircleOutlined />} name="Restore Drill" description="Latest isolated recovery verification" service={services.restoreDrill} />
        <ServiceRow icon={<CloudServerOutlined />} name="Retention Policy" description="Guarded background data lifecycle execution" service={services.retention} />
      </div></Card></Col>
      <Col xs={24} xl={9}><Card variant="borderless" className="status-detail-card" title="Health Check Context"><Timeline items={[
        { dot: <CheckCircleOutlined />, color: timelineColor(health.status), children: <><Typography.Text strong>Aggregate status: {label(health.status)}</Typography.Text><small>{health.timestamp ? new Date(health.timestamp).toLocaleString() : 'Health check pending'}</small></> },
        { dot: <DatabaseOutlined />, color: timelineColor(services.postgresql.status), children: <><Typography.Text strong>PostgreSQL probe</Typography.Text><small>Lightweight SELECT 1 query</small></> },
        { dot: <ApiOutlined />, color: timelineColor(services.mqtt.status), children: <><Typography.Text strong>EMQX and Redis probes</Typography.Text><small>Protocol-level MQTT CONNECT and Redis PING; probe connections are immediately closed.</small></> },
        { dot: <CloudServerOutlined />, color: timelineColor(services.objectStorage.status), children: <><Typography.Text strong>Storage probes</Typography.Text><small>Read-only bucket accessibility checks; no temporary objects are uploaded.</small></> },
        { dot: <SafetyCertificateOutlined />, color: timelineColor(services.certificate.status), children: <><Typography.Text strong>Production hardening</Typography.Text><small>Device certificate expiry, encrypted backup RPO, restore drill and retention gates.</small></> },
      ]} /><Typography.Paragraph type="secondary">Not Checked means a probe could not run because its configuration or the health endpoint was unavailable. It does not mean the dependency is down.</Typography.Paragraph></Card></Col>
    </Row>
  </>;
}

function Signal({ title, value, tone = 'default' }: { title: string; value?: number; tone?: 'default' | 'success' | 'warning' | 'error' }) {
  return <Col xs={12} md={8} lg={6} xl={4}><StatCard title={title} value={value ?? '--'} tone={tone} /></Col>;
}

function HealthCard({ title, service, icon }: { title: string; service: ServiceHealth; icon?: 'api' | 'database' | 'storage' }) {
  return <Col xs={24} sm={12} lg={8} xl={6}><StatCard title={title} value={<StatusBadge status={service.status} />} tone={statusTone(service.status)} caption={serviceCaption(service)} icon={icon} /></Col>;
}

function ServiceRow({ icon, name, description, service }: { icon: React.ReactNode; name: string; description: string; service: ServiceHealth }) {
  return <div className="service-row"><span className="service-icon">{icon}</span><div><Typography.Text strong>{name}</Typography.Text><small>{description}{service.bucket ? ` · ${service.bucket}` : ''}</small></div><Typography.Text type="secondary" className="service-detail">{service.message}</Typography.Text><StatusBadge status={service.status} /></div>;
}

function serviceCaption(service: ServiceHealth) { return service.bucket ? `${service.bucket} · ${service.message}` : service.message; }
function timelineColor(status: HealthStatus) { return status === 'healthy' ? 'green' : status === 'degraded' ? 'orange' : status === 'unhealthy' ? 'red' : 'gray'; }
function label(status: HealthStatus) { return status.split('_').map((part) => part[0].toUpperCase() + part.slice(1)).join(' '); }
