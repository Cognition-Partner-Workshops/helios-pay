import { describe, expect, it } from "vitest";

import { assertAllowedUrl } from "../src/lib/urlguard";

describe("webhook URL guard", () => {
  it.each(["http://169.254.169.254/latest/meta-data/", "http://metadata/"])(
    "blocks %s",
    (url) => {
      expect(() => assertAllowedUrl(url)).toThrow();
    },
  );

  it("allows partner URLs", () => {
    expect(() => assertAllowedUrl("http://partner.example/hook")).not.toThrow();
  });
});
