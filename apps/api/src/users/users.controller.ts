import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, HttpCode, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsEnum, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

class UserPageQuery { @Type(() => Number) @IsInt() @Min(1) page = 1; @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20; @IsOptional() @IsString() search?: string; @IsOptional() @IsEnum(UserRole) role?: UserRole; }
class CreateUserDto { @IsEmail() email!: string; @IsString() @MinLength(2) displayName!: string; @IsEnum(UserRole) role!: UserRole; @IsString() @MinLength(12) temporaryPassword!: string; }
class UpdateUserDto { @IsOptional() @IsString() @MinLength(2) displayName?: string; @IsOptional() @IsEnum(UserRole) role?: UserRole; @IsOptional() @IsBoolean() isActive?: boolean; }
class ResetPasswordDto { @IsString() @MinLength(12) temporaryPassword!: string; }

@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
@Controller('v1/users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}
  @Get('page') async page(@Query() query: UserPageQuery,@CurrentUser() actor:AuthUser) { const where = { role: query.role,...this.scope(actor), ...(query.search && { OR: [{ email: { contains: query.search, mode: 'insensitive' as const } }, { displayName: { contains: query.search, mode: 'insensitive' as const } }] }) }; const [items, total] = await this.prisma.$transaction([this.prisma.user.findMany({ where, select: publicUser, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }), this.prisma.user.count({ where })]); return { items, total, page: query.page, pageSize: query.pageSize }; }
  @Post() async create(@Body() body: CreateUserDto,@CurrentUser() actor:AuthUser) { this.assertAssignable(actor,body.role);if (await this.prisma.user.findUnique({ where: { email: body.email.toLowerCase() } })) throw new BadRequestException('Email already exists'); return this.prisma.user.create({ data: { email: body.email.toLowerCase(), displayName: body.displayName, role: body.role,tenantId:actor.role==='SUPER_ADMIN'||actor.role==='ADMIN'?null:actor.tenantId, passwordHash: await argon2.hash(body.temporaryPassword, { type: argon2.argon2id }), mustChangePassword: true }, select: publicUser }); }
  @Patch(':id') async update(@Param('id') id: string, @Body() body: UpdateUserDto,@CurrentUser() actor:AuthUser) { await this.visible(id,actor);if(body.role)this.assertAssignable(actor,body.role);const user = await this.prisma.user.update({ where: { id }, data: body, select: publicUser }); if (body.isActive === false || body.role !== undefined) await this.prisma.session.deleteMany({ where: { userId: id } }); return user; }
  @Post(':id/reset-password') async reset(@Param('id') id: string, @Body() body: ResetPasswordDto,@CurrentUser() actor:AuthUser) { await this.visible(id,actor);await this.prisma.$transaction([this.prisma.user.update({ where: { id }, data: { passwordHash: await argon2.hash(body.temporaryPassword, { type: argon2.argon2id }), mustChangePassword: true } }), this.prisma.session.deleteMany({ where: { userId: id } })]); return { success: true }; }
  @Delete(':id/sessions') @HttpCode(204) async revokeSessions(@Param('id') id: string,@CurrentUser() actor:AuthUser) { await this.visible(id,actor);await this.prisma.session.deleteMany({ where: { userId: id } }); }
  private scope(actor:AuthUser){return actor.role==='SUPER_ADMIN'||actor.role==='ADMIN'?{}:{tenantId:actor.tenantId??'__NO_TENANT__'};}
  private async visible(id:string,actor:AuthUser){const user=await this.prisma.user.findFirst({where:{id,...this.scope(actor)},select:{id:true}});if(!user)throw new NotFoundException('User not found');}
  private assertAssignable(actor:AuthUser,role:UserRole){if(actor.role==='TENANT_ADMIN'&&(role===UserRole.SUPER_ADMIN||role===UserRole.ADMIN))throw new ForbiddenException('Tenant administrators cannot assign a global role');}
}
const publicUser = { id: true, email: true, displayName: true, role: true, isActive: true, mustChangePassword: true, lastLoginAt: true, createdAt: true, updatedAt: true } as const;
