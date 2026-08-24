import { CheckCircleOutlined, LockOutlined, ReloadOutlined, RocketOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Modal, Row, Space, Table, Tag, Typography, message } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type DatasetVersion, type ValidationReport } from '../services/api';
import { bytes, date } from '../services/format';
import { StatCard } from './ui';
import { useOptionalAuth } from '../auth/AuthContext';

export function VersionValidation({ version, onChanged }: { version: DatasetVersion; onChanged: () => void }) {
  const auth = useOptionalAuth(); const canOperate = auth ? auth.hasRole('ADMIN', 'SUPER_ADMIN', 'TENANT_ADMIN', 'PROJECT_ADMIN', 'OPERATOR') : true;
  const [report, setReport] = useState<ValidationReport>(); const [freezing, setFreezing] = useState(false); const queryClient = useQueryClient();
  const navigate = useNavigate();
  const validate = useMutation({ mutationFn: () => api.validateVersion(version.id), onSuccess: setReport, onError: (reason: Error) => message.error(reason.message) });
  const refreshResources = async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ['datasets'] }), queryClient.invalidateQueries({ queryKey: ['versions'] }), queryClient.invalidateQueries({ queryKey: ['dashboard'] })]); onChanged(); };
  const freeze = async () => {
    setFreezing(true);
    try {
      const validation = await api.validateVersion(version.id); setReport(validation);
      if (!validation.valid) { message.error('Validation failed. Resolve all errors before freezing.'); return; }
      Modal.confirm({ title: `Freeze v${version.version}?`, content: 'Membership becomes immutable and a checksum-protected manifest is written to ObjectStorage.', okText: 'Freeze Version', onOk: async () => { await api.freeze(version.id); message.success('Version frozen'); await refreshResources(); } });
    } catch (reason) { message.error((reason as Error).message); }
    finally { setFreezing(false); }
  };
  const publish = async () => { try { const validation = await api.validateVersion(version.id); setReport(validation); if (!validation.valid) { message.error('Validation failed. Publication is blocked.'); return; } Modal.confirm({ title: `Publish v${version.version} with DVC?`, content: <><Alert type="success" showIcon message={`${validation.summary.files} files verified`} description="A durable background Job will run DVC and Git steps. The page can be closed safely." /><Typography.Paragraph type="secondary">The Worker serializes Git/DVC publication and retries infrastructure failures.</Typography.Paragraph></>, okText: 'Create Publish Job', onOk: async () => { const job = await api.publishJob(version.id); message.success('Publish job queued'); navigate(`/jobs/${job.id}`); } }); } catch (reason) { message.error((reason as Error).message); } };
  const recovery = async () => { try { const job = await api.recoveryJob(version.id); message.success('Recovery verification queued'); navigate(`/jobs/${job.id}`); } catch (reason) { message.error((reason as Error).message); } };
  return <div className="validation-workspace">
      <div className="builder-toolbar"><div><Typography.Title level={4}>Integrity Validation</Typography.Title><Typography.Text type="secondary">Reads each object with concurrency 3 and verifies its real byte length and SHA-256 checksum.</Typography.Text></div>{canOperate && <Space><Button icon={<ReloadOutlined />} loading={validate.isPending} onClick={() => validate.mutate()}>{validate.isPending ? 'Checking Objects' : 'Run Validation'}</Button>{version.status === 'DRAFT' && <Button type="primary" icon={<LockOutlined />} loading={freezing} onClick={() => void freeze()}>{freezing ? 'Checking Integrity' : 'Validate & Freeze'}</Button>}{version.status === 'FROZEN' && <Button type="primary" icon={<RocketOutlined />} onClick={() => void publish()}>Publish with DVC</Button>}{version.status === 'PUBLISHED' && <Button icon={<SafetyCertificateOutlined />} onClick={() => void recovery()}>Recovery Verify</Button>}</Space>}</div>
    {!canOperate && <Alert className="validation-result" type="info" showIcon message="Read-only access" description="Validation, freeze, publish and recovery operations require an Operator or Admin role." />}
    {!report ? <Card variant="borderless" className="validation-empty"><SafetyCertificateOutlined /><Typography.Title level={4}>No validation report in this session</Typography.Title><Typography.Text type="secondary">Reports are calculated on demand and are not persisted as business data.</Typography.Text></Card> : <>
      <Alert className="validation-result" showIcon type={report.valid ? 'success' : 'error'} message={report.valid ? 'Version integrity verified' : 'Version has blocking integrity errors'} description={`Validated ${date(report.validatedAt)} · ${report.summary.checkedObjects}/${report.summary.files} file objects read`} />
      <Row gutter={[12, 12]} className="summary-row"><Col xs={12} lg={6}><StatCard title="Files" value={report.summary.files} /></Col><Col xs={12} lg={6}><StatCard title="Verified Data" value={bytes(report.summary.totalSize)} /></Col><Col xs={12} lg={6}><StatCard title="Errors" value={report.summary.errors} tone={report.summary.errors ? 'error' : 'success'} /></Col><Col xs={12} lg={6}><StatCard title="Warnings" value={report.summary.warnings} tone={report.summary.warnings ? 'warning' : 'default'} /></Col></Row>
      <Card variant="borderless" className="table-panel"><Table size="small" rowKey={(issue) => `${issue.code}:${issue.fileId ?? issue.objectKey ?? 'version'}`} dataSource={report.issues} pagination={false} locale={{ emptyText: <span><CheckCircleOutlined /> No integrity issues found</span> }} columns={[{ title: 'Severity', dataIndex: 'severity', width: 105, render: (value) => <Tag color={value === 'error' ? 'error' : 'warning'}>{String(value).toUpperCase()}</Tag> }, { title: 'Code', dataIndex: 'code', width: 220, render: (value) => <Typography.Text code>{value}</Typography.Text> }, { title: 'Message', dataIndex: 'message' }, { title: 'Object', dataIndex: 'objectKey', width: 280, ellipsis: true, render: (value) => value ?? '--' }]} /></Card>
    </>}
  </div>;
}
