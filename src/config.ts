import { dbOps } from "./db";

export const CONFIG_KEYS = {
  JIRA_DOMAIN: "JIRA_DOMAIN", // e.g., your-company.atlassian.net
  JIRA_EMAIL: "JIRA_EMAIL",
  JIRA_TOKEN: "JIRA_TOKEN",
  JIRA_ACCOUNT_ID: "JIRA_ACCOUNT_ID",
  PERSONAL_TICKET_ID: "PERSONAL_TICKET_ID",
  MONTHLY_TARGET_HOURS: "MONTHLY_TARGET_HOURS",
  LAST_CALCULATION_DAY: "LAST_CALCULATION_DAY",
} as const;

export type ConfigKey = keyof typeof CONFIG_KEYS;

export function getAppConfig() {
  const config: Record<string, string | null> = {};
  for (const key of Object.values(CONFIG_KEYS)) {
    config[key] = dbOps.getConfig(key);
  }
  
  // Set defaults if missing
  if (!config.MONTHLY_TARGET_HOURS) config.MONTHLY_TARGET_HOURS = "180";
  if (!config.LAST_CALCULATION_DAY) config.LAST_CALCULATION_DAY = "25";

  return config as Record<ConfigKey, string>;
}

export function setAppConfig(key: ConfigKey, value: string) {
  dbOps.setConfig(key, value);
}

export function isConfigValid(): { valid: boolean; missing: string[] } {
  const config = getAppConfig();
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
