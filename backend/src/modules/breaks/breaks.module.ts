import { BranchIsolationGuard } from "../../common/guards/branch-isolation.guard";
import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BreaksController } from "./breaks.controller";
import { BreaksGateway } from "./breaks.gateway";
import { BreaksMonitor } from "./breaks.monitor";
import { BreaksService } from "./breaks.service";

@Module({
  imports: [AuthModule],
  controllers: [BreaksController],
  providers: [BreaksService, BreaksGateway, BreaksMonitor, BranchIsolationGuard],
  exports: [BreaksService, BreaksGateway],
})
export class BreaksModule {}
