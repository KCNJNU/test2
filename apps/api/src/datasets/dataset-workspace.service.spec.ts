import { ConflictException } from '@nestjs/common';
import { DatasetVersionStatus } from '@prisma/client';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { DatasetsService } from './datasets.service';

const robot = { id: '00000000-0000-0000-0000-000000000001', name: 'Robot One', externalId: 'CR-001' };
const content = Buffer.from('{"ok":true}');
const robotFile = (id: string, body = content) => ({ id, robotId: robot.id, robot, objectKey: `raw/CR-001/${id}.json`, originalName: `${id}.json`, fileType: 'json', mimeType: 'application/json', fileSize: BigInt(body.length), checksum: createHash('sha256').update(body).digest('hex'), recognitionType: 'obstacle', schemaVersion: '1.0', capturedAt: new Date('2026-08-16T00:00:00Z'), createdAt: new Date('2026-08-16T00:00:00Z'), updatedAt: new Date('2026-08-16T00:00:00Z'), metadata: null });
const draft = (files = [robotFile('00000000-0000-0000-0000-000000000011')]) => ({ id: '00000000-0000-0000-0000-000000000101', datasetId: '00000000-0000-0000-0000-000000000201', version: 2, status: DatasetVersionStatus.DRAFT, manifestKey: null, manifestChecksum: null, fileCount: 0, totalSize: 0n, createdAt: new Date('2026-08-16T00:00:00Z'), updatedAt: new Date('2026-08-16T00:00:00Z'), frozenAt: null, files: files.map((file) => ({ robotFileId: file.id, robotFile: file })) });

