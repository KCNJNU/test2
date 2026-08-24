import {
  DeleteOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  ScanOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Input,
  Modal,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { DataState, PageHeader } from "../components/ui";
import { api } from "../services/api";
import { bytes, date } from "../services/format";

export function Storage() {
  const auth = useAuth();
  const client = useQueryClient();
  const [prefix, setPrefix] = useState("");
  const [selectedRun, setSelectedRun] = useState<string>();
  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
  const objects = useQuery({
    queryKey: ["storage", "objects", prefix],
    queryFn: () => api.storageObjects({ prefix, limit: 100 }),
  });
  const runs = useQuery({
    queryKey: ["storage", "runs"],
    queryFn: () => api.reconciliationRuns({ page: 1, pageSize: 30 }),
    refetchInterval: 10_000,
  });
  const detail = useQuery({
    queryKey: ["storage", "run", selectedRun],
    queryFn: () => api.reconciliationRun(selectedRun!),
    enabled: Boolean(selectedRun),
    refetchInterval: (query) =>
      ["RUNNING", "QUEUED"].includes(query.state.data?.status ?? "")
        ? 5_000
        : false,
  });
  const scan = useMutation({
    mutationFn: api.startReconciliation,
    onSuccess: async (value) => {
      message.success("Storage scan queued");
      await client.invalidateQueries({ queryKey: ["storage", "runs"] });
      if (value.job.id)
        window.history.replaceState(null, "", `/storage?job=${value.job.id}`);
    },
  });
  const remove = useMutation({
    mutationFn: () => api.deleteOrphans(selectedIssues),
    onSuccess: (job) => {
      message.success("Confirmed orphan deletion job queued");
      window.location.assign(`/jobs/${job.id}`);
    },
  });
  const openIssues =
    detail.data?.issues.filter((item) => item.status === "OPEN") ?? [];
  return (
    <>
      <PageHeader
        eyebrow="INFRASTRUCTURE OPERATIONS"
        title="Storage Explorer"
        description="Browse real bucket objects, compare database references and review safe repair work."
        actions={
          <Space>
            {auth.hasRole("ADMIN", "SUPER_ADMIN", "TENANT_ADMIN", "PROJECT_ADMIN", "OPERATOR") && (
              <Button
                type="primary"
                icon={<ScanOutlined />}
                loading={scan.isPending}
                onClick={() => scan.mutate()}
              >
                Run Reconciliation
              </Button>
            )}
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                void objects.refetch();
                void runs.refetch();
              }}
            >
              Refresh
            </Button>
          </Space>
        }
      />
      <Tabs
        items={[
          {
            key: "objects",
            label: "Object Browser",
            children: (
              <>
                <Card variant="borderless" className="filter-bar">
                  <Input.Search
                    allowClear
                    placeholder="Object key prefix"
                    onSearch={setPrefix}
                  />
                </Card>
                <DataState
                  loading={objects.isLoading}
                  error={(objects.error as Error | null)?.message}
                  empty={!objects.data?.items.length}
                  emptyTitle="No objects found"
                  emptyDescription="Change the prefix or upload data."
                >
                  <Card variant="borderless" className="table-panel">
                    <Table
                      rowKey="objectKey"
                      dataSource={objects.data?.items ?? []}
                      pagination={false}
                      scroll={{ x: 1050 }}
                      columns={[
                        {
                          title: "Object Key",
                          dataIndex: "objectKey",
                          render: (value) => (
                            <Typography.Text className="mono-value" copyable>
                              {value}
                            </Typography.Text>
                          ),
                        },
                        {
                          title: "Size",
                          dataIndex: "size",
                          width: 120,
                          render: bytes,
                        },
                        {
                          title: "Database Mapping",
                          dataIndex: "mapping",
                          width: 180,
                          render: (value) =>
                            value ? (
                              <Tag color="success">Mapped</Tag>
                            ) : (
                              <Tag color="warning">Not indexed</Tag>
                            ),
                        },
                        {
                          title: "ETag",
                          dataIndex: "etag",
                          width: 180,
                          ellipsis: true,
                        },
                        {
                          title: "Modified",
                          dataIndex: "lastModified",
                          width: 180,
                          render: (value) => (value ? date(value) : "--"),
                        },
                      ]}
                    />
                  </Card>
                </DataState>
              </>
            ),
          },
          {
            key: "runs",
            label: "Reconciliation",
            children: (
              <div className="storage-review-grid">
                <Card variant="borderless" className="table-panel">
                  <Table
                    rowKey="id"
                    dataSource={runs.data?.items ?? []}
                    pagination={false}
                    onRow={(row) => ({
                      onClick: () => setSelectedRun(row.id),
                      className: "clickable-row",
                    })}
                    columns={[
                      { title: "Run", dataIndex: "id", ellipsis: true },
                      {
                        title: "Status",
                        dataIndex: "status",
                        render: (value) => <Tag>{value}</Tag>,
                      },
                      { title: "Objects", dataIndex: "scannedObjects" },
                      { title: "Issues", dataIndex: "issueCount" },
                      {
                        title: "Created",
                        dataIndex: "createdAt",
                        render: date,
                      },
                    ]}
                  />
                </Card>
                <Card
                  variant="borderless"
                  className="panel-card"
                  title="Issue Review"
                  extra={
                    ["ADMIN", "SUPER_ADMIN"].includes(auth.user?.role ?? "") && selectedIssues.length ? (
                      <Button
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() =>
                          Modal.confirm({
                            title: `Delete ${selectedIssues.length} confirmed orphan object(s)?`,
                            content:
                              "Only selected OPEN ORPHAN_OBJECT issues are eligible. Database records are never deleted.",
                            okText: "Delete Orphan Objects",
                            okButtonProps: { danger: true },
                            onOk: () => remove.mutateAsync(),
                          })
                        }
                      >
                        Delete selected orphans
                      </Button>
                    ) : null
                  }
                >
                  {!selectedRun ? (
                    <Alert type="info" showIcon message="Select a scan run" />
                  ) : (
                    <Table
                      size="small"
                      rowKey="id"
                      loading={detail.isLoading}
                      dataSource={openIssues}
                      rowSelection={
                        ["ADMIN", "SUPER_ADMIN"].includes(auth.user?.role ?? "")
                          ? {
                              selectedRowKeys: selectedIssues,
                              onChange: (_keys, rows) =>
                                setSelectedIssues(
                                  rows
                                    .filter(
                                      (row) => row.type === "ORPHAN_OBJECT",
                                    )
                                    .map((row) => row.id),
                                ),
                              getCheckboxProps: (row) => ({
                                disabled: row.type !== "ORPHAN_OBJECT",
                              }),
                            }
                          : undefined
                      }
                      pagination={false}
                      columns={[
                        {
                          title: "Type",
                          dataIndex: "type",
                          render: (value) => (
                            <Tag
                              color={
                                value === "ORPHAN_OBJECT" ? "warning" : "error"
                              }
                            >
                              {value}
                            </Tag>
                          ),
                        },
                        {
                          title: "Object",
                          dataIndex: "objectKey",
                          ellipsis: true,
                        },
                        {
                          title: "Expected",
                          dataIndex: "expectedSize",
                          render: (value) => (value ? bytes(value) : "--"),
                        },
                        {
                          title: "Actual",
                          dataIndex: "actualSize",
                          render: (value) => (value ? bytes(value) : "--"),
                        },
                      ]}
                    />
                  )}
                </Card>
              </div>
            ),
          },
          {
            key: "policy",
            label: (
              <span>
                <SafetyCertificateOutlined /> Safety Policy
              </span>
            ),
            children: (
              <Alert
                showIcon
                type="info"
                message="Repair is deliberately constrained"
                description="Missing and size-mismatch findings are report-only. Only Admin users can explicitly confirm deletion of objects proven orphaned by a completed scan. Active upload part prefixes are excluded."
              />
            ),
          },
        ]}
      />
    </>
  );
}
