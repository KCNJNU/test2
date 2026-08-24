import { Module } from '@nestjs/common';
import { BuildInfoController } from './build-info.controller';
import { BuildInfoService } from './build-info.service';

@Module({ controllers: [BuildInfoController], providers: [BuildInfoService], exports: [BuildInfoService] })
export class BuildInfoModule {}
