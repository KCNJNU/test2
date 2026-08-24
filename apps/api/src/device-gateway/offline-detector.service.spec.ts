import { RobotOnlineStatus, RobotOperationalState } from '@prisma/client';
import { OfflineDetectorService } from './offline-detector.service';

describe('OfflineDetectorService', () => {
  const prisma = { robot: { updateMany: jest.fn() } };
  const service = new OfflineDetectorService(prisma as never);

  beforeEach(() => { jest.clearAllMocks(); prisma.robot.updateMany.mockResolvedValueOnce({ count: 2 }).mockResolvedValueOnce({ count: 3 }); });

  it('marks expired leases OFFLINE before marking the intermediate lease UNSTABLE', async () => {
    await expect(service.detect(15_000, 30_000)).resolves.toEqual({ offline: 2, unstable: 3 });
    expect(prisma.robot.updateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ data: {
      onlineStatus: RobotOnlineStatus.OFFLINE, operationalState: RobotOperationalState.OFFLINE,
    } }));
    expect(prisma.robot.updateMany).toHaveBeenNthCalledWith(2, expect.objectContaining({ data: { onlineStatus: RobotOnlineStatus.UNSTABLE } }));
  });
});
