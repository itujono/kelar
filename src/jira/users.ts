import { dbOps } from "../db";
import { getBaseUrl, jiraHeaders } from "./client";
import type { JiraUser } from "./types";

const BANNED_KEYWORDS = [
  "app", "automation", "assist", "outlook", "trello",
  "notifications", "spreadsheet", "bot", "connect",
  "service", "integration", "slack", "system"
];

export async function fetchUsers(query: string = ""): Promise<JiraUser[]> {
  const CACHE_KEY = "USERS_CACHE";
  const CACHE_TS_KEY = "USERS_CACHE_TIMESTAMP";
  const CACHE_DURATION = 2 * 24 * 60 * 60 * 1000; // 2 days

  if (!query) {
    const cachedUsers = dbOps.getConfig(CACHE_KEY);
    const cachedTs = dbOps.getConfig(CACHE_TS_KEY);

    if (cachedUsers && cachedTs) {
      const ts = parseInt(cachedTs, 10);
      if (Date.now() - ts < CACHE_DURATION) {
        try {
          const parsed = JSON.parse(cachedUsers);
          if (Array.isArray(parsed) && parsed.every(u => u && typeof u.accountId === "string" && typeof u.displayName === "string")) {
            return parsed as JiraUser[];
          }
        } catch {
          // Invalid cache — fall through to fetch
        }
        dbOps.deleteConfigLike(CACHE_KEY);
      }
    }
  }

  const url = `${getBaseUrl()}/users/search?query=${encodeURIComponent(query)}&maxResults=300`;
  const response = await fetch(url, {
    headers: jiraHeaders(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch users: ${response.status} ${errorText}`);
  }

  const data = await response.json() as JiraUser[] | { values: JiraUser[] };
  const users = Array.isArray(data) ? data : (data.values || []);

  const filtered = users.filter((u: JiraUser) => {
    if (!u.accountId) return false;
    if (u.accountType === "app") return false;
    if (!u.emailAddress) return false;
    const name = (u.displayName || "").toLowerCase();
    const isBotName = BANNED_KEYWORDS.some(kw => name.includes(kw));
    return !isBotName;
  });

  if (!query) {
    dbOps.setConfig(CACHE_KEY, JSON.stringify(filtered));
    dbOps.setConfig(CACHE_TS_KEY, Date.now().toString());
  }

  return filtered;
}

export async function fetchMe(): Promise<JiraUser> {
  const url = `${getBaseUrl()}/myself`;
  const response = await fetch(url, {
    headers: jiraHeaders(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch current user: ${response.status} ${errorText}`);
  }

  return response.json() as Promise<JiraUser>;
}
