import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompareFile, Dataset, DatasetVersion, RobotFile, ValidationReport, VersionComparison } from '../services/api';
import { Datasets } from '../pages/Datasets';
import { VersionBuilder } from './VersionBuilder';
import { VersionCompare } from './VersionCompare';
import { VersionValidation } from './VersionValidation';

const mocks = vi.hoisted(() => ({
  datasetPage: vi.fn(), version: vi.fn(), versionCandidates: vi.fn(), replaceVersionFiles: vi.fn(),
  validateVersion: vi.fn(), freeze: vi.fn(), publish: vi.fn(), compareVersions: vi.fn(),
}));

vi.mock('../services/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../services/api')>();
  return { ...original, api: { ...original.api, ...mocks } };
});

const file = (id: string, name: string): RobotFile => ({ id, robotId: 'robot-1', objectKey: `raw/${name}`, originalName: name, fileType: 'json', mimeType: 'application/json', fileSize: '12', checksum: 'a'.repeat(64), recognitionType: 'obstacle', schemaVersion: '1.0', capturedAt: '2026-08-16T00:00:00.000Z', createdAt: '2026-08-16T00:00:00.000Z', updatedAt: '2026-08-16T00:00:00.000Z', robot: { id: 'robot-1', name: 'Robot One', externalId: 'CR-001' } });
const compareFile = (id: string, name: string): CompareFile => ({ id, originalName: name, fileSize: '12', checksum: 'a'.repeat(64), recognitionType: 'obstacle', schemaVersion: '1.0', capturedAt: '2026-08-16T00:00:00.000Z', robot: { id: 'robot-1', name: 'Robot One', externalId: 'CR-001' } });
const version = (id = 'version-2', number = 2): DatasetVersion => ({ id, datasetId: 'dataset-1', version: number, status: 'DRAFT', fileCount: 1, totalSize: '12', createdAt: '2026-08-16T00:00:00.000Z', updatedAt: '2026-08-16T00:00:00.000Z', files: [{ robotFileId: 'file-1', robotFile: file('file-1', 'current.json') }] });
const dataset: Dataset = { id: 'dataset-1', name: 'Workspace Dataset', createdAt: '2026-08-16T00:00:00.000Z', updatedAt: '2026-08-16T00:00:00.000Z', versions: [version(), version('version-1', 1)] };

function wrapper(initialEntry = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const Wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}><MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter></QueryClientProvider>;
  return { client, Wrapper };
}

describe('Dataset Workspace UX', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.datasetPage.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 12 });
    mocks.versionCandidates.mockResolvedValue({ items: [file('file-2', 'candidate.json')], total: 1, page: 1, pageSize: 8 });
    mocks.replaceVersionFiles.mockResolvedValue(version());
  });

  it('redirects the legacy dataset query deep link to the workspace route', async () => {
    const { Wrapper } = wrapper('/datasets?dataset=dataset-1');
    function Location() { return <output data-testid="location">{useLocation().pathname}</output>; }
    render(<Routes><Route path="/datasets" element={<Datasets />} /><Route path="/datasets/:datasetId" element={<Location />} /></Routes>, { wrapper: Wrapper });
    expect(await screen.findByTestId('location')).toHaveTextContent('/datasets/dataset-1');
  });

  it('stages membership and saves a complete replacement', async () => {
    const { client, Wrapper } = wrapper('/datasets/dataset-1/versions/version-2?tab=builder');
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    render(<VersionBuilder version={version()} onDirtyChange={() => undefined} />, { wrapper: Wrapper });
    fireEvent.click(await screen.findByLabelText('Add candidate.json'));
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/ }));
    await waitFor(() => expect(mocks.replaceVersionFiles).toHaveBeenCalledWith('version-2', ['file-1', 'file-2']));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['datasets'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['versions'] });
  });

  it('does not offer Freeze confirmation when validation has errors', async () => {
    const invalid: ValidationReport = { versionId: 'version-2', status: 'DRAFT', valid: false, validatedAt: '2026-08-16T00:00:00.000Z', summary: { files: 1, totalSize: '12', checkedObjects: 0, errors: 1, warnings: 0 }, issues: [{ code: 'OBJECT_MISSING', severity: 'error', message: 'Object is missing' }] };
    mocks.validateVersion.mockResolvedValue(invalid);
    const { Wrapper } = wrapper();
    render(<VersionValidation version={version()} onChanged={() => undefined} />, { wrapper: Wrapper });
    fireEvent.click(screen.getByRole('button', { name: /Validate & Freeze/ }));
    expect(await screen.findByText('Version has blocking integrity errors')).toBeVisible();
    expect(mocks.freeze).not.toHaveBeenCalled();
    expect(screen.queryByText('Freeze Version')).not.toBeInTheDocument();
  });

  it('loads the default current-versus-previous comparison from real API data', async () => {
    const comparison: VersionComparison = { dataset: { id: dataset.id, name: dataset.name }, base: { id: 'version-1', version: 1, status: 'DRAFT', fileCount: 1, totalSize: '12' }, target: { id: 'version-2', version: 2, status: 'DRAFT', fileCount: 2, totalSize: '24' }, summary: { added: 1, removed: 0, unchanged: 1, totalSizeDelta: '12' }, files: { added: [compareFile('file-2', 'candidate.json')], removed: [], unchanged: [compareFile('file-1', 'current.json')] } };
    mocks.compareVersions.mockResolvedValue(comparison);
    const { Wrapper } = wrapper('/datasets/dataset-1/compare');
    render(<VersionCompare dataset={dataset} currentVersionId="version-2" />, { wrapper: Wrapper });
    expect(await screen.findByText('RobotFile identity comparison · no inferred modifications')).toBeVisible();
    expect(mocks.compareVersions).toHaveBeenCalledWith('dataset-1', 'version-1', 'version-2');
    expect(screen.getByText('candidate.json')).toBeVisible();
  });
});
