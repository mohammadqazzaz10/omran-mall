import { BadRequestException } from "@nestjs/common";
import { OrganizationService } from "./organization.service";

describe("OrganizationService branch integrity", () => {
  const query = jest.fn();
  const db = {
    query,
    transaction: jest.fn(
      async (work: (client: { query: typeof query }) => Promise<unknown>) =>
        work({ query }),
    ),
  };
  const service = new OrganizationService(db as any);
  const user = {
    id: "00000000-0000-4000-8000-000000000001",
    companyId: "00000000-0000-4000-8000-000000000002",
    primaryBranchId: "00000000-0000-4000-8000-000000000003",
    allowedBranchIds: ["00000000-0000-4000-8000-000000000003"],
    sessionId: "session",
    username: "admin",
  };

  beforeEach(() => query.mockReset());

  it("rejects a department from another branch before inserting an employee", async () => {
    query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: user.primaryBranchId }] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });

    await expect(
      service.createEmployee(
        user.primaryBranchId,
        {
          departmentId: "00000000-0000-4000-8000-000000000004",
          positionId: "00000000-0000-4000-8000-000000000005",
          firstNameAr: "أحمد",
          secondNameAr: "محمد",
          lastNameAr: "علي",
          mobilePhone: "0790000000",
          hireDate: "2026-11-14",
        } as any,
        user,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls.some((call) => String(call[0]).includes("INSERT INTO employees"))).toBe(false);
  });

  it("rejects a position that does not belong to the selected department", async () => {
    query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: user.primaryBranchId }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "department" }] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });

    await expect(
      service.createEmployee(
        user.primaryBranchId,
        {
          departmentId: "00000000-0000-4000-8000-000000000004",
          positionId: "00000000-0000-4000-8000-000000000005",
          firstNameAr: "أحمد",
          secondNameAr: "محمد",
          lastNameAr: "علي",
          mobilePhone: "0790000000",
          hireDate: "2026-11-14",
        } as any,
        user,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls.some((call) => String(call[0]).includes("INSERT INTO employees"))).toBe(false);
  });
});
