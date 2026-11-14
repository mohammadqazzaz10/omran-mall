import {
  Body,
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
import {
  CreateBreakTypeDto,
  ListBreakRequestsQueryDto,
  RejectBreakRequestDto,
  RequestBreakDto,
  UpdateBreakTypeDto,
} from "./breaks.dto";
import { BreaksService } from "./breaks.service";

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@ApiTags("Breaks")
@ApiBearerAuth()
@Controller("branches/:branchId/breaks")
export class BreaksController {
  constructor(private readonly breaks: BreaksService) {}

  @Get("types")
  @RequirePermission("breaks.types.view.branch")
  listTypes(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.breaks.listTypes(branchId, req.user);
  }

  @Post("types")
  @RequirePermission("breaks.manage.branch")
  createType(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Body() dto: CreateBreakTypeDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.breaks.createType(branchId, dto, req.user);
  }

  @Patch("types/:typeId")
  @RequirePermission("breaks.manage.branch")
  updateType(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Param("typeId", ParseUUIDPipe) typeId: string,
    @Body() dto: UpdateBreakTypeDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.breaks.updateType(branchId, typeId, dto, req.user);
  }

  @Post("requests")
  @RequirePermission("breaks.request.own")
  requestBreak(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Body() dto: RequestBreakDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.breaks.requestBreak(branchId, dto, req.user);
  }

  @Get("me")
  @RequirePermission("breaks.types.view.branch")
  myStatus(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.breaks.myStatus(branchId, req.user);
  }

  @Get("requests")
  @RequirePermission("breaks.view.branch")
  listRequests(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Query() query: ListBreakRequestsQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.breaks.listRequests(branchId, query.status, req.user);
  }

  @Post("requests/:requestId/approve")
  @RequirePermission("breaks.approve.branch")
  approveRequest(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Param("requestId", ParseUUIDPipe) requestId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.breaks.approveRequest(branchId, requestId, req.user);
  }

  @Post("requests/:requestId/reject")
  @RequirePermission("breaks.approve.branch")
  rejectRequest(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Param("requestId", ParseUUIDPipe) requestId: string,
    @Body() dto: RejectBreakRequestDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.breaks.rejectRequest(branchId, requestId, dto, req.user);
  }

  @Post("sessions/:sessionId/end")
  @RequirePermission("breaks.end.own")
  endOwnSession(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.breaks.endOwnSession(branchId, sessionId, req.user);
  }

  @Get("live")
  @RequirePermission("breaks.view.branch")
  live(
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.breaks.live(branchId, req.user);
  }
}
