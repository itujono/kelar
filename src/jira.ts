import { getAppConfig } from "./config";
import { Buffer } from "node:buffer";
import { dbOps } from "./db";

export interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress?: string;
  avatarUrls?: Record<string, string>;
  accountType?: "atlassian" | "app" | "customer" | "unknown";
}

export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description: string | JiraAdfDoc | null;
    status: {
      name: string;
      statusCategory: {
        name: string;
        key: string;
      };
    };
    project: {
      name: string;
      key: string;
    };
    priority: {
      name: string;
    } | null;
    assignee: JiraUser | null;
    reporter: JiraUser | null;
    timeoriginalestimate: number | null; // seconds
    timespent: number | null; // seconds
    created: string;
    updated: string;
    comment?: {
      comments: JiraComment[];
    };
    worklog?: {
      worklogs: JiraWorklog[];
      total?: number;
      maxResults?: number;
    };
    issuelinks: JiraIssueLink[];
  };
}

export interface JiraIssueLink {
  id: string;
  type: {
    name: string;
    inward: string;
    outward: string;
  };
  inwardIssue?: {
    id: string;
    key: string;
    fields: {
      summary: string;
      status: { name: string };
    };
  };
  outwardIssue?: {
    id: string;
    key: string;
    fields: {
      summary: string;
      status: { name: string };
    };
  };
}

export interface JiraTransition {
  id: string;
  name: string;
  to: {
    name: string;
    statusCategory: {
      name: string;
      key: string;
    };
  };
}

export interface JiraAdfDoc {
  type: string;
  version: number;
  content: {
    type: string;
    content?: {
      text?: string;
      type: string;
    }[];
  }[];
}

export interface JiraComment {
  id: string;
  created: string;
  author: JiraUser;
  body: JiraAdfDoc;
}

export interface JiraWorklog {
  id: string;
  comment: JiraAdfDoc | null;
  started: string;
  timeSpentSeconds: number;
  author: JiraUser;
}

function getAuthHeader() {
  const config = getAppConfig();
  if (!config.JIRA_EMAIL || !config.JIRA_TOKEN) {
    throw new Error("Jira credentials not configured.");
  }
  const email = config.JIRA_EMAIL.trim();
  const token = config.JIRA_TOKEN.trim();
  const auth = Buffer.from(`${email}:${token}`).toString("base64");
  return `Basic ${auth}`;
}

