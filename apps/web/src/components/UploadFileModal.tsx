import { InboxOutlined } from '@ant-design/icons';
import { Form, Input, Modal, Select, Upload, message } from 'antd';
import type { UploadFile } from 'antd';
import { useEffect, useState } from 'react';
import { api, type Robot } from '../services/api';

export function UploadFileModal({ open, robots, onClose, onDone }: { open: boolean; robots: Robot[]; onClose: () => void; onDone: () => void }) {
  const [form] = Form.useForm();
  const [file, setFile] = useState<UploadFile>();
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (!open) { form.resetFields(); setFile(undefined); } }, [form, open]);
  const submit = async () => {
    const values = await form.validateFields();
    if (!file?.originFileObj) { message.error('Select a JSON file'); return; }
    setSaving(true);
    const payload = new FormData();
    Object.entries(values).forEach(([key, value]) => payload.append(key, String(value)));
    payload.append('file', file.originFileObj);
    api.upload(payload)
      .then(() => { message.success('File uploaded successfully'); onClose(); onDone(); })
      .catch((reason: Error) => message.error(reason.message))
      .finally(() => setSaving(false));
  };
  return <Modal open={open} title="Upload Recognition File" okText="Upload File" confirmLoading={saving} onCancel={onClose} onOk={() => void submit()}>
    <Form form={form} layout="vertical" requiredMark="optional" className="upload-form">
      <Form.Item name="robotId" label="Robot" rules={[{ required: true, message: 'Select a robot' }]}>
        <Select showSearch optionFilterProp="label" placeholder="Select robot" options={robots.map((robot) => ({ value: robot.id, label: `${robot.externalId ?? robot.id} · ${robot.name}` }))} />
      </Form.Item>
      <Form.Item name="recognitionType" label="Recognition Type" rules={[{ required: true, message: 'Enter a recognition type' }]}><Input placeholder="e.g. obstacle-detection" /></Form.Item>
      <Form.Item name="capturedAt" label="Captured At" rules={[{ required: true, message: 'Select the capture time' }]}><Input type="datetime-local" /></Form.Item>
      <Form.Item name="schemaVersion" label="Schema Version" rules={[{ required: true, message: 'Enter the schema version' }]}><Input placeholder="e.g. 1.0" /></Form.Item>
      <Upload.Dragger beforeUpload={(selected) => { setFile({ uid: selected.uid, name: selected.name, originFileObj: selected }); return false; }} onRemove={() => { setFile(undefined); }} fileList={file ? [file] : []} maxCount={1} accept="application/json,.json">
        <p className="ant-upload-drag-icon"><InboxOutlined /></p><p className="ant-upload-text">Drop a JSON file here or click to browse</p><p className="ant-upload-hint">JSON only · maximum 10 MiB · duplicate checksums are rejected</p>
      </Upload.Dragger>
    </Form>
  </Modal>;
}
