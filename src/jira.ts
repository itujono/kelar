import { getAppConfig } from "./config";
import { Buffer } from "node:buffer";

export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    assignee: {
      accountId: string;
      displayName: string;
    } | null;
  };
}

export interface JiraComment {
  content: {
    content: {
      text: string;
      type: string;
    }[];
    type: string;
  }[];
  type: string;
  version: number;
}

export interface JiraWorklog {
  id: string;
  comment: JiraComment | null;
  started: string;
  timeSpentSeconds: number;
  author: {
    accountId: string;
    displayName: string;
  };
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
    const errorText = await response.text();
    throw new Error(`Failed to fetch issue details.
URL: ${url}
Status: ${response.status}
Response: ${errorText}`);
  }

  return response.json() as Promise<JiraIssue>;
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

  return response.json() as Promise<JiraWorklog>;
}

/**
 * Searches for issues using JQL
 */
export async function searchIssues(jql: string): Promise<JiraIssue[]> {
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
      fields: ["summary", "assignee"]
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`JQL Search failed: ${response.status} ${errorText}`);
  }

  const data = await response.json() as { issues: JiraIssue[] };
  return data.issues;
}

/**
 * Fetches all worklogs for a specific issue
 */
export async function fetchIssueWorklogs(issueIdOrKey: string): Promise<JiraWorklog[]> {
  const url = `${getBaseUrl()}/issue/${issueIdOrKey}/worklog`;
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

  const data = await response.json() as { worklogs: JiraWorklog[] };
  return data.worklogs;
}
