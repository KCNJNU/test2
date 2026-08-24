import { PrismaClient, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();
const legacy = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  projectId: '22222222-2222-4222-8222-222222222222',
  siteId: '33333333-3333-4333-8333-333333333333',
  floorId: '44444444-4444-4444-8444-444444444444',
};

const permissionCodes = [
  'TENANT_READ', 'TENANT_MANAGE', 'PROJECT_READ', 'PROJECT_MANAGE',
  'ROBOT_READ', 'ROBOT_MANAGE', 'TASK_READ', 'TASK_CONTROL',
  'MAP_READ', 'MAP_MANAGE', 'MAP_PUBLISH', 'FAULT_READ', 'FAULT_ACKNOWLEDGE',
  'MAINTENANCE_MANAGE', 'VERSION_READ', 'OTA_MANAGE', 'CONFIG_SAFETY_MANAGE',
  'REPORT_READ', 'AUDIT_READ', 'USER_MANAGE', 'DATA_READ', 'DATA_MANAGE',
  'DEVICE_IDENTITY_MANAGE', 'RESILIENCE_MANAGE',
] as const;

const rolePermissions: Record<UserRole, readonly string[]> = {
  ADMIN: permissionCodes,
  SUPER_ADMIN: permissionCodes,
  TENANT_ADMIN: permissionCodes.filter((code) => code !== 'CONFIG_SAFETY_MANAGE'),
  PROJECT_ADMIN: permissionCodes.filter((code) => !['TENANT_MANAGE', 'CONFIG_SAFETY_MANAGE'].includes(code)),
  OPERATOR: ['PROJECT_READ', 'ROBOT_READ', 'TASK_READ', 'TASK_CONTROL', 'MAP_READ', 'FAULT_READ', 'FAULT_ACKNOWLEDGE', 'REPORT_READ', 'DATA_READ'],
  MAINTENANCE_ENGINEER: ['PROJECT_READ', 'ROBOT_READ', 'TASK_READ', 'MAP_READ', 'FAULT_READ', 'FAULT_ACKNOWLEDGE', 'MAINTENANCE_MANAGE', 'VERSION_READ', 'OTA_MANAGE', 'REPORT_READ', 'DATA_READ'],
  VIEWER: ['PROJECT_READ', 'ROBOT_READ', 'TASK_READ', 'MAP_READ', 'FAULT_READ', 'VERSION_READ', 'REPORT_READ', 'DATA_READ'],
};

async function main() {
  await prisma.tenant.upsert({ where: { code: 'LEGACY' }, update: {}, create: { id: legacy.tenantId, code: 'LEGACY', name: 'Legacy Data Platform' } });
  await prisma.project.upsert({ where: { tenantId_code: { tenantId: legacy.tenantId, code: 'LEGACY-DATA' } }, update: {}, create: { id: legacy.projectId, tenantId: legacy.tenantId, code: 'LEGACY-DATA', name: 'Legacy Data Project' } });
  await prisma.site.upsert({ where: { projectId_code: { projectId: legacy.projectId, code: 'LEGACY-SITE' } }, update: {}, create: { id: legacy.siteId, tenantId: legacy.tenantId, projectId: legacy.projectId, code: 'LEGACY-SITE', name: 'Legacy Site' } });
  await prisma.floor.upsert({ where: { siteId_code: { siteId: legacy.siteId, code: 'LEGACY-FLOOR-1' } }, update: {}, create: { id: legacy.floorId, tenantId: legacy.tenantId, projectId: legacy.projectId, siteId: legacy.siteId, code: 'LEGACY-FLOOR-1', name: 'Legacy Floor 1', level: 1 } });

  for (const role of Object.values(UserRole)) {
    await prisma.roleDefinition.upsert({ where: { code: role }, update: { deprecated: role === UserRole.ADMIN }, create: { code: role, displayName: role.replaceAll('_', ' '), deprecated: role === UserRole.ADMIN } });
  }
  for (const code of permissionCodes) await prisma.permission.upsert({ where: { code }, update: {}, create: { code, description: code.replaceAll('_', ' ').toLowerCase() } });
  for (const [role, permissions] of Object.entries(rolePermissions) as Array<[UserRole, readonly string[]]>) {
    for (const permissionCode of permissions) await prisma.rolePermission.upsert({ where: { roleCode_permissionCode: { roleCode: role, permissionCode } }, update: {}, create: { roleCode: role, permissionCode } });
  }

  const safetyPolicies = [
    ['SAFE-101', 'Forward obstacle / waiting', 'WARNING', false, false, false, true, true, 'Wait for the path to clear; no manual reset is required.'],
    ['SAFE-106', 'Negative obstacle / fall risk', 'LATCHED', true, true, true, false, true, 'Inspect the robot and floor on site.'],
    ['SAFE-301', 'Physical emergency stop', 'LATCHED', true, true, true, false, true, 'Reset the physical emergency stop on site.'],
  ] as const;
  for (const [code, meaning, severity, latched, fullBlock, requiresOnsiteHandling, allowAutoRecovery, configured, handlingSuggestion] of safetyPolicies) {
    await prisma.safetyPolicy.upsert({ where: { code }, update: { meaning, severity, latched, fullBlock, requiresOnsiteHandling, allowAutoRecovery, configured, handlingSuggestion }, create: { code, meaning, severity, latched, fullBlock, requiresOnsiteHandling, allowAutoRecovery, configured, handlingSuggestion } });
  }
  for (const code of ['SAFE-201', 'SAFE-202', 'SAFE-302', 'SAFE-303', 'SAFE-403', 'SAFE-404', 'SAFE-405']) {
    await prisma.safetyPolicy.upsert({ where: { code }, update: {}, create: { code, meaning: 'Product definition pending', severity: 'LATCHED', latched: true, fullBlock: true, requiresOnsiteHandling: true, configured: false, handlingSuggestion: 'On-site handling required; policy is not yet configured.' } });
  }
  const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const bootstrapPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (Boolean(bootstrapEmail) !== Boolean(bootstrapPassword)) throw new Error('BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD must be provided together');
  if (bootstrapEmail && bootstrapPassword) {
    if (bootstrapPassword.length < 12) throw new Error('BOOTSTRAP_ADMIN_PASSWORD must contain at least 12 characters');
    const existing = await prisma.user.findUnique({ where: { email: bootstrapEmail }, select: { id: true } });
    if (!existing) {
      await prisma.user.create({
        data: {
          email: bootstrapEmail,
          displayName: 'Bootstrap Administrator',
          passwordHash: await argon2.hash(bootstrapPassword, { type: argon2.argon2id }),
          role: UserRole.ADMIN,
          mustChangePassword: true,
        },
      });
    }
  }
  await prisma.robot.upsert({
    where: { externalId: 'CR-001' },
    update: { name: 'Cleaning Robot CR-001', ...legacy },
    create: { name: 'Cleaning Robot CR-001', externalId: 'CR-001', ...legacy },
  });
  await prisma.robot.upsert({
    where: { externalId: 'CR-002' },
    update: { name: 'Cleaning Robot CR-002', ...legacy },
    create: { name: 'Cleaning Robot CR-002', externalId: 'CR-002', ...legacy },
  });
  await prisma.robot.upsert({
    where: { externalId: 'CR-003' },
    update: { name: 'Cleaning Robot CR-003', ...legacy },
    create: { name: 'Cleaning Robot CR-003', externalId: 'CR-003', ...legacy },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
