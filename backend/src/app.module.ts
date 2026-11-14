import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { BreaksGateway } from "./modules/breaks/breaks.gateway";
import { BreaksModule } from "./modules/breaks/breaks.module";
import { DatabaseModule } from "./database/database.module";
import { HealthController } from "./health/health.controller";
import { AuthModule } from "./modules/auth/auth.module";
import { OrganizationModule } from "./modules/organization/organization.module";
import { AdminModule } from "./modules/admin/admin.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    DatabaseModule,
    AuthModule,
    OrganizationModule,
    AdminModule,
    BreaksModule,
  ],
  controllers: [HealthController],
  providers: [BreaksGateway],
})
export class AppModule {}
