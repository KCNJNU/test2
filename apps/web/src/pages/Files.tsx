import {
  AppstoreOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EyeOutlined,
  ReloadOutlined,
  SearchOutlined,
  TableOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  DatePicker,
  Input,
  InputNumber,
  Modal,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AddToDatasetDrawer,
  BulkActionBar,
} from "../components/FileBulkActions";
import { FilePreview } from "../components/FilePreview";
import { DataState, PageHeader } from "../components/ui";
import { SavedViews } from "../components/SavedViews";
import { api, type FileQuery, type RobotFile } from "../services/api";
import { bytes, date, shortHash } from "../services/format";
import { useOptionalAuth } from "../auth/AuthContext";

export function Files() {
  const auth = useOptionalAuth();
  const canMutate = auth ? auth.hasRole("ADMIN", "SUPER_ADMIN", "TENANT_ADMIN", "PROJECT_ADMIN", "OPERATOR") : true;
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [datasetOpen, setDatasetOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const view = params.get("view") === "grid" ? "grid" : "table";
  const page = Number(params.get("page") ?? 1);
  const pageSize = Number(params.get("pageSize") ?? 20);
  const query = useMemo<FileQuery>(
    () => ({
      page,
      pageSize,
      search: params.get("search") ?? undefined,
      robotId: params.get("robotId") ?? undefined,
      fileType: params.get("fileType") ?? undefined,
      recognitionType: params.get("recognitionType") ?? undefined,
      schemaVersion: params.get("schemaVersion") ?? undefined,
      tagId: params.get("tagId") ?? undefined,
      startTime: params.get("startTime") ?? undefined,
      endTime: params.get("endTime") ?? undefined,
      uploadedStartTime: params.get("uploadedStartTime") ?? undefined,
      uploadedEndTime: params.get("uploadedEndTime") ?? undefined,
      minSize: params.get("minSize") ?? undefined,
      maxSize: params.get("maxSize") ?? undefined,
      sortBy: params.get("sortBy") ?? "createdAt",
      sortOrder: params.get("sortOrder") ?? "desc",
    }),
    [params, page, pageSize],
  );
  const files = useQuery({
    queryKey: ["files", query],
    queryFn: () => api.files(query),
  });
  const robots = useQuery({
    queryKey: ["robots", "selector"],
    queryFn: api.robots,
  });
  const tags = useQuery({ queryKey: ["tags"], queryFn: api.tags });
  const update = (values: FileQuery) =>
    setParams((current) => {
      for (const [key, value] of Object.entries(values)) {
        if (value === undefined || value === "") current.delete(key);
        else current.set(key, String(value));
      }
      return current;
    });
  const remove = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) await api.deleteFile(id);
    },
    onSuccess: () => {
      message.success("Selected files deleted");
      setSelected([]);
      void queryClient.invalidateQueries({ queryKey: ["files"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["robots"] });
    },
    onError: (reason: Error) => message.error(reason.message),
  });
  const applyTags = useMutation({ mutationFn: () => api.bulkTagFiles(selected, tagIds), onSuccess: async () => { message.success("Tags applied"); setTagOpen(false); setTagIds([]); await queryClient.invalidateQueries({ queryKey: ["files"] }); } });
  const selectedRows = (files.data?.items ?? []).filter((file) =>
    selected.includes(file.id),
  );
  const confirmDelete = (ids = selected) =>
    Modal.confirm({
      title: `Delete ${ids.length} raw files?`,
      content:
        "This removes each MinIO object and its RobotFile metadata. Dataset references may prevent deletion.",
      okText: "Delete Files",
      okButtonProps: { danger: true },
      onOk: () => remove.mutateAsync(ids),
    });
  const download = async (id: string) => {
    try {
      const { url } = await api.download(id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (reason) {
      message.error((reason as Error).message);
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="DATA WORKBENCH"
        title="Files"
        description="Search, inspect, select and organize managed robot data from one workspace."
        actions={
          <>
            <div className="header-count">
              <strong>{files.data?.total ?? "--"}</strong>
              <span>Managed files</span>
            </div>
            {canMutate && <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={() => navigate("/upload")}
            >
              Upload Files
            </Button>}
          </>
        }
      />
      <Card variant="borderless" className="filter-bar">
        <div className="filter-grid v2-file-filters">
          <Input.Search
            allowClear
            prefix={<SearchOutlined />}
            defaultValue={String(query.search ?? "")}
            placeholder="Filename, object key or checksum"
            onSearch={(value) => update({ search: value, page: 1 })}
          />
          <Select
            allowClear
            value={query.robotId}
            placeholder="Robot"
            showSearch
            optionFilterProp="label"
            onChange={(value) => update({ robotId: value, page: 1 })}
            options={robots.data?.map((robot) => ({
              value: robot.id,
              label: `${robot.externalId ?? robot.id.slice(0, 8)} · ${robot.name}`,
            }))}
          />
          <Select
            allowClear
            value={query.fileType}
            placeholder="File type"
            onChange={(value) => update({ fileType: value, page: 1 })}
            options={["json", "image", "text", "log"].map((value) => ({
              value,
              label: value.toUpperCase(),
            }))}
          />
          <Input
            allowClear
            value={query.recognitionType}
            placeholder="Recognition type"
            onChange={(event) =>
              update({ recognitionType: event.target.value, page: 1 })
            }
          />
          <Select allowClear mode="multiple" maxTagCount={1} value={query.tagId ? [query.tagId] : []} placeholder="Tag" options={tags.data?.map((tag) => ({ value: tag.id, label: tag.name }))} onChange={(values) => update({ tagId: values.at(-1), page: 1 })} />
          <Input
            allowClear
            value={query.schemaVersion}
            placeholder="Schema version"
            onChange={(event) =>
              update({ schemaVersion: event.target.value, page: 1 })
            }
          />
          <DatePicker.RangePicker
            showTime
            placeholder={["Captured from", "Captured to"]}
            onChange={(range) =>
              update({
                startTime: range?.[0]?.toISOString(),
                endTime: range?.[1]?.toISOString(),
                page: 1,
              })
            }
          />
          <DatePicker.RangePicker
            showTime
            placeholder={["Uploaded from", "Uploaded to"]}
            onChange={(range) =>
              update({
                uploadedStartTime: range?.[0]?.toISOString(),
                uploadedEndTime: range?.[1]?.toISOString(),
                page: 1,
              })
            }
          />
          <Space.Compact>
            <InputNumber
              min={0}
              placeholder="Min bytes"
              value={query.minSize ? Number(query.minSize) : null}
              onChange={(value) =>
                update({ minSize: value ?? undefined, page: 1 })
              }
            />
            <InputNumber
              min={0}
              placeholder="Max bytes"
              value={query.maxSize ? Number(query.maxSize) : null}
              onChange={(value) =>
                update({ maxSize: value ?? undefined, page: 1 })
              }
            />
          </Space.Compact>
        </div>
        <Space wrap className="filter-footer">
          <Select
            value={`${query.sortBy}:${query.sortOrder}`}
            onChange={(value) => {
              const [sortBy, sortOrder] = value.split(":");
              update({ sortBy, sortOrder, page: 1 });
            }}
            options={[
              { value: "createdAt:desc", label: "Newest upload" },
              { value: "capturedAt:desc", label: "Newest capture" },
              { value: "fileSize:desc", label: "Largest first" },
              { value: "originalName:asc", label: "Filename A–Z" },
            ]}
          />
          <Button
            onClick={() =>
              setParams(params.get("file") ? { file: params.get("file")! } : {})
            }
          >
            Reset
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => void files.refetch()}
          >
            Refresh
          </Button>
          <Segmented
            value={view}
            onChange={(value) => update({ view: value })}
            options={[
              { value: "table", icon: <TableOutlined /> },
              { value: "grid", icon: <AppstoreOutlined /> },
            ]}
          />
          <SavedViews resource="FILES" query={{ ...query, view }} onApply={(saved) => setParams(Object.fromEntries(Object.entries(saved).map(([key, value]) => [key, String(value)])))} />
        </Space>
      </Card>
      <DataState
        loading={files.isLoading}
        error={files.error instanceof Error ? files.error.message : undefined}
        empty={!files.data?.items.length}
        emptyTitle="No files found"
        emptyDescription="Upload robot data or reset the current filters."
        action={canMutate ? (
          <Button
            type="primary"
            icon={<UploadOutlined />}
            onClick={() => navigate("/upload")}
          >
            Upload Files
          </Button>
        ) : undefined}
      >
        {view === "table" ? (
          <Card variant="borderless" className="table-panel">
            <Table
              rowKey="id"
              dataSource={files.data?.items ?? []}
              rowSelection={canMutate ? {
                selectedRowKeys: selected,
                onChange: (keys) => setSelected(keys.map(String)),
                preserveSelectedRowKeys: true,
              } : undefined}
              scroll={{ x: 1420 }}
              onRow={(row) => ({
                onClick: () => update({ file: row.id }),
                className: "clickable-row",
              })}
              pagination={{
                current: page,
                pageSize,
                total: files.data?.total,
                showSizeChanger: true,
                pageSizeOptions: [10, 20, 50, 100],
                showTotal: (total) => `${total} files`,
                onChange: (nextPage, nextSize) =>
                  update({ page: nextPage, pageSize: nextSize }),
              }}
              columns={[
                {
                  title: "File",
                  width: 260,
                  fixed: "left",
                  render: (_, row) => (
                    <div>
                      <Typography.Text strong>
                        {row.originalName}
                      </Typography.Text>
                      <small className="table-secondary mono-value">
                        {row.objectKey}
                      </small>
                    </div>
                  ),
                },
                {
                  title: "Robot",
                  width: 150,
                  render: (_, row) =>
                    row.robot?.externalId ??
                    row.robot?.name ??
                    row.robotId.slice(0, 8),
                },
                {
                  title: "Type",
                  dataIndex: "fileType",
                  width: 85,
                  render: (value) => <Tag>{String(value).toUpperCase()}</Tag>,
                },
                {
                  title: "Recognition",
                  dataIndex: "recognitionType",
                  width: 150,
                },
                { title: "Schema", dataIndex: "schemaVersion", width: 90 },
                {
                  title: "Captured At",
                  dataIndex: "capturedAt",
                  width: 175,
                  render: date,
                },
                {
                  title: "Uploaded At",
                  dataIndex: "createdAt",
                  width: 175,
                  render: date,
                },
                {
                  title: "Size",
                  dataIndex: "fileSize",
                  width: 100,
                  align: "right",
                  render: bytes,
                },
                {
                  title: "Checksum",
                  dataIndex: "checksum",
                  width: 145,
                  render: (value) => (
                    <Tooltip
                      title={
                        <Typography.Text copyable>{value}</Typography.Text>
                      }
                    >
                      <Typography.Text className="mono-value">
                        {shortHash(value)}
                      </Typography.Text>
                    </Tooltip>
                  ),
                },
                {
                  title: "Actions",
                  width: 130,
                  fixed: "right",
                  render: (_, row) => (
                    <Space onClick={(event) => event.stopPropagation()}>
                      <Tooltip title="Preview">
                        <Button
                          type="text"
                          icon={<EyeOutlined />}
                          onClick={() => update({ file: row.id })}
                        />
                      </Tooltip>
                      <Tooltip title="Download">
                        <Button
                          type="text"
                          icon={<DownloadOutlined />}
                          onClick={() => void download(row.id)}
                        />
                      </Tooltip>
                      {canMutate && <Tooltip title="Delete">
                        <Button
                          danger
                          type="text"
                          icon={<DeleteOutlined />}
                          onClick={() => confirmDelete([row.id])}
                        />
                      </Tooltip>}
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        ) : (
          <div className="file-grid">
            {files.data?.items.map((file) => (
              <FileGridCard
                key={file.id}
                file={file}
                selected={selected.includes(file.id)}
                onSelect={() =>
                  setSelected((current) =>
                    current.includes(file.id)
                      ? current.filter((id) => id !== file.id)
                      : [...current, file.id],
                  )
                }
                onOpen={() => update({ file: file.id })}
              />
            ))}
          </div>
        )}
      </DataState>
      {canMutate && <BulkActionBar
        count={selected.length}
        onAddDataset={() => setDatasetOpen(true)}
        onTag={() => setTagOpen(true)}
        onExportCsv={() => exportRows(selectedRows, "csv")}
        onExportJson={() => exportRows(selectedRows, "json")}
        onDelete={() => confirmDelete()}
        onClear={() => setSelected([])}
      />}
      {canMutate && <AddToDatasetDrawer
        open={datasetOpen}
        fileIds={selected}
        onClose={() => setDatasetOpen(false)}
        onDone={() => {
          setDatasetOpen(false);
          setSelected([]);
        }}
      />}
      <FilePreview
        fileId={params.get("file") ?? undefined}
        onClose={() => update({ file: undefined })}
      />
      {canMutate && <Modal open={tagOpen} title={`Apply tags to ${selected.length} file(s)`} okText="Apply Tags" okButtonProps={{ disabled: !tagIds.length }} confirmLoading={applyTags.isPending} onCancel={() => setTagOpen(false)} onOk={() => applyTags.mutate()}><Select mode="multiple" value={tagIds} onChange={setTagIds} style={{ width: "100%" }} placeholder="Select tags" options={tags.data?.map((tag) => ({ value: tag.id, label: tag.name }))} /></Modal>}
    </>
  );
}

function FileGridCard({
  file,
  selected,
  onSelect,
  onOpen,
}: {
  file: RobotFile;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  return (
    <Card
      className={`file-grid-card ${selected ? "selected" : ""}`}
      variant="borderless"
    >
      <button
        className="grid-select"
        onClick={onSelect}
        aria-label={`Select ${file.originalName}`}
      >
        {selected ? "✓" : ""}
      </button>
      <button className="file-grid-main" onClick={onOpen}>
        <span className="file-type-icon">
          {file.mimeType.startsWith("image/") ? <AppstoreOutlined /> : "{ }"}
        </span>
        <Typography.Text strong ellipsis>
          {file.originalName}
        </Typography.Text>
        <small>
          {file.robot?.externalId ?? file.robot?.name ?? "Robot"} ·{" "}
          {bytes(file.fileSize)}
        </small>
        <div>
          <Tag>{file.fileType.toUpperCase()}</Tag>
          <Tag>{file.recognitionType}</Tag>
        </div>
        <Typography.Text type="secondary">
          {date(file.createdAt)}
        </Typography.Text>
      </button>
    </Card>
  );
}
function exportRows(rows: RobotFile[], format: "csv" | "json") {
  const fields = rows.map((row) => ({
    id: row.id,
    fileName: row.originalName,
    robot: row.robot?.externalId ?? row.robot?.name ?? row.robotId,
    objectKey: row.objectKey,
    fileType: row.fileType,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    checksum: row.checksum,
    recognitionType: row.recognitionType,
    schemaVersion: row.schemaVersion,
    capturedAt: row.capturedAt,
    uploadedAt: row.createdAt,
    metadata: row.metadata ?? {},
  }));
  const content =
    format === "json" ? JSON.stringify(fields, null, 2) : toCsv(fields);
  const blob = new Blob([content], {
    type: format === "json" ? "application/json" : "text/csv;charset=utf-8",
  });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = `robot-files-${new Date().toISOString().slice(0, 10)}.${format}`;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}
function toCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) =>
    `"${String(typeof value === "object" ? JSON.stringify(value) : (value ?? "")).replaceAll('"', '""')}"`;
  return [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => escape(row[header])).join(","),
    ),
  ].join("\n");
}
