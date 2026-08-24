import { RobotsService } from './robots.service';

describe('RobotsService', () => {
  it('paginates robots and derives data activity from real file timestamps', async () => {
    const recent = new Date(Date.now() - 60_000);
    const item = { id: 'r1', name: 'Sweep One', externalId: 'CR-001', metadata: null, createdAt: recent, updatedAt: recent };
    const prisma = {
      robot: { findMany: jest.fn().mockResolvedValue([item]), count: jest.fn().mockResolvedValue(1) },
      robotFile: {
        groupBy: jest.fn()
          .mockResolvedValueOnce([{ robotId: 'r1', _count: { _all: 2 }, _sum: { fileSize: 24n }, _max: { createdAt: recent } }])
          .mockResolvedValueOnce([{ robotId: 'r1', _count: { _all: 1 } }]),
        findMany: jest.fn().mockResolvedValue([{ robotId: 'r1', recognitionType: 'obstacle' }]),
      },
      $transaction: jest.fn((operations: Array<Promise<unknown>>) => Promise.all(operations)),
    };

    const result = await new RobotsService(prisma as never).page({ page: 1, pageSize: 20, sortBy: 'createdAt', sortOrder: 'desc' });

    expect(result.total).toBe(1);
    expect(result.items[0].stats).toMatchObject({ activityStatus: 'ACTIVE', files24h: 1, totalFiles: 2, totalBytes: '24', recognitionTypes: ['obstacle'] });
  });

  it('creates a robot without changing the data model', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'r1', name: 'Sweep One', externalId: 'CR-001' });
    const service = new RobotsService({ robot: { create } } as never);

    await service.create({ name: ' Sweep One ', externalId: ' CR-001 ', metadata: { model: 'S1' } });

    expect(create).toHaveBeenCalledWith({ data: { name: 'Sweep One', externalId: 'CR-001', metadata: { model: 'S1' } } });
  });
});
