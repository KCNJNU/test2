import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/auth.decorators';
import { BuildInfoService } from './build-info.service';

@Public()
@Controller('version')
export class BuildInfoController {
  constructor(private readonly build: BuildInfoService) {}
  @Get() get() { return this.build.get(); }
}
