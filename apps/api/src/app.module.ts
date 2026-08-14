import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'node:path';
import { HealthModule } from './health/health.module';
import { FilesModule } from './files/files.module';
import { DatasetsModule } from './datasets/datasets.module';
import { RobotsModule } from './robots/robots.module';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';

/**
 * The canonical environment file lives at the repository root. Resolving from
 * this module makes both root-level and workspace-level npm commands behave
 * identically, regardless of their current working directory.
 */
const rootEnvFile = resolve(__dirname, '..', '..', '..', '.env');

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: rootEnvFile }),
    HealthModule,
    PrismaModule,
    StorageModule,
    FilesModule,
    DatasetsModule,
    RobotsModule,
  ],
})
export class AppModule {}
