import { getAppConfig } from "../config";
import { Buffer } from "node:buffer";
import type { JiraIssue, JiraWorklog } from "./types";

let cachedAuthHeader: string | null = null;
let cachedAuthConfigSig: string | null = null;
let cachedBaseUrl: string | null = null;
let cachedBaseUrlSig: string | null = null;

function getConfigSignature(email: string, token: string, domain: string): string {
  return `${email}:${token}:${domain}`;
}

function getAuthHeader() {
  const config = getAppConfig();
  if (!config.JIRA_EMAIL || !config.JIRA_TOKEN) {
    throw new Error("Jira credentials not configured.");
  }
  const sig = getConfigSignature(config.JIRA_EMAIL, config.JIRA_TOKEN, config.JIRA_DOMAIN || "");
  if (cachedAuthHeader && cachedAuthConfigSig === sig) {
    return cachedAuthHeader;
  }
  const email = config.JIRA_EMAIL.trim();
  const token = config.JIRA_TOKEN.trim();
  cachedAuthHeader = `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;
  cachedAuthConfigSig = sig;
  return cachedAuthHeader;
}

export function getBaseUrl() {
  const config = getAppConfig();
  if (!config.JIRA_DOMAIN) {
    throw new Error("Jira domain not configured.");
  }
  const domain = config.JIRA_DOMAIN.replace(/^https?:\/\//, '').replace(/\/$/, '').trim();
  if (cachedBaseUrl && cachedBaseUrlSig === domain) {
    return cachedBaseUrl;
  }
  cachedBaseUrl = `https://${domain}/rest/api/3`;
  cachedBaseUrlSig = domain;
  return cachedBaseUrl;
}

const JIRA_HEADERS = {
  Authorization: "" as string,
  Accept: "application/json",
  "User-Agent": "KelarCLI/1.0.0",
};

export function jiraHeaders(): Record<string, string> {
  return { ...JIRA_HEADERS, Authorization: getAuthHeader() };
}

export function assertObject(val: unknown, context: string): asserts val is Record<string, unknown> {
  if (typeof val !== "object" || val === null || Array.isArray(val)) {
    const actual = val === null ? "null" : Array.isArray(val) ? "array" : typeof val;
    throw new Error(`Unexpected API response: expected object, got ${actual} (${context})`);
  }
}

export function validateJiraIssue(data: unknown): JiraIssue {
  assertObject(data, "JiraIssue");
  const fields = data.fields;
  assertObject(fields, "JiraIssue.fields");
  const status = fields.status;
  assertObject(status, "JiraIssue.fields.status");
  const statusCategory = status.statusCategory;
  assertObject(statusCategory, "JiraIssue.fields.status.statusCategory");
  return data as unknown as JiraIssue;
}

export function validateJiraWorklog(data: unknown): JiraWorklog {
  assertObject(data, "JiraWorklog");
  if (typeof data.id !== "string" || typeof data.timeSpentSeconds !== "number") {
    throw new Error("Unexpected worklog format from API");
  }
  return data as unknown as JiraWorklog;
}
