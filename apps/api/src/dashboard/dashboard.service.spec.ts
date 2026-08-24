import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  it('aggregates persisted metrics including durable Jobs', async () => {
    const now = new Date('2026-08-16T08:00:00.000Z');
    const prisma = {
      robot: { count: jest.fn().mockResolvedValue(4) },
      robotFile: {
        count: jest.fn().mockResolvedValue(3),
        aggregate: jest.fn().mockResolvedValue({ _sum: { fileSize: 1500n } }),
        findMany: jest.fn().mockResolvedValue([{ id: 'file-1', originalName: 'scan.json', createdAt: now }]),
      },
      dataset: {
        count: jest.fn().mockResolvedValue(2),
        findMany: jest.fn().mockResolvedValue([{ id: 'dataset-1', name: 'Training', createdAt: now }]),
      },
      datasetVersion: {
        count: jest.fn().mockResolvedValue(1),
        groupBy: jest.fn().mockResolvedValue([{ status: 'DRAFT', _count: { _all: 2 } }]),
        findMany: jest.fn().mockResolvedValue([{ id: 'version-1', version: 1, status: 'DRAFT', createdAt: now, frozenAt: null, dataset: { name: 'Training' } }]),
      },
      job: { groupBy: jest.fn().mockResolvedValue([{ status: 'RUNNING', _count: { _all: 1 } }, { status: 'SUCCEEDED', _count: { _all: 2 } }]), count: jest.fn().mockResolvedValue(1), findMany: jest.fn().mockResolvedValue([{ id: 'job-1', type: 'STORAGE_SCAN', status: 'RUNNING', updatedAt: now }]) },
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([{ day: now, fileCount: 3n, bytes: 1500n }])
        .mockResolvedValueOnce([{ id: 'robot-1', name: 'Robot One', externalId: 'CR-001', lastUpload: now, files24h: 1n, totalFiles: 3n, totalBytes: 1500n, recognitionTypes: ['obstacle'] }]),
    };

    const result = await new DashboardService(prisma as never).get(7);

    expect(result.summary).toEqual({ robots: 4, files: 3, managedBytes: '1500', datasets: 2, publishedVersions: 1, jobs: { status: 'enabled', active: 1, total: 3, byStatus: { RUNNING: 1, SUCCEEDED: 2 } } });
    expect(result.ingestion).toEqual([{ date: '2026-08-16', fileCount: 3, bytes: '1500' }]);
    expect(result.robotActivity[0]).toMatchObject({ totalFiles: 3, totalBytes: '1500', recognitionTypes: ['obstacle'] });
    expect(result.pipeline).toEqual({ DRAFT: 2, FROZEN: 0, PUBLISHED: 0, ARCHIVED: 0 });
  });
});
