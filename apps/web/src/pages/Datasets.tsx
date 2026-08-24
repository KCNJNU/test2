import { PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Col, Input, Pagination, Row, Select } from "antd";
import { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { CreateDatasetModal } from "../components/DatasetDrawers";
import { DatasetCard } from "../components/DatasetCard";
import { DataState, PageHeader } from "../components/ui";
import { SavedViews } from "../components/SavedViews";
import { api } from "../services/api";
import { useOptionalAuth } from "../auth/AuthContext";

export function Datasets() {
  const auth = useOptionalAuth();
  const canMutate = auth ? auth.hasRole("ADMIN", "SUPER_ADMIN", "TENANT_ADMIN", "PROJECT_ADMIN", "OPERATOR") : true;
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const page = Number(params.get("page") ?? 1);
  const pageSize = Number(params.get("pageSize") ?? 12);
  const search = params.get("search") ?? "";
  const status = params.get("status") ?? undefined;
  const tagId = params.get("tagId") ?? undefined;
  const sort = params.get("sort") ?? "updatedAt:desc";
  const legacyDataset = params.get("dataset") ?? undefined;
  const legacyVersion = params.get("version") ?? undefined;
  const legacyVersionQuery = useQuery({
    queryKey: ["datasets", "legacy-version", legacyVersion],
    queryFn: () => api.version(legacyVersion!),
    enabled: Boolean(legacyVersion),
  });
  const datasets = useQuery({
    queryKey: ["datasets", "page", page, pageSize, search, status, tagId, sort],
    queryFn: () => {
      const [sortBy, sortOrder] = sort.split(":");
      return api.datasetPage({
        page,
        pageSize,
        search,
        status,
        tagId,
        sortBy,
        sortOrder,
      });
    },
  });
  const update = (values: Record<string, string | number | undefined>) =>
    setParams((current) => {
      for (const [key, value] of Object.entries(values)) {
        if (value === undefined || value === "") current.delete(key);
        else current.set(key, String(value));
      }
      return current;
    });
  const tags = useQuery({ queryKey: ["tags"], queryFn: api.tags });
  if (legacyDataset)
    return <Navigate replace to={`/datasets/${legacyDataset}`} />;
  if (legacyVersionQuery.data)
    return (
      <Navigate
        replace
        to={`/datasets/${legacyVersionQuery.data.datasetId}/versions/${legacyVersionQuery.data.id}`}
      />
    );
  return (
    <>
      <PageHeader
        eyebrow="DATASET MANAGEMENT"
        title="Datasets"
        description="Build, validate and compare immutable robot-data versions in a dedicated workspace."
        actions={canMutate ? (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateOpen(true)}
          >
            Create Dataset
          </Button>
        ) : undefined}
      />
      <Card variant="borderless" className="filter-bar">
        <div className="dataset-filter-grid">
          <Input.Search
            allowClear
            prefix={<SearchOutlined />}
            defaultValue={search}
            placeholder="Search dataset name or description"
            onSearch={(value) => update({ search: value, page: 1 })}
          />
          <Select
            allowClear
            value={status}
            placeholder="Version status"
            onChange={(value) => update({ status: value, page: 1 })}
            options={["DRAFT", "FROZEN", "PUBLISHED", "ARCHIVED"].map(
              (value) => ({ value, label: value }),
            )}
          />
          <Select allowClear value={tagId} placeholder="Tag" onChange={(value) => update({ tagId: value, page: 1 })} options={tags.data?.map((tag) => ({ value: tag.id, label: tag.name }))} />
          <Select
            value={sort}
            onChange={(value) => update({ sort: value, page: 1 })}
            options={[
              { value: "updatedAt:desc", label: "Recently updated" },
              { value: "createdAt:desc", label: "Recently created" },
              { value: "name:asc", label: "Name A–Z" },
            ]}
          />
          <SavedViews resource="DATASETS" query={{ search, status, tagId, sortBy: sort.split(":")[0], sortOrder: sort.split(":")[1], pageSize }} onApply={(saved) => { const next = { ...saved }; if (next.sortBy && next.sortOrder) { next.sort = `${next.sortBy}:${next.sortOrder}`; delete next.sortBy; delete next.sortOrder; } setParams(Object.fromEntries(Object.entries(next).map(([key, value]) => [key, String(value)]))); }} />
        </div>
      </Card>
      <DataState
        loading={
          datasets.isLoading ||
          Boolean(legacyVersion && legacyVersionQuery.isLoading)
        }
        error={
          (datasets.error as Error | null)?.message ??
          (legacyVersionQuery.error as Error | null)?.message
        }
        empty={!datasets.data?.items.length}
        emptyTitle="No datasets found"
        emptyDescription="Create a dataset or change the current filters."
        action={canMutate ? (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateOpen(true)}
          >
            Create Dataset
          </Button>
        ) : undefined}
      >
        <Row gutter={[14, 14]}>
          {datasets.data?.items.map((dataset) => (
            <Col xs={24} md={12} xl={8} key={dataset.id}>
              <DatasetCard
                dataset={dataset}
                onOpen={() => navigate(`/datasets/${dataset.id}`)}
                onVersion={(id) =>
                  navigate(`/datasets/${dataset.id}/versions/${id}`)
                }
              />
            </Col>
          ))}
        </Row>
        <Pagination
          className="workspace-pagination"
          current={page}
          pageSize={pageSize}
          total={datasets.data?.total}
          showSizeChanger
          pageSizeOptions={[12, 24, 48]}
          showTotal={(total) => `${total} datasets`}
          onChange={(nextPage, nextSize) =>
            update({ page: nextPage, pageSize: nextSize })
          }
        />
      </DataState>
      {canMutate && <CreateDatasetModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onDone={() => {
          setCreateOpen(false);
          void queryClient.invalidateQueries({ queryKey: ["datasets"] });
        }}
      />}
    </>
  );
}
