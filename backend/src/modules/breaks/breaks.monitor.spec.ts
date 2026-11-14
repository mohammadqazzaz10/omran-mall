import { BreaksMonitor } from "./breaks.monitor";

describe("BreaksMonitor", () => {
  it("emits a pre-end warning only for sessions atomically claimed by the database", async () => {
    const warning = {
      id: "11111111-1111-4111-8111-111111111111",
      branch_id: "22222222-2222-4222-8222-222222222222",
      employee_id: "33333333-3333-4333-8333-333333333333",
      department_id: "44444444-4444-4444-8444-444444444444",
      remaining_seconds: 120,
    };
    const db = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [warning] })
        .mockResolvedValueOnce({ rows: [] }),
    };
    const gateway = { broadcastBreakAlert: jest.fn() };
    const monitor = new BreaksMonitor(db as any, gateway as any);

    await monitor.scanOverstays();

    expect(db.query).toHaveBeenCalledTimes(2);
    expect(db.query.mock.calls[0][0]).toContain(
      "pre_end_alert_sent_at IS NULL",
    );
    expect(db.query.mock.calls[0][0]).toContain("FOR UPDATE OF s SKIP LOCKED");
    expect(gateway.broadcastBreakAlert).toHaveBeenCalledWith(
      warning.branch_id,
      expect.objectContaining({ event: "BREAK_ENDING_SOON" }),
    );
  });

  it("emits overstay alerts only for newly claimed overdue sessions", async () => {
    const alert = {
      id: "11111111-1111-4111-8111-111111111111",
      branch_id: "22222222-2222-4222-8222-222222222222",
      employee_id: "33333333-3333-4333-8333-333333333333",
      department_id: "44444444-4444-4444-8444-444444444444",
      overstay_minutes: 4,
    };
    const db = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [alert] }),
    };
    const gateway = { broadcastBreakAlert: jest.fn() };
    const monitor = new BreaksMonitor(db as any, gateway as any);

    await monitor.scanOverstays();

    expect(db.query).toHaveBeenCalledTimes(2);
    expect(db.query.mock.calls[1][0]).toContain(
      "overstay_alert_sent_at IS NULL",
    );
    expect(gateway.broadcastBreakAlert).toHaveBeenCalledWith(
      alert.branch_id,
      expect.objectContaining({ event: "BREAK_OVERSTAY_ALERT" }),
    );
  });

  it("does not broadcast when there are no newly due alerts", async () => {
    const db = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }),
    };
    const gateway = { broadcastBreakAlert: jest.fn() };
    const monitor = new BreaksMonitor(db as any, gateway as any);

    await monitor.scanOverstays();

    expect(gateway.broadcastBreakAlert).not.toHaveBeenCalled();
  });
});
