import { describe, it, expect } from "vitest";
import { interpolate, expandHome } from "../core/variable-interpolator.js";

describe("interpolate", () => {
  it("replaces ${VAR} with values from context", () => {
    const result = interpolate("redis-cli SET ${flag_name} ${flag_value}", {
      flag_name: "my_flag",
      flag_value: "true",
    });
    expect(result).toBe("redis-cli SET my_flag true");
  });

  it("leaves unknown vars as-is", () => {
    const result = interpolate("echo ${UNKNOWN}", {});
    expect(result).toBe("echo ${UNKNOWN}");
  });

  it("handles multiple occurrences", () => {
    const result = interpolate("${X} and ${X}", { X: "hello" });
    expect(result).toBe("hello and hello");
  });

  it("handles empty context", () => {
    const result = interpolate("no vars here", {});
    expect(result).toBe("no vars here");
  });
});

describe("expandHome", () => {
  it("expands ~ at start of path", () => {
    const result = expandHome("~/Desktop/code");
    expect(result).toMatch(/^\/.*\/Desktop\/code$/);
  });

  it("leaves absolute paths unchanged", () => {
    expect(expandHome("/usr/local/bin")).toBe("/usr/local/bin");
  });

  it("returns undefined for undefined input", () => {
    expect(expandHome(undefined)).toBeUndefined();
  });
});
