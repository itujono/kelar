import { createHash } from "node:crypto";
import { dbOps } from "../db";
import { getBaseUrl, jiraHeaders, validateJiraIssue } from "./client";
import { clearTixCache } from "./cache";
import type { JiraIssue, JiraTransition } from "./types";

export async function fetchIssueDetails(issueKey: string): Promise<JiraIssue> {
  const url = `${getBaseUrl()}/issue/${issueKey}`;
  const response = await fetch(url, {
    headers: jiraHeaders(),
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Ticket "${issueKey}" not found. Please check the key and try again.`);
    }

    const errorText = await response.text();
    throw new Error(`Failed to fetch issue details (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return validateJiraIssue(data);
}

export async function searchIssues(jql: string, maxResults: number = 100): Promise<JiraIssue[]> {
  // Hash the full JQL: a truncated prefix makes queries that only differ in their date clauses share an entry
  const CACHE_KEY = `TIX_CACHE_V4_${createHash("sha1").update(jql).digest("hex")}_${maxResults}`;
  const CACHE_TS_KEY = `${CACHE_KEY}_TS`;
  const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

  const cachedData = dbOps.getConfig(CACHE_KEY);
  const cachedTs = dbOps.getConfig(CACHE_TS_KEY);

  if (cachedData && cachedTs) {
    const ts = parseInt(cachedTs, 10);
    if (Date.now() - ts < CACHE_DURATION) {
      try {
        const parsed = JSON.parse(cachedData);
        if (Array.isArray(parsed) && parsed.every(item => item && typeof item.id === "string" && item.fields)) {
          return parsed as JiraIssue[];
        }
      } catch {
        // Invalid cache — fall through to fetch
      }
      dbOps.deleteConfigLike(CACHE_KEY);
    }
  }

  const url = `${getBaseUrl()}/search/jql`;
  const response = await fetch(url, {
    method: "POST",
    headers: { ...jiraHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      jql,
      maxResults,
      fields: [
        "summary", "assignee", "status", "priority",
        "timeoriginalestimate", "timespent", "created", "updated",
        "comment", "worklog", "issuelinks", "description", "project", "reporter"
      ]
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`JQL Search failed: ${response.status} ${errorText}`);
  }

  const data = await response.json() as { issues: JiraIssue[] };
  const issues = (data.issues || []).map(validateJiraIssue);

  dbOps.setConfig(CACHE_KEY, JSON.stringify(issues));
  dbOps.setConfig(CACHE_TS_KEY, Date.now().toString());

  return issues;
}

export async function fetchTransitions(issueKey: string): Promise<JiraTransition[]> {
  const url = `${getBaseUrl()}/issue/${issueKey}/transitions`;
  const response = await fetch(url, {
    headers: jiraHeaders(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch transitions for ${issueKey}: ${response.status} ${errorText}`);
  }

  const data = await response.json() as { transitions: JiraTransition[] };
  return data.transitions;
}

export async function transitionIssue(issueKey: string, transitionId: string): Promise<void> {
  const url = `${getBaseUrl()}/issue/${issueKey}/transitions`;
  const response = await fetch(url, {
    method: "POST",
    headers: { ...jiraHeaders(), "Content-Type": "application/json" },
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

export async function updateIssueEstimate(issueKey: string, estimateSeconds: number): Promise<void> {
  const url = `${getBaseUrl()}/issue/${issueKey}`;
  const response = await fetch(url, {
    method: "PUT",
    headers: { ...jiraHeaders(), "Content-Type": "application/json" },
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

export async function fetchActivityCountToday(): Promise<number> {
  const jql = `worklogDate >= startOfDay() AND worklogAuthor = currentUser()`;
  const url = `${getBaseUrl()}/search`;
  const response = await fetch(url, {
    method: "POST",
    headers: { ...jiraHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
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
