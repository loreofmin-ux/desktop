import { describe, it, expect, vi } from "vitest";
import { goToAppHome } from "./RootErrorFallback";

describe("goToAppHome", () => {
  it("reloads the current document on the home route instead of leaving it", () => {
    const reload = vi.fn();
    const location = { hash: "#/library/playlist?id=1", reload };

    goToAppHome(location);

    expect(location.hash).toBe("#/");
    expect(reload).toHaveBeenCalledOnce();
  });
});
