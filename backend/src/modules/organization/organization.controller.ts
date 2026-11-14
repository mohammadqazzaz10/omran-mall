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
  DepartmentDto,
  DepartmentUpdateDto,
  EmployeeDto,
  EmployeeUpdateDto,
  EmployeeTransferDto,
  PositionDto,
  PositionUpdateDto,
} from "./organization.dto";
import { OrganizationService } from "./organization.service";

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@ApiTags("Organization & Employees")
@ApiBearerAuth()
@Controller("branches/:branchId")
export class OrganizationController {
  constructor(private readonly organization: OrganizationService) {}

  @Get("departments")
  @RequirePermission("departments.view.branch")
  departments(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.organization.listDepartments(branchId, req.user);
  }

  @Post("departments")
  @RequirePermission("departments.manage.branch")
  createDepartment(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Body() dto: DepartmentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.organization.createDepartment(branchId, dto, req.user);
  }

  @Patch("departments/:departmentId")
  @RequirePermission("departments.manage.branch")
  updateDepartment(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Param("departmentId", ParseUUIDPipe) id: string,
    @Body() dto: DepartmentUpdateDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.organization.updateDepartment(branchId, id, dto, req.user);
  }

  @Get("positions")
  @RequirePermission("positions.view.branch")
  positions(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.organization.listPositions(branchId, req.user);
  }

  @Post("positions")
  @RequirePermission("positions.manage.branch")
  createPosition(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Body() dto: PositionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.organization.createPosition(branchId, dto, req.user);
  }

  @Patch("positions/:positionId")
  @RequirePermission("positions.manage.branch")
  updatePosition(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Param("positionId", ParseUUIDPipe) id: string,
    @Body() dto: PositionUpdateDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.organization.updatePosition(branchId, id, dto, req.user);
  }

  @Get("employees")
  @RequirePermission("employees.view.branch")
  employees(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Query()
    query: { page?: string; limit?: string; search?: string; status?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.organization.listEmployees(branchId, req.user, query);
  }

  @Post("employees")
  @RequirePermission("employees.create.branch")
  createEmployee(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Body() dto: EmployeeDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.organization.createEmployee(branchId, dto, req.user);
  }

  @Get("employees/:employeeId")
  @RequirePermission("employees.view.branch")
  employee(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Param("employeeId", ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.organization.getEmployee(branchId, id, req.user);
  }

  @Patch("employees/:employeeId")
  @RequirePermission("employees.edit.branch")
  updateEmployee(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Param("employeeId", ParseUUIDPipe) id: string,
    @Body() dto: EmployeeUpdateDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.organization.updateEmployee(branchId, id, dto, req.user);
  }

  @Post("employees/:employeeId/transfer")
  @RequirePermission("employees.transfer.company")
  transferEmployee(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Param("employeeId", ParseUUIDPipe) id: string,
    @Body() dto: EmployeeTransferDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.organization.transferEmployee(branchId, id, dto, req.user);
  }

  @Post("employees/:employeeId/archive")
  @RequirePermission("employees.archive.branch")
  archiveEmployee(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Param("employeeId", ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.organization.archiveEmployee(branchId, id, req.user);
  }
}
