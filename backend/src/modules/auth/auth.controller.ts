import { Body, Controller, Post, Get, Req, Param, ParseUUIDPipe } from "@nestjs/common";
import { Public } from "../../common/decorators/public.decorator";
import { SkipPermissionCheck } from "../../common/decorators/permission.decorator";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import { AllowPasswordChangeOnly } from "../../common/decorators/password-change.decorator";
import { ChangePasswordDto, LoginDto, RefreshDto } from "./auth.dto";
import { AuthenticatedUser } from "./auth.types";

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("login")
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.auth.login(dto, request);
  }

  @Public()
  @Post("refresh")
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @ApiBearerAuth()
  @SkipPermissionCheck()
  @AllowPasswordChangeOnly()
  @Post("logout")
  logout(@Req() request: AuthenticatedRequest) {
    return this.auth.logout(request.user.sessionId, request.user.id);
  }

  @ApiBearerAuth()
  @SkipPermissionCheck()
  @AllowPasswordChangeOnly()
  @Post("change-password")
  changePassword(@Body() dto: ChangePasswordDto, @Req() request: AuthenticatedRequest) {
    return this.auth.changePassword(request.user.id, request.user.sessionId, dto.currentPassword, dto.newPassword);
  }

  @ApiBearerAuth()
  @SkipPermissionCheck()
  @Get("sessions")
  sessions(@Req() request: AuthenticatedRequest) {
    return this.auth.listSessions(request.user.id, request.user.sessionId);
  }

  @ApiBearerAuth()
  @SkipPermissionCheck()
  @Post("sessions/:sessionId/revoke")
  revokeSession(@Param("sessionId", ParseUUIDPipe) id: string, @Req() request: AuthenticatedRequest) {
    return this.auth.revokeOwnedSession(request.user.id, request.user.sessionId, id);
  }

  @ApiBearerAuth()
  @SkipPermissionCheck()
  @Get("me")
  me(@Req() request: AuthenticatedRequest) {
    return this.auth.me(request.user.id, request.user.sessionId);
  }
}
