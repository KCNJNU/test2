import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateDatasetDto } from './dto/create-dataset.dto';
import { CreateDatasetVersionDto } from './dto/create-dataset-version.dto';
import { CompareVersionsQueryDto } from './dto/compare-versions-query.dto';
import { ListDatasetsQueryDto } from './dto/list-datasets-query.dto';
import { ListVersionFilesQueryDto } from './dto/list-version-files-query.dto';
import { ListVersionsQueryDto } from './dto/list-versions-query.dto';
import { ReplaceVersionFilesDto } from './dto/replace-version-files.dto';
import { UpdateVersionFilesDto } from './dto/update-version-files.dto';
import { DatasetsService } from './datasets.service';
import { DatasetPublishService } from './dataset-publish.service';
import { JobType, UserRole } from '@prisma/client';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { AuthUser } from '../auth/auth.types';
import { JobsService } from '../jobs/jobs.service';

@ApiTags('datasets')
@Controller('v1/datasets')
export class DatasetsController {
  constructor(private readonly datasets: DatasetsService, private readonly publisher: DatasetPublishService, private readonly jobs: JobsService) {}

  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @Post()
  @ApiOperation({ summary: 'Create a dataset' })
  @ApiCreatedResponse()
  create(@Body() body: CreateDatasetDto, @CurrentUser() user: AuthUser) { return this.datasets.create(body, user); }

  @Get()
  @ApiOkResponse()
  list(@CurrentUser() user: AuthUser) { return this.datasets.list(user); }

  @Get('page')
  @ApiOkResponse()
  page(@Query() query: ListDatasetsQueryDto, @CurrentUser() user: AuthUser) { return this.datasets.page(query, user); }

  @Get('versions/page')
  @ApiOkResponse()
  pageVersions(@Query() query: ListVersionsQueryDto, @CurrentUser() user: AuthUser) { return this.datasets.pageVersions(query, user); }

  @Get(':datasetId/versions/compare')
  @ApiOkResponse()
  compare(@Param('datasetId') datasetId: string, @Query() query: CompareVersionsQueryDto, @CurrentUser() user: AuthUser) { return this.datasets.compareVersions(datasetId, query.baseVersionId, query.targetVersionId, user); }

  @Get(':id')
  @ApiOkResponse()
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) { return this.datasets.get(id, user); }

  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @Post(':datasetId/versions')
  @ApiOperation({ summary: 'Create the next DRAFT dataset version' })
  @ApiCreatedResponse()
  createVersion(@Param('datasetId') datasetId: string, @Body() body: CreateDatasetVersionDto, @CurrentUser() user: AuthUser) { return this.datasets.createVersion(datasetId, body.fileIds ?? [], body.sourceVersionId, user); }

  @Get('versions/:id')
  @ApiOkResponse()
  getVersion(@Param('id') id: string, @CurrentUser() user: AuthUser) { return this.datasets.getVersion(id, user); }

  @Get('versions/:id/files')
  @ApiOkResponse()
  files(@Param('id') id: string, @Query() query: ListVersionFilesQueryDto, @CurrentUser() user: AuthUser) { return this.datasets.listVersionFiles(id, query, false, user); }

  @Get('versions/:id/candidates')
  @ApiOkResponse()
  candidates(@Param('id') id: string, @Query() query: ListVersionFilesQueryDto, @CurrentUser() user: AuthUser) { return this.datasets.listVersionFiles(id, query, true, user); }

  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @Post('versions/:id/files')
  @ApiOperation({ summary: 'Add RobotFiles to a DRAFT dataset version' })
  addFiles(@Param('id') id: string, @Body() body: UpdateVersionFilesDto, @CurrentUser() user: AuthUser) { return this.datasets.addFiles(id, body.fileIds, user); }

  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @Put('versions/:id/files')
  @ApiOperation({ summary: 'Atomically replace RobotFiles in a DRAFT dataset version' })
  replaceFiles(@Param('id') id: string, @Body() body: ReplaceVersionFilesDto, @CurrentUser() user: AuthUser) { return this.datasets.replaceFiles(id, body.fileIds, user); }

  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @Delete('versions/:versionId/files/:fileId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a RobotFile from a DRAFT dataset version' })
  removeFile(@Param('versionId') versionId: string, @Param('fileId') fileId: string, @CurrentUser() user: AuthUser) { return this.datasets.removeFile(versionId, fileId, user); }

  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @Post('versions/:id/freeze')
  @ApiOperation({ summary: 'Freeze a dataset version and store its manifest' })
  freeze(@Param('id') id: string, @CurrentUser() user: AuthUser) { return this.datasets.freeze(id, user); }

  @Post('versions/:id/validate')
  @ApiOperation({ summary: 'Validate DatasetVersion membership and stored object integrity' })
  validate(@Param('id') id: string, @CurrentUser() user: AuthUser) { return this.datasets.validateVersion(id, user); }

  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @Post('versions/:id/publish')
  @ApiOperation({ summary: 'Publish a FROZEN version with DVC and a Git tag' })
  async publish(@Param('id') id: string, @CurrentUser() user: AuthUser) { await this.datasets.getVersion(id, user); return this.publisher.publish(id); }

  @Post('versions/:id/publish-jobs')
  @HttpCode(202)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  async publishJob(@Param('id') id: string, @CurrentUser() user: AuthUser) { const version=await this.datasets.getVersion(id,user); return this.jobs.create(JobType.DATASET_PUBLISH, { payload: { versionId: id }, resourceType: 'DatasetVersion', resourceId: id, requestedById: user.id, tenantId: version.dataset.tenantId, projectId: version.dataset.projectId }); }

  @Post('versions/:id/recovery-jobs')
  @HttpCode(202)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  async recoveryJob(@Param('id') id: string, @CurrentUser() user: AuthUser) { const version=await this.datasets.getVersion(id,user); return this.jobs.create(JobType.RECOVERY_VERIFY, { payload: { versionId: id }, resourceType: 'DatasetVersion', resourceId: id, requestedById: user.id, tenantId: version.dataset.tenantId, projectId: version.dataset.projectId }); }
}
