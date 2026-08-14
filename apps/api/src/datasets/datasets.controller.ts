import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateDatasetDto } from './dto/create-dataset.dto';
import { CreateDatasetVersionDto } from './dto/create-dataset-version.dto';
import { UpdateVersionFilesDto } from './dto/update-version-files.dto';
import { DatasetsService } from './datasets.service';
import { DatasetPublishService } from './dataset-publish.service';

@ApiTags('datasets')
@Controller('v1/datasets')
export class DatasetsController {
  constructor(private readonly datasets: DatasetsService, private readonly publisher: DatasetPublishService) {}

  @Post()
  @ApiOperation({ summary: 'Create a dataset' })
  @ApiCreatedResponse()
  create(@Body() body: CreateDatasetDto) { return this.datasets.create(body); }

  @Get()
  @ApiOkResponse()
  list() { return this.datasets.list(); }

  @Get(':id')
  @ApiOkResponse()
  get(@Param('id') id: string) { return this.datasets.get(id); }

  @Post(':datasetId/versions')
  @ApiOperation({ summary: 'Create the next DRAFT dataset version' })
  @ApiCreatedResponse()
  createVersion(@Param('datasetId') datasetId: string, @Body() body: CreateDatasetVersionDto) { return this.datasets.createVersion(datasetId, body.fileIds ?? []); }

  @Get('versions/:id')
  @ApiOkResponse()
  getVersion(@Param('id') id: string) { return this.datasets.getVersion(id); }

  @Post('versions/:id/files')
  @ApiOperation({ summary: 'Add RobotFiles to a DRAFT dataset version' })
  addFiles(@Param('id') id: string, @Body() body: UpdateVersionFilesDto) { return this.datasets.addFiles(id, body.fileIds); }

  @Delete('versions/:versionId/files/:fileId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a RobotFile from a DRAFT dataset version' })
  removeFile(@Param('versionId') versionId: string, @Param('fileId') fileId: string) { return this.datasets.removeFile(versionId, fileId); }

  @Post('versions/:id/freeze')
  @ApiOperation({ summary: 'Freeze a dataset version and store its manifest' })
  freeze(@Param('id') id: string) { return this.datasets.freeze(id); }

  @Post('versions/:id/publish')
  @ApiOperation({ summary: 'Publish a FROZEN version with DVC and a Git tag' })
  publish(@Param('id') id: string) { return this.publisher.publish(id); }
}
