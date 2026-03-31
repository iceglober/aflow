import { describe, test, expect } from "bun:test";
import { slugify } from "./slug";

describe("slugify", () => {
  test("basic text", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  test("preserves dots in version strings", () => {
    expect(slugify("v1.0.0")).toBe("v1.0.0");
  });

  test("collapses consecutive dots", () => {
    expect(slugify("v1..0")).toBe("v1.0");
    expect(slugify("v1...0")).toBe("v1.0");
  });

  test("strips leading and trailing dashes and dots", () => {
    expect(slugify(".hello.")).toBe("hello");
    expect(slugify("-hello-")).toBe("hello");
    expect(slugify(".-hello-.")).toBe("hello");
  });

  test("replaces special characters with dashes", () => {
    expect(slugify("fix: handle edge case")).toBe("fix-handle-edge-case");
  });

  test("truncates to maxLen", () => {
    expect(slugify("a".repeat(60))).toBe("a".repeat(50));
  });

  test("strips trailing dashes and dots after truncation", () => {
    expect(slugify("a".repeat(49) + "---")).toBe("a".repeat(49));
  });
});
