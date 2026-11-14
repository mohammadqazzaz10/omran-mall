import { Body, Controller, Get, Patch, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { RequirePermission } from "../../common/decorators/permission.decorator";
import { AuthenticatedUser } from "../auth/auth.types";
import { OrganizationService } from "./organization.service";
import { EmployeeSelfUpdateDto } from "./employee-self.dto";

type AuthRequest = Request & { user: AuthenticatedUser };

@ApiTags("Employee Self Service")
@ApiBearerAuth()
@Controller("me/employee")
export class EmployeeSelfController {
  constructor(private readonly organization: OrganizationService) {}

  @Get()
  @RequirePermission("employees.view.own")
  getOwnProfile(@Req() req: AuthRequest) {
    return this.organization.getOwnEmployeeProfile(req.user);
  }

  @Patch()
  @RequirePermission("employees.edit.own")
  updateOwnProfile(
    @Body() dto: EmployeeSelfUpdateDto,
    @Req() req: AuthRequest,
  ) {
    return this.organization.updateOwnEmployeeProfile(dto, req.user);
  }
}
