import { Injectable } from '@nestjs/common';
import { RobotOnlineStatus, RobotOperationalState } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OfflineDetectorService {
  constructor(private readonly prisma: PrismaService) {}

  async detect(unstableTimeoutMs: number, offlineTimeoutMs: number) {
    const now = Date.now();
    const offlineBefore = new Date(now - offlineTimeoutMs);
    const unstableBefore = new Date(now - unstableTimeoutMs);
    const offline = await this.prisma.robot.updateMany({
      where: { onlineStatus: { in: [RobotOnlineStatus.ONLINE, RobotOnlineStatus.UNSTABLE] }, OR: [{ lastOnlineAt: null }, { lastOnlineAt: { lt: offlineBefore } }] },
      data: { onlineStatus: RobotOnlineStatus.OFFLINE, operationalState: RobotOperationalState.OFFLINE },
    });
    const unstable = await this.prisma.robot.updateMany({
      where: { onlineStatus: RobotOnlineStatus.ONLINE, lastOnlineAt: { gte: offlineBefore, lt: unstableBefore } },
      data: { onlineStatus: RobotOnlineStatus.UNSTABLE },
    });
    return { offline: offline.count, unstable: unstable.count };
  }
}
