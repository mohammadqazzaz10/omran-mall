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
  AttendanceCheckOutDto,
  AttendanceCorrectionDto,
  AttendanceCorrectionRejectionDto,
  AttendanceQrCheckInDto,
} from "./attendance.dto";
import { AttendanceQrService } from "./attendance-qr.service";
import { AttendanceService } from "./attendance.service";

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@ApiTags("Attendance")
@ApiBearerAuth()
@UseGuards(BranchIsolationGuard)
@Controller("branches/:branchId/attendance")
export class AttendanceController {
  constructor(
    private readonly attendance: AttendanceService,
    private readonly attendanceQr: AttendanceQrService,
  ) {}

  @Get("qr/geofence")
  @RequirePermission("attendance.check_in.own")
  geofenceStatus(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.attendanceQr.geofenceStatus(branchId, req.user);
  }
  @Post("qr/challenges")
  @RequirePermission("attendance.qr.manage.branch")
  createQrChallenge(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.attendanceQr.createChallenge(branchId, req.user);
  }

  @Post("check-in/qr")
  @RequirePermission("attendance.check_in.own")
  checkInWithQr(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Body() dto: AttendanceQrCheckInDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.attendanceQr.checkInWithQr(branchId, dto, req.user);
  }

  @Post("check-in")
  @RequirePermission("attendance.check_in.own")
  async checkIn(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.attendanceQr.assertDirectCheckInAllowed(branchId, req.user);
    return this.attendance.checkIn(branchId, req.user);
  }

  @Post("check-out")
  @RequirePermission("attendance.check_out.own")
  checkOut(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Body() dto: AttendanceCheckOutDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.attendanceQr.checkOutWithGeofence(branchId, dto, req.user);
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

  @Post("corrections/:correctionId/reject")
  @RequirePermission("attendance.approve.branch")
  rejectCorrection(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Param("correctionId", ParseUUIDPipe) correctionId: string,
    @Body() dto: AttendanceCorrectionRejectionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.attendance.rejectCorrection(
      branchId,
      correctionId,
      dto.reviewNotes,
      req.user,
    );
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
