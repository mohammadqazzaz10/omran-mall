import { BranchIsolationGuard } from "../../common/guards/branch-isolation.guard";
import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AttendanceController } from "./attendance.controller";
import { AttendanceQrService } from "./attendance-qr.service";
import { AttendanceService } from "./attendance.service";

@Module({
  imports: [AuthModule],
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceQrService, BranchIsolationGuard],
  exports: [AttendanceService],
})
export class AttendanceModule {}
