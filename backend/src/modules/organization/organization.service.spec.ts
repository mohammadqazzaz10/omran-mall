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
  it(
    "blocks an employee transfer while attendance is still open",
    async () => {
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
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: "open-attendance" }],
      });

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
    },
  );

  it(
    "records a controlled cross-branch transfer without copying old branch roles",
    async () => {
    const employeeId = "00000000-0000-4000-8000-000000000009";
    const targetBranchId = "00000000-0000-4000-8000-000000000006";
    query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: user.primaryBranchId }],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: targetBranchId }] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: employeeId,
            user_id: user.id,
            employee_code: "OM-1001",
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
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: employeeId,
            user_id: user.id,
            employee_code: "OM-1001",
            branch_id: targetBranchId,
            department_id: "target-dept",
            position_id: "target-position",
            direct_manager_id: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: user.id }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });

    const result = await service.transferEmployee(
      user.primaryBranchId,
      employeeId,
      {
        targetBranchId,
        targetDepartmentId: "target-dept",
        targetPositionId: "target-position",
        effectiveDate: "2026-11-14",
        reason: "نقل تنظيمي معتمد إلى الفرع الجديد",
      } as any,
      user as any,
    );

    expect(result.employeeCode).toBe("OM-1001");
    expect(result.from.branchId).toBe(user.primaryBranchId);
    expect(result.to.branchId).toBe(targetBranchId);
    expect(
      query.mock.calls.some((call) =>
        String(call[0]).includes("INSERT INTO employee_history"),
      ),
    ).toBe(true);
    expect(
      query.mock.calls.some((call) =>
        String(call[0]).includes(
          "DELETE FROM user_roles WHERE user_id=$1 AND branch_id=$2",
        ),
      ),
    ).toBe(true);
    expect(
      query.mock.calls.some((call) =>
        String(call[0]).includes("INSERT INTO user_branch_memberships"),
      ),
    ).toBe(true);
    },
  );

  it(
    "loads only the employee record linked to the authenticated user",
    async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: "employee-1", employee_code: "OM-1001" }],
    });
    const result = await service.getOwnEmployeeProfile(user as any);
    expect(result.employee_code).toBe("OM-1001");
    expect(query.mock.calls[0][0]).toContain("e.user_id=$1");
    expect(query.mock.calls[0][1]).toEqual([user.id, user.companyId]);
  });
});
