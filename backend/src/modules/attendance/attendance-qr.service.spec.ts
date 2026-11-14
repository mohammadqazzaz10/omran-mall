import {
  ForbiddenException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createHmac } from "crypto";
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

  it("issues a signed 45-second QR token and stores only the nonce digest", async () => {
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
    expect(db.query.mock.calls[1][0]).toContain("nonce_hash");
    expect(db.query.mock.calls[1][1][1]).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects QR tokens issued for another branch", async () => {
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

  it("requires accurate location when branch geofence is configured", async () => {
    const nonce = "b".repeat(64);
    const payload = {
      v: 1 as const,
      b: branchId,
      n: nonce,
      e: Math.floor(Date.now() / 1000) + 45,
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const key = createHmac("sha256", process.env.ATTENDANCE_QR_SECRET!)
      .update("branch-salt")
      .digest();
    const signature = createHmac("sha256", key)
      .update(encoded)
      .digest("base64url");
    const db = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              id: branchId,
              qr_secret_salt: "branch-salt",
              latitude: "31.95",
              longitude: "35.91",
              geofence_radius_meters: 150,
            },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ id: "66666666-6666-4666-8666-666666666666" }],
          rowCount: 1,
        }),
      transaction: jest.fn(),
    };
    const attendance = { checkIn: jest.fn() };
    const service = new AttendanceQrService(db as any, attendance as any);

    await expect(
      service.checkInWithQr(
        branchId,
        { qrToken: encoded + "." + signature },
        user,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.transaction).not.toHaveBeenCalled();
    expect(attendance.checkIn).not.toHaveBeenCalled();
  });

  it("fails closed without a QR signing secret", async () => {
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

    await expect(
      service.createChallenge(branchId, user),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
