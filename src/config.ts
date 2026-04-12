import { dbOps } from "./db";

export const CONFIG_KEYS = {
  JIRA_DOMAIN: "JIRA_DOMAIN", // e.g., your-company.atlassian.net
  JIRA_EMAIL: "JIRA_EMAIL",
  JIRA_TOKEN: "JIRA_TOKEN",
  JIRA_ACCOUNT_ID: "JIRA_ACCOUNT_ID",
  PERSONAL_TICKET_ID: "PERSONAL_TICKET_ID",
} as const;

export type ConfigKey = keyof typeof CONFIG_KEYS;

export function getAppConfig() {
  const config: Record<string, string | null> = {};
  for (const key of Object.values(CONFIG_KEYS)) {
    config[key] = dbOps.getConfig(key);
  }
  return config as Record<ConfigKey, string | null>;
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
  
  const missing = required.filter(k => !config[k]);
  return {
    valid: missing.length === 0,
    missing
  };
}
