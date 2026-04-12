import { test, expect, describe } from "bun:test";
import { parseJiraTime, roundToNearest5, formatMinutes } from "../src/utils";

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
});

describe("Formatting", () => {
  test("formats minutes to string", () => {
    expect(formatMinutes(90)).toBe("1h 30m");
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(60)).toBe("1h");
  });
});
