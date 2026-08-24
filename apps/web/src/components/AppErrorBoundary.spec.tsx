import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppErrorBoundary } from './AppErrorBoundary';

function BrokenPage(): ReactNode { throw new Error('Unexpected page data'); }

describe('AppErrorBoundary', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renders a recoverable error page instead of a blank root', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<AppErrorBoundary><BrokenPage /></AppErrorBoundary>);

    expect(screen.getByText('页面加载失败')).toBeInTheDocument();
    expect(screen.getByText('Unexpected page data')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新加载' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '返回工作台' })).toBeInTheDocument();
  });
});