function getBaseUrl() {
  const config = getAppConfig();
  if (!config.JIRA_DOMAIN) {
    throw new Error("Jira domain not configured.");
  }
  const domain = config.JIRA_DOMAIN.replace(/^https?:\/\//, '').replace(/\/$/, '').trim();
  return `https://${domain}/rest/api/3`;
}

export async function fetchIssueDetails(issueKey: string): Promise<JiraIssue> {
  const url = `${getBaseUrl()}/issue/${issueKey}`;
  const response = await fetch(url, {
    headers: {
      Authorization: getAuthHeader(),
      Accept: "application/json",
      "User-Agent": "KelarCLI/1.0.0",
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Ticket "${issueKey}" not found. Please check the key and try again.`);
    }

    const errorText = await response.text();
    throw new Error(`Failed to fetch issue details (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<JiraIssue>;
}

/**
 * Clears the local cache for ticket searches
 */
export function clearTixCache() {
  dbOps.deleteConfigLike("TIX_CACHE_%");
}

export async function postWorklog(issueKey: string, minutes: number, comment: string, started: string): Promise<JiraWorklog> {
  const url = `${getBaseUrl()}/issue/${issueKey}/worklog`;

  const body = {
    comment: {
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [
            {
              text: comment,
              type: "text",
            },
          ],
        },
      ],
    },
    started: started, // ISO string with offset, e.g. 2021-01-17T12:34:00.000+0700
    timeSpentSeconds: minutes * 60,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "KelarCLI/1.0.0",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to post worklog.
URL: ${url}
Status: ${response.status}
Response: ${errorText}`);
  }

  const result = await response.json() as JiraWorklog;
  clearTixCache();
  return result;
}

/**
 * Searches for issues using JQL
 */
export async function searchIssues(jql: string, maxResults: number = 100): Promise<JiraIssue[]> {
  const CACHE_KEY = `TIX_CACHE_V3_${Buffer.from(jql).toString("base64").substring(0, 50)}_${maxResults}`;
  const CACHE_TS_KEY = `${CACHE_KEY}_TS`;
  const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

  const cachedData = dbOps.getConfig(CACHE_KEY);
  const cachedTs = dbOps.getConfig(CACHE_TS_KEY);

  if (cachedData && cachedTs) {
    const ts = parseInt(cachedTs, 10);
    if (Date.now() - ts < CACHE_DURATION) {
      return JSON.parse(cachedData);
    }
  }

  const url = `${getBaseUrl()}/search/jql`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "KelarCLI/1.0.0",
    },
    body: JSON.stringify({
      jql,
      maxResults,
      fields: [
        "summary",
        "assignee",
        "status",
        "priority",
        "timeoriginalestimate",
        "timespent",
        "created",
        "updated",
        "comment",
        "worklog",
        "issuelinks",
        "description",
        "project",
        "reporter"
      ]
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`JQL Search failed: ${response.status} ${errorText}`);
  }

  const data = await response.json() as { issues: JiraIssue[] };
  const issues = data.issues || [];

  // Cache broadly
  dbOps.setConfig(CACHE_KEY, JSON.stringify(issues));
  dbOps.setConfig(CACHE_TS_KEY, Date.now().toString());

  return issues;
}

/**
 * Searches for all manageable users
 */
export async function fetchUsers(query: string = ""): Promise<JiraUser[]> {
  const CACHE_KEY = "USERS_CACHE";
  const CACHE_TS_KEY = "USERS_CACHE_TIMESTAMP";
  const CACHE_DURATION = 2 * 24 * 60 * 60 * 1000; // 2 days

  // Check persistent cache first if query is empty
  if (!query) {
    const cachedUsers = dbOps.getConfig(CACHE_KEY);
    const cachedTs = dbOps.getConfig(CACHE_TS_KEY);
    
    if (cachedUsers && cachedTs) {
      const ts = parseInt(cachedTs, 10);
      if (Date.now() - ts < CACHE_DURATION) {
        return JSON.parse(cachedUsers);
      }
    }
  }

  const url = `${getBaseUrl()}/users/search?query=${encodeURIComponent(query)}&maxResults=300`;
  const response = await fetch(url, {
    headers: {
      Authorization: getAuthHeader(),
      Accept: "application/json",
      "User-Agent": "KelarCLI/1.0.0",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch users: ${response.status} ${errorText}`);
  }

  const data = await response.json() as JiraUser[] | { values: JiraUser[] };
  const users = Array.isArray(data) ? data : (data.values || []);

  const BANNED_KEYWORDS = [
    "app", "automation", "assist", "outlook", "trello",
    "notifications", "spreadsheet", "bot", "connect",
    "service", "integration", "slack", "system"
  ];

  const filtered = users.filter((u: JiraUser) => {
    if (!u.accountId) return false;

    // Explicitly exclude apps
    if (u.accountType === "app") return false;

    if (!u.emailAddress) return false;

    const name = (u.displayName || "").toLowerCase();
    const isBotName = BANNED_KEYWORDS.some(kw => name.includes(kw));

    return !isBotName;
  });

  // Save to cache if this was a broad fetch (no query)
  if (!query) {
    dbOps.setConfig(CACHE_KEY, JSON.stringify(filtered));
    dbOps.setConfig(CACHE_TS_KEY, Date.now().toString());
  }

  return filtered;
}

/**
 * Fetches available transitions for an issue
 */
export async function fetchTransitions(issueKey: string): Promise<JiraTransition[]> {
  const url = `${getBaseUrl()}/issue/${issueKey}/transitions`;
  const response = await fetch(url, {
    headers: {
      Authorization: getAuthHeader(),
      Accept: "application/json",
      "User-Agent": "KelarCLI/1.0.0",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch transitions for ${issueKey}: ${response.status} ${errorText}`);
  }

  const data = await response.json() as { transitions: JiraTransition[] };
  return data.transitions;
}

/**
 * Transitions an issue to a new status
 */
export async function transitionIssue(issueKey: string, transitionId: string): Promise<void> {
  const url = `${getBaseUrl()}/issue/${issueKey}/transitions`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "KelarCLI/1.0.0",
    },
    body: JSON.stringify({
      transition: { id: transitionId }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to transition ${issueKey}: ${response.status} ${errorText}`);
  }

  clearTixCache();
}

/**
 * Updates the original estimate of an issue
 */
export async function updateIssueEstimate(issueKey: string, estimateSeconds: number): Promise<void> {
  const url = `${getBaseUrl()}/issue/${issueKey}`;
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "KelarCLI/1.0.0",
    },
    body: JSON.stringify({
      fields: {
        timetracking: {
          originalEstimate: `${Math.floor(estimateSeconds / 60)}m`
        }
      }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update estimate for ${issueKey}: ${response.status} ${errorText}`);
  }

  clearTixCache();
}

/**
 * Fetches active worklogs today to calculate context score
 */
export async function fetchActivityCountToday(): Promise<number> {
  // JQL for unique tickets worked on today by current user
  const jql = `worklogDate >= startOfDay() AND worklogAuthor = currentUser()`;
  const url = `${getBaseUrl()}/search`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
      "User-Agent": "KelarCLI/1.0.0",
    },
    body: JSON.stringify({
      jql,
      maxResults: 100,
      fields: ["key"]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch today's activity: ${response.status} ${errorText}`);
  }

  const data = await response.json() as { total: number };
  return data.total;
}

/**
 * Fetches all worklogs for a specific issue
 */
export async function fetchIssueWorklogs(issueIdOrKey: string): Promise<JiraWorklog[]> {
  let allWorklogs: JiraWorklog[] = [];
  let startAt = 0;
  const maxResults = 100;

  while (true) {
    const url = `${getBaseUrl()}/issue/${issueIdOrKey}/worklog?startAt=${startAt}&maxResults=${maxResults}`;
    const response = await fetch(url, {
      headers: {
        Authorization: getAuthHeader(),
        Accept: "application/json",
        "User-Agent": "KelarCLI/1.0.0",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch worklogs for ${issueIdOrKey}: ${response.status} ${errorText}`);
    }

    const data = await response.json() as { worklogs: JiraWorklog[], total: number };
    allWorklogs = [...allWorklogs, ...data.worklogs];

    if (allWorklogs.length >= data.total || data.worklogs.length < maxResults) {
      break;
    }
    startAt += maxResults;
  }

  return allWorklogs;
}

/**
 * Fetches all worklogs for a user in a given date range across all issues
 */
export async function fetchUserWorklogs(accountId: string, sinceDate: string): Promise<JiraWorklog[]> {
  const jql = `worklogAuthor = "${accountId}" AND worklogDate >= "${sinceDate.split("T")[0]}"`;
  const issues = await searchIssues(jql);

  const allWorklogs: JiraWorklog[] = [];
  const since = new Date(sinceDate);

  // Issues that might have more worklogs than the 20 returned by default in search
  const issuesToFetchMore: string[] = [];

  for (const issue of issues) {
    const wlData = issue.fields.worklog;
    if (wlData && Array.isArray(wlData.worklogs)) {
      // Add existing worklogs from search results
      wlData.worklogs.forEach((wl: JiraWorklog) => {
        const wlDate = new Date(wl.started);
        if (wl.author.accountId === accountId && wlDate >= since) {
          allWorklogs.push(wl);
        }
      });

      // Check if we need to fetch more
      const total = wlData.total || wlData.worklogs.length;
      const maxResults = wlData.maxResults || 20;

      if (total > maxResults) {
        issuesToFetchMore.push(issue.key);
      }
    } else {
      // Fallback if worklog field was missing surprisingly
      issuesToFetchMore.push(issue.key);
    }
  }

  if (issuesToFetchMore.length > 0) {
    // Fetch remaining worklogs in parallel
    const extraWorklogResults = await Promise.all(
      issuesToFetchMore.map(key => fetchIssueWorklogs(key))
    );

    extraWorklogResults.forEach(worklogs => {
      worklogs.forEach((wl: JiraWorklog) => {
        const wlDate = new Date(wl.started);
        // Only add if not already present (checking ID)
        if (wl.author.accountId === accountId && wlDate >= since && !allWorklogs.find(existing => existing.id === wl.id)) {
          allWorklogs.push(wl);
        }
      });
    });
  }

  return allWorklogs;
}
