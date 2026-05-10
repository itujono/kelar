import { test, expect, describe } from "bun:test";
import {
  isBitbucketMe,
  calculateVelocity,
  calculatePRFeedbackMetrics,
  type BitbucketUser,
  type BitbucketPR,
  type BitbucketActivity,
  type BitbucketComment,
} from "../src/bitbucket";

const author: BitbucketUser = {
  display_name: "Alice Dev",
  uuid: "alice-uuid",
  account_id: "alice-account-id",
  nickname: "alicedev",
};

const reviewer: BitbucketUser = {
  display_name: "Bob Reviewer",
  uuid: "bob-uuid",
  account_id: "bob-account-id",
  nickname: "bobrev",
};

const makePR = (overrides?: Partial<BitbucketPR>): BitbucketPR => ({
  id: 123,
  title: "Test PR",
  description: "",
  state: "OPEN",
  author,
  source: { branch: { name: "feature" } },
  destination: { branch: { name: "main" } },
  created_on: new Date(Date.now() - 3600000).toISOString(),
  updated_on: new Date().toISOString(),
  links: { html: { href: "https://example.com" } },
  comment_count: 0,
  task_count: 0,
  ...overrides,
});

const makeComment = (
  id: number,
  user: BitbucketUser,
  overrides?: Partial<BitbucketComment>
): BitbucketComment => ({
  id,
  content: { raw: "comment" },
  user,
  created_on: new Date().toISOString(),
  updated_on: new Date().toISOString(),
  is_resolved: false,
  ...overrides,
});

describe("isBitbucketMe", () => {
  const config = (username: string | null = "alicedev") => ({
    BITBUCKET_EMAIL: "test@example.com" as string | null,
    BITBUCKET_USERNAME: (username ?? "alicedev") as string | null,
    BITBUCKET_TOKEN: "token123" as string | null,
    BITBUCKET_WORKSPACE: "ws" as string | null,
    BITBUCKET_REPO_SLUG: "repo" as string | null,
  });

  test("matches by account_id via meData", () => {
    expect(isBitbucketMe(author, config(), { ...author })).toBe(true);
  });

  test("matches by nickname via meData", () => {
    const meData: BitbucketUser = {
      display_name: "Alice Dev",
      uuid: "alice-uuid",
      account_id: "different-id",
      nickname: "alicedev",
    };
    expect(isBitbucketMe(author, config(), meData)).toBe(true);
  });

  test("matches by display_name against config username", () => {
    expect(isBitbucketMe(author, config("Alice Dev"), undefined)).toBe(true);
  });

  test("matches by nickname against config username", () => {
    expect(isBitbucketMe(author, config("alicedev"), undefined)).toBe(true);
  });

  test("matches by email handle against display_name", () => {
    expect(isBitbucketMe(author, config("alicedev@company.com"), undefined)).toBe(true);
  });

  test("matches by account_id against config username", () => {
    expect(isBitbucketMe(author, config("alice-account-id"), undefined)).toBe(true);
  });

  test("does not match when all fields differ", () => {
    expect(isBitbucketMe(reviewer, config(), undefined)).toBe(false);
  });

  test("returns false when config username is null", () => {
    expect(isBitbucketMe(reviewer, config(null), undefined)).toBe(false);
  });

  test("meData match takes precedence over config", () => {
    const meData = { ...author, nickname: "me-nick" };
    expect(isBitbucketMe(author, config("other-user"), meData)).toBe(true);
  });
});

describe("calculateVelocity", () => {
  test("returns leadTime as positive number", () => {
    const pr = makePR();
    const velocity = calculateVelocity(pr, []);
    expect(velocity.leadTime).toBeGreaterThan(0);
    expect(velocity.pickupLatency).toBeNull();
  });

  test("pickupLatency from non-author approval activity", () => {
    const pr = makePR();
    const approvalTime = new Date(Date.now() - 1800000).toISOString();
    const activities: BitbucketActivity[] = [
      {
        approval: { user: reviewer, date: approvalTime },
        pull_request: { id: pr.id },
      },
    ];
    const velocity = calculateVelocity(pr, activities);
    expect(velocity.pickupLatency).toBeGreaterThan(0);
    expect(velocity.pickupLatency).toBeLessThanOrEqual(velocity.leadTime);
  });

  test("pickupLatency from non-author comment activity", () => {
    const pr = makePR();
    const commentTime = new Date(Date.now() - 900000).toISOString();
    const activities: BitbucketActivity[] = [
      {
        comment: { id: 1, user: reviewer, created_on: commentTime },
        pull_request: { id: pr.id },
      },
    ];
    const velocity = calculateVelocity(pr, activities);
    expect(velocity.pickupLatency).toBeGreaterThan(0);
  });

  test("null pickupLatency when no non-author interactions", () => {
    const pr = makePR();
    const activities: BitbucketActivity[] = [
      {
        comment: { id: 1, user: author, created_on: new Date().toISOString() },
        pull_request: { id: pr.id },
      },
    ];
    const velocity = calculateVelocity(pr, activities);
    expect(velocity.pickupLatency).toBeNull();
  });

  test("uses earliest non-author interaction for pickupLatency", () => {
    const pr = makePR();
    const earlier = new Date(Date.now() - 3600000).toISOString();
    const later = new Date(Date.now() - 1800000).toISOString();
    const activities: BitbucketActivity[] = [
      {
        comment: { id: 1, user: reviewer, created_on: later },
        pull_request: { id: pr.id },
      },
      {
        comment: { id: 2, user: reviewer, created_on: earlier },
        pull_request: { id: pr.id },
      },
    ];
    const velocity = calculateVelocity(pr, activities);
    const expectedLatency =
      new Date(earlier).getTime() - new Date(pr.created_on).getTime();
    expect(velocity.pickupLatency).toBe(expectedLatency);
  });
});

describe("calculatePRFeedbackMetrics", () => {
  test("counts feedback from non-authors", () => {
    const pr = makePR();
    const comments = [1, 2, 3, 4, 5].map((id) => makeComment(id, reviewer));
    expect(calculatePRFeedbackMetrics(pr, comments)).toEqual({
      fb: 5,
      nr: 5,
    });
  });

  test("resolved peer comment contributes to fb but not nr", () => {
    const pr = makePR();
    const comments = [
      makeComment(1, reviewer, { is_resolved: true }),
      makeComment(2, reviewer),
    ];
    expect(calculatePRFeedbackMetrics(pr, comments)).toEqual({
      fb: 2,
      nr: 1,
    });
  });

  test("does not count peer feedback as nr after author replies", () => {
    const pr = makePR();
    const comments = [
      makeComment(1, reviewer),
      makeComment(2, author, { parent: { id: 1 } }),
      makeComment(3, reviewer),
    ];
    expect(calculatePRFeedbackMetrics(pr, comments)).toEqual({
      fb: 2,
      nr: 1,
    });
  });

  test("excludes author comments from feedback counts", () => {
    const pr = makePR();
    const comments = [
      makeComment(1, author),
      makeComment(2, author),
      makeComment(3, reviewer),
    ];
    expect(calculatePRFeedbackMetrics(pr, comments)).toEqual({
      fb: 1,
      nr: 1,
    });
  });

  test("empty comments returns zeros", () => {
    const pr = makePR();
    expect(calculatePRFeedbackMetrics(pr, [])).toEqual({ fb: 0, nr: 0 });
  });
});
