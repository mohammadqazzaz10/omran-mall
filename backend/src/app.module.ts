import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { BreaksModule } from "./modules/breaks/breaks.module";
import { DatabaseModule } from "./database/database.module";
import { HealthController } from "./health/health.controller";
import { AuthModule } from "./modules/auth/auth.module";
import { OrganizationModule } from "./modules/organization/organization.module";
import { AdminModule } from "./modules/admin/admin.module";
import { AttendanceModule } from "./modules/attendance/attendance.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";

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
    AttendanceModule,
    NotificationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
