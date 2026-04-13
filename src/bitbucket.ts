import { getBitbucketConfig } from "./config";
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

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
  participants: {
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

const getAuthHeader = () => {
  const { BITBUCKET_USERNAME, BITBUCKET_APP_PASSWORD } = getBitbucketConfig();
  if (!BITBUCKET_USERNAME || !BITBUCKET_APP_PASSWORD) {
    throw new Error("Bitbucket configuration is missing.");
  }
  const credentials = Buffer.from(`${BITBUCKET_USERNAME}:${BITBUCKET_APP_PASSWORD}`).toString("base64");
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
  url.searchParams.append("state", "OPEN");
  
  // Bitbucket API filtering can be complex, for simplicity we'll fetch then filter or use 'q' parameter if possible.
  if (!all && BITBUCKET_USERNAME) {
     url.searchParams.append("q", `author.nickname="${BITBUCKET_USERNAME}" OR author.username="${BITBUCKET_USERNAME}"`);
  }

  const response = await fetch(url.toString(), {
    headers: { "Authorization": getAuthHeader() },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch PRs: ${response.statusText}`);
  }

  const data = await response.json() as { values?: BitbucketPR[] };
  return data.values || [];
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
