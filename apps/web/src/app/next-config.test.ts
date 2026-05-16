import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("next image config", () => {
  it("allows Google profile image hosts", () => {
    expect(nextConfig.images?.remotePatterns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          protocol: "https",
          hostname: "lh3.googleusercontent.com",
        }),
      ]),
    );
  });
});
