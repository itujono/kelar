import { getAppConfig } from "./config";

export interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    assignee: {
      accountId: string;
      displayName: string;
    } | null;
  };
}

function getAuthHeader() {
  const config = getAppConfig();
  if (!config.JIRA_EMAIL || !config.JIRA_TOKEN) {
    throw new Error("Jira credentials not configured.");
  }
  const auth = Buffer.from(`${config.JIRA_EMAIL}:${config.JIRA_TOKEN}`).toString("base64");
  return `Basic ${auth}`;
}

function getBaseUrl() {
  const config = getAppConfig();
  if (!config.JIRA_DOMAIN) {
    throw new Error("Jira domain not configured.");
  }
  return `https://${config.JIRA_DOMAIN}/rest/api/3`;
}

export async function fetchIssueDetails(issueKey: string): Promise<JiraIssue> {
  const url = `${getBaseUrl()}/issue/${issueKey}`;
  const response = await fetch(url, {
    headers: {
      Authorization: getAuthHeader(),
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch issue ${issueKey}: ${response.status} ${errorText}`);
  }

  return response.json() as Promise<JiraIssue>;
}

export async function postWorklog(issueKey: string, minutes: number, comment: string, started: string) {
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
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to post worklog to ${issueKey}: ${response.status} ${errorText}`);
  }

  return response.json();
}
