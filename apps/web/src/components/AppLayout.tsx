import { ApiOutlined, AuditOutlined, BellOutlined, CloudServerOutlined, DashboardOutlined, DatabaseOutlined, FileOutlined, FolderOutlined, HddOutlined, LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined, NotificationOutlined, PlusOutlined, RobotOutlined, SafetyCertificateOutlined, SearchOutlined, SettingOutlined, TeamOutlined, UploadOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, Badge, Breadcrumb, Button, Drawer, Dropdown, Flex, Layout, List, Menu, Space, Tag, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api, pendingHealth, unreachableHealth } from '../services/api';
import { CommandPalette } from './CommandPalette';
import { CreateDatasetModal } from './DatasetDrawers';
import { StatusBadge } from './ui';
import { useUnsavedChanges } from './UnsavedChanges';
import { useAuth } from '../auth/AuthContext';
import { date } from '../services/format';

const { Header, Content, Sider } = Layout;
const labels: Record<string, string> = { '/dashboard': '工作台', '/robots': '设备', '/maps':'地图', '/tasks':'任务', '/realtime':'实时作业', '/faults':'告警', '/maintenance':'运维', '/reports':'报表', '/versions-platform':'版本与 OTA', '/system-platform':'系统管理', '/files': 'Files', '/upload': 'Upload Center', '/datasets': 'Datasets', '/dataset-versions': 'Dataset Versions', '/jobs': 'Jobs', '/activity': 'Activity', '/storage': 'Storage', '/system-status': 'System Status', '/system-settings': 'System Settings', '/users': 'Users', '/audit-logs': 'Audit Logs' };

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [createDatasetOpen, setCreateDatasetOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { confirmDiscard } = useUnsavedChanges();
  const healthQuery = useQuery({ queryKey: ['health'], queryFn: api.health, refetchInterval: 30_000, retry: 1 });
  const health = healthQuery.data ?? (healthQuery.isError ? unreachableHealth() : pendingHealth());
  const jobs = useQuery({ queryKey: ['jobs', 'header'], queryFn: () => api.jobs({ page: 1, pageSize: 1, status: 'RUNNING' }), refetchInterval: 10_000 });
  const notifications = useQuery({ queryKey: ['notifications', 'header'], queryFn: () => api.notifications({ page: 1, pageSize: 20 }), refetchInterval: 10_000 });
  const menuItems = useMemo(() => [
    { type: 'group' as const, label: '运营', children: [{ key: '/dashboard', icon: <DashboardOutlined />, label: '工作台' },{ key: '/robots', icon: <RobotOutlined />, label: '设备' },{key:'/maps',icon:<DatabaseOutlined/>,label:'地图'},{key:'/tasks',icon:<NotificationOutlined/>,label:'任务'},{key:'/realtime',icon:<ApiOutlined/>,label:'实时作业'},{key:'/faults',icon:<BellOutlined/>,label:'告警'},{key:'/maintenance',icon:<SafetyCertificateOutlined/>,label:'运维'},{key:'/reports',icon:<AuditOutlined/>,label:'报表'},{key:'/versions-platform',icon:<CloudServerOutlined/>,label:'版本与 OTA'}] },
    { type: 'group' as const, label: 'DATA', children: [{ key: '/files', icon: <FileOutlined />, label: 'Files' }, ...(auth.hasRole('ADMIN', 'SUPER_ADMIN', 'TENANT_ADMIN', 'PROJECT_ADMIN', 'OPERATOR') ? [{ key: '/upload', icon: <UploadOutlined />, label: 'Upload Center' }] : [])] },
    { type: 'group' as const, label: 'DATASETS', children: [{ key: '/datasets', icon: <FolderOutlined />, label: 'Datasets' }, { key: '/dataset-versions', icon: <SafetyCertificateOutlined />, label: 'Dataset Versions' }] },
    { type: 'group' as const, label: 'OPERATIONS', children: [{ key: '/jobs', icon: <NotificationOutlined />, label: 'Jobs' }, { key: '/activity', icon: <AuditOutlined />, label: 'Activity' }] },
    { type: 'group' as const, label: 'SYSTEM', children: [{key:'/system-platform',icon:<TeamOutlined/>,label:'系统管理'},{ key: '/storage', icon: <HddOutlined />, label: 'Storage' }, { key: '/system-status', icon: <CloudServerOutlined />, label: 'System Status' }, ...(auth.hasRole('ADMIN','SUPER_ADMIN','TENANT_ADMIN') ? [{ key: '/system-settings', icon: <SettingOutlined />, label: 'Settings' }, { key: '/users', icon: <TeamOutlined />, label: 'Users' }, { key: '/audit-logs', icon: <AuditOutlined />, label: 'Audit Logs' }] : [])] },
  ], [auth]);
  const pageLabel = labels[location.pathname] ?? (location.pathname.startsWith('/datasets/') ? 'Dataset Workspace' : 'Platform');
  const environment = import.meta.env.MODE === 'development' ? 'Development' : import.meta.env.MODE;
  return <Layout className="app-shell">
    <Sider className="app-sider" width={232} collapsedWidth={72} collapsible collapsed={collapsed} trigger={null} breakpoint="xl" onBreakpoint={setCollapsed}>
      <button className="brand" onClick={() => confirmDiscard(() => navigate('/dashboard'))} aria-label="Go to dashboard"><span className="brand-mark"><RobotOutlined /></span>{!collapsed && <span><strong>Robot Data</strong><small>OPERATIONS PLATFORM</small></span>}</button>
      <Menu mode="inline" selectedKeys={[location.pathname]} items={menuItems} onClick={({ key }) => confirmDiscard(() => navigate(key))} />
      {!collapsed && <div className="sider-footer"><span className="footer-dot" />V2.1 Platform<small>Operations & governance</small></div>}
    </Sider>
    <Layout>
      <Header className="app-header"><Flex align="center" justify="space-between" gap={12}>
        <Flex align="center" gap={12} className="header-leading"><Button type="text" className="collapse-button" icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={() => setCollapsed((value) => !value)} /><Breadcrumb items={[{ title: 'Robot Cloud' }, { title: pageLabel }]} /></Flex>
        <Space size={8} className="global-actions"><Button className="global-search-button" icon={<SearchOutlined />} onClick={() => setPaletteOpen(true)}>Search <kbd>Ctrl K</kbd></Button>{auth.hasRole('ADMIN', 'SUPER_ADMIN', 'TENANT_ADMIN', 'PROJECT_ADMIN', 'OPERATOR') && <><Button icon={<UploadOutlined />} onClick={() => confirmDiscard(() => navigate('/upload'))}>Upload</Button><Button icon={<PlusOutlined />} onClick={() => setCreateDatasetOpen(true)}>Dataset</Button></>}<Badge count={jobs.data?.total ?? 0} size="small"><Button icon={<NotificationOutlined />} onClick={() => navigate('/jobs')}>Jobs</Button></Badge><Badge count={notifications.data?.unread ?? 0} size="small"><Button aria-label="Notifications" icon={<BellOutlined />} onClick={() => setNotificationsOpen(true)} /></Badge></Space>
        <Space size={10} className="header-statuses"><Tag className="environment-pill">{environment}</Tag><span className="header-service"><ApiOutlined /> API <StatusBadge status={health.services.api.status} label={health.services.api.status === 'healthy' ? 'Online' : undefined} /></span><span className="header-service optional-health"><DatabaseOutlined /> DB <StatusBadge status={health.services.postgresql.status} /></span><span className="header-divider" /><Dropdown menu={{ items: [{ key: 'role', label: `${auth.user?.role ?? '--'} role`, disabled: true }, { type: 'divider' }, { key: 'logout', icon: <LogoutOutlined />, label: 'Sign out', onClick: () => void auth.logout().then(() => navigate('/login')) }] }}><Flex align="center" gap={8} className="system-entry"><Avatar size={30}>{auth.user?.displayName?.slice(0, 1).toUpperCase()}</Avatar><span><Typography.Text strong>{auth.user?.displayName}</Typography.Text><small>{auth.user?.role}</small></span></Flex></Dropdown></Space>
      </Flex></Header>
      <Content className="app-content"><Outlet /></Content>
    </Layout>
    <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onCreateDataset={() => { setPaletteOpen(false); setCreateDatasetOpen(true); }} />
    <CreateDatasetModal open={createDatasetOpen} onClose={() => setCreateDatasetOpen(false)} onDone={() => { setCreateDatasetOpen(false); void queryClient.invalidateQueries({ queryKey: ['datasets'] }); void queryClient.invalidateQueries({ queryKey: ['dashboard'] }); }} />
    <Drawer open={notificationsOpen} onClose={() => setNotificationsOpen(false)} title="Notifications" extra={<Button type="link" onClick={() => void api.readAllNotifications().then(() => queryClient.invalidateQueries({ queryKey: ['notifications'] }))}>Mark all read</Button>}><List dataSource={notifications.data?.items ?? []} locale={{ emptyText: 'No notifications' }} renderItem={(item) => <List.Item className={item.readAt ? '' : 'notification-unread'} onClick={() => { void api.readNotification(item.id).then(() => queryClient.invalidateQueries({ queryKey: ['notifications'] })); if (item.resourceUrl) navigate(item.resourceUrl); setNotificationsOpen(false); }}><List.Item.Meta title={item.title} description={<>{item.message}<small className="table-secondary">{date(item.createdAt)}</small></>} /></List.Item>} /></Drawer>
  </Layout>;
}
