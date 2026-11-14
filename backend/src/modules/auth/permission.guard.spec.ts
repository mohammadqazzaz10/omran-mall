import { ForbiddenException } from "@nestjs/common";
import { PermissionGuard } from "./permission.guard";

describe("PermissionGuard", () => {
  const contextFor = (request: Record<string, any>) =>
    ({
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as any;

  const makeReflector = (values: Record<string, any>) => ({
    getAllAndOverride: jest.fn((key: string) => values[key]),
  });

  const user = {
    id: "11111111-1111-4111-8111-111111111111",
    companyId: "33333333-3333-4333-8333-333333333333",
    primaryBranchId: "44444444-4444-4444-8444-444444444444",
    allowedBranchIds: ["44444444-4444-4444-8444-444444444444"],
  };

  it(
    "denies protected routes without explicit permission metadata",
    async () => {
    const db = { query: jest.fn() } as any;
    const reflector = makeReflector({});
    const guard = new PermissionGuard(db, reflector as any);

    await expect(
      guard.canActivate(contextFor({ user, headers: {} })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.query).not.toHaveBeenCalled();
  });

  it("rejects a requested branch outside current memberships", async () => {
    const db = { query: jest.fn() } as any;
    const reflector = makeReflector({
      "omran:requiredPermission": "attendance.view.branch",
    });
    const guard = new PermissionGuard(db, reflector as any);

    await expect(
      guard.canActivate(
        contextFor({
          user,
          headers: { "x-branch-id": "55555555-5555-4555-8555-555555555555" },
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it(
    "allows explicitly public routes without querying permissions",
    async () => {
    const db = { query: jest.fn() } as any;
    const reflector = makeReflector({ "omran:isPublic": true });
    const guard = new PermissionGuard(db, reflector as any);

    await expect(guard.canActivate(contextFor({ headers: {} }))).resolves.toBe(
      true,
    );
      expect(db.query).not.toHaveBeenCalled();
    },
  );

  it(
    "allows company-scoped permissions without a branch membership",
    async () => {
    const companyUser = {
      ...user,
      primaryBranchId: null,
      allowedBranchIds: [],
    };
    const db = { query: jest.fn().mockResolvedValue({ rowCount: 1 }) } as any;
    const reflector = makeReflector({
      "omran:requiredPermission": "company.settings.manage",
    });
    const guard = new PermissionGuard(db, reflector as any);
    const request: Record<string, any> = { user: companyUser, headers: {} };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.branchId).toBeNull();
      expect(db.query.mock.calls[0][1]).toEqual([
        companyUser.id,
        companyUser.companyId,
        null,
        "company.settings.manage",
      ]);
    },
  );

  it(
    "allows a company-scoped grant to operate on another active branch in the same company",
    async () => {
    const companyUser = {
      ...user,
      primaryBranchId: null,
      allowedBranchIds: [],
    };
    const branchId = "55555555-5555-4555-8555-555555555555";
    const db = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 1 }),
    } as any;
    const reflector = makeReflector({
      "omran:requiredPermission": "attendance.view.company",
    });
    const guard = new PermissionGuard(db, reflector as any);
    const request: Record<string, any> = {
      user: companyUser,
      headers: { "x-branch-id": branchId },
    };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.branchId).toBe(branchId);
    expect(db.query).toHaveBeenCalledTimes(2);
      expect(db.query.mock.calls[1][1]).toEqual([
        companyUser.id,
        companyUser.companyId,
        branchId,
        "attendance.view.company",
        false,
      ]);
    },
  );

  it(
    "does not grant branch permissions when no branch is selected",
    async () => {
    const companyUser = {
      ...user,
      primaryBranchId: null,
      allowedBranchIds: [],
    };
    const db = { query: jest.fn().mockResolvedValue({ rowCount: 0 }) } as any;
    const reflector = makeReflector({
      "omran:requiredPermission": "attendance.view.branch",
    });
    const guard = new PermissionGuard(db, reflector as any);

      await expect(
        guard.canActivate(contextFor({ user: companyUser, headers: {} })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it("checks permission grants against the selected branch", async () => {
    const db = { query: jest.fn().mockResolvedValue({ rowCount: 1 }) } as any;
    const reflector = makeReflector({
      "omran:requiredPermission": "attendance.view.branch",
    });
    const guard = new PermissionGuard(db, reflector as any);
    const request: Record<string, any> = { user, headers: {} };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.branchId).toBe(user.primaryBranchId);
    expect(db.query.mock.calls[0][1]).toEqual([
      user.id,
      user.companyId,
      user.primaryBranchId,
      "attendance.view.branch",
      true,
    ]);
  });
});
