import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { DatabaseService } from "../../database/database.service";
import { AccessTokenGuard } from "./access-token.guard";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

const jwtSecret = process.env.JWT_ACCESS_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error("JWT_ACCESS_SECRET must be configured with at least 32 characters");
}

@Module({
  imports: [
    JwtModule.register({
      secret: jwtSecret,
      signOptions: { expiresIn: 900, issuer: "omran-mall-api", audience: "omran-mall-client" },
      verifyOptions: { issuer: "omran-mall-api", audience: "omran-mall-client" },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AccessTokenGuard, DatabaseService],
  exports: [AuthService, AccessTokenGuard, JwtModule],
})
export class AuthModule {}
