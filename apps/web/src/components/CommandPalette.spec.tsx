import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandPalette } from './CommandPalette';

vi.mock('../services/api', () => ({
  api: { search: vi.fn().mockResolvedValue({ query: '', groups: { robots: [], files: [], datasets: [], versions: [] } }) },
}));

function Harness() {
  const [open, setOpen] = useState(false); const location = useLocation();
  return <><button className="global-search-button" onClick={() => setOpen(true)}>Search</button><output data-testid="location">{location.pathname}</output><CommandPalette open={open} onClose={() => setOpen(false)} onCreateDataset={() => undefined} /></>;
}

describe('CommandPalette', () => {
  beforeEach(() => localStorage.clear());

  it('opens with Ctrl+K and navigates to a command target', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/dashboard']}><Harness /></MemoryRouter></QueryClientProvider>);

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(await screen.findByPlaceholderText(/Search robots/)).toBeInTheDocument();
    fireEvent.click(await screen.findByText('Upload files'));

    expect(screen.getByTestId('location')).toHaveTextContent('/upload');
  });
});
