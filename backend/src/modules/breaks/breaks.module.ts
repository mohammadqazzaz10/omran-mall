import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BreaksController } from "./breaks.controller";
import { BreaksGateway } from "./breaks.gateway";
import { BreaksService } from "./breaks.service";

@Module({
  imports: [AuthModule],
  controllers: [BreaksController],
  providers: [BreaksService, BreaksGateway],
  exports: [BreaksService, BreaksGateway],
})
export class BreaksModule {}
