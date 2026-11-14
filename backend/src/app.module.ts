import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { BreaksGateway } from "./modules/breaks/breaks.gateway";
import { DatabaseModule } from "./database/database.module";
import { HealthController } from "./health/health.controller";
import { AuthModule } from "./modules/auth/auth.module";
import { OrganizationModule } from "./modules/organization/organization.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    DatabaseModule,
    AuthModule,
    OrganizationModule,
  ],
  controllers: [HealthController],
  providers: [BreaksGateway],
})
export class AppModule {}
