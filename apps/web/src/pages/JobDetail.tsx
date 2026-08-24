import {
  ArrowLeftOutlined,
  ReloadOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Progress,
  Space,
  Steps,
  Tag,
  Typography,
  message,
} from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { DataState, PageHeader } from "../components/ui";
import { api } from "../services/api";
import { date } from "../services/format";
import { useOptionalAuth } from "../auth/AuthContext";

export function JobDetail() {
  const auth = useOptionalAuth();
  const canOperate = auth ? auth.hasRole("ADMIN", "SUPER_ADMIN", "TENANT_ADMIN", "PROJECT_ADMIN", "OPERATOR") : true;
  const { id } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const job = useQuery({
    queryKey: ["jobs", "detail", id],
    queryFn: () => api.job(id!),
    enabled: Boolean(id),
    refetchInterval: (query) =>
      ["QUEUED", "RUNNING"].includes(query.state.data?.status ?? "")
        ? 2_000
        : false,
  });
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["jobs"] }),
      job.refetch(),
    ]);
  };
  const retry = useMutation({
    mutationFn: () => api.retryJob(id!),
    onSuccess: async () => {
      message.success("Job queued for retry");
      await refresh();
    },
  });
  const cancel = useMutation({
    mutationFn: () => api.cancelJob(id!),
    onSuccess: async () => {
      message.success("Cancellation requested");
      await refresh();
    },
  });
  const value = job.data;
  return (
    <>
      <PageHeader
        eyebrow="JOB EXECUTION"
        title={value?.type.replaceAll("_", " ") ?? "Job Detail"}
        description="Durable steps, retries and recovery state from PostgreSQL."
        actions={
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate("/jobs")}
            >
              All Jobs
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => void refresh()}>
              Refresh
            </Button>
            {canOperate && value?.status === "FAILED" && (
              <Button
                type="primary"
                onClick={() => retry.mutate()}
                loading={retry.isPending}
              >
                Retry failed step
              </Button>
            )}
            {canOperate &&
              value &&
              ["QUEUED", "RUNNING"].includes(value.status) && (
                <Button
                  danger
                  icon={<StopOutlined />}
                  onClick={() => cancel.mutate()}
                >
                  Cancel
                </Button>
              )}
          </Space>
        }
      />
      <DataState
        loading={job.isLoading}
        error={(job.error as Error | null)?.message}
        empty={!value}
        emptyTitle="Job not found"
        emptyDescription="The requested job is unavailable."
      >
        {value && (
          <>
            <Card variant="borderless" className="panel-card">
              <Descriptions
                column={3}
                bordered
                size="small"
                items={[
                  {
                    key: "id",
                    label: "Job ID",
                    children: (
                      <Typography.Text copyable>{value.id}</Typography.Text>
                    ),
                  },
                  {
                    key: "status",
                    label: "Status",
                    children: <Tag>{value.status}</Tag>,
                  },
                  {
                    key: "progress",
                    label: "Progress",
                    children: (
                      <Progress percent={value.progress} size="small" />
                    ),
                  },
                  {
                    key: "resource",
                    label: "Resource",
                    children: `${value.resourceType ?? "--"} · ${value.resourceId ?? "--"}`,
                  },
                  {
                    key: "created",
                    label: "Created",
                    children: date(value.createdAt),
                  },
                  {
                    key: "finished",
                    label: "Finished",
                    children: value.finishedAt ? date(value.finishedAt) : "--",
                  },
                ]}
              />
              {value.errorMessage && (
                <Alert
                  type="error"
                  showIcon
                  message="Execution failed"
                  description={value.errorMessage}
                />
              )}
            </Card>
            <Card
              variant="borderless"
              className="panel-card"
              title="Execution Steps"
            >
              <Steps
                direction="vertical"
                current={value.steps.findIndex(
                  (step) =>
                    step.status === "RUNNING" || step.status === "FAILED",
                )}
                items={value.steps.map((step) => ({
                  title: step.name,
                  status:
                    step.status === "SUCCEEDED"
                      ? "finish"
                      : step.status === "RUNNING"
                        ? "process"
                        : step.status === "FAILED"
                          ? "error"
                          : "wait",
                  description:
                    step.errorMessage ??
                    (step.finishedAt
                      ? `Completed ${date(step.finishedAt)}`
                      : "Waiting for worker"),
                }))}
              />
            </Card>
          </>
        )}
      </DataState>
    </>
  );
}
