import { ConflictException } from '@nestjs/common';
import { DatasetVersionStatus } from '@prisma/client';
import { DatasetsService } from './datasets.service';

const file = (id: string, size = 12n) => ({ id, robotId: '00000000-0000-0000-0000-000000000001', objectKey: `raw/CR-001/${id}.json`, checksum: `checksum-${id}`, fileSize: size, capturedAt: new Date('2026-08-12T00:00:00.000Z') });
const version = (status: DatasetVersionStatus = DatasetVersionStatus.DRAFT) => ({ id: '00000000-0000-0000-0000-000000000010', datasetId: '00000000-0000-0000-0000-000000000020', version: 1, status, createdAt: new Date('2026-08-12T01:00:00.000Z'), totalSize: 0n, files: [{ robotFileId: '00000000-0000-0000-0000-000000000030', robotFile: file('00000000-0000-0000-0000-000000000030') }] });

describe('DatasetsService', () => {
  const prisma = { dataset: { findUnique: jest.fn(), create: jest.fn() }, datasetVersion: { findUnique: jest.fn(), aggregate: jest.fn(), create: jest.fn(), update: jest.fn() }, datasetVersionFile: { createMany: jest.fn(), deleteMany: jest.fn() }, robotFile: { count: jest.fn() } };
  const storage = { putObject: jest.fn(), deleteObject: jest.fn() };
  const service = new DatasetsService(prisma as never, storage as never);
  beforeEach(() => { jest.clearAllMocks(); storage.putObject.mockResolvedValue(undefined); storage.deleteObject.mockResolvedValue(undefined); });

  it('stores a complete manifest and persists its checksum when freezing a draft', async () => {
    prisma.datasetVersion.findUnique.mockResolvedValue(version());
    prisma.datasetVersion.update.mockImplementation(async ({ data }: { data: object }) => ({ ...version(DatasetVersionStatus.FROZEN), ...data }));
    const result = await service.freeze('00000000-0000-0000-0000-000000000010');
    expect(storage.putObject).toHaveBeenCalledWith(expect.objectContaining({ objectKey: 'manifests/00000000-0000-0000-0000-000000000020/v1/manifest.json', contentType: 'application/json' }));
    const content = storage.putObject.mock.calls[0][0].content.toString();
    expect(JSON.parse(content)).toEqual({ datasetId: '00000000-0000-0000-0000-000000000020', version: 1, createdAt: '2026-08-12T01:00:00.000Z', files: [{ fileId: '00000000-0000-0000-0000-000000000030', robotId: '00000000-0000-0000-0000-000000000001', objectKey: 'raw/CR-001/00000000-0000-0000-0000-000000000030.json', checksum: 'checksum-00000000-0000-0000-0000-000000000030', fileSize: '12', capturedAt: '2026-08-12T00:00:00.000Z' }] });
    expect(prisma.datasetVersion.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: DatasetVersionStatus.FROZEN, manifestChecksum: expect.stringMatching(/^[a-f0-9]{64}$/), fileCount: 1, totalSize: 12n }) }));
    expect(result.status).toBe(DatasetVersionStatus.FROZEN);
  });

  it('rejects changing a frozen version', async () => {
    prisma.datasetVersion.findUnique.mockResolvedValue(version(DatasetVersionStatus.FROZEN));
    await expect(service.addFiles('00000000-0000-0000-0000-000000000010', ['00000000-0000-0000-0000-000000000031'])).rejects.toBeInstanceOf(ConflictException);
    await expect(service.removeFile('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000030')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.datasetVersionFile.createMany).not.toHaveBeenCalled();
    expect(prisma.datasetVersionFile.deleteMany).not.toHaveBeenCalled();
  });
});
