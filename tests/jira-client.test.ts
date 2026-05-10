import { test, expect, describe } from "bun:test";
import { assertObject, validateJiraIssue, validateJiraWorklog } from "../src/jira/client";

describe("assertObject", () => {
  test("passes for plain objects", () => {
    expect(() => assertObject({}, "test")).not.toThrow();
    expect(() => assertObject({ a: 1 }, "test")).not.toThrow();
  });

  test("throws with context for null", () => {
    expect(() => assertObject(null, "FooBar")).toThrow(
      "Unexpected API response: expected object, got null (FooBar)"
    );
  });

  test("throws with context for arrays", () => {
    expect(() => assertObject([1, 2], "Items")).toThrow(
      "Unexpected API response: expected object, got array (Items)"
    );
  });

  test("throws with context for strings", () => {
    expect(() => assertObject("hello", "Greeting")).toThrow(
      "Unexpected API response: expected object, got string (Greeting)"
    );
  });

  test("throws with context for numbers", () => {
    expect(() => assertObject(42, "Answer")).toThrow(
      "Unexpected API response: expected object, got number (Answer)"
    );
  });
});

describe("validateJiraIssue", () => {
  const validIssue = {
    id: "123",
    key: "TEST-1",
    fields: {
      summary: "Test",
      status: {
        name: "In Progress",
        statusCategory: {
          name: "In Progress",
          key: "indeterminate",
        },
      },
    },
  };

  test("passes for valid issue structure", () => {
    const result = validateJiraIssue(validIssue);
    expect(result.id).toBe("123");
    expect(result.key).toBe("TEST-1");
  });

  test("throws when data is not an object", () => {
    expect(() => validateJiraIssue(null)).toThrow(/JiraIssue/);
  });

  test("throws when fields is missing", () => {
    expect(() => validateJiraIssue({ id: "1" })).toThrow(/JiraIssue.fields/);
  });

  test("throws when fields is not an object", () => {
    expect(() =>
      validateJiraIssue({ id: "1", fields: "not-object" })
    ).toThrow(/JiraIssue.fields/);
  });

  test("throws when status is missing", () => {
    expect(() =>
      validateJiraIssue({ id: "1", fields: {} })
    ).toThrow(/JiraIssue.fields.status/);
  });

  test("throws when statusCategory is missing", () => {
    expect(() =>
      validateJiraIssue({
        id: "1",
        fields: { status: { name: "Done" } },
      })
    ).toThrow(/JiraIssue.fields.status.statusCategory/);
  });
});

describe("validateJiraWorklog", () => {
  const validWorklog = {
    id: "wl-123",
    timeSpentSeconds: 3600,
    started: "2024-01-01T00:00:00.000+0000",
    author: { accountId: "user", displayName: "User" },
    comment: null,
  };

  test("passes for valid worklog structure", () => {
    const result = validateJiraWorklog(validWorklog);
    expect(result.id).toBe("wl-123");
  });

  test("throws when data is not an object", () => {
    expect(() => validateJiraWorklog(null)).toThrow(/JiraWorklog/);
  });

  test("throws when id is not a string", () => {
    expect(() =>
      validateJiraWorklog({ ...validWorklog, id: 123 })
    ).toThrow("Unexpected worklog format from API");
  });

  test("throws when id is missing", () => {
    const { id, ...withoutId } = validWorklog;
    expect(() => validateJiraWorklog(withoutId)).toThrow(
      "Unexpected worklog format from API"
    );
  });

  test("throws when timeSpentSeconds is not a number", () => {
    expect(() =>
      validateJiraWorklog({ ...validWorklog, timeSpentSeconds: "3600" })
    ).toThrow("Unexpected worklog format from API");
  });

  test("throws when timeSpentSeconds is missing", () => {
    const { timeSpentSeconds, ...without } = validWorklog;
    expect(() => validateJiraWorklog(without)).toThrow(
      "Unexpected worklog format from API"
    );
  });
});
