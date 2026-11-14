import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { BreaksService } from "./breaks.service";
import { AuthenticatedUser } from "../auth/auth.types";

describe("BreaksService", () => {
  const user: AuthenticatedUser = {
    id: "11111111-1111-4111-8111-111111111111",
    companyId: "33333333-3333-4333-8333-333333333333",
    primaryBranchId: "44444444-4444-4444-8444-444444444444",
    allowedBranchIds: ["44444444-4444-4444-8444-444444444444"],
    sessionId: "55555555-5555-4555-8555-555555555555",
    username: "employee",
    mustChangePassword: false,
  };

  const branchId = user.primaryBranchId as string;

  const serviceWithClient = (client: any) => {
    const db = {
      transaction: jest.fn(async (work: (client: any) => Promise<any>) =>
        work(client),
      ),
      query: jest.fn(),
    };
    const gateway = {
      broadcastBreakStarted: jest.fn(),
      broadcastBreakEnded: jest.fn(),
      broadcastBreakAlert: jest.fn(),
    };
    return {
      service: new BreaksService(db as any, gateway as any),
      db,
      gateway,
    };
  };

  it("refuses to configure breaks for a branch outside the authenticated company", async () => {
    const client = {
      query: jest.fn().mockResolvedValueOnce({ rows: [], rowCount: 0 }),
    };
    const { service } = serviceWithClient(client);

    await expect(
      service.createType(
        branchId,
        {
          code: "lunch",
          nameAr: "غداء",
          defaultDurationMinutes: 30,
          maxDurationMinutes: 45,
        },
        user,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(client.query).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid duration policy before opening a database transaction", async () => {
    const db = { transaction: jest.fn() };
    const service = new BreaksService(
      db as any,
      { broadcastBreakStarted: jest.fn() } as any,
    );

    await expect(
      service.createType(
        branchId,
        {
          code: "lunch",
          nameAr: "غداء",
          defaultDurationMinutes: 60,
          maxDurationMinutes: 30,
        },
        user,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("does not let an account request a break without an employee record in that branch", async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ id: branchId }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }),
    };
    const { service } = serviceWithClient(client);

    await expect(
      service.requestBreak(
        branchId,
        {
          breakTypeId: "66666666-6666-4666-8666-666666666666",
          requestedDurationMinutes: 15,
        },
        user,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(client.query).toHaveBeenCalledTimes(2);
  });
  it("filters supervisor request lists to their assigned departments", async () => {
    const departmentId = "77777777-7777-4777-8777-777777777777";
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ id: branchId }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ department_id: departmentId }] })
        .mockResolvedValueOnce({ rows: [] }),
    };
    const { service } = serviceWithClient(client);

    await expect(
      service.listRequests(branchId, "pending", user),
    ).resolves.toEqual([]);

    const listQuery = client.query.mock.calls[2];
    expect(listQuery[0]).toContain(
      "($3::boolean = TRUE OR r.department_id = ANY($4::uuid[]))",
    );
    expect(listQuery[1]).toEqual([
      branchId,
      "pending",
      false,
      [departmentId],
    ]);
  });

  it("allows branch-wide managers to view all branch requests", async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ id: branchId }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ department_id: null }] })
        .mockResolvedValueOnce({ rows: [] }),
    };
    const { service } = serviceWithClient(client);

    await service.listRequests(branchId, undefined, user);

    expect(client.query.mock.calls[2][1]).toEqual([branchId, null, true, []]);
  });

});
