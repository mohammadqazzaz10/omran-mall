import { BreaksMonitor } from "./breaks.monitor";

describe("BreaksMonitor", () => {
  it("emits alerts only for rows atomically claimed by the database", async () => {
    const alert = {
      id: "11111111-1111-4111-8111-111111111111",
      branch_id: "22222222-2222-4222-8222-222222222222",
      overstay_minutes: 4,
    };
    const db = {
      query: jest.fn().mockResolvedValue({ rows: [alert] }),
    };
    const gateway = { broadcastBreakAlert: jest.fn() };
    const monitor = new BreaksMonitor(db as any, gateway as any);

    await monitor.scanOverstays();

    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query.mock.calls[0][0]).toContain(
      "overstay_alert_sent_at IS NULL",
    );
    expect(db.query.mock.calls[0][0]).toContain("FOR UPDATE SKIP LOCKED");
    expect(gateway.broadcastBreakAlert).toHaveBeenCalledWith(
      alert.branch_id,
      alert,
    );
  });

  it("does not broadcast when there are no newly claimed overdue sessions", async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const gateway = { broadcastBreakAlert: jest.fn() };
    const monitor = new BreaksMonitor(db as any, gateway as any);

    await monitor.scanOverstays();

    expect(gateway.broadcastBreakAlert).not.toHaveBeenCalled();
  });
});
