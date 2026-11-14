import { UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";

describe("AuthService refresh rotation", () => {
  const user = {
    id: "11111111-1111-4111-8111-111111111111",
    company_id: "33333333-3333-4333-8333-333333333333",
    primary_branch_id: "44444444-4444-4444-8444-444444444444",
    username: "employee",
    password_hash: "not-used-in-refresh",
    is_active: true,
    failed_login_attempts: 0,
    lockout_until: null,
    must_change_password: false,
  };

  it("rejects malformed session identifiers before database access", async () => {
    const db = {
      transaction: jest.fn(),
      query: jest.fn(),
    } as any;
    const jwt = { signAsync: jest.fn() } as any;
    const service = new AuthService(db, jwt);

    await expect(service.refresh("not-a-uuid.secret")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(db.transaction).not.toHaveBeenCalled();
    expect(db.query).not.toHaveBeenCalled();
  });

  it("rotates the refresh secret and reloads current memberships", async () => {
    const sessionId = "22222222-2222-4222-8222-222222222222";
    const branchId = user.primary_branch_id;
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ user_id: user.id }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [user], rowCount: 1 }),
    };
    const db = {
      transaction: jest.fn(async (work: (client: any) => Promise<any>) =>
        work(client),
      ),
      query: jest.fn().mockResolvedValue({ rows: [{ branch_id: branchId }] }),
    } as any;
    const jwt = {
      signAsync: jest.fn().mockResolvedValue("new-access-token"),
    } as any;
    const service = new AuthService(db, jwt);

    const result = await service.refresh(`${sessionId}.old-refresh-secret`);

    expect(result.accessToken).toBe("new-access-token");
    expect(result.refreshToken.startsWith(`${sessionId}.`)).toBe(true);
    expect(result.refreshToken).not.toBe(`${sessionId}.old-refresh-secret`);
    expect(client.query).toHaveBeenCalledTimes(2);
    expect(client.query.mock.calls[0][0]).toContain("refresh_token_hash = $3");
    expect(client.query.mock.calls[0][1][1]).not.toBe("old-refresh-secret");
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: user.id,
      sid: sessionId,
      companyId: user.company_id,
    });
  });

  it("rejects replayed or expired refresh tokens", async () => {
    const client = {
      query: jest.fn().mockResolvedValueOnce({ rows: [], rowCount: 0 }),
    };
    const db = {
      transaction: jest.fn(async (work: (client: any) => Promise<any>) =>
        work(client),
      ),
      query: jest.fn(),
    } as any;
    const jwt = { signAsync: jest.fn() } as any;
    const service = new AuthService(db, jwt);

    await expect(
      service.refresh("22222222-2222-4222-8222-222222222222.old-secret"),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });
  it("returns scoped role summaries from the authenticated profile endpoint", async () => {
    const db = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              id: user.id,
              username: user.username,
              email: null,
              company_id: user.company_id,
              primary_branch_id: user.primary_branch_id,
              roles: [
                {
                  code: "EMPLOYEE",
                  nameAr: "موظف",
                  branchId: user.primary_branch_id,
                  departmentId: null,
                },
              ],
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{ branch_id: user.primary_branch_id }],
        }),
    } as any;
    const jwt = { signAsync: jest.fn() } as any;
    const service = new AuthService(db, jwt);

    const result = await service.me(user.id, "session-1");

    expect(result.roles).toEqual([
      {
        code: "EMPLOYEE",
        nameAr: "موظف",
        branchId: user.primary_branch_id,
        departmentId: null,
      },
    ]);
    expect(db.query.mock.calls[0][0]).toContain("jsonb_agg");
    expect(db.query.mock.calls[1][1]).toEqual([user.id]);
  });
});
