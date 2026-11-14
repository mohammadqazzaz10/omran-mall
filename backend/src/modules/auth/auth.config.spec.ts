import { durationToSeconds } from "./auth.config";

describe("durationToSeconds", () => {
  it.each([
    ["15m", 900],
    ["1h", 3600],
    ["7d", 604800],
    ["30s", 30],
  ])("parses %s", (value, expected) => {
    expect(durationToSeconds(value, 900, 60 * 60 * 24 * 90)).toBe(expected);
  });

  it("uses a fallback when unset", () => {
    expect(durationToSeconds(undefined, 900, 3600)).toBe(900);
  });

  it.each(["0s", "999999d", "15 minutes", "abc", "-1h"])(
    "rejects unsafe duration %s",
    (value) => {
      expect(() => durationToSeconds(value, 900, 3600)).toThrow();
    },
  );
});
