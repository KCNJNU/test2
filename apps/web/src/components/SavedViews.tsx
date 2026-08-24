import { BookOutlined, SaveOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Dropdown, Input, Modal, Switch, message } from "antd";
import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { api } from "../services/api";

export function SavedViews({
  resource,
  query,
  onApply,
}: {
  resource:
    "ROBOTS" | "FILES" | "DATASETS" | "VERSIONS" | "JOBS" | "AUDIT" | "STORAGE";
  query: Record<string, string | number | boolean | undefined>;
  onApply: (query: Record<string, string | number | boolean>) => void;
}) {
  const auth = useAuth();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);
  const views = useQuery({
    queryKey: ["saved-views", resource],
    queryFn: () => api.savedViews(resource),
  });
  const save = useMutation({
    mutationFn: () =>
      api.createSavedView({
        resource,
        name,
        query: Object.fromEntries(
          Object.entries(query).filter(([, value]) => value !== undefined),
        ) as Record<string, string | number | boolean>,
        isShared: shared,
      }),
    onSuccess: async () => {
      message.success("View saved");
      setOpen(false);
      setName("");
      await client.invalidateQueries({ queryKey: ["saved-views", resource] });
    },
  });
  return (
    <>
      <Dropdown
        menu={{
          items: (views.data ?? []).map((view) => ({
            key: view.id,
            label: `${view.name}${view.isShared ? ` · ${view.owner.displayName}` : ""}`,
            onClick: () => onApply(view.query),
          })),
        }}
      >
        <Button icon={<BookOutlined />}>Saved Views</Button>
      </Dropdown>
      <Button icon={<SaveOutlined />} onClick={() => setOpen(true)}>
        Save View
      </Button>
      <Modal
        open={open}
        title="Save Current View"
        okText="Save"
        okButtonProps={{ disabled: !name.trim() }}
        confirmLoading={save.isPending}
        onCancel={() => setOpen(false)}
        onOk={() => save.mutate()}
      >
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="View name"
        />
        {auth.hasRole("ADMIN", "SUPER_ADMIN", "TENANT_ADMIN", "PROJECT_ADMIN", "OPERATOR") && (
          <label className="saved-view-share">
            <Switch checked={shared} onChange={setShared} /> Share with other
            users
          </label>
        )}
      </Modal>
    </>
  );
}
