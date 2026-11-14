import { Body, Controller, Post, Get, Req } from "@nestjs/common";\nimport { Public } from "../../common/decorators/public.decorator";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import { LoginDto, RefreshDto } from "./auth.dto";
import { AccessTokenGuard } from "./access-token.guard";
import { AuthenticatedUser } from "./auth.types";

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()\n  @Post("login")
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.auth.login(dto, request);
  }

  @Public()\n  @Post("refresh")
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @Post("logout")
  logout(@Req() request: AuthenticatedRequest) {
    return this.auth.logout(request.user.sessionId, request.user.id);
  }

  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @Get("me")
  me(@Req() request: AuthenticatedRequest) {
    return this.auth.me(request.user.id, request.user.sessionId);
  }
}
