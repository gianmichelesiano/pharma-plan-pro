import { describe, it, expect } from "vitest";
import { monthGrid, isInMonth } from "./calendar";

describe("monthGrid", () => {
  it("April 2026 starts on Wednesday, first week has Mon Mar 30", () => {
    const g = monthGrid(2026, 3); // 3 = April
    expect(g).toHaveLength(6);
    expect(g[0]).toHaveLength(7);
    expect(g[0][0]).toBe("2026-03-30");
    expect(g[0][2]).toBe("2026-04-01");
  });

  it("isInMonth filters correctly", () => {
    expect(isInMonth("2026-04-15", 2026, 3)).toBe(true);
    expect(isInMonth("2026-03-30", 2026, 3)).toBe(false);
  });
});
