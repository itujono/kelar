import { type JiraAdfDoc } from "./jira";
import { formatDistanceToNow } from "date-fns";
import { type JiraIssue } from "./jira";

/**
 * Shortens relative time strings (e.g., "6 hours" -> "6h", "2 days" -> "2d")
 */
export function formatRelativeTime(date: Date): string {
  return formatDistanceToNow(date, { addSuffix: false })
    .replace(/about|almost|over/g, "")
    .replace(/less than a minute/g, "1m")
    .replace(/ minutes?/g, "m")
    .replace(/ hours?/g, "h")
    .replace(/ days?/g, "d")
    .replace(/ months?/g, "mo")
    .replace(/ years?/g, "y")
    .replace(/\s+/g, "");
}

/**
 * Parses a Jira-standard time string (e.g., "45m", "1h", "1h 30m", "1.5h") into total minutes.
 */
export function parseJiraTime(timeStr: string): number {
  const hoursMatch = timeStr.match(/([\d.]+)h/i);
  const minsMatch = timeStr.match(/([\d.]+)m/i);

  let totalMinutes = 0;

  if (hoursMatch) {
    totalMinutes += parseFloat(hoursMatch[1] || "0") * 60;
  }

  if (minsMatch) {
    totalMinutes += parseFloat(minsMatch[1] || "0");
  }

  if (!hoursMatch && !minsMatch) {
    // If it's just a number, assume minutes
    const numeric = parseFloat(timeStr);
    if (!isNaN(numeric)) {
      totalMinutes = numeric;
    }
  }

  return Math.round(totalMinutes);
}

/**
 * Rounds up minutes to the nearest 5-minute increment.
 * (e.g., 42m -> 45m, 31m -> 35m)
 */
export function roundToNearest5(minutes: number): number {
  if (minutes <= 0) return 0;
  return Math.ceil(minutes / 5) * 5;
}

/**
 * Formats minutes back to a duration string if needed (optional)
 */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || h === 0) parts.push(`${m}m`);

  return parts.join(' ');
}

/**
 * Regex for Jira Issue Keys (e.g., PROJ-123)
 */
export const JIRA_KEY_REGEX = /^[A-Z]+-\d+$/i;

/**
 * Get current timestamp in ISO with UTC+7 offset
 */
export function getNowWithOffset(): string {
  // Jira expects started string like "2021-01-17T12:34:00.000+0700"
  const now = new Date();

  // Shift date to UTC+7 for string representation if needed, 
  // but usually we just want the ISO string with the +07:00 at the end.
  // Bun's Date and Intl should handle this or we can use a helper.

  const pad = (n: number) => n.toString().padStart(2, '0');
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const min = pad(now.getMinutes());
  const ss = pad(now.getSeconds());

  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}.000+0700`;
}

/**
 * Recursively extracts plain text from Jira ADF (Atlassian Document Format).
 */
export function extractAdfText(doc: JiraAdfDoc | string | null | undefined): string {
  if (!doc) return "";
  if (typeof doc === "string") return doc;
  let text = "";
  if ("text" in doc && typeof doc.text === "string") text += doc.text;
  if (doc.content && Array.isArray(doc.content)) {
    for (const c of doc.content) {
      text += extractAdfText(c as JiraAdfDoc | string);
      if (c.type === "paragraph" || c.type === "heading") text += "\n";
    }
  }
  return text;
}

/**
 * Determines if a ticket is a "zombie" (stagnant).
 * A zombie is an In Progress ticket with no activity for > 48 hours,
 * excluding waiting stages like Review, QA, or Test.
 */
export function isZombieTicket(t: JiraIssue): boolean {
  if (!t) return false;
  
  const status = t.fields.status.name.toLowerCase();
  const category = t.fields.status.statusCategory.key;
  
  const isInProgress = category === "indeterminate";
  const isDone = category === "done";
  const isWaiting = status.includes("review") || status.includes("qa") || status.includes("test");
  const isTerminal = status.includes("done") || status.includes("closed") || status.includes("resolved") || status.includes("canceled");

  // Only In Progress tickets that aren't waiting or terminal can be zombies
  if (!isInProgress || isDone || isWaiting || isTerminal) return false;

  const comments = t.fields.comment?.comments || [];
  const worklogs = t.fields.worklog?.worklogs || [];

  const lastComment = comments[comments.length - 1];
  const lastCommentDate = lastComment ? new Date(lastComment.created).getTime() : 0;
    
  const lastWorklog = worklogs[worklogs.length - 1];
  const lastWorklogDate = lastWorklog ? new Date(lastWorklog.started).getTime() : 0;

  const lastActivity = Math.max(
    lastCommentDate,
    lastWorklogDate,
    new Date(t.fields.updated).getTime()
  );

  const fortyEightHoursAgo = Date.now() - (48 * 60 * 60 * 1000);
  return lastActivity < fortyEightHoursAgo;
}
