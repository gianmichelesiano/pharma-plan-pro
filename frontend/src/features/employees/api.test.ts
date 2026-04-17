import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.fn();
vi.mock("../../lib/supabase", () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}));

import { listEmployees, createEmployee } from "./api";

beforeEach(() => { fromMock.mockReset(); });

describe("listEmployees", () => {
  it("filters by active when onlyActive=true", async () => {
    const eq = vi.fn().mockResolvedValue({ data: [], error: null });
    const order = vi.fn().mockReturnValue({ eq });
    const select = vi.fn().mockReturnValue({ order });
    fromMock.mockReturnValue({ select });

    await listEmployees(true);

    expect(fromMock).toHaveBeenCalledWith("employees");
    expect(eq).toHaveBeenCalledWith("active", true);
  });
});

describe("createEmployee", () => {
  it("inserts payload and returns the new row", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: "x", display_code: "ZZ", first_name: "Z", last_name: "Z", role: "pha", active: true },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    fromMock.mockReturnValue({ insert });

    const result = await createEmployee({ display_code: "ZZ", first_name: "Z", last_name: "Z", role: "pha" });

    expect(insert).toHaveBeenCalledWith({ display_code: "ZZ", first_name: "Z", last_name: "Z", role: "pha" });
    expect(result.display_code).toBe("ZZ");
  });
});
