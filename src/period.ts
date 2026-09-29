import { TZDate } from "@date-fns/tz";
import { format, startOfWeek, startOfMonth, startOfDay, subDays, setDate, addMonths, differenceInCalendarDays } from "date-fns";

export type PeriodType = "day" | "yesterday" | "week" | "month";

/**
 * Period bounds computed in the Jira profile timezone, which is what JQL `worklogDate`
 * and the Jira UI use to decide which day a worklog belongs to. `until` is exclusive;
 * open-ended periods run up to now.
 */
export function getPeriodRange(period: PeriodType, timeZone: string, now: Date = new Date()): { since: Date; until?: Date } {
  const zonedNow = new TZDate(now, timeZone);
  const toDate = (d: TZDate) => new Date(d.getTime());
  switch (period) {
    case "yesterday": return { since: toDate(startOfDay(subDays(zonedNow, 1))), until: toDate(startOfDay(zonedNow)) };
    case "week": return { since: toDate(startOfWeek(zonedNow, { weekStartsOn: 1 })) };
    case "month": return { since: toDate(startOfMonth(zonedNow)) };
    default: return { since: toDate(startOfDay(zonedNow)) };
  }
}

/**
 * Formats a moment as a JQL date ("yyyy-MM-dd"), which Jira reads in the profile timezone.
 */
export function toJqlDate(date: Date, timeZone: string): string {
  return format(new TZDate(date, timeZone), "yyyy-MM-dd");
}

/**
 * Calendar days until the next occurrence of `calculationDay`, counted in the given timezone.
 */
export function getDaysUntilCalculationDay(calculationDay: number, timeZone: string, now: Date = new Date()): number {
  const zonedNow = new TZDate(now, timeZone);
  let targetDate = setDate(zonedNow, calculationDay);
  if (zonedNow.getDate() > calculationDay) {
    targetDate = addMonths(targetDate, 1);
  }
  return differenceInCalendarDays(targetDate, zonedNow);
}
