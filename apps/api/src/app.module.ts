import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { FilesModule } from './files/files.module';
import { DatasetsModule } from './datasets/datasets.module';
import { RobotsModule } from './robots/robots.module';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SearchModule } from './search/search.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { JobsModule } from './jobs/jobs.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SettingsModule } from './settings/settings.module';
import { UsersModule } from './users/users.module';
import { TagsModule } from './tags/tags.module';
import { SavedViewsModule } from './saved-views/saved-views.module';
import { UploadsModule } from './uploads/uploads.module';
import { WorkerModule } from './worker/worker.module';
import { ActivityModule } from './activity/activity.module';
import { ROOT_ENV_FILE } from './root-env';
import { ObservabilityModule } from './observability/observability.module';
import { BuildInfoModule } from './build-info/build-info.module';

/**
 * The canonical environment file lives at the repository root. Resolving from
 * this module makes both root-level and workspace-level npm commands behave
 * identically, regardless of their current working directory.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ROOT_ENV_FILE }),
    ObservabilityModule,
    BuildInfoModule,
    AuthModule,
    AuditModule,
    HealthModule,
    PrismaModule,
    StorageModule,
    FilesModule,
    DatasetsModule,
    RobotsModule,
    DashboardModule,
    SearchModule,
    JobsModule,
    NotificationsModule,
    SettingsModule,
    UsersModule,
    TagsModule,
    SavedViewsModule,
    UploadsModule,
    WorkerModule,
    ActivityModule,
  ],
})
export class AppModule {}
