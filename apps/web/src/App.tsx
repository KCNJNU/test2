import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth, RequireRole } from './auth/RouteGuards';
import { AppLayout } from './components/AppLayout';
import { UnsavedChangesProvider } from './components/UnsavedChanges';

const CommercialDashboard = lazy(() => import('./pages/CommercialOperations').then((module) => ({ default: module.CommercialDashboard })));
const OperationsPage = lazy(() => import('./pages/CommercialOperations').then((module) => ({ default: module.OperationsPage })));
const RobotOperations = lazy(() => import('./pages/CommercialOperations').then((module) => ({ default: module.RobotOperations })));
const TaskOperations = lazy(() => import('./pages/CommercialOperations').then((module) => ({ default: module.TaskOperations })));
const Activity = lazy(() => import('./pages/Activity').then((module) => ({ default: module.Activity })));
const AuditLogs = lazy(() => import('./pages/AuditLogs').then((module) => ({ default: module.AuditLogs })));
const ChangePassword = lazy(() => import('./pages/ChangePassword').then((module) => ({ default: module.ChangePassword })));
const Datasets = lazy(() => import('./pages/Datasets').then((module) => ({ default: module.Datasets })));
const DatasetWorkspace = lazy(() => import('./pages/DatasetWorkspace').then((module) => ({ default: module.DatasetWorkspace })));
const Files = lazy(() => import('./pages/Files').then((module) => ({ default: module.Files })));
const JobDetail = lazy(() => import('./pages/JobDetail').then((module) => ({ default: module.JobDetail })));
const Jobs = lazy(() => import('./pages/Jobs').then((module) => ({ default: module.Jobs })));
const Login = lazy(() => import('./pages/Login').then((module) => ({ default: module.Login })));
const MapOperations = lazy(() => import('./pages/MapOperations').then((module) => ({ default: module.MapOperations })));
const OtaRelease = lazy(() => import('./pages/OtaRelease').then((module) => ({ default: module.OtaRelease })));
const Storage = lazy(() => import('./pages/Storage').then((module) => ({ default: module.Storage })));
const SystemSettings = lazy(() => import('./pages/SystemSettings').then((module) => ({ default: module.SystemSettings })));
const SystemStatus = lazy(() => import('./pages/SystemStatus').then((module) => ({ default: module.SystemStatus })));
const UploadCenter = lazy(() => import('./pages/UploadCenter').then((module) => ({ default: module.UploadCenter })));
const Users = lazy(() => import('./pages/Users').then((module) => ({ default: module.Users })));
const Versions = lazy(() => import('./pages/Versions').then((module) => ({ default: module.Versions })));

export function App() {
  return <UnsavedChangesProvider><Suspense fallback={<main className="page-stack" aria-busy="true">正在加载页面…</main>}><Routes>
    <Route path="/login" element={<Login />} />
    <Route element={<RequireAuth />}>
      <Route path="/change-password" element={<ChangePassword />} />
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<CommercialDashboard />} />
        <Route path="/robots" element={<RobotOperations />} />
        <Route path="/tasks" element={<TaskOperations />} />
        <Route path="/maps" element={<MapOperations />} />
        <Route path="/versions-platform" element={<OtaRelease />} />
        {['/realtime', '/faults', '/maintenance', '/reports', '/system-platform'].map((path) => <Route key={path} path={path} element={<OperationsPage />} />)}
        <Route path="/files" element={<Files />} />
        <Route element={<RequireRole roles={['ADMIN', 'SUPER_ADMIN', 'TENANT_ADMIN', 'PROJECT_ADMIN', 'OPERATOR']} />}><Route path="/upload" element={<UploadCenter />} /></Route>
        <Route path="/datasets" element={<Datasets />} />
        <Route path="/datasets/:datasetId" element={<DatasetWorkspace />} />
        <Route path="/datasets/:datasetId/versions/:versionId" element={<DatasetWorkspace />} />
        <Route path="/datasets/:datasetId/compare" element={<DatasetWorkspace />} />
        <Route path="/dataset-versions" element={<Versions />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/jobs/:id" element={<JobDetail />} />
        <Route path="/activity" element={<Activity />} />
        <Route path="/storage" element={<Storage />} />
        <Route path="/system-status" element={<SystemStatus />} />
        <Route element={<RequireRole roles={['ADMIN', 'SUPER_ADMIN', 'TENANT_ADMIN']} />}>
          <Route path="/system-settings" element={<SystemSettings />} />
          <Route path="/users" element={<Users />} />
          <Route path="/audit-logs" element={<AuditLogs />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Route>
  </Routes></Suspense></UnsavedChangesProvider>;
}
