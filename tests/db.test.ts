import { test, expect, describe, beforeEach } from "bun:test";
import { dbOps } from "../src/db";

describe("dbOps - config", () => {
  const testKey = "__test_config_key__";

  beforeEach(() => {
    dbOps.deleteConfigLike(testKey);
  });

  test("setConfig and getConfig round-trip", () => {
    dbOps.setConfig(testKey, "test_value");
    expect(dbOps.getConfig(testKey)).toBe("test_value");
  });

  test("getConfig returns null for missing key", () => {
    expect(dbOps.getConfig("__nonexistent_key__")).toBeNull();
  });

  test("setConfig overwrites existing value", () => {
    dbOps.setConfig(testKey, "first");
    dbOps.setConfig(testKey, "second");
    expect(dbOps.getConfig(testKey)).toBe("second");
  });

  test("deleteConfigLike removes matching keys", () => {
    dbOps.setConfig(`${testKey}_a`, "1");
    dbOps.setConfig(`${testKey}_b`, "2");
    expect(dbOps.getConfig(`${testKey}_a`)).toBe("1");
    expect(dbOps.getConfig(`${testKey}_b`)).toBe("2");

    dbOps.deleteConfigLike(`${testKey}%`);

    expect(dbOps.getConfig(`${testKey}_a`)).toBeNull();
    expect(dbOps.getConfig(`${testKey}_b`)).toBeNull();
  });
});

describe("dbOps - logs", () => {
  const uniqueId = () => `WL_TEST_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  test("addLog and getLogs round-trip", () => {
    const worklogId = uniqueId();
    const now = new Date().toISOString();

    dbOps.addLog({
      identifier: "TEST-123",
      label: "Test ticket",
      minutes: 45,
      jira_worklog_id: worklogId,
      is_jira: true,
      created_at: now,
    });

    const logs = dbOps.getLogs();
    const found = logs.find(l => l.jira_worklog_id === worklogId);
    expect(found).toBeDefined();
    expect(found!.identifier).toBe("TEST-123");
    expect(found!.minutes).toBe(45);
    expect(found!.is_jira).toBe(1);
    expect(found!.label).toBe("Test ticket");
  });

  test("addLog with upsert on conflict", () => {
    const worklogId = uniqueId();
    const now = new Date().toISOString();

    dbOps.addLog({
      identifier: "TEST-456",
      label: "Original",
      minutes: 30,
      jira_worklog_id: worklogId,
      is_jira: true,
      created_at: now,
    });

    dbOps.addLog({
      identifier: "TEST-456",
      label: "Updated",
      minutes: 60,
      jira_worklog_id: worklogId,
      is_jira: true,
      created_at: now,
    });

    const logs = dbOps.getLogs();
    const found = logs.find(l => l.jira_worklog_id === worklogId);
    expect(found).toBeDefined();
    expect(found!.label).toBe("Updated");
    expect(found!.minutes).toBe(60);
  });

  test("getLogs with sinceISO filters correctly", () => {
    const worklogId = uniqueId();
    const now = new Date();
    const futureDate = new Date(now.getTime() + 100000).toISOString();

    dbOps.addLog({
      identifier: "TEST-FUTURE",
      label: "Future log",
      minutes: 15,
      jira_worklog_id: worklogId,
      is_jira: false,
      created_at: futureDate,
    });

    const pastCutoff = new Date(now.getTime() + 50000).toISOString();
    const filtered = dbOps.getLogs(pastCutoff);
    const found = filtered.find(l => l.jira_worklog_id === worklogId);
    expect(found).toBeDefined();
  });

  test("addLog without jira_worklog_id inserts null", () => {
    const now = new Date().toISOString();
    const beforeCount = dbOps.getLogs().length;

    dbOps.addLog({
      identifier: "PERSONAL",
      minutes: 10,
      is_jira: false,
      created_at: now,
    });

    expect(dbOps.getLogs().length).toBe(beforeCount + 1);
  });

  test("deleteLogsByWorklogIds removes specified logs", () => {
    const worklogId = uniqueId();
    const now = new Date().toISOString();

    dbOps.addLog({
      identifier: "TEST-DEL",
      label: "To delete",
      minutes: 20,
      jira_worklog_id: worklogId,
      is_jira: true,
      created_at: now,
    });

    const found = dbOps.getLogs().find(l => l.jira_worklog_id === worklogId);
    expect(found).toBeDefined();

    dbOps.deleteLogsByWorklogIds([worklogId]);

    const afterDelete = dbOps.getLogs().find(l => l.jira_worklog_id === worklogId);
    expect(afterDelete).toBeUndefined();
  });

  test("deleteLogsByWorklogIds with empty array does nothing", () => {
    expect(() => dbOps.deleteLogsByWorklogIds([])).not.toThrow();
  });

  test("clearAllLogsInRange removes logs after date", () => {
    const worklogId = uniqueId();
    const now = new Date();
    const futureDate = new Date(now.getTime() + 100000).toISOString();

    dbOps.addLog({
      identifier: "TEST-RANGE-DEL",
      label: "Range delete",
      minutes: 25,
      jira_worklog_id: worklogId,
      is_jira: true,
      created_at: futureDate,
    });

    const cutoff = new Date(now.getTime() + 50000).toISOString();
    dbOps.clearAllLogsInRange(cutoff);

    const afterDelete = dbOps.getLogs().find(l => l.jira_worklog_id === worklogId);
    expect(afterDelete).toBeUndefined();
  });
});