import { BranchIsolationGuard } from "../../common/guards/branch-isolation.guard";
import { Module } from "@nestjs/common";
import { OrganizationController } from "./organization.controller";
import { OrganizationService } from "./organization.service";
import { EmployeeSelfController } from "./employee-self.controller";

@Module({
  controllers: [OrganizationController, EmployeeSelfController],
  providers: [OrganizationService, BranchIsolationGuard],
})
export class OrganizationModule {}
