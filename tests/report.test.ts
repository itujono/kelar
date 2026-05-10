import { test, expect, describe } from "bun:test";
import { generateHtmlReport } from "../src/report";

const baseLogs = [
  {
    id: 1,
    identifier: "PROJ-123",
    label: "Fixed navigation bug",
    minutes: 90,
    is_jira: 1,
    created_at: "2024-06-15T10:00:00.000Z",
  },
  {
    id: 2,
    identifier: "Personal Log",
    label: "Code review",
    minutes: 45,
    is_jira: 0,
    created_at: "2024-06-15T14:00:00.000Z",
  },
];

describe("generateHtmlReport", () => {
  test("returns HTML string with period header", () => {
    const html = generateHtmlReport(baseLogs, "day", 180, 25, 10, 135, 1);
    expect(html).toContain("DAY");
    expect(html).toContain("Kelar Log Summary");
    expect(html).toContain("<!DOCTYPE html>");
  });

  test("includes grand total and formatted minutes", () => {
    const html = generateHtmlReport(baseLogs, "day", 180, 25, 10, 135, 1);
    expect(html).toContain("2h 15m");
    expect(html).toContain("135m logged");
  });

  test("includes entries count and personal count", () => {
    const html = generateHtmlReport(baseLogs, "day", 180, 25, 10, 135, 1);
    expect(html).toContain("Entries Found");
    expect(html).toContain('<div class="stat-value">2</div>');
    expect(html).toContain("1 personal items");
  });

  test("includes goal info", () => {
    const html = generateHtmlReport(baseLogs, "day", 180, 25, 10, 135, 1);
    expect(html).toContain("180 Hours");
    expect(html).toContain("Through the 25th");
  });

  test("escapes HTML in identifier", () => {
    const logs = [
      {
        id: 1,
        identifier: '<script>alert("xss")</script>',
        label: "Safe label",
        minutes: 30,
        is_jira: 1,
        created_at: "2024-06-15T10:00:00.000Z",
      },
    ];
    const html = generateHtmlReport(logs, "day", 180, 25, 10, 30, 0);
    expect(html).not.toContain('<script>alert("xss")</script>');
    expect(html).toContain("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
  });

  test("escapes HTML in label", () => {
    const logs = [
      {
        id: 1,
        identifier: "PROJ-456",
        label: '<img src=x onerror=alert(1)>',
        minutes: 30,
        is_jira: 1,
        created_at: "2024-06-15T10:00:00.000Z",
      },
    ];
    const html = generateHtmlReport(logs, "day", 180, 25, 10, 30, 0);
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain(
      "&lt;img src=x onerror=alert(1)&gt;"
    );
  });

  test("escapes ampersands", () => {
    const logs = [
      {
        id: 1,
        identifier: "A & B Co",
        label: "Fix & Test",
        minutes: 30,
        is_jira: 1,
        created_at: "2024-06-15T10:00:00.000Z",
      },
    ];
    const html = generateHtmlReport(logs, "day", 180, 25, 10, 30, 0);
    expect(html).toContain("A &amp; B Co");
    expect(html).toContain("Fix &amp; Test");
  });

  test("renders Jira and Personal badges", () => {
    const html = generateHtmlReport(baseLogs, "day", 180, 25, 10, 135, 1);
    expect(html).toContain(">Jira<");
    expect(html).toContain(">Personal<");
  });
});
