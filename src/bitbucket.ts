import { getBitbucketConfig } from "./config";

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

let cachedAuthHeader: string | null = null;
let cachedAuthSig: string | null = null;
let cachedBaseUrl: string | null = null;
let cachedBaseUrlSig: string | null = null;

const getAuthHeader = () => {
  const { BITBUCKET_EMAIL, BITBUCKET_TOKEN } = getBitbucketConfig();
  if (!BITBUCKET_EMAIL || !BITBUCKET_TOKEN) {
    throw new Error("Bitbucket configuration is missing (EMAIL or TOKEN).");
  }
  const sig = `${BITBUCKET_EMAIL}:${BITBUCKET_TOKEN}`;
  if (cachedAuthHeader && cachedAuthSig === sig) {
    return cachedAuthHeader;
  }
  const credentials = Buffer.from(`${BITBUCKET_EMAIL}:${BITBUCKET_TOKEN}`).toString("base64");
  cachedAuthHeader = `Basic ${credentials}`;
  cachedAuthSig = sig;
  return cachedAuthHeader;
};

const getBaseUrl = () => {
  const { BITBUCKET_WORKSPACE, BITBUCKET_REPO_SLUG } = getBitbucketConfig();
  if (!BITBUCKET_WORKSPACE || !BITBUCKET_REPO_SLUG) {
    throw new Error("Bitbucket workspace or repository slug is missing.");
  }
  const sig = `${BITBUCKET_WORKSPACE}:${BITBUCKET_REPO_SLUG}`;
  if (cachedBaseUrl && cachedBaseUrlSig === sig) {
    return cachedBaseUrl;
  }
  cachedBaseUrl = `https://api.bitbucket.org/2.0/repositories/${BITBUCKET_WORKSPACE}/${BITBUCKET_REPO_SLUG}`;
  cachedBaseUrlSig = sig;
  return cachedBaseUrl;
};

const BB_HEADERS = { "Authorization": "" as string };

function bbHeaders(): Record<string, string> {
  return { "Authorization": getAuthHeader() };
}

export function isBitbucketMe(user: BitbucketUser, config: ReturnType<typeof getBitbucketConfig>, meData?: BitbucketUser): boolean {
  if (meData) {
    if (meData.account_id && user.account_id?.toLowerCase() === meData.account_id.toLowerCase()) return true;
    if (meData.nickname && user.nickname?.toLowerCase() === meData.nickname.toLowerCase()) return true;
  }

  const myUsername = config.BITBUCKET_USERNAME?.toLowerCase().trim();
  const myHandle = myUsername?.includes("@") ? myUsername.split("@")[0] : myUsername;
  const nick = user.nickname?.toLowerCase().trim();
  const display = user.display_name?.toLowerCase().trim();
  const account = user.account_id?.toLowerCase().trim();

  return (
    nick === myUsername ||
    nick === myHandle ||
    display === myUsername ||
    (myUsername && display?.includes(myUsername)) ||
    (myHandle && display?.includes(myHandle)) ||
    account === myUsername ||
    account === myHandle
  );
}

export const fetchPRs = async (all = false): Promise<BitbucketPR[]> => {
  const { BITBUCKET_USERNAME } = getBitbucketConfig();
  const baseUrl = getBaseUrl();
  let allPRs: BitbucketPR[] = [];

  const initialUrl = new URL(`${baseUrl}/pullrequests`);
  let query = 'state="OPEN"';
  if (!all && BITBUCKET_USERNAME) {
    query = `(${query}) AND (author.nickname="${BITBUCKET_USERNAME}" OR author.username="${BITBUCKET_USERNAME}")`;
  }
  initialUrl.searchParams.append("q", query);
  initialUrl.searchParams.append("fields", "values.*,values.participants,next");

  let nextUrl: string | null = initialUrl.toString();

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: bbHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch PRs: ${response.statusText}`);
    }

    const data = await response.json() as { values?: BitbucketPR[]; next?: string };
    allPRs = [...allPRs, ...(data.values || [])];
    nextUrl = data.next || null;
  }

  // Client-side safety filter
  return allPRs.filter(pr => pr.state === "OPEN");
};



export const fetchPRActivity = async (prId: number): Promise<BitbucketActivity[]> => {
  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}/pullrequests/${prId}/activity`, {
    headers: bbHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch activity: ${response.statusText}`);
  }

  const data = await response.json() as { values?: BitbucketActivity[] };
  return data.values || [];
};

export const fetchMe = async (): Promise<BitbucketUser> => {
  const response = await fetch(`https://api.bitbucket.org/2.0/user`, {
    headers: bbHeaders(),
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
    headers: bbHeaders(),
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
