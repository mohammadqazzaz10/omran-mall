import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { RequirePermission } from "../../common/decorators/permission.decorator";
import { AuthenticatedUser } from "../auth/auth.types";
import { NotificationsService } from "./notifications.service";

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@ApiTags("Notifications")
@ApiBearerAuth()
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get("me")
  @RequirePermission("notifications.view.own")
  listMine(
    @Query("limit") limit: string | undefined,
    @Query("offset") offset: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.notifications.listForUser(
      req.user.id,
      Number(limit ?? 30),
      Number(offset ?? 0),
    );
  }

  @Patch("me/:notificationId/read")
  @RequirePermission("notifications.read.own")
  markRead(
    @Param("notificationId", ParseUUIDPipe) notificationId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.notifications.markRead(req.user.id, notificationId);
  }

  @Post("me/read-all")
  @RequirePermission("notifications.read.own")
  markAllRead(@Req() req: AuthenticatedRequest) {
    return this.notifications.markAllRead(req.user.id);
  }
}
