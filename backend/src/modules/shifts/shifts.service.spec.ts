import { BadRequestException } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { AuthenticatedUser } from "../auth/auth.types";
import { ShiftsService } from "./shifts.service";

describe("ShiftsService", () => {
  let service: ShiftsService;
  let client: { query: jest.Mock };
  let db: { transaction: jest.Mock };
  const user = {
    id: "user-1",
    companyId: "company-1",
    primaryBranchId: "branch-1",
    allowedBranchIds: ["branch-1"],
    sessionId: "session-1",
    username: "manager",
    mustChangePassword: false,
  } as AuthenticatedUser;

  beforeEach(() => {
    client = { query: jest.fn() };
    db = {
      transaction: jest.fn(async (work: (tx: typeof client) => unknown) =>
        work(client),
      ),
    };
    service = new ShiftsService(db as unknown as DatabaseService);
    client.query.mockResolvedValue({ rowCount: 1, rows: [{ id: "branch-1" }] });
  });

  it("rejects an invalid schedule range before querying the database", async () => {
    await expect(
      service.listSchedule("branch-1", "2026-11-20", "2026-11-01", user),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("limits schedule reads to at most 63 calendar days", async () => {
    await expect(
      service.mySchedule("branch-1", "2026-01-01", "2026-04-01", user),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("does not create a non-flexible shift with identical start and end times", async () => {
    await expect(
      service.createTemplate(
        "branch-1",
        {
          code: "DAY",
          nameAr: "وردية نهارية",
          startTime: "08:00",
          endTime: "08:00",
          shiftType: "morning",
        },
        user,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("requires a shift template for a working-day assignment", async () => {
    await expect(
      service.createAssignment(
        "branch-1",
        { employeeId: "employee-1", workDate: "2026-11-20" },
        user,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("checks the branch before returning templates", async () => {
    client.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "branch-1" }] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });

    await expect(service.listTemplates("branch-1", user)).resolves.toEqual([]);
    expect(client.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("company_id = $2"),
      ["branch-1", "company-1"],
    );
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("FROM shifts WHERE branch_id = $1"),
      ["branch-1"],
    );
  });
});
