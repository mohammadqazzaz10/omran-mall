import { UnauthorizedException } from "@nestjs/common";
import { AccessTokenGuard } from "./access-token.guard";

describe("AccessTokenGuard", () => {
  const claims = {
    sub: "11111111-1111-4111-8111-111111111111",
    sid: "22222222-2222-4222-8222-222222222222",
    companyId: "33333333-3333-4333-8333-333333333333",
  };

  const contextFor = (request: Record<string, any>) =>
    ({
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as any;

  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(false),
  };

  beforeEach(() => reflector.getAllAndOverride.mockReturnValue(false));

  it("allows explicitly public routes without a bearer token", async () => {
    const jwt = { verifyAsync: jest.fn() } as any;
    const db = { query: jest.fn() } as any;
    reflector.getAllAndOverride.mockReturnValue(true);
    const guard = new AccessTokenGuard(jwt, db, reflector as any);

    await expect(guard.canActivate(contextFor({ headers: {} }))).resolves.toBe(
      true,
    );
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
    expect(db.query).not.toHaveBeenCalled();
  });

  it("rejects requests without a bearer token", async () => {
    const jwt = { verifyAsync: jest.fn() } as any;
    const db = { query: jest.fn() } as any;
    const guard = new AccessTokenGuard(jwt, db, reflector as any);

    await expect(
      guard.canActivate(contextFor({ headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });

  it("rejects a revoked or missing session", async () => {
    const jwt = { verifyAsync: jest.fn().mockResolvedValue(claims) } as any;
    const db = { query: jest.fn().mockResolvedValue({ rows: [] }) } as any;
    const guard = new AccessTokenGuard(jwt, db, reflector as any);

    await expect(
      guard.canActivate(
        contextFor({ headers: { authorization: "Bearer valid-token" } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it(
    "accepts a company-scoped administrator without branch memberships",
    async () => {
    const jwt = { verifyAsync: jest.fn().mockResolvedValue(claims) } as any;
    const db = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              user_id: claims.sub,
              company_id: claims.companyId,
              username: "company-admin",
              primary_branch_id: null,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ allowed: 1 }], rowCount: 1 }),
    } as any;
    const guard = new AccessTokenGuard(jwt, db, reflector as any);
    const request: Record<string, any> = {
      headers: { authorization: "Bearer valid-token" },
    };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toMatchObject({
      id: claims.sub,
      companyId: claims.companyId,
      primaryBranchId: null,
      allowedBranchIds: [],
    });
      expect(db.query).toHaveBeenCalledTimes(3);
    },
  );

  it("loads current branch memberships from the database", async () => {
    const jwt = { verifyAsync: jest.fn().mockResolvedValue(claims) } as any;
    const db = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              user_id: claims.sub,
              company_id: claims.companyId,
              username: "employee",
              primary_branch_id: "44444444-4444-4444-8444-444444444444",
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{ branch_id: "44444444-4444-4444-8444-444444444444" }],
        }),
    } as any;
    const guard = new AccessTokenGuard(jwt, db, reflector as any);
    const request: Record<string, any> = {
      headers: { authorization: "Bearer valid-token" },
    };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toMatchObject({
      id: claims.sub,
      companyId: claims.companyId,
      sessionId: claims.sid,
      allowedBranchIds: ["44444444-4444-4444-8444-444444444444"],
    });
    expect(db.query).toHaveBeenCalledTimes(2);
  });
});
