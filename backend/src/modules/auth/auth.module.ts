import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { DatabaseModule } from "../../database/database.module";
import { AccessTokenGuard } from "./access-token.guard";
import { PermissionGuard } from "./permission.guard";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { durationToSeconds } from "./auth.config";

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32 || jwtSecret.startsWith("REPLACE_")) {
  throw new Error(
    "JWT_SECRET must be a unique secret of at least 32 characters",
  );
}
const accessTokenTtlSeconds = durationToSeconds(
  process.env.JWT_EXPIRATION,
  900,
  60 * 60,
);

@Module({
  imports: [
    DatabaseModule,
    JwtModule.register({
      secret: jwtSecret,
      signOptions: {
        expiresIn: accessTokenTtlSeconds,
        issuer: "omran-mall-api",
        audience: "omran-mall-client",
      },
      verifyOptions: {
        issuer: "omran-mall-api",
        audience: "omran-mall-client",
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AccessTokenGuard,
    PermissionGuard,
    { provide: APP_GUARD, useExisting: AccessTokenGuard },
    { provide: APP_GUARD, useExisting: PermissionGuard },
  ],
  exports: [AuthService, AccessTokenGuard, PermissionGuard, JwtModule],
})
export class AuthModule {}
