import { test, expect, describe } from "bun:test";
import { parseJiraTime, roundToNearest5, formatMinutes, formatDuration, extractAdfText, isZombieTicket } from "../src/utils";
import type { JiraIssue } from "../src/jira";

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

describe("formatDuration", () => {
  test("null returns default label", () => {
    expect(formatDuration(null)).toBe("-");
  });

  test("null with custom nullLabel", () => {
    expect(formatDuration(null, { nullLabel: "N/A" })).toBe("N/A");
  });

  test("zero seconds", () => {
    expect(formatDuration(0)).toBe("0m");
  });

  test("seconds to minutes only", () => {
    expect(formatDuration(60)).toBe("1m");
    expect(formatDuration(1500)).toBe("25m");
  });

  test("seconds to hours only", () => {
    expect(formatDuration(3600)).toBe("1h");
    expect(formatDuration(7200)).toBe("2h");
  });

  test("seconds to hours and minutes", () => {
    expect(formatDuration(3660)).toBe("1h 1m");
    expect(formatDuration(5400)).toBe("1h 30m");
    expect(formatDuration(54300)).toBe("15h 5m");
  });

  test("showDays false — no days, just hours", () => {
    expect(formatDuration(86400)).toBe("24h");
    expect(formatDuration(90000)).toBe("25h");
  });

  test("showDays true — shows days", () => {
    expect(formatDuration(86400, { showDays: true })).toBe("1d 0h");
    expect(formatDuration(90000, { showDays: true })).toBe("1d 1h");
    expect(formatDuration(173400, { showDays: true })).toBe("2d 0h");
    expect(formatDuration(176400, { showDays: true })).toBe("2d 1h");
  });

  test("showDays with less than a day", () => {
    expect(formatDuration(3660, { showDays: true })).toBe("1h 1m");
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

describe("isZombieTicket", () => {
  const makeTicket = (overrides: Partial<JiraIssue["fields"] & { key?: string; id?: string }> = {}): JiraIssue => ({
    id: "1",
    key: "TEST-1",
    fields: {
      summary: "Test",
      description: null,
      status: { name: "In Progress", statusCategory: { name: "In Progress", key: "indeterminate" } },
      project: { name: "Test", key: "TEST" },
      priority: null,
      assignee: null,
      reporter: null,
      timeoriginalestimate: null,
      timespent: null,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      issuelinks: [],
      ...overrides,
    },
  });

  test("null or falsy ticket returns false", () => {
    expect(isZombieTicket(null as any)).toBe(false);
    expect(isZombieTicket(undefined as any)).toBe(false);
  });

  test("done category returns false", () => {
    const t = makeTicket({ status: { name: "Done", statusCategory: { name: "Done", key: "done" } } });
    expect(isZombieTicket(t)).toBe(false);
  });

  test("new category (todo) returns false", () => {
    const t = makeTicket({ status: { name: "To Do", statusCategory: { name: "To Do", key: "new" } } });
    expect(isZombieTicket(t)).toBe(false);
  });

  test("waiting for review returns false", () => {
    const t = makeTicket({ status: { name: "In Review", statusCategory: { name: "In Progress", key: "indeterminate" } } });
    expect(isZombieTicket(t)).toBe(false);
  });

  test("waiting for QA returns false", () => {
    const t = makeTicket({ status: { name: "In QA", statusCategory: { name: "In Progress", key: "indeterminate" } } });
    expect(isZombieTicket(t)).toBe(false);
  });

  test("done/closed/resolved/canceled in status name returns false", () => {
    const names = ["Done", "Closed", "Resolved", "Canceled"];
    for (const name of names) {
      const t = makeTicket({ status: { name, statusCategory: { name: "In Progress", key: "indeterminate" } } });
      expect(isZombieTicket(t)).toBe(false);
    }
  });

  test("in progress with recent activity returns false", () => {
    const t = makeTicket({
      status: { name: "In Progress", statusCategory: { name: "In Progress", key: "indeterminate" } },
      updated: new Date().toISOString(),
    });
    expect(isZombieTicket(t)).toBe(false);
  });

  test("in progress with no activity for >48h returns true", () => {
    const staleDate = new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString();
    const t = makeTicket({
      status: { name: "In Progress", statusCategory: { name: "In Progress", key: "indeterminate" } },
      updated: staleDate,
    });
    expect(isZombieTicket(t)).toBe(true);
  });

  test("in progress with recent comment returns false", () => {
    const t = makeTicket({
      status: { name: "In Progress", statusCategory: { name: "In Progress", key: "indeterminate" } },
      updated: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
      comment: { comments: [{ id: "1", created: new Date().toISOString(), author: { accountId: "u", displayName: "User" }, body: null as any }] },
    });
    expect(isZombieTicket(t)).toBe(false);
  });

  test("in progress with recent worklog returns false", () => {
    const t = makeTicket({
      status: { name: "In Progress", statusCategory: { name: "In Progress", key: "indeterminate" } },
      updated: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
      worklog: { worklogs: [{ id: "1", started: new Date().toISOString(), timeSpentSeconds: 3600, author: { accountId: "u", displayName: "User" }, comment: null }] },
    });
    expect(isZombieTicket(t)).toBe(false);
  });
});

