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

export interface FetchWorklogsResult {
  worklogs: JiraWorklog[];
  warnings: string[];
}
