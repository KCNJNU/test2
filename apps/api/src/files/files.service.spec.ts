import { ConflictException } from '@nestjs/common';
import { FilesService } from './files.service';

const file = { originalname: 'recognition.json', mimetype: 'application/json', buffer: Buffer.from('{"ok":true}'), size: 11 };

describe('FilesService', () => {
  const prisma = { robot: { findUnique: jest.fn() }, robotFile: { findUnique: jest.fn(), create: jest.fn() } };
  const storage = { putObject: jest.fn(), deleteObject: jest.fn(), exists: jest.fn(), getPresignedDownloadUrl: jest.fn(), getObject: jest.fn() };
  const service = new FilesService(prisma as never, storage);
  beforeEach(() => { jest.clearAllMocks(); storage.putObject.mockResolvedValue(undefined); storage.deleteObject.mockResolvedValue(undefined); });

  it('returns 409 before storage work for a duplicate checksum', async () => {
    prisma.robot.findUnique.mockResolvedValue({ id: '00000000-0000-0000-0000-000000000001', externalId: 'CR-001' });
    prisma.robotFile.findUnique.mockResolvedValue({ id: 'duplicate' });
    await expect(service.create({ robotId: '00000000-0000-0000-0000-000000000001', recognitionType: 'lidar', capturedAt: '2026-08-12T00:00:00Z', schemaVersion: '1.0', file })).rejects.toBeInstanceOf(ConflictException);
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it('deletes the stored object when the database write fails', async () => {
    prisma.robot.findUnique.mockResolvedValue({ id: '00000000-0000-0000-0000-000000000001', externalId: 'CR-001' });
    prisma.robotFile.findUnique.mockResolvedValue(null);
    prisma.robotFile.create.mockRejectedValue(new Error('database unavailable'));
    await expect(service.create({ robotId: '00000000-0000-0000-0000-000000000001', recognitionType: 'lidar', capturedAt: '2026-08-12T00:00:00Z', schemaVersion: '1.0', file })).rejects.toThrow('database unavailable');
    expect(storage.deleteObject).toHaveBeenCalledWith(expect.stringMatching(/^raw\/CR-001\/2026\/08\/12\/.+\.json$/));
  });
});
