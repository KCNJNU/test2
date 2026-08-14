import { Module } from '@nestjs/common';
import { DvcService } from './dvc.service';

@Module({ providers: [DvcService], exports: [DvcService] })
export class DvcModule {}
