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
});
