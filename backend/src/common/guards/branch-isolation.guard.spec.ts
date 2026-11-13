import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { BranchIsolationGuard } from "./branch-isolation.guard";

function makeContext(request: Record<string, any>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe("BranchIsolationGuard", () => {
  let guard: BranchIsolationGuard;

  beforeEach(() => {
    guard = new BranchIsolationGuard();
  });

  it("uses the authenticated user primary branch when no branch is requested", () => {
    const request = {
      user: { id: "user-1", primaryBranchId: "branch-a", allowedBranchIds: [] },
      params: {},
      query: {},
      body: {},
      headers: {},
    };

    expect(guard.canActivate(makeContext(request))).toBe(true);
    expect((request as Record<string, any>).branchId).toBe("branch-a");
  });

  it("allows an explicitly assigned additional branch", () => {
    const request = {
      user: {
        id: "user-1",
        primaryBranchId: "branch-a",
        allowedBranchIds: ["branch-b"],
      },
      params: { branchId: "branch-b" },
      query: {},
      body: {},
      headers: {},
    };

    expect(guard.canActivate(makeContext(request))).toBe(true);
    expect((request as Record<string, any>).branchId).toBe("branch-b");
  });

  it("rejects access to a branch outside the authenticated membership list", () => {
    const request = {
      user: { id: "user-1", primaryBranchId: "branch-a", allowedBranchIds: [] },
      params: { branchId: "branch-b" },
      query: {},
      body: {},
      headers: {},
    };

    expect(() => guard.canActivate(makeContext(request))).toThrow(
      ForbiddenException,
    );
  });

  it("does not grant cross-branch access based on role names alone", () => {
    const request = {
      user: {
        id: "user-1",
        roles: ["SUPER_ADMIN"],
        primaryBranchId: "branch-a",
        allowedBranchIds: [],
      },
      params: { branchId: "branch-b" },
      query: {},
      body: {},
      headers: {},
    };

    expect(() => guard.canActivate(makeContext(request))).toThrow(
      ForbiddenException,
    );
  });

  it("rejects requests without an authenticated user", () => {
    const request = { params: {}, query: {}, body: {}, headers: {} };

    expect(() => guard.canActivate(makeContext(request))).toThrow(
      ForbiddenException,
    );
  });

  it("rejects an authenticated account without a branch assignment", () => {
    const request = {
      user: { id: "user-1", allowedBranchIds: [] },
      params: {},
      query: {},
      body: {},
      headers: {},
    };

    expect(() => guard.canActivate(makeContext(request))).toThrow(
      ForbiddenException,
    );
  });
});
