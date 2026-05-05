import { getBaseUrl, jiraHeaders, validateJiraWorklog } from "./client";
import { clearTixCache } from "./cache";
import { searchIssues } from "./issues";
import type { JiraWorklog, FetchWorklogsResult } from "./types";

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
    started,
    timeSpentSeconds: minutes * 60,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { ...jiraHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to post worklog.\nURL: ${url}\nStatus: ${response.status}\nResponse: ${errorText}`);
  }

  const result = await response.json();
  const worklog = validateJiraWorklog(result);
  clearTixCache();
  return worklog;
}

export async function fetchIssueWorklogs(issueIdOrKey: string): Promise<JiraWorklog[]> {
  let allWorklogs: JiraWorklog[] = [];
  let startAt = 0;
  const maxResults = 100;

  while (true) {
    const url = `${getBaseUrl()}/issue/${issueIdOrKey}/worklog?startAt=${startAt}&maxResults=${maxResults}`;
    const response = await fetch(url, {
      headers: jiraHeaders(),
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

export async function fetchUserWorklogs(accountId: string, sinceDate: string): Promise<FetchWorklogsResult> {
  const jql = `worklogAuthor = "${accountId}" AND worklogDate >= "${sinceDate.split("T")[0]}"`;
  const issues = await searchIssues(jql);

  const allWorklogs: JiraWorklog[] = [];
  const seenIds = new Set<string>();
  const warnings: string[] = [];
  const since = new Date(sinceDate);

  function addWorklog(wl: JiraWorklog) {
    const wlDate = new Date(wl.started);
    if (wl.author.accountId === accountId && wlDate >= since && !seenIds.has(wl.id)) {
      seenIds.add(wl.id);
      allWorklogs.push(wl);
    }
  }

  const issuesToFetchMore: string[] = [];

  for (const issue of issues) {
    const wlData = issue.fields.worklog;
    if (wlData && Array.isArray(wlData.worklogs)) {
      wlData.worklogs.forEach(addWorklog);

      const total = wlData.total || wlData.worklogs.length;
      const maxResults = wlData.maxResults || 20;

      if (total > maxResults) {
        issuesToFetchMore.push(issue.key);
      }
    } else {
      issuesToFetchMore.push(issue.key);
    }
  }

  if (issuesToFetchMore.length > 0) {
    const extraWorklogResults = await Promise.allSettled(
      issuesToFetchMore.map(key => fetchIssueWorklogs(key))
    );

    extraWorklogResults.forEach((result, i) => {
      if (result.status === "fulfilled") {
        result.value.forEach(addWorklog);
      } else {
        const issueKey = issuesToFetchMore[i];
        warnings.push(`Failed to fetch worklogs for ${issueKey}: ${result.reason}`);
      }
    });
  }

  return { worklogs: allWorklogs, warnings };
}
