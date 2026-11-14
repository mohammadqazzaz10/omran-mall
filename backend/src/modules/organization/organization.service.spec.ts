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
    mustChangePassword: false,
  };

  beforeEach(() => query.mockReset());

  it("rejects a department from another branch before inserting an employee", async () => {
    query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: user.primaryBranchId }],
      })
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
    expect(
      query.mock.calls.some((call) =>
        String(call[0]).includes("INSERT INTO employees"),
      ),
    ).toBe(false);
  });

  it("rejects a position that does not belong to the selected department", async () => {
    query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: user.primaryBranchId }],
      })
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
    expect(
      query.mock.calls.some((call) =>
        String(call[0]).includes("INSERT INTO employees"),
      ),
    ).toBe(false);
  });
  it("blocks an employee transfer while attendance is still open", async () => {
    query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: user.primaryBranchId }],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "target-branch" }] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: "employee-1",
            user_id: null,
            branch_id: user.primaryBranchId,
            department_id: "old-dept",
            position_id: "old-position",
            direct_manager_id: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ today: "2026-11-14" }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "target-dept" }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "target-position" }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "open-attendance" }] });

    await expect(
      service.transferEmployee(
        user.primaryBranchId,
        "employee-1",
        {
          targetBranchId: "00000000-0000-4000-8000-000000000006",
          targetDepartmentId: "00000000-0000-4000-8000-000000000007",
          targetPositionId: "00000000-0000-4000-8000-000000000008",
          effectiveDate: "2026-11-14",
          reason: "نقل تنظيمي معتمد إلى الفرع الجديد",
        } as any,
        user as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(query).toHaveBeenCalledTimes(7);
    expect(
      query.mock.calls.some((call) =>
        String(call[0]).includes("UPDATE employees"),
      ),
    ).toBe(false);
  });

  it("loads only the employee record linked to the authenticated user", async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: "employee-1", employee_code: "OM-1001" }],
    });
    const result = await service.getOwnEmployeeProfile(user as any);
    expect(result.employee_code).toBe("OM-1001");
    expect(query.mock.calls[0][0]).toContain("e.user_id=$1");
    expect(query.mock.calls[0][1]).toEqual([user.id, user.companyId]);
  });
});
