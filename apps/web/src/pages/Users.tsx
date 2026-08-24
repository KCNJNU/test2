import { PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Table,
  Tag,
  message,
} from "antd";
import { useState } from "react";
import { DataState, PageHeader } from "../components/ui";
import { api } from "../services/api";
import { date } from "../services/format";
export function Users() {
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const client = useQueryClient();
  const users = useQuery({
    queryKey: ["users"],
    queryFn: () => api.users({ page: 1, pageSize: 100 }),
  });
  const create = useMutation({
    mutationFn: api.createUser,
    onSuccess: async () => {
      message.success("User created with a temporary password");
      setOpen(false);
      form.resetFields();
      await client.invalidateQueries({ queryKey: ["users"] });
    },
  });
  return (
    <>
      <PageHeader
        eyebrow="ADMINISTRATION"
        title="Users & Roles"
        description="Local accounts with Admin, Operator and Viewer authorization boundaries."
        actions={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setOpen(true)}
          >
            Add User
          </Button>
        }
      />
      <DataState
        loading={users.isLoading}
        error={(users.error as Error | null)?.message}
        empty={!users.data?.items.length}
        emptyTitle="No users"
        emptyDescription="Create a local account."
      >
        <Card variant="borderless" className="table-panel">
          <Table
            rowKey="id"
            dataSource={users.data?.items ?? []}
            pagination={false}
            columns={[
              {
                title: "User",
                render: (_, row) => (
                  <div>
                    <strong>{row.displayName}</strong>
                    <small className="table-secondary">{row.email}</small>
                  </div>
                ),
              },
              {
                title: "Role",
                dataIndex: "role",
                render: (value) => (
                  <Tag
                    color={
                      value === "ADMIN"
                        ? "red"
                        : value === "OPERATOR"
                          ? "blue"
                          : "default"
                    }
                  >
                    {value}
                  </Tag>
                ),
              },
              {
                title: "Status",
                dataIndex: "isActive",
                render: (value) => (
                  <Tag color={value ? "success" : "default"}>
                    {value ? "Active" : "Disabled"}
                  </Tag>
                ),
              },
              {
                title: "Password",
                dataIndex: "mustChangePassword",
                render: (value) => (value ? "Change required" : "Current"),
              },
              {
                title: "Last Login",
                dataIndex: "lastLoginAt",
                render: (value) => (value ? date(value) : "--"),
              },
              { title: "Created", dataIndex: "createdAt", render: date },
            ]}
          />
        </Card>
      </DataState>
      <Modal
        open={open}
        title="Create Local User"
        okText="Create User"
        confirmLoading={create.isPending}
        onCancel={() => setOpen(false)}
        onOk={() =>
          form.validateFields().then((values) => create.mutate(values))
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true, type: "email" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="displayName"
            label="Display Name"
            rules={[{ required: true, min: 2 }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="role" label="Role" rules={[{ required: true }]}>
            <Select
              options={["SUPER_ADMIN", "TENANT_ADMIN", "PROJECT_ADMIN", "OPERATOR", "MAINTENANCE_ENGINEER", "VIEWER"].map((value) => ({
                value,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="temporaryPassword"
            label="Temporary Password"
            rules={[{ required: true, min: 12 }]}
          >
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
