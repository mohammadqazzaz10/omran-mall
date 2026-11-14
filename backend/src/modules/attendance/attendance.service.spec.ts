import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { AuthenticatedUser } from "../auth/auth.types";
import { AttendanceService } from "./attendance.service";

describe("AttendanceService", () => {
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
    return { service: new AttendanceService(db as any), db };
  };

  it("rejects a branch outside the authenticated company", async () => {
    const client = {
      query: jest.fn().mockResolvedValueOnce({ rows: [], rowCount: 0 }),
    };
    const { service } = serviceWithClient(client);

    await expect(service.checkIn(branchId, user)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(client.query).toHaveBeenCalledTimes(1);
  });

  it("uses PostgreSQL server time and the employee's own branch record", async () => {
    const employeeId = "66666666-6666-4666-8666-666666666666";
    const record = {
      id: "77777777-7777-4777-8777-777777777777",
      employee_id: employeeId,
      branch_id: branchId,
      work_date: "2026-11-14",
      check_in_time: "2026-11-14T08:00:00.000Z",
      check_out_time: null,
      status: "present",
    };
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ id: branchId }], rowCount: 1 })
        .mockResolvedValueOnce({
          rows: [{ id: employeeId, status: "active" }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ work_date: "2026-11-14", local_time: "08:00" }],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [record], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }),
    };
    const { service } = serviceWithClient(client);

    await expect(service.checkIn(branchId, user)).resolves.toEqual(record);
    const insert = client.query.mock.calls[4];
    expect(insert[0]).toContain("CURRENT_TIMESTAMP");
    expect(insert[1]).toEqual([
      employeeId,
      branchId,
      null,
      "2026-11-14",
      0,
      "present",
    ]);
  });

  it("does not expose another employee's records through self-service", async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ id: branchId }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }),
    };
    const { service, db } = serviceWithClient(client);
    db.query
      .mockResolvedValueOnce({ rows: [{ id: branchId }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await expect(service.myRecords(branchId, user)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(db.query).toHaveBeenCalledTimes(2);
  });

  it("rejects malformed report dates before querying attendance", async () => {
    const db = { query: jest.fn() };
    const service = new AttendanceService(db as any);

    await expect(
      service.branchRecords(branchId, "14-11-2026", user),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.query).not.toHaveBeenCalled();
  });

  it("maps duplicate daily check-ins to a safe conflict response", async () => {
    const employeeId = "66666666-6666-4666-8666-666666666666";
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ id: branchId }], rowCount: 1 })
        .mockResolvedValueOnce({
          rows: [{ id: employeeId, status: "active" }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ work_date: "2026-11-14", local_time: "08:00" }],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockRejectedValueOnce({ code: "23505" }),
    };
    const { service } = serviceWithClient(client);

    await expect(service.checkIn(branchId, user)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("consumes QR and writes attendance plus audit through one transaction", async () => {
    const employeeId = "66666666-6666-4666-8666-666666666666";
    const record = {
      id: "77777777-7777-4777-8777-777777777777",
      employee_id: employeeId,
      branch_id: branchId,
      work_date: "2026-11-14",
      check_in_time: "2026-11-14T08:00:00.000Z",
      check_out_time: null,
      status: "present",
    };
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ id: branchId }], rowCount: 1 })
        .mockResolvedValueOnce({
          rows: [{ id: employeeId, status: "active" }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ id: "88888888-8888-4888-8888-888888888888" }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockResolvedValueOnce({
          rows: [{ work_date: "2026-11-14", local_time: "08:00" }],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [record], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }),
    };
    const { service, db } = serviceWithClient(client);

    const result = await service.checkInWithQr(
      branchId,
      user,
      "a".repeat(64),
      31.95,
      35.91,
    );

    expect(result).toMatchObject({
      id: record.id,
      check_in_method: "qr_code",
      check_in_lat: 31.95,
      check_in_lng: 35.91,
    });
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(client.query.mock.calls[2][0]).toContain("attendance_qr_challenges");
    expect(client.query.mock.calls[3][0]).toContain("attendance_qr_uses");
    expect(client.query.mock.calls[6][0]).toContain("'qr_code'");
    expect(client.query.mock.calls[7][0]).toContain("audit_logs");
  });

  it("does not write audit or commit a partial QR attendance when record insertion fails", async () => {
    const employeeId = "66666666-6666-4666-8666-666666666666";
    const failure = new Error("attendance insert failed");
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ id: branchId }], rowCount: 1 })
        .mockResolvedValueOnce({
          rows: [{ id: employeeId, status: "active" }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ id: "88888888-8888-4888-8888-888888888888" }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockResolvedValueOnce({
          rows: [{ work_date: "2026-11-14", local_time: "08:00" }],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockRejectedValueOnce(failure),
    };
    const { service, db } = serviceWithClient(client);

    await expect(
      service.checkInWithQr(branchId, user, "b".repeat(64), null, null),
    ).rejects.toBe(failure);
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenCalledTimes(7);
    expect(
      client.query.mock.calls.some((call: any[]) =>
        String(call[0]).includes("audit_logs"),
      ),
    ).toBe(false);
  });
});
