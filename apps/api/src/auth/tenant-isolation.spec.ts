import { NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { DatasetsService } from '../datasets/datasets.service';
import { JobsService } from '../jobs/jobs.service';
import { RobotsService } from '../robots/robots.service';
import type { AuthUser } from './auth.types';

describe('D6 tenant isolation query policy', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const projectId = '22222222-2222-4222-8222-222222222222';
  const projectAdmin: AuthUser = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'a@example.test', displayName: 'A', role: UserRole.PROJECT_ADMIN, tenantId, projectIds: [projectId], mustChangePassword: false };

  it('derives Robot list and detail scope from the authenticated principal', async () => {
    const prisma = { robot: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new RobotsService(prisma as never);
    await service.list(projectAdmin);
    expect(prisma.robot.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId, projectId: { in: [projectId] } } }));
    await expect(service.get('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', projectAdmin)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.robot.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId, projectId: { in: [projectId] } }) }));
  });

  it('returns not found when a Dataset is outside the principal scope', async () => {
    const prisma = { dataset: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new DatasetsService(prisma as never, {} as never);
    await expect(service.get('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', projectAdmin)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.dataset.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: expect.any(String), tenantId, projectId: { in: [projectId] } } }));
  });

  it('returns not found for a foreign Job instead of revealing authorization state', async () => {
    const prisma = { job: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new JobsService(prisma as never);
    await expect(service.getScoped('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', projectAdmin)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.job.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: expect.any(String), tenantId, projectId: { in: [projectId] } } }));
  });
});
