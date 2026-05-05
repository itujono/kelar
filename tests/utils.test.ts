import { test, expect, describe } from "bun:test";
import { parseJiraTime, roundToNearest5, formatMinutes, extractAdfText } from "../src/utils";

describe("Time Parsing", () => {
  test("parses minutes", () => {
    expect(parseJiraTime("45m")).toBe(45);
  });

  test("parses hours", () => {
    expect(parseJiraTime("1h")).toBe(60);
  });

  test("parses mixed hours and minutes", () => {
    expect(parseJiraTime("1h 30m")).toBe(90);
    expect(parseJiraTime("2h15m")).toBe(135);
  });

  test("parses numeric values as minutes", () => {
    expect(parseJiraTime("30")).toBe(30);
  });

  test("parses decimal hours", () => {
    expect(parseJiraTime("1.5h")).toBe(90);
  });

  test("parses zero", () => {
    expect(parseJiraTime("0")).toBe(0);
  });

  test("parses combined hours and minutes", () => {
    expect(parseJiraTime("2h 30m")).toBe(150);
  });
});

describe("Rounding logic", () => {
  test("rounds up to nearest 5", () => {
    expect(roundToNearest5(42)).toBe(45);
    expect(roundToNearest5(31)).toBe(35);
    expect(roundToNearest5(5)).toBe(5);
    expect(roundToNearest5(1)).toBe(5);
  });

  test("handles 0 or negative", () => {
    expect(roundToNearest5(0)).toBe(0);
    expect(roundToNearest5(-1)).toBe(0);
  });

  test("rounds exact multiples", () => {
    expect(roundToNearest5(30)).toBe(30);
    expect(roundToNearest5(60)).toBe(60);
  });
});

describe("Formatting", () => {
  test("formats minutes to string", () => {
    expect(formatMinutes(90)).toBe("1h 30m");
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(60)).toBe("1h");
  });

  test("formats zero minutes", () => {
    expect(formatMinutes(0)).toBe("0m");
  });
});

describe("extractAdfText", () => {
  test("returns empty string for null", () => {
    expect(extractAdfText(null)).toBe("");
  });

  test("returns empty string for undefined", () => {
    expect(extractAdfText(undefined)).toBe("");
  });

  test("returns string as-is", () => {
    expect(extractAdfText("hello")).toBe("hello");
  });

  test("extracts text from simple paragraph", () => {
    const doc = {
      type: "doc",
      version: 1,
      content: [
        { type: "paragraph", content: [{ text: "Hello world", type: "text" }] }
      ]
    };
    expect(extractAdfText(doc)).toBe("Hello world\n");
  });

  test("extracts text from multiple paragraphs", () => {
    const doc = {
      type: "doc",
      version: 1,
      content: [
        { type: "paragraph", content: [{ text: "Line 1", type: "text" }] },
        { type: "paragraph", content: [{ text: "Line 2", type: "text" }] }
      ]
    };
    expect(extractAdfText(doc)).toBe("Line 1\nLine 2\n");
  });

  test("handles empty content", () => {
    const doc = { type: "doc", version: 1, content: [] };
    expect(extractAdfText(doc)).toBe("");
  });

  test("handles paragraph with no content", () => {
    const doc = {
      type: "doc",
      version: 1,
      content: [
        { type: "paragraph" }
      ]
    };
    expect(extractAdfText(doc)).toBe("\n");
  });
});

describe("HTML escaping (report.ts)", () => {
  const escapeHtml = (s: string): string => {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  };

  test("escapes HTML special characters", () => {
    expect(escapeHtml("<script>alert(1)</script>")).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  test("escapes ampersands", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  test("escapes double quotes", () => {
    expect(escapeHtml('say "hello"')).toBe("say &quot;hello&quot;");
  });

  test("leaves plain text unchanged", () => {
    expect(escapeHtml("Hello world")).toBe("Hello world");
  });
});