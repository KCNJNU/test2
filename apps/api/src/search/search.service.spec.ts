import { SearchService } from './search.service';

describe('SearchService', () => {
  it('returns bounded, resource-grouped search results', async () => {
    const prisma = {
      robot: { findMany: jest.fn().mockResolvedValue([{ id: 'r1', name: 'Sweep One', externalId: 'CR-001' }]) },
      robotFile: { findMany: jest.fn().mockResolvedValue([{ id: 'f1', originalName: 'scan.json', objectKey: 'raw/CR-001/scan.json', checksum: 'abc', robot: { name: 'Sweep One', externalId: 'CR-001' } }]) },
      dataset: { findMany: jest.fn().mockResolvedValue([{ id: 'd1', name: 'Obstacle', description: null }]) },
      datasetVersion: { findMany: jest.fn().mockResolvedValue([{ id: 'v1', version: 2, status: 'DRAFT', gitTag: null, dataset: { id: 'd1', name: 'Obstacle' } }]) },
    };

    const result = await new SearchService(prisma as never).search(' scan ', 4);

    expect(result.query).toBe('scan');
    expect(result.groups.files[0]).toMatchObject({ type: 'file', id: 'f1', title: 'scan.json' });
    expect(result.groups.versions[0]).toMatchObject({ type: 'version', datasetId: 'd1' });
    expect(prisma.robot.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 4 }));
    expect(prisma.robotFile.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 4 }));
  });
});
