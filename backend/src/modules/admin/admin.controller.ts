import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { RequirePermission } from "../../common/decorators/permission.decorator";
import { AuthenticatedUser } from "../auth/auth.types";
import {
  AssignUserRoleDto,
  CreateBranchDto,
  CreateRoleDto,
  CreateUserDto,
  ListUsersQueryDto,
  UpdateBranchDto,
  UpdateRoleDto,
  UpdateUserStatusDto,
} from "./admin.dto";
import { AdminService } from "./admin.service";

type AuthRequest = Request & { user: AuthenticatedUser };

@ApiTags("Administration")
@ApiBearerAuth()
@Controller("admin")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("branches")
  @RequirePermission("branches.view.company")
  branches(@Req() req: AuthRequest) {
    return this.admin.listBranches(req.user);
  }

  @Post("branches")
  @RequirePermission("branches.manage.company")
  createBranch(@Body() dto: CreateBranchDto, @Req() req: AuthRequest) {
    return this.admin.createBranch(dto, req.user);
  }

  @Patch("branches/:branchId")
  @RequirePermission("branches.manage.company")
  updateBranch(
    @Param("branchId", ParseUUIDPipe) id: string,
    @Body() dto: UpdateBranchDto,
    @Req() req: AuthRequest,
  ) {
    return this.admin.updateBranch(id, dto, req.user);
  }

  @Get("roles")
  @RequirePermission("roles.view.company")
  roles(@Req() req: AuthRequest) {
    return this.admin.listRoles(req.user);
  }

  @Post("roles")
  @RequirePermission("roles.manage.company")
  createRole(@Body() dto: CreateRoleDto, @Req() req: AuthRequest) {
    return this.admin.createRole(dto, req.user);
  }

  @Patch("roles/:roleId")
  @RequirePermission("roles.manage.company")
  updateRole(
    @Param("roleId", ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
    @Req() req: AuthRequest,
  ) {
    return this.admin.updateRole(id, dto, req.user);
  }

  @Get("permissions")
  @RequirePermission("roles.view.company")
  permissions() {
    return this.admin.listPermissions();
  }

  @Get("users")
  @RequirePermission("users.view.company")
  users(@Query() query: ListUsersQueryDto, @Req() req: AuthRequest) {
    return this.admin.listUsers(req.user, query);
  }

  @Post("users")
  @RequirePermission("users.manage.company")
  createUser(@Body() dto: CreateUserDto, @Req() req: AuthRequest) {
    return this.admin.createUser(dto, req.user);
  }

  @Post("users/:userId/roles")
  @RequirePermission("users.assign_roles.company")
  assignRole(
    @Param("userId", ParseUUIDPipe) id: string,
    @Body() dto: AssignUserRoleDto,
    @Req() req: AuthRequest,
  ) {
    return this.admin.assignRole(id, dto, req.user);
  }

  @Patch("users/:userId/status")
  @RequirePermission("users.manage.company")
  updateUserStatus(
    @Param("userId", ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
    @Req() req: AuthRequest,
  ) {
    return this.admin.updateUserStatus(id, dto.isActive, req.user);
  }
}
