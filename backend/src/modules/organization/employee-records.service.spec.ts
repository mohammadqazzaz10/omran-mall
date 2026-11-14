import { BadRequestException } from "@nestjs/common";
import { EmployeeRecordsService } from "./employee-records.service";

describe("EmployeeRecordsService", () => {
  const query = jest.fn();
  const db = {
    query,
    transaction: jest.fn(
      async (work: (client: { query: typeof query }) => Promise<unknown>) =>
        work({ query }),
    ),
  };
  const service = new EmployeeRecordsService(db as any);
  const user = {
    id: "00000000-0000-4000-8000-000000000001",
    companyId: "00000000-0000-4000-8000-000000000002",
  };
  const branchId = "00000000-0000-4000-8000-000000000003";
  const employeeId = "00000000-0000-4000-8000-000000000004";

  beforeEach(() => {
    query.mockReset();
    db.transaction.mockClear();
  });

  it("rejects a document object key outside the employee's private namespace", async () => {
    await expect(
      service.createDocument(
        branchId,
        employeeId,
        {
          documentType: "certificate",
          title: "شهادة",
          storageKey: "public/employee.pdf",
        } as any,
        user as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(db.transaction).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it("rejects an expiry date earlier than the issue date", async () => {
    await expect(
      service.createDocument(
        branchId,
        employeeId,
        {
          documentType: "national_id",
          title: "هوية",
          storageKey: `companies/${user.companyId}/branches/${branchId}/employees/${employeeId}/id.pdf`,
          issueDate: "2026-11-14",
          expiryDate: "2026-01-01",
        } as any,
        user as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("checks employee ownership in the requested branch before recording a document", async () => {
    query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: employeeId, employee_code: "OM-1001" }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: "document-id",
            employee_id: employeeId,
            branch_id: branchId,
            document_type: "certificate",
            title: "شهادة",
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });

    await service.createDocument(
      branchId,
      employeeId,
      {
        documentType: "certificate",
        title: "شهادة",
        storageKey: `companies/${user.companyId}/branches/${branchId}/employees/${employeeId}/certificate.pdf`,
      } as any,
      user as any,
    );

    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls[0][0]).toContain("e.branch_id=$2");
    expect(query.mock.calls[1][0]).toContain("INSERT INTO employee_documents");
    expect(query.mock.calls[1][1][4]).toContain(
      `companies/${user.companyId}/branches/${branchId}/employees/${employeeId}/`,
    );
    expect(query.mock.calls[2][0]).toContain("INSERT INTO audit_logs");
  });

  it("rejects contracts with an end date before their start date", async () => {
    await expect(
      service.createContract(
        branchId,
        employeeId,
        {
          contractType: "full_time",
          startDate: "2026-11-14",
          endDate: "2026-01-01",
          basicSalary: 500,
        } as any,
        user as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(db.transaction).not.toHaveBeenCalled();
  });
});
