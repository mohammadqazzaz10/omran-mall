import {
  ForbiddenException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { AttendanceQrService } from "./attendance-qr.service";

describe("AttendanceQrService", () => {
  const branchId = "44444444-4444-4444-8444-444444444444";
  const user = {
    id: "11111111-1111-4111-8111-111111111111",
    companyId: "33333333-3333-4333-8333-333333333333",
    primaryBranchId: branchId,
    allowedBranchIds: [branchId],
    sessionId: "55555555-5555-4555-8555-555555555555",
    username: "manager",
    mustChangePassword: false,
  };

  beforeEach(() => {
    process.env.ATTENDANCE_QR_SECRET =
      "test-only-secret-with-at-least-thirty-two-bytes";
  });

  afterAll(() => {
    delete process.env.ATTENDANCE_QR_SECRET;
  });

  it("issues a signed short-lived QR token and persists only its nonce digest", async () => {
    const db = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              id: branchId,
              qr_secret_salt: "branch-salt",
              expires_epoch: String(Math.floor(Date.now() / 1000) + 45),
            },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }),
      transaction: jest.fn(),
    };
    const attendance = { checkIn: jest.fn() };
    const service = new AttendanceQrService(db as any, attendance as any);

    const result = await service.createChallenge(branchId, user);

    expect(result.expiresInSeconds).toBe(45);
    expect(result.branchId).toBe(branchId);
    expect(result.token.split(".")).toHaveLength(2);
    expect(db.query.mock.calls[1][0]).toContain("attendance_qr_challenges");
    expect(db.query.mock.calls[1][0]).not.toContain("INSERT INTO attendance_qr_challenges (branch_id, nonce");
    expect(db.query.mock.calls[1][1][1]).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects a QR token issued for a different branch before any database lookup", async () => {
    const db = { query: jest.fn(), transaction: jest.fn() };
    const service = new AttendanceQrService(
      db as any,
      { checkIn: jest.fn() } as any,
    );
    const encoded = Buffer.from(
      JSON.stringify({
        v: 1,
        b: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        n: "a".repeat(64),
        e: Math.floor(Date.now() / 1000) + 45,
      }),
    ).toString("base64url");

    await expect(
      service.checkInWithQr(
        branchId,
        { qrToken: encoded + ".invalid" },
        user,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.query).not.toHaveBeenCalled();
  });

  it("fails closed when QR signing secret is not configured", async () => {
    delete process.env.ATTENDANCE_QR_SECRET;
    const db = {
      query: jest.fn().mockResolvedValueOnce({
        rows: [{ id: branchId, qr_secret_salt: "branch-salt" }],
        rowCount: 1,
      }),
    };
    const service = new AttendanceQrService(
      db as any,
      { checkIn: jest.fn() } as any,
    );

    await expect(service.createChallenge(branchId, user)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
