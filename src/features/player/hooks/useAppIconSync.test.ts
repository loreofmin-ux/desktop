import { describe, expect, it } from "vitest";
import { packagedIconIsOutdated } from "./useAppIconSync";

describe("packagedIconIsOutdated", () => {
  it("installs the rendered icon on binaries that still package the old logo", () => {
    expect(packagedIconIsOutdated("0.2.10")).toBe(true);
    expect(packagedIconIsOutdated("0.2.9")).toBe(true);
    expect(packagedIconIsOutdated("0.1.40")).toBe(true);
  });

  it("lets the packaged icon win on binaries built with the new logo", () => {
    expect(packagedIconIsOutdated("0.2.11")).toBe(false);
    expect(packagedIconIsOutdated("0.3.0")).toBe(false);
    expect(packagedIconIsOutdated("1.0.0-beta.1")).toBe(false);
  });

  it("keeps the packaged icon when the version is unknown", () => {
    expect(packagedIconIsOutdated(undefined)).toBe(false);
    expect(packagedIconIsOutdated("dev")).toBe(false);
  });
});
