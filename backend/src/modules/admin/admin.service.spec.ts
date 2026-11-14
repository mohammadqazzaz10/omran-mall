import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { AdminService } from "./admin.service";

describe("AdminService privilege boundaries", () => {
  const actor = {
    id: "11111111-1111-4111-8111-111111111111",
    companyId: "22222222-2222-4222-8222-222222222222",
    primaryBranchId: null,
    allowedBranchIds: [],
    sessionId: "33333333-3333-4333-8333-333333333333",
    username: "hr",
    mustChangePassword: false,
  };

  it("does not allow a non-super-admin to create elevated role accounts", async () => {
    const db = {
      query: jest.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
    };
    const service = new AdminService(db as any);
    await expect(
      service.createUser(
        {
          username: "branch.manager",
          roleCode: "BRANCH_MANAGER",
          branchIds: ["44444444-4444-4444-8444-444444444444"],
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it("prevents an administrator from disabling their own account", async () => {
    const db = { query: jest.fn() };
    const service = new AdminService(db as any);
    await expect(
      service.updateUserStatus(actor.id, false, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.query).not.toHaveBeenCalled();
  });

  it("does not allow an empty branch update", async () => {
    const db = { query: jest.fn() };
    const service = new AdminService(db as any);
    await expect(
      service.updateBranch("55555555-5555-4555-8555-555555555555", {}, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.query).not.toHaveBeenCalled();
  });

  it("restricts custom role management to a company Super Admin", async () => {
    const db = {
      query: jest.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
      transaction: jest.fn(),
    };
    const service = new AdminService(db as any);
    await expect(
      service.createRole(
        { code: "CUSTOM_STOCK_VIEWER", nameAr: "مشاهد المخزون", permissionCodes: ["employees.view.branch"] },
        actor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("rejects company-level and identity-management permissions in custom roles", async () => {
    const client = {
      query: jest.fn().mockResolvedValue({
        rowCount: 1,
        rows: [{ id: "permission-id", code: "users.manage.company", scope: "company" }],
      }),
    };
    const db = {
      query: jest.fn().mockResolvedValue({ rowCount: 1, rows: [] }),
      transaction: jest.fn((callback: (tx: any) => unknown) => callback(client)),
    };
    const service = new AdminService(db as any);
    await expect(
      service.createRole(
        { code: "CUSTOM_USER_ADMIN", nameAr: "مدير حسابات", permissionCodes: ["users.manage.company"] },
        actor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(client.query).toHaveBeenCalledTimes(1);
  });

  it("prevents editing built-in system roles even for a Super Admin", async () => {
    const superAdmin = { ...actor, id: "99999999-9999-4999-8999-999999999999" };
    const client = {
      query: jest.fn().mockResolvedValue({
        rowCount: 1,
        rows: [{ id: "role-id", code: "SUPER_ADMIN", is_system_role: true }],
      }),
    };
    const db = {
      query: jest.fn().mockResolvedValue({ rowCount: 1, rows: [] }),
      transaction: jest.fn((callback: (tx: any) => unknown) => callback(client)),
    };
    const service = new AdminService(db as any);
    await expect(
      service.updateRole("role-id", { nameAr: "تعديل غير مسموح" }, superAdmin),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(client.query).toHaveBeenCalledTimes(1);
  });

});
