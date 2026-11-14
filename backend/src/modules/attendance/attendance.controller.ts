import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import {
  RequirePermission,
} from "../../common/decorators/permission.decorator";
import { AuthenticatedUser } from "../auth/auth.types";
import { AttendanceCorrectionDto } from "./attendance.dto";
import { AttendanceService } from "./attendance.service";

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@ApiTags("Attendance")
@ApiBearerAuth()
@Controller("branches/:branchId/attendance")
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Post("check-in")
  @RequirePermission("attendance.check_in.own")
  checkIn(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.attendance.checkIn(branchId, req.user);
  }

  @Post("check-out")
  @RequirePermission("attendance.check_out.own")
  checkOut(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.attendance.checkOut(branchId, req.user);
  }

  @Get("me")
  @RequirePermission("attendance.view.own")
  myRecords(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Query("limit") limit: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.attendance.myRecords(branchId, req.user, Number(limit || 30));
  }

  @Post("corrections")
  @RequirePermission("attendance.correct.own")
  requestCorrection(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Body() dto: AttendanceCorrectionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.attendance.requestCorrection(branchId, dto, req.user);
  }

  @Get()
  @RequirePermission("attendance.view.branch")
  branchRecords(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Query("workDate") workDate: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.attendance.branchRecords(branchId, workDate, req.user);
  }

  @Post("corrections/:correctionId/approve")
  @RequirePermission("attendance.approve.branch")
  approveCorrection(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Param("correctionId", ParseUUIDPipe) correctionId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.attendance.approveCorrection(branchId, correctionId, req.user);
  }
}
