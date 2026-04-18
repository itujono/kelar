import { getBitbucketConfig } from "./config";
import { queryClient } from "./queryClient";

export interface BitbucketUser {
  display_name: string;
  uuid: string;
  nickname?: string;
  account_id: string;
}

export interface BitbucketPR {
  id: number;
  title: string;
  description: string;
  state: "OPEN" | "MERGED" | "DECLINED" | "SUPERSEDED";
  author: BitbucketUser;
  source: {
    branch: {
      name: string;
    };
  };
  destination: {
    branch: {
      name: string;
    };
  };
  created_on: string;
  updated_on: string;
  links: {
    html: { href: string };
  };
  comment_count: number;
  task_count: number;
  participants?: {
    user: BitbucketUser;
    role: "REVIEWER" | "PARTICIPANT";
    approved: boolean;
    state: "null" | "approved" | "changes_requested";
  }[];
}


export interface BitbucketActivity {
  comment?: {
    id: number;
    user: BitbucketUser;
    created_on: string;
  };
  approval?: {
    user: BitbucketUser;
    date: string;
  };
  update?: {
    author: BitbucketUser;
    date: string;
  };
  pull_request: {
    id: number;
  };
}

export interface BitbucketTask {
  id: number;
  content: { raw: string };
  state: "OPEN" | "RESOLVED";
  creator: BitbucketUser;
}

export interface BitbucketStatus {
  key: string;
  state: "SUCCESSFUL" | "FAILED" | "INPROGRESS" | "STOPPED";
  name: string;
  url: string;
}

export interface BitbucketComment {
  id: number;
  content: { raw: string };
  user: BitbucketUser;
  created_on: string;
  updated_on: string;
  is_resolved: boolean;
  parent?: {
    id: number;
  };
  inline?: {
    path: string;
  };
}

const getAuthHeader = () => {
  const { BITBUCKET_EMAIL, BITBUCKET_TOKEN } = getBitbucketConfig();
  if (!BITBUCKET_EMAIL || !BITBUCKET_TOKEN) {
    throw new Error("Bitbucket configuration is missing (EMAIL or TOKEN).");
  }
  const credentials = Buffer.from(`${BITBUCKET_EMAIL}:${BITBUCKET_TOKEN}`).toString("base64");
  return `Basic ${credentials}`;
};



const getBaseUrl = () => {
  const { BITBUCKET_WORKSPACE, BITBUCKET_REPO_SLUG } = getBitbucketConfig();
  if (!BITBUCKET_WORKSPACE || !BITBUCKET_REPO_SLUG) {
    throw new Error("Bitbucket workspace or repository slug is missing.");
  }
  return `https://api.bitbucket.org/2.0/repositories/${BITBUCKET_WORKSPACE}/${BITBUCKET_REPO_SLUG}`;
};

export const fetchPRs = async (all = false): Promise<BitbucketPR[]> => {
  const { BITBUCKET_USERNAME } = getBitbucketConfig();
  const baseUrl = getBaseUrl();
  const url = new URL(`${baseUrl}/pullrequests`);

  // Use 'q' parameter for all filtering to ensure state and author checks are combined correctly
  let query = 'state="OPEN"';
  if (!all && BITBUCKET_USERNAME) {
    query = `(${query}) AND (author.nickname="${BITBUCKET_USERNAME}" OR author.username="${BITBUCKET_USERNAME}")`;
  }

  url.searchParams.append("q", query);
  url.searchParams.append("fields", "values.*,values.participants");

  const response = await fetch(url.toString(), {
    headers: { "Authorization": getAuthHeader() },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch PRs: ${response.statusText}`);
  }

  const data = await response.json() as { values?: BitbucketPR[] };
  const values = data.values || [];

  // Client-side safety filter
  return values.filter(pr => pr.state === "OPEN");
};



export const fetchPRActivity = async (prId: number): Promise<BitbucketActivity[]> => {
  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}/pullrequests/${prId}/activity`, {
    headers: { "Authorization": getAuthHeader() },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch activity: ${response.statusText}`);
  }

  const data = await response.json() as { values?: BitbucketActivity[] };
  return data.values || [];
};


export const fetchPRTasks = async (prId: number): Promise<BitbucketTask[]> => {
  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}/pullrequests/${prId}/tasks`, {
    headers: { "Authorization": getAuthHeader() },
  });

  if (!response.ok) return [];
  const data = await response.json() as { values?: BitbucketTask[] };
  return data.values || [];
};


export const fetchPRStatuses = async (prId: number): Promise<BitbucketStatus[]> => {
  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}/pullrequests/${prId}/statuses`, {
    headers: { "Authorization": getAuthHeader() },
  });

  if (!response.ok) return [];
  const data = await response.json() as { values?: BitbucketStatus[] };
  return data.values || [];
};

export const fetchMe = async (): Promise<BitbucketUser> => {
  const response = await fetch(`https://api.bitbucket.org/2.0/user`, {
    headers: { "Authorization": getAuthHeader() },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch current user: ${response.statusText}`);
  }

  return await response.json() as BitbucketUser;
};

export const fetchPRComments = async (prId: number): Promise<BitbucketComment[]> => {
  const baseUrl = getBaseUrl();
  const url = new URL(`${baseUrl}/pullrequests/${prId}/comments`);
  url.searchParams.append("fields", "values.*,values.parent.id");

  const response = await fetch(url.toString(), {
    headers: { "Authorization": getAuthHeader() },
  });

  if (!response.ok) return [];
  const data = await response.json() as { values?: BitbucketComment[] };
  return data.values || [];
};

export const calculateVelocity = (pr: BitbucketPR, activities: BitbucketActivity[]) => {
  const created = new Date(pr.created_on).getTime();
  const leadTime = Date.now() - created;

  // Find first interaction from someone other than author
  const interactions = activities
    .filter(a => {
      const actor = a.comment?.user || a.approval?.user;
      return actor && actor.account_id !== pr.author.account_id;
    })
    .map(a => new Date(a.comment?.created_on || a.approval?.date || 0).getTime())
    .filter(t => t > 0)
    .sort((a, b) => a - b);

  const firstInteraction = interactions[0];
  const pickupLatency = firstInteraction ? firstInteraction - created : null;

  return {
    leadTime,
    pickupLatency,
  };
};
