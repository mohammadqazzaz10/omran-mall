import { BranchIsolationGuard } from "../../common/guards/branch-isolation.guard";
import { Module } from "@nestjs/common";
import { OrganizationController } from "./organization.controller";
import { OrganizationService } from "./organization.service";
import { EmployeeSelfController } from "./employee-self.controller";
import { EmployeeRecordsController } from "./employee-records.controller";
import { EmployeeRecordsService } from "./employee-records.service";

@Module({
  controllers: [
    OrganizationController,
    EmployeeSelfController,
    EmployeeRecordsController,
  ],
  providers: [
    OrganizationService,
    EmployeeRecordsService,
    BranchIsolationGuard,
  ],
})
export class OrganizationModule {}
