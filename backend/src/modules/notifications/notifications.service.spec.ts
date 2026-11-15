import { NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { NotificationsService } from "./notifications.service";

describe("NotificationsService", () => {
  let service: NotificationsService;
  let db: { query: jest.Mock };

  beforeEach(() => {
    db = { query: jest.fn() };
    service = new NotificationsService(db as unknown as DatabaseService);
  });

  it("lists only the authenticated user's notifications with bounded pagination", async () => {
    db.query.mockResolvedValue({ rows: [{ id: "notice-1" }] });

    const result = await service.listForUser("user-1", 500, -4);

    expect(result).toEqual([{ id: "notice-1" }]);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE user_id = $1"),
      ["user-1", 100, 0],
    );
  });

  it("marks a notification read only when it belongs to the user", async () => {
    db.query.mockResolvedValue({ rowCount: 1, rows: [{ id: "notice-1", is_read: true }] });

    const result = await service.markRead("user-1", "notice-1");

    expect(result.is_read).toBe(true);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE id = $1 AND user_id = $2"),
      ["notice-1", "user-1"],
    );
  });

  it("does not reveal notifications owned by another user", async () => {
    db.query.mockResolvedValue({ rowCount: 0, rows: [] });

    await expect(service.markRead("user-1", "other-users-notice")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("marks all unread notifications for the authenticated user only", async () => {
    db.query.mockResolvedValue({ rowCount: 3, rows: [] });

    await expect(service.markAllRead("user-1")).resolves.toEqual({ updatedCount: 3 });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE user_id = $1 AND is_read = FALSE"),
      ["user-1"],
    );
  });
});
