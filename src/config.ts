import { dbOps } from "./db";

export const CONFIG_KEYS = {
  JIRA_DOMAIN: "JIRA_DOMAIN",
  JIRA_EMAIL: "JIRA_EMAIL",
  JIRA_TOKEN: "JIRA_TOKEN",
  JIRA_ACCOUNT_ID: "JIRA_ACCOUNT_ID",
  PERSONAL_TICKET_ID: "PERSONAL_TICKET_ID",
  MONTHLY_TARGET_HOURS: "MONTHLY_TARGET_HOURS",
  LAST_CALCULATION_DAY: "LAST_CALCULATION_DAY",
} as const;
 
export const BITBUCKET_CONFIG_KEYS = {
  BITBUCKET_USERNAME: "BITBUCKET_USERNAME",
  BITBUCKET_APP_PASSWORD: "BITBUCKET_APP_PASSWORD",
  BITBUCKET_WORKSPACE: "BITBUCKET_WORKSPACE",
  BITBUCKET_REPO_SLUG: "BITBUCKET_REPO_SLUG",
} as const;


export type ConfigKey = keyof typeof CONFIG_KEYS;
export type BitbucketConfigKey = keyof typeof BITBUCKET_CONFIG_KEYS;


export const DEFAULT_MONTHLY_TARGET_HOURS = 180;
export const DEFAULT_CALCULATION_DAY = 25;

export function getAppConfig() {
  const config: Record<string, string | null> = {};
  for (const key of Object.values(CONFIG_KEYS)) {
    config[key] = dbOps.getConfig(key);
  }

  if (!config.MONTHLY_TARGET_HOURS) config.MONTHLY_TARGET_HOURS = DEFAULT_MONTHLY_TARGET_HOURS.toString();
  if (!config.LAST_CALCULATION_DAY) config.LAST_CALCULATION_DAY = DEFAULT_CALCULATION_DAY.toString();

  return config as Record<ConfigKey, string>;
}

export function getBitbucketConfig() {
  const config: Record<string, string | null> = {};
  for (const key of Object.values(BITBUCKET_CONFIG_KEYS)) {
    config[key] = dbOps.getConfig(key);
  }
  return config as Record<BitbucketConfigKey, string | null>;
}


export function setAppConfig(key: ConfigKey, value: string) {
  dbOps.setConfig(key, value);
}

export function isConfigValid(): { valid: boolean; missing: string[] } {
  const required: ConfigKey[] = [
    "JIRA_DOMAIN",
    "JIRA_EMAIL",
    "JIRA_TOKEN",
    "JIRA_ACCOUNT_ID",
    "PERSONAL_TICKET_ID",
  ];

  const missing = required.filter(k => !dbOps.getConfig(k));
  return {
    valid: missing.length === 0,
    missing
  };
}

export function isBitbucketConfigValid(): { valid: boolean; missing: string[] } {
  const required: BitbucketConfigKey[] = [
    "BITBUCKET_USERNAME",
    "BITBUCKET_APP_PASSWORD",
    "BITBUCKET_WORKSPACE",
    "BITBUCKET_REPO_SLUG",
  ];

  const missing = required.filter(k => !dbOps.getConfig(k));
  return {
    valid: missing.length === 0,
    missing
  };
}

