import {
  CloseOutlined,
  DeleteOutlined,
  InboxOutlined,
  ReloadOutlined,
  StopOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import {
  App as AntApp,
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  Progress,
  Radio,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
} from "antd";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/ui";
import { api } from "../services/api";
import { bytes } from "../services/format";
import {
  useUploadQueue,
  type UploadQueueItem,
  type UploadStatus,
} from "../upload/UploadQueueContext";

const statusConfig: Record<UploadStatus, { color: string; label: string }> = {
  QUEUED: { color: "default", label: "Queued" },
  HASHING: { color: "processing", label: "Hashing" },
  CHECKING_DUPLICATE: { color: "processing", label: "Checking Duplicate" },
  UPLOADING: { color: "blue", label: "Uploading & Saving" },
  FINALIZING: { color: "processing", label: "Finalizing" },
  COMPLETED: { color: "success", label: "Completed" },
  FAILED: { color: "error", label: "Failed" },
  CANCELLED: { color: "default", label: "Cancelled" },
  DUPLICATE: { color: "warning", label: "Duplicate" },
};
export function UploadCenter() {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const queue = useUploadQueue();
  const navigate = useNavigate();
  const robots = useQuery({
    queryKey: ["robots", "selector"],
    queryFn: api.robots,
  });
  const running = queue.items.some((item) =>
    ["HASHING", "CHECKING_DUPLICATE", "UPLOADING", "FINALIZING"].includes(item.status),
  );
  const queued = queue.items.filter((item) => item.status === "QUEUED").length;
  const start = async () => {
    const values = await form.validateFields();
    let metadata: Record<string, unknown> | undefined;
    try {
      const parsed: unknown = values.metadata
        ? JSON.parse(values.metadata)
        : undefined;
      if (
        parsed !== undefined &&
        (!parsed || Array.isArray(parsed) || typeof parsed !== "object")
      )
        throw new Error("not an object");
      metadata = parsed as Record<string, unknown> | undefined;
    } catch {
      form.setFields([
        { name: "metadata", errors: ["Enter a valid JSON object"] },
      ]);
      return;
    }
    await queue.start({
      robotId: values.robotId,
      recognitionType: values.recognitionType,
      schemaVersion: values.schemaVersion,
      capturedAtStrategy: values.capturedAtStrategy,
      capturedAt: values.capturedAt
        ? new Date(values.capturedAt).toISOString()
        : undefined,
      metadata,
    });
    message.info("Upload queue processing finished");
  };
  return (
    <>
      <PageHeader
        eyebrow="DATA INGESTION"
        title="Upload Center"
        description="Resumable 8 MiB parts, incremental SHA-256, durable server sessions and background finalization."
        actions={
          <Space>
            <Button onClick={queue.clearCompleted}>Clear completed</Button>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              disabled={!queued || running}
              onClick={() => void start()}
            >
              Start {queued || ""}
            </Button>
          </Space>
        }
      />
      <Row gutter={[12, 12]}>
        <Col xs={24} xl={8}>
          <Card variant="borderless" className="panel-card">
            <Typography.Title level={4}>Upload Defaults</Typography.Title>
            <Form
              form={form}
              layout="vertical"
              initialValues={{
                capturedAtStrategy: "NOW",
                schemaVersion: "1.0",
              }}
            >
              <Form.Item
                name="robotId"
                label="Robot"
                rules={[{ required: true }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={robots.data?.map((robot) => ({
                    value: robot.id,
                    label: `${robot.externalId ?? robot.id.slice(0, 8)} · ${robot.name}`,
                  }))}
                  placeholder="Select target robot"
                />
              </Form.Item>
              <Form.Item
                name="recognitionType"
                label="Recognition Type"
                rules={[{ required: true }]}
              >
                <Input placeholder="e.g. obstacle-detection" />
              </Form.Item>
              <Form.Item
                name="schemaVersion"
                label="Schema Version"
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name="capturedAtStrategy"
                label="Captured Time Strategy"
              >
                <Radio.Group>
                  <Radio value="NOW">Upload time</Radio>
                  <Radio value="LAST_MODIFIED">File modified time</Radio>
                  <Radio value="CUSTOM">Custom time</Radio>
                </Radio.Group>
              </Form.Item>
              <Form.Item
                noStyle
                shouldUpdate={(previous, current) =>
                  previous.capturedAtStrategy !== current.capturedAtStrategy
                }
              >
                {({ getFieldValue }) =>
                  getFieldValue("capturedAtStrategy") === "CUSTOM" && (
                    <Form.Item
                      name="capturedAt"
                      label="Captured At"
                      rules={[{ required: true }]}
                    >
                      <Input type="datetime-local" />
                    </Form.Item>
                  )
                }
              </Form.Item>
              <Form.Item name="metadata" label="Custom Metadata JSON">
                <Input.TextArea
                  rows={6}
                  placeholder={'{\n  "source": "field-test"\n}'}
                />
              </Form.Item>
            </Form>
            <Alert
              type="info"
              showIcon
            message="Durable resumable ingestion"
            description="Queue descriptors and completed part numbers persist in IndexedDB. File bytes never do; after refresh, reselect the same file to continue."
            />
          </Card>
        </Col>
        <Col xs={24} xl={16}>
          <Card variant="borderless" className="panel-card">
            <Upload.Dragger
              multiple
              accept=".json,.jpg,.jpeg,.png,.pcd,.pgm,.yaml,.yml,.log,.txt"
              showUploadList={false}
              beforeUpload={(file) => {
                queue.addFiles([file]);
                return Upload.LIST_IGNORE;
              }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">Drop files here or click to select files</p>
              <p className="ant-upload-hint">
                JSON · Images · PCD · PGM/YAML maps · Logs, up to the configured
                format limit
              </p>
            </Upload.Dragger>
            <div style={{ marginTop: 10 }}>
              <Upload
                multiple
                directory
                accept=".json,.jpg,.jpeg,.png,.pcd,.pgm,.yaml,.yml,.log,.txt"
                showUploadList={false}
                beforeUpload={(file) => {
                  queue.addFiles([file]);
                  return Upload.LIST_IGNORE;
                }}
              >
                <Button icon={<InboxOutlined />}>Select a folder</Button>
              </Upload>
            </div>
            <div className="queue-summary">
              <span>
                <strong>{queue.items.length}</strong> total
              </span>
              <span>
                <strong>{queued}</strong> queued
              </span>
              <span>
                <strong>
                  {
                    queue.items.filter((item) => item.status === "COMPLETED")
                      .length
                  }
                </strong>{" "}
                completed
              </span>
              <span>
                <strong>
                  {
                    queue.items.filter((item) => item.status === "FAILED")
                      .length
                  }
                </strong>{" "}
                failed
              </span>
            </div>
            <Table
              size="small"
              rowKey="id"
              dataSource={queue.items}
              pagination={false}
              scroll={{ x: 850, y: 430 }}
              locale={{ emptyText: "Select files to build an upload queue" }}
              columns={[
                {
                  title: "Filename",
                  width: 250,
                  render: (_, item) => (
                    <div>
                      <Typography.Text strong ellipsis>
                        {item.fileName}
                      </Typography.Text>
                      <small className="table-secondary">
                        {bytes(item.fileSize)}
                        {!item.file ? " · reselect to resume" : ""}
                      </small>
                    </div>
                  ),
                },
                {
                  title: "Status",
                  width: 160,
                  render: (_, item) => (
                    <>
                      <Tag color={statusConfig[item.status].color}>
                        {statusConfig[item.status].label}
                      </Tag>
                      {item.error && (
                        <small className="queue-error">{item.error}</small>
                      )}
                    </>
                  ),
                },
                {
                  title: "Progress",
                  width: 180,
                  render: (_, item) => (
                    <Progress
                      size="small"
                      percent={item.progress}
                      status={
                        item.status === "FAILED"
                          ? "exception"
                          : item.status === "COMPLETED"
                            ? "success"
                            : "active"
                      }
                    />
                  ),
                },
                {
                  title: "Checksum / Result",
                  render: (_, item) => (
                    <Typography.Text className="mono-value" ellipsis>
                      {item.existing
                        ? `Existing: ${item.existing.originalName}`
                        : (item.result?.objectKey ?? item.checksum ?? "--")}
                    </Typography.Text>
                  ),
                },
                {
                  title: "Actions",
                  width: 110,
                  fixed: "right",
                  render: (_, item) => (
                    <QueueActions
                      item={item}
                      onCancel={() => queue.cancel(item.id)}
                      onRetry={() => queue.retry(item.id)}
                      onRemove={() => queue.remove(item.id)}
                      onExisting={() =>
                        item.existing &&
                        navigate(`/files?file=${item.existing.id}`)
                      }
                    />
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </>
  );
}
function QueueActions({
  item,
  onCancel,
  onRetry,
  onRemove,
  onExisting,
}: {
  item: UploadQueueItem;
  onCancel: () => void;
  onRetry: () => void;
  onRemove: () => void;
  onExisting: () => void;
}) {
  if (["HASHING", "CHECKING_DUPLICATE", "UPLOADING", "FINALIZING"].includes(item.status))
    return (
      <Button danger type="text" icon={<StopOutlined />} onClick={onCancel}>
        Cancel
      </Button>
    );
  if (item.status === "FAILED" || item.status === "CANCELLED")
    return (
      <Space.Compact>
        <Button type="text" icon={<ReloadOutlined />} onClick={onRetry} />
        <Button type="text" icon={<DeleteOutlined />} onClick={onRemove} />
      </Space.Compact>
    );
  if (item.status === "DUPLICATE")
    return (
      <Space.Compact>
        <Button type="link" onClick={onExisting}>
          View
        </Button>
        <Button type="text" icon={<CloseOutlined />} onClick={onRemove} />
      </Space.Compact>
    );
  return (
    <Button
      type="text"
      icon={<DeleteOutlined />}
      disabled={item.status === "COMPLETED"}
      onClick={onRemove}
    />
  );
}
