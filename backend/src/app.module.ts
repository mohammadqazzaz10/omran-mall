import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { BreaksGateway } from "./modules/breaks/breaks.gateway";
import { DatabaseService } from "./database/database.service";
import { HealthController } from "./health/health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
  ],
  controllers: [HealthController],
  providers: [BreaksGateway, DatabaseService],
})
export class AppModule {}