describe('DatasetsService V2 workspace', () => {
  const datasetVersionFile = { deleteMany: jest.fn(), createMany: jest.fn() };
  const prisma = {
    dataset: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    datasetVersion: { findUnique: jest.fn(), findMany: jest.fn(), aggregate: jest.fn(), create: jest.fn(), count: jest.fn(), update: jest.fn() },
    datasetVersionFile,
    robotFile: { count: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn((operation: unknown) => Array.isArray(operation) ? Promise.all(operation) : (operation as (tx: { datasetVersionFile: typeof datasetVersionFile }) => Promise<unknown>)({ datasetVersionFile })),
  };
  const storage = { putObject: jest.fn(), deleteObject: jest.fn(), exists: jest.fn(), getObject: jest.fn() };
  const service = new DatasetsService(prisma as never, storage as never);

  beforeEach(() => {
    jest.clearAllMocks();
    storage.exists.mockResolvedValue(true);
    storage.getObject.mockImplementation(() => Promise.resolve(Readable.from([content])));
    storage.putObject.mockResolvedValue(undefined);
    prisma.robotFile.count.mockResolvedValue(1);
  });

  it('clones membership from a version in the same dataset', async () => {
    prisma.dataset.findUnique.mockResolvedValue({ id: draft().datasetId });
    prisma.datasetVersion.findUnique.mockResolvedValue({ datasetId: draft().datasetId, files: [{ robotFileId: robotFile('00000000-0000-0000-0000-000000000011').id }] });
    prisma.datasetVersion.aggregate.mockResolvedValue({ _max: { version: 2 } });
    prisma.datasetVersion.create.mockImplementation(({ data }) => Promise.resolve({ ...draft(), version: data.version }));

    await service.createVersion(draft().datasetId, [], draft().id);

    expect(prisma.datasetVersion.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ version: 3, files: { create: [{ robotFileId: '00000000-0000-0000-0000-000000000011' }] } }) }));
  });

  it('rejects cloning a version from another dataset', async () => {
    prisma.dataset.findUnique.mockResolvedValue({ id: draft().datasetId });
    prisma.datasetVersion.findUnique.mockResolvedValue({ datasetId: '00000000-0000-0000-0000-000000000999', files: [] });

    await expect(service.createVersion(draft().datasetId, [], draft().id)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.datasetVersion.create).not.toHaveBeenCalled();
  });

  it('atomically replaces all members of a draft', async () => {
    prisma.datasetVersion.findUnique.mockResolvedValue(draft());
    prisma.robotFile.count.mockResolvedValue(2);

    await service.replaceFiles(draft().id, ['00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000022']);

    expect(datasetVersionFile.deleteMany).toHaveBeenCalledWith({ where: { datasetVersionId: draft().id } });
    expect(datasetVersionFile.createMany).toHaveBeenCalledWith({ data: [{ datasetVersionId: draft().id, robotFileId: '00000000-0000-0000-0000-000000000021' }, { datasetVersionId: draft().id, robotFileId: '00000000-0000-0000-0000-000000000022' }] });
  });

  it('rejects membership replacement after a version is frozen', async () => {
    prisma.datasetVersion.findUnique.mockResolvedValue({ ...draft(), status: DatasetVersionStatus.FROZEN });

    await expect(service.replaceFiles(draft().id, [])).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('recomputes object size and SHA-256 for a valid draft', async () => {
    prisma.datasetVersion.findUnique.mockResolvedValue(draft());

    const report = await service.validateVersion(draft().id);

    expect(report.valid).toBe(true);
    expect(report.summary).toMatchObject({ files: 1, checkedObjects: 1, errors: 0 });
  });

  it('returns live DRAFT aggregates from membership instead of stale persisted counters', async () => {
    prisma.datasetVersion.findUnique.mockResolvedValue(draft());

    const detail = await service.getVersion(draft().id);

    expect(detail).toMatchObject({ fileCount: 1, totalSize: String(content.length) });
  });

  it('reports a missing object without reading it', async () => {
    prisma.datasetVersion.findUnique.mockResolvedValue(draft());
    storage.exists.mockResolvedValue(false);

    const report = await service.validateVersion(draft().id);

    expect(report.valid).toBe(false);
    expect(report.issues).toContainEqual(expect.objectContaining({ code: 'OBJECT_MISSING', fileId: '00000000-0000-0000-0000-000000000011' }));
    expect(storage.getObject).not.toHaveBeenCalled();
  });

  it('reports stored size and checksum mismatches', async () => {
    const stale = robotFile('00000000-0000-0000-0000-000000000012', Buffer.from('different metadata'));
    prisma.datasetVersion.findUnique.mockResolvedValue(draft([stale]));
    storage.getObject.mockResolvedValue(Readable.from([content]));

    const report = await service.validateVersion(draft().id);

    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'SIZE_MISMATCH', fileId: stale.id }),
      expect.objectContaining({ code: 'CHECKSUM_MISMATCH', fileId: stale.id }),
    ]));
  });

  it('checks frozen manifest checksum, membership and aggregate fields', async () => {
    const file = robotFile('00000000-0000-0000-0000-000000000013');
    const manifest = Buffer.from(JSON.stringify({ datasetId: draft().datasetId, version: 2, createdAt: new Date().toISOString(), files: [] }));
    prisma.datasetVersion.findUnique.mockResolvedValue({ ...draft([file]), status: DatasetVersionStatus.FROZEN, manifestKey: 'manifests/example.json', manifestChecksum: '0'.repeat(64), fileCount: 0, totalSize: 0n });
    storage.getObject.mockImplementation((objectKey: string) => Promise.resolve(Readable.from([objectKey === 'manifests/example.json' ? manifest : content])));

    const report = await service.validateVersion(draft().id);

    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'MANIFEST_CHECKSUM_MISMATCH' }),
      expect.objectContaining({ code: 'MANIFEST_MEMBERSHIP_MISMATCH' }),
      expect.objectContaining({ code: 'VERSION_AGGREGATE_MISMATCH' }),
    ]));
  });

  it('blocks freeze when full validation has errors', async () => {
    prisma.datasetVersion.findUnique.mockResolvedValue(draft([]));

    await expect(service.freeze(draft().id)).rejects.toBeInstanceOf(ConflictException);

    expect(storage.putObject).not.toHaveBeenCalled();
    expect(prisma.datasetVersion.update).not.toHaveBeenCalled();
  });

  it('classifies added, removed and unchanged RobotFiles', async () => {
    const unchanged = robotFile('00000000-0000-0000-0000-000000000031');
    const removed = robotFile('00000000-0000-0000-0000-000000000032');
    const added = robotFile('00000000-0000-0000-0000-000000000033');
    prisma.dataset.findUnique.mockResolvedValue({ id: draft().datasetId, name: 'Dataset One' });
    prisma.datasetVersion.findMany.mockResolvedValue([
      { ...draft([unchanged, removed]), id: '00000000-0000-0000-0000-000000000301', version: 1 },
      { ...draft([unchanged, added]), id: '00000000-0000-0000-0000-000000000302', version: 2 },
    ]);

    const comparison = await service.compareVersions(draft().datasetId, '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000302');

    expect(comparison.summary).toMatchObject({ added: 1, removed: 1, unchanged: 1 });
    expect(comparison.files.added[0].id).toBe(added.id);
    expect(comparison.files.removed[0].id).toBe(removed.id);
  });

  it('rejects compare when either version belongs to another dataset', async () => {
    prisma.dataset.findUnique.mockResolvedValue({ id: draft().datasetId, name: 'Dataset One' });
    prisma.datasetVersion.findMany.mockResolvedValue([
      { ...draft(), id: '00000000-0000-0000-0000-000000000401' },
      { ...draft(), id: '00000000-0000-0000-0000-000000000402', datasetId: '00000000-0000-0000-0000-000000000999' },
    ]);

    await expect(service.compareVersions(draft().datasetId, '00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000402')).rejects.toBeInstanceOf(ConflictException);
  });
});
