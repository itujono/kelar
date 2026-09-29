import { dbOps } from "../db";
import { fetchMe } from "./users";

const JIRA_TIMEZONE_KEY = "JIRA_TIMEZONE";

/**
 * Last known Jira profile timezone, falling back to the machine's until the first lookup.
 */
export function getCachedJiraTimeZone(): string {
  return dbOps.getConfig(JIRA_TIMEZONE_KEY) || Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Refreshes the Jira profile timezone; falls back to the cached one if the lookup fails.
 */
export async function refreshJiraTimeZone(): Promise<string> {
  try {
    const me = await fetchMe();
    if (me.timeZone) {
      dbOps.setConfig(JIRA_TIMEZONE_KEY, me.timeZone);
      return me.timeZone;
    }
  } catch {
    // Keep the cached timezone
  }
  return getCachedJiraTimeZone();
}
