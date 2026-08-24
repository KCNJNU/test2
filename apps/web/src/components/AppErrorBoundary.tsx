import { Alert, Button, Result, Space } from 'antd';
import { Component, type ErrorInfo, type ReactNode } from 'react';

type State = { error?: Error };

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = {};

  static getDerivedStateFromError(error: Error): State { return { error }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page rendering failed', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <main className="route-error-boundary"><Result status="error" title="页面加载失败" subTitle="页面遇到了意外数据或运行时错误，其他系统服务仍可继续使用。" extra={<Space wrap><Button type="primary" onClick={() => window.location.reload()}>重新加载</Button><Button onClick={() => window.location.assign('/dashboard')}>返回工作台</Button></Space>}><Alert type="error" showIcon message={this.state.error.message || 'Unknown rendering error'} /></Result></main>;
  }
}
