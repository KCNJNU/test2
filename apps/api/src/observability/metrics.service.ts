import { Injectable } from '@nestjs/common';
import { CommandStatus, Prisma, RobotOnlineStatus, RobotOperationalState, TaskStatus, UserRole } from '@prisma/client';
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MetricsService {
  readonly registry = new Registry();
  readonly httpRequests = new Counter({ name: 'platform_http_requests_total', help: 'HTTP requests processed', labelNames: ['method', 'route', 'status_code'], registers: [this.registry] });
  readonly httpDuration = new Histogram({ name: 'platform_http_request_duration_seconds', help: 'HTTP request latency', labelNames: ['method', 'route', 'status_code'], buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5], registers: [this.registry] });
  readonly gatewayConnected = new Gauge({ name: 'platform_device_gateway_connected', help: 'Whether the gateway is connected to MQTT', registers: [this.registry] });
  readonly gatewayInbound = new Counter({ name: 'platform_gateway_inbound_messages_total', help: 'MQTT messages handled by channel and result', labelNames: ['channel', 'result'], registers: [this.registry] });
  readonly gatewayCommands = new Counter({ name: 'platform_gateway_commands_total', help: 'Commands handled by result', labelNames: ['result'], registers: [this.registry] });
  readonly offlineTransitions = new Counter({ name: 'platform_robot_online_transitions_total', help: 'Robot online-state transitions detected by the gateway', labelNames: ['status'], registers: [this.registry] });
  readonly robots = new Gauge({ name: 'platform_robots', help: 'Robot count by online and operational state', labelNames: ['online_status', 'operational_state'], registers: [this.registry] });
  readonly tasks = new Gauge({ name: 'platform_tasks', help: 'Task count by status', labelNames: ['status'], registers: [this.registry] });
  readonly commands = new Gauge({ name: 'platform_commands', help: 'Command count by status', labelNames: ['status'], registers: [this.registry] });
  readonly faults = new Gauge({ name: 'platform_open_faults', help: 'Open fault count by severity', labelNames: ['severity'], registers: [this.registry] });
  readonly jobBacklog = new Gauge({ name: 'platform_job_backlog', help: 'Queued and running PostgreSQL jobs', labelNames: ['status'], registers: [this.registry] });
  readonly outboxBacklog = new Gauge({ name: 'platform_outbox_backlog', help: 'Unpublished command outbox messages', registers: [this.registry] });
  readonly refreshSuccessful = new Gauge({ name: 'platform_metrics_refresh_success', help: 'Whether the latest database-backed metric refresh succeeded', registers: [this.registry] });

  constructor(private readonly prisma: PrismaService) {
    this.registry.setDefaultLabels({ service: process.env.RUNTIME_SERVICE_NAME ?? 'unknown' });
    collectDefaultMetrics({ register: this.registry, prefix: 'platform_process_' });
  }

  observeHttp(method: string, route: string, statusCode: number, seconds: number) {
    const labels = { method, route, status_code: String(statusCode) };
    this.httpRequests.inc(labels);
    this.httpDuration.observe(labels, seconds);
  }

  async render() {
    try { await this.refreshPlatformGauges(); this.refreshSuccessful.set(1); }
    catch { this.refreshSuccessful.set(0); }
    return this.registry.metrics();
  }

  async summary(user: AuthUser) {
    const tenant = tenantWhere(user);
    const robot = tenant;
    const task = tenant;
    const command = Object.keys(tenant).length ? { robot: tenant } : {};
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const [online, offline, running, blocked, fault, safeEventsHour, tasksRunning, tasksBlocked, sent, accepted, rejected, timeout, failed] = await this.prisma.$transaction([
      this.prisma.robot.count({ where: { ...robot, onlineStatus: RobotOnlineStatus.ONLINE } }),
      this.prisma.robot.count({ where: { ...robot, onlineStatus: RobotOnlineStatus.OFFLINE } }),
      this.prisma.robot.count({ where: { ...robot, operationalState: RobotOperationalState.RUNNING } }),
      this.prisma.robot.count({ where: { ...robot, operationalState: RobotOperationalState.BLOCKED } }),
      this.prisma.robot.count({ where: { ...robot, operationalState: RobotOperationalState.FAULT } }),
      this.prisma.faultEvent.count({ where: { ...tenant, startAt: { gte: since } } }),
      this.prisma.task.count({ where: { ...task, status: TaskStatus.RUNNING } }),
      this.prisma.task.count({ where: { ...task, status: TaskStatus.BLOCKED } }),
      this.prisma.command.count({ where: { ...command, status: CommandStatus.SENT } }),
      this.prisma.command.count({ where: { ...command, status: CommandStatus.ACCEPTED } }),
      this.prisma.command.count({ where: { ...command, status: CommandStatus.REJECTED } }),
      this.prisma.command.count({ where: { ...command, status: CommandStatus.TIMEOUT } }),
      this.prisma.command.count({ where: { ...command, status: CommandStatus.FAILED } }),
    ]);
    return { timestamp: new Date().toISOString(), fleet: { online, offline, running, blocked, fault, safeEventsHour }, tasks: { running: tasksRunning, blocked: tasksBlocked }, commands: { sent, accepted, rejected, timeout, failed } };
  }

  private async refreshPlatformGauges() {
    const [robots, tasks, commands, faults, jobs, outbox] = await this.prisma.$transaction([
      this.prisma.$queryRaw<Array<{ onlineStatus: string; operationalState: string; count: bigint }>>(Prisma.sql`SELECT "onlineStatus", "operationalState", COUNT(*) AS count FROM "Robot" GROUP BY "onlineStatus", "operationalState"`),
      this.prisma.$queryRaw<Array<{ status: string; count: bigint }>>(Prisma.sql`SELECT status, COUNT(*) AS count FROM "Task" GROUP BY status`),
      this.prisma.$queryRaw<Array<{ status: string; count: bigint }>>(Prisma.sql`SELECT status, COUNT(*) AS count FROM "Command" GROUP BY status`),
      this.prisma.$queryRaw<Array<{ severity: string; count: bigint }>>(Prisma.sql`SELECT severity, COUNT(*) AS count FROM "FaultEvent" WHERE "endAt" IS NULL GROUP BY severity`),
      this.prisma.$queryRaw<Array<{ status: string; count: bigint }>>(Prisma.sql`SELECT status, COUNT(*) AS count FROM "Job" WHERE status IN ('QUEUED', 'RUNNING') GROUP BY status`),
      this.prisma.outboxMessage.count({ where: { publishedAt: null } }),
    ]);
    this.robots.reset(); this.tasks.reset(); this.commands.reset(); this.faults.reset(); this.jobBacklog.reset();
    robots.forEach((item) => this.robots.set({ online_status: item.onlineStatus, operational_state: item.operationalState }, Number(item.count)));
    tasks.forEach((item) => this.tasks.set({ status: item.status }, Number(item.count)));
    commands.forEach((item) => this.commands.set({ status: item.status }, Number(item.count)));
    faults.forEach((item) => this.faults.set({ severity: item.severity }, Number(item.count)));
    jobs.forEach((item) => this.jobBacklog.set({ status: item.status }, Number(item.count)));
    this.outboxBacklog.set(outbox);
  }
}

function tenantWhere(user: AuthUser): { tenantId?: string } {
  if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN) return {};
  return user.tenantId ? { tenantId: user.tenantId } : { tenantId: '__no_tenant__' };
}
