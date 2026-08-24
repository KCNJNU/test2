import '@ant-design/v5-patch-for-react-19';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp, ConfigProvider } from 'antd';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import './styles.css';
import { UploadQueueProvider } from './upload/UploadQueueContext';
import { AuthProvider } from './auth/AuthContext';
import { AppErrorBoundary } from './components/AppErrorBoundary';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 20_000, retry: 1, refetchOnWindowFocus: false } } });
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ConfigProvider theme={{ token: { colorPrimary: '#2563a6', colorBgLayout: '#eef2f6', colorBorderSecondary: '#dbe3eb', borderRadius: 8, fontSize: 14, controlHeight: 34 }, components: { Table: { headerBg: '#f4f7fa', headerColor: '#425466', cellPaddingBlock: 10, cellPaddingInline: 12 }, Card: { paddingLG: 18 }, Drawer: { paddingLG: 20 } } }}><AntApp><AppErrorBoundary><QueryClientProvider client={queryClient}><BrowserRouter><AuthProvider><UploadQueueProvider><App /></UploadQueueProvider></AuthProvider></BrowserRouter></QueryClientProvider></AppErrorBoundary></AntApp></ConfigProvider></React.StrictMode>);
