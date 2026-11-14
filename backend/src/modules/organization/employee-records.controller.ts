import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
  DefaultValuePipe,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { RequirePermission } from "../../common/decorators/permission.decorator";
import { BranchIsolationGuard } from "../../common/guards/branch-isolation.guard";
import { AuthenticatedUser } from "../auth/auth.types";
import {
  EmployeeContractCreateDto,
  EmployeeDocumentCreateDto,
  EmployeeProfileUpsertDto,
} from "./employee-records.dto";
import { EmployeeRecordsService } from "./employee-records.service";

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@ApiTags("Employee Records")
@ApiBearerAuth()
@UseGuards(BranchIsolationGuard)
@Controller("branches/:branchId/employees/:employeeId/records")
export class EmployeeRecordsController {
  constructor(private readonly records: EmployeeRecordsService) {}

  @Get("profile")
  @RequirePermission("employee_profiles.view.branch")
  getProfile(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Param("employeeId", ParseUUIDPipe) employeeId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.records.getProfile(branchId, employeeId, req.user);
  }

  @Post("profile")
  @RequirePermission("employee_profiles.manage.branch")
  upsertProfile(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Param("employeeId", ParseUUIDPipe) employeeId: string,
    @Body() dto: EmployeeProfileUpsertDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.records.upsertProfile(branchId, employeeId, dto, req.user);
  }

  @Get("documents")
  @RequirePermission("employee_documents.view.branch")
  documents(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Param("employeeId", ParseUUIDPipe) employeeId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.records.listDocuments(branchId, employeeId, req.user);
  }

  @Post("documents")
  @RequirePermission("employee_documents.manage.branch")
  createDocument(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Param("employeeId", ParseUUIDPipe) employeeId: string,
    @Body() dto: EmployeeDocumentCreateDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.records.createDocument(branchId, employeeId, dto, req.user);
  }

  @Delete("documents/:documentId")
  @RequirePermission("employee_documents.manage.branch")
  archiveDocument(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Param("employeeId", ParseUUIDPipe) employeeId: string,
    @Param("documentId", ParseUUIDPipe) documentId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.records.archiveDocument(branchId, employeeId, documentId, req.user);
  }

  @Get("contracts")
  @RequirePermission("employee_contracts.view.branch")
  contracts(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Param("employeeId", ParseUUIDPipe) employeeId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.records.listContracts(branchId, employeeId, req.user);
  }

  @Post("contracts")
  @RequirePermission("employee_contracts.manage.branch")
  createContract(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Param("employeeId", ParseUUIDPipe) employeeId: string,
    @Body() dto: EmployeeContractCreateDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.records.createContract(branchId, employeeId, dto, req.user);
  }

  @Get("history")
  @RequirePermission("employee_history.view.branch")
  history(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Param("employeeId", ParseUUIDPipe) employeeId: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(25), ParseIntPipe) limit: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.records.listHistory(branchId, employeeId, req.user, page, limit);
  }
}
