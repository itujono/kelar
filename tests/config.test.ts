import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { dbOps } from "../src/db";
import {
  getAppConfig,
  getBitbucketConfig,
  setAppConfig,
  isConfigValid,
  isBitbucketConfigValid,
  CONFIG_KEYS,
  BITBUCKET_CONFIG_KEYS,
  DEFAULT_MONTHLY_TARGET_HOURS,
  DEFAULT_CALCULATION_DAY,
} from "../src/config";

const JIRA_KEYS = Object.values(CONFIG_KEYS);
const BITBUCKET_KEYS = Object.values(BITBUCKET_CONFIG_KEYS);
const TRACKED_KEYS = [...JIRA_KEYS, ...BITBUCKET_KEYS];

const snapshots = new Map<string, string | null>();

beforeEach(() => {
  snapshots.clear();
  for (const key of TRACKED_KEYS) {
    snapshots.set(key, dbOps.getConfig(key));
  }
});

afterEach(() => {
  for (const [key, originalValue] of snapshots) {
    if (originalValue !== null) {
      dbOps.setConfig(key, originalValue);
    } else {
      dbOps.deleteConfig(key);
    }
  }
});

describe("getAppConfig", () => {
  test("returns config with defaults for missing optional keys", () => {
    // Wipe optional keys
    dbOps.deleteConfig("MONTHLY_TARGET_HOURS");
    dbOps.deleteConfig("LAST_CALCULATION_DAY");

    const config = getAppConfig();
    expect(config.MONTHLY_TARGET_HOURS).toBe(
      DEFAULT_MONTHLY_TARGET_HOURS.toString()
    );
    expect(config.LAST_CALCULATION_DAY).toBe(
      DEFAULT_CALCULATION_DAY.toString()
    );
  });

  test("returns real value for set keys", () => {
    setAppConfig("JIRA_DOMAIN", "test-domain.atlassian.net");
    const config = getAppConfig();
    expect(config.JIRA_DOMAIN).toBe("test-domain.atlassian.net");
  });
});

describe("getBitbucketConfig", () => {
  test("returns null for missing keys", () => {
    dbOps.deleteConfig("BITBUCKET_WORKSPACE");
    const config = getBitbucketConfig();
    expect(config.BITBUCKET_WORKSPACE).toBeNull();
  });

  test("returns set values", () => {
    setAppConfig("BITBUCKET_WORKSPACE", "test-ws");
    const config = getBitbucketConfig();
    expect(config.BITBUCKET_WORKSPACE).toBe("test-ws");
  });
});

describe("setAppConfig", () => {
  test("writes a value and can be read back", () => {
    setAppConfig("JIRA_EMAIL", "test@example.com");
    expect(dbOps.getConfig("JIRA_EMAIL")).toBe("test@example.com");
  });

  test("overwrites existing value", () => {
    setAppConfig("JIRA_EMAIL", "first@example.com");
    setAppConfig("JIRA_EMAIL", "second@example.com");
    expect(dbOps.getConfig("JIRA_EMAIL")).toBe("second@example.com");
  });
});

describe("isConfigValid", () => {
  const REQUIRED_JIRA = [
    "JIRA_DOMAIN",
    "JIRA_EMAIL",
    "JIRA_TOKEN",
    "JIRA_ACCOUNT_ID",
    "PERSONAL_TICKET_ID",
  ] as const;

  test("returns valid when all required keys are set", () => {
    for (const key of REQUIRED_JIRA) {
      setAppConfig(key, `test-${key}`);
    }
    const result = isConfigValid();
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  test("returns missing keys when some are absent", () => {
    for (const key of REQUIRED_JIRA) {
      setAppConfig(key, `test-${key}`);
    }
    dbOps.deleteConfig("JIRA_TOKEN");
    dbOps.deleteConfig("JIRA_ACCOUNT_ID");

    const result = isConfigValid();
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("JIRA_TOKEN");
    expect(result.missing).toContain("JIRA_ACCOUNT_ID");
    expect(result.missing.length).toBe(2);
  });

  test("returns all missing when nothing configured", () => {
    for (const key of REQUIRED_JIRA) {
      dbOps.deleteConfig(key);
    }
    const result = isConfigValid();
    expect(result.valid).toBe(false);
    expect(result.missing.length).toBe(REQUIRED_JIRA.length);
  });
});

describe("isBitbucketConfigValid", () => {
  const REQUIRED_BB = [
    "BITBUCKET_EMAIL",
    "BITBUCKET_TOKEN",
    "BITBUCKET_WORKSPACE",
    "BITBUCKET_REPO_SLUG",
  ] as const;

  test("returns valid when all required keys are set", () => {
    for (const key of REQUIRED_BB) {
      setAppConfig(key, `test-${key}`);
    }
    const result = isBitbucketConfigValid();
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  test("returns missing keys when some are absent", () => {
    for (const key of REQUIRED_BB) {
      setAppConfig(key, `test-${key}`);
    }
    dbOps.deleteConfig("BITBUCKET_TOKEN");

    const result = isBitbucketConfigValid();
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(["BITBUCKET_TOKEN"]);
  });

  test("BITBUCKET_USERNAME is not required", () => {
    for (const key of REQUIRED_BB) {
      setAppConfig(key, `test-${key}`);
    }
    dbOps.deleteConfig("BITBUCKET_USERNAME");
    const result = isBitbucketConfigValid();
    expect(result.valid).toBe(true);
  });
});
