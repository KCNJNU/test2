import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FilesService } from './files.service';

const file = { originalname: 'recognition.json', mimetype: 'application/json', buffer: Buffer.from('{"ok":true}'), size: 11 };
const robot = { id: '00000000-0000-0000-0000-000000000001', externalId: 'CR-001' };
const input = { robotId: robot.id, recognitionType: 'lidar', capturedAt: '2026-08-12T00:00:00Z', schemaVersion: '1.0', file };

describe('FilesService', () => {
  const prisma = { robot: { findUnique: jest.fn(), findFirst: jest.fn() }, robotFile: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), delete: jest.fn() }, datasetVersionFile: { count: jest.fn() } };
  const storage = { putObject: jest.fn(), deleteObject: jest.fn(), exists: jest.fn(), getPresignedDownloadUrl: jest.fn(), getObject: jest.fn(), checkHealth: jest.fn(), statObject: jest.fn(), listObjects: jest.fn(), composeObject: jest.fn(), deleteObjects: jest.fn() };
  const service = new FilesService(prisma as never, storage);
  beforeEach(() => { jest.clearAllMocks(); storage.putObject.mockResolvedValue(undefined); storage.deleteObject.mockResolvedValue(undefined); });

  it('returns 409 before storage work for a duplicate checksum', async () => {
    prisma.robot.findFirst.mockResolvedValue(robot);
    prisma.robotFile.findUnique.mockResolvedValue({ id: 'duplicate' });
    await expect(service.create(input)).rejects.toBeInstanceOf(ConflictException);
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it('does not create metadata when object storage fails', async () => {
    const storageError = new Error('object storage unavailable');
    prisma.robot.findFirst.mockResolvedValue(robot);
    prisma.robotFile.findUnique.mockResolvedValue(null);
    storage.putObject.mockRejectedValueOnce(storageError);

    await expect(service.create(input)).rejects.toBe(storageError);
    expect(prisma.robotFile.create).not.toHaveBeenCalled();
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('stores the object before creating metadata', async () => {
    prisma.robot.findFirst.mockResolvedValue(robot);
    prisma.robotFile.findUnique.mockResolvedValue(null);
    prisma.robotFile.create.mockResolvedValue({ id: 'file-id', fileSize: BigInt(file.size) });

    await service.create(input);

    expect(storage.putObject).toHaveBeenCalledTimes(1);
    expect(prisma.robotFile.create).toHaveBeenCalledTimes(1);
    expect(storage.putObject.mock.invocationCallOrder[0]).toBeLessThan(prisma.robotFile.create.mock.invocationCallOrder[0]);
  });

  it('parses optional metadata as a JSON object', async () => {
    prisma.robot.findFirst.mockResolvedValue(robot);
    prisma.robotFile.findUnique.mockResolvedValue(null);
    prisma.robotFile.create.mockImplementation(({ data }) => Promise.resolve({ ...data, id: 'file-id' }));

    await service.create({ ...input, metadata: '{"sensor":"lidar"}' });

    expect(prisma.robotFile.create).toHaveBeenCalledWith({ data: expect.objectContaining({ metadata: { sensor: 'lidar' } }) });
  });

  it('rejects metadata arrays before writing ObjectStorage', async () => {
    prisma.robot.findFirst.mockResolvedValue(robot);
    prisma.robotFile.findUnique.mockResolvedValue(null);

    await expect(service.create({ ...input, metadata: '[]' })).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it('deletes the exact stored object and preserves the database error when metadata creation fails', async () => {
    const databaseError = new Error('database unavailable');
    prisma.robot.findFirst.mockResolvedValue(robot);
    prisma.robotFile.findUnique.mockResolvedValue(null);
    prisma.robotFile.create.mockRejectedValue(databaseError);
    storage.deleteObject.mockRejectedValueOnce(new Error('cleanup unavailable'));

    await expect(service.create(input)).rejects.toBe(databaseError);
    const uploadedObjectKey = storage.putObject.mock.calls[0][0].objectKey;
    expect(uploadedObjectKey).toMatch(/^raw\/CR-001\/2026\/08\/12\/.+\.json$/);
    expect(storage.deleteObject).toHaveBeenCalledWith(uploadedObjectKey);
  });

  it('does not delete an object while a dataset version references the file', async () => {
    prisma.robotFile.findFirst.mockResolvedValue({ id: 'file-id', objectKey: 'raw/CR-001/file.json' });
    prisma.datasetVersionFile.count.mockResolvedValue(1);

    await expect(service.delete('file-id')).rejects.toBeInstanceOf(ConflictException);

    expect(storage.deleteObject).not.toHaveBeenCalled();
    expect(prisma.robotFile.delete).not.toHaveBeenCalled();
  });

  it('deletes metadata before the object so a database conflict cannot destroy referenced data', async () => {
    prisma.robotFile.findFirst.mockResolvedValue({ id: 'file-id', objectKey: 'raw/CR-001/file.json' });
    prisma.datasetVersionFile.count.mockResolvedValue(0);
    prisma.robotFile.delete.mockResolvedValue({ id: 'file-id' });

    await service.delete('file-id');

    expect(prisma.robotFile.delete.mock.invocationCallOrder[0]).toBeLessThan(storage.deleteObject.mock.invocationCallOrder[0]);
  });

  it('maps a racing dataset foreign-key reference to 409 without deleting the object', async () => {
    prisma.robotFile.findFirst.mockResolvedValue({ id: 'file-id', objectKey: 'raw/CR-001/file.json' });
    prisma.datasetVersionFile.count.mockResolvedValue(0);
    prisma.robotFile.delete.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('foreign key', { code: 'P2003', clientVersion: 'test' }));

    await expect(service.delete('file-id')).rejects.toBeInstanceOf(ConflictException);
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });
});
