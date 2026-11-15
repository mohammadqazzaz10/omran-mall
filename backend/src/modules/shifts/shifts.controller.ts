import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { RequirePermission } from "../../common/decorators/permission.decorator";
import { BranchIsolationGuard } from "../../common/guards/branch-isolation.guard";
import { AuthenticatedUser } from "../auth/auth.types";
import {
  CreateAssignmentDto,
  CreateCoverageRequirementDto,
  CreateShiftDto,
  CreateSwapRequestDto,
  DecideSwapDto,
  RespondSwapDto,
  ScheduleRangeQueryDto,
} from "./shifts.dto";
import { ShiftsService } from "./shifts.service";

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@ApiTags("Shifts & Scheduling")
@ApiBearerAuth()
@UseGuards(BranchIsolationGuard)
@Controller("branches/:branchId/shifts")
export class ShiftsController {
  constructor(private readonly shifts: ShiftsService) {}

  @Get("templates")
  @RequirePermission("shifts.view.branch")
  listTemplates(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.shifts.listTemplates(branchId, req.user);
  }

  @Post("templates")
  @RequirePermission("shifts.manage.branch")
  createTemplate(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Body() dto: CreateShiftDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.shifts.createTemplate(branchId, dto, req.user);
  }

  @Get("schedule")
  @RequirePermission("shifts.view.branch")
  listSchedule(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Query() query: ScheduleRangeQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.shifts.listSchedule(branchId, query.from, query.to, req.user);
  }

  @Get("me")
  @RequirePermission("shifts.view.own")
  mySchedule(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Query() query: ScheduleRangeQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.shifts.mySchedule(branchId, query.from, query.to, req.user);
  }

  @Post("assignments")
  @RequirePermission("shifts.manage.branch")
  createAssignment(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Body() dto: CreateAssignmentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.shifts.createAssignment(branchId, dto, req.user);
  }

  @Post("publish")
  @RequirePermission("shifts.publish.branch")
  publish(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Body() query: ScheduleRangeQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.shifts.publish(branchId, query.from, query.to, req.user);
  }

  @Get("swaps")
  @RequirePermission("shifts.view.branch")
  listSwaps(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.shifts.listSwaps(branchId, req.user);
  }

  @Post("swaps")
  @RequirePermission("shifts.swap.own")
  createSwap(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Body() dto: CreateSwapRequestDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.shifts.createSwap(branchId, dto, req.user);
  }

  @Post("swaps/:swapId/respond")
  @RequirePermission("shifts.swap.own")
  respondSwap(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Param("swapId", ParseUUIDPipe) swapId: string,
    @Body() dto: RespondSwapDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.shifts.respondSwap(branchId, swapId, dto, req.user);
  }

  @Post("swaps/:swapId/decision")
  @RequirePermission("shifts.swap.manage.branch")
  decideSwap(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Param("swapId", ParseUUIDPipe) swapId: string,
    @Body() dto: DecideSwapDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.shifts.decideSwap(branchId, swapId, dto, req.user);
  }

  @Get("coverage")
  @RequirePermission("shifts.coverage.view.branch")
  coverage(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Query() query: ScheduleRangeQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.shifts.coverage(branchId, query.from, query.to, req.user);
  }

  @Post("coverage")
  @RequirePermission("shifts.coverage.manage.branch")
  createCoverageRequirement(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Body() dto: CreateCoverageRequirementDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.shifts.createCoverageRequirement(branchId, dto, req.user);
  }
}
