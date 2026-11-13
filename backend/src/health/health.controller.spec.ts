import { ServiceUnavailableException } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { DatabaseService } from "../database/database.service";

describe("HealthController", () => {
  it("reports liveness without depending on the database", () => {
    const database = { isReady: jest.fn() } as unknown as DatabaseService;
    const controller = new HealthController(database);

    expect(controller.live()).toMatchObject({
      status: "ok",
      service: "omran-mall-api",
    });
    expect(database.isReady).not.toHaveBeenCalled();
  });

  it("reports ready only when the database is reachable", async () => {
    const database = {
      isReady: jest.fn().mockResolvedValue(true),
    } as unknown as DatabaseService;
    const controller = new HealthController(database);

    await expect(controller.ready()).resolves.toMatchObject({
      status: "ready",
      dependencies: { database: "ready" },
    });
  });

  it("returns unavailable when the database is not configured or reachable", async () => {
    const database = {
      isReady: jest.fn().mockResolvedValue(false),
    } as unknown as DatabaseService;
    const controller = new HealthController(database);

    await expect(controller.ready()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
