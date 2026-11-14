import { BranchIsolationGuard } from "../../common/guards/branch-isolation.guard";
import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AttendanceController } from "./attendance.controller";
import { AttendanceService } from "./attendance.service";

@Module({
  imports: [AuthModule],
  controllers: [AttendanceController],
  providers: [AttendanceService, BranchIsolationGuard],
  exports: [AttendanceService],
})
export class AttendanceModule {}
