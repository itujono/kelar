import { test, expect, describe } from "bun:test";
import { getPeriodRange } from "../src/hooks/useLogView";

describe("getPeriodRange", () => {
  // 13:59 WIB on Tue 29 Sep 2026 = 08:59 in Berlin
  const now = new Date("2026-09-29T06:59:10Z");

  test("yesterday spans the previous calendar day in the Jira timezone", () => {
    const { since, until } = getPeriodRange("yesterday", "Europe/Berlin", now);
    expect(since.toISOString()).toBe("2026-09-27T22:00:00.000Z");
    expect(until?.toISOString()).toBe("2026-09-28T22:00:00.000Z");
  });

  test("yesterday includes late-evening Jira worklogs that are already tomorrow locally", () => {
    const { since, until } = getPeriodRange("yesterday", "Europe/Berlin", now);
    // 19:35 in Berlin is 00:35 the next day in WIB, but Jira counts it as Sep 28
    const lateLog = new Date("2026-09-28T19:35:58.000+0200");
    expect(lateLog >= since && lateLog < until!).toBe(true);
  });

  test("day starts at midnight in the Jira timezone and is open-ended", () => {
    const { since, until } = getPeriodRange("day", "Europe/Berlin", now);
    expect(since.toISOString()).toBe("2026-09-28T22:00:00.000Z");
    expect(until).toBeUndefined();
  });

  test("week starts on Monday in the Jira timezone", () => {
    const { since } = getPeriodRange("week", "Europe/Berlin", now);
    expect(since.toISOString()).toBe("2026-09-27T22:00:00.000Z");
  });

  test("month starts on the 1st in the Jira timezone", () => {
    const { since } = getPeriodRange("month", "Europe/Berlin", now);
    expect(since.toISOString()).toBe("2026-08-31T22:00:00.000Z");
  });

  test("uses the given timezone rather than the machine's", () => {
    const { since } = getPeriodRange("day", "Asia/Jakarta", now);
    expect(since.toISOString()).toBe("2026-09-28T17:00:00.000Z");
  });
});
