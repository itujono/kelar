import { format } from "date-fns";
import { formatMinutes } from "./utils";

export function generateHtmlReport(
    logs: any[],
    period: string,
    targetHours: number,
    calculationDay: number,
    daysRemaining: number,
    totalMinutesAll: number,
    personalCount: number
) {
    const percentage = ((totalMinutesAll / (targetHours * 60)) * 100).toFixed(1);
    const progressRatio = Math.min(1, totalMinutesAll / (targetHours * 60));
    const dateStr = format(new Date(), "PPpp");

    const rows = logs.map(log => `
    <tr>
      <td>${format(new Date(log.created_at), "dd MMM")}</td>
      <td><span class="badge ${log.is_jira ? 'jira' : 'personal'}">${log.is_jira ? 'Jira' : 'Personal'}</span></td>
      <td class="identifier">${log.identifier}</td>
      <td class="label">${log.label || ""}</td>
      <td class="time">${formatMinutes(log.minutes)}</td>
    </tr>
  `).join("");

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kelar Worklog Report - ${period.toUpperCase()}</title>
    <style>
        :root {
            --bg: #0d1117;
            --surface: #161b22;
            --border: #30363d;
            --text: #c9d1d9;
            --text-dim: #8b949e;
            --cyan: #58a6ff;
            --magenta: #ff79c6;
            --yellow: #f1e05a;
            --green: #3fb950;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--bg);
            color: var(--text);
            margin: 0;
            padding: 40px;
            display: flex;
            justify-content: center;
        }
        .container {
            width: 100%;
            max-width: 900px;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 32px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
        }
        header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 32px;
        }
        h1 {
            margin: 0;
            font-size: 24px;
            color: var(--cyan);
            letter-spacing: -0.5px;
        }
        .meta {
            font-size: 13px;
            color: var(--text-dim);
            margin-top: 4px;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 32px;
        }
        .stat-card {
            background: rgba(255,255,255,0.03);
            border: 1px solid var(--border);
            padding: 16px;
            border-radius: 8px;
        }
        .stat-label {
            font-size: 12px;
            text-transform: uppercase;
            color: var(--text-dim);
            margin-bottom: 8px;
            font-weight: 600;
        }
        .stat-value {
            font-size: 20px;
            font-weight: 700;
            color: var(--text);
        }
        .progress-section {
            margin-bottom: 32px;
        }
        .progress-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 12px;
            font-size: 14px;
        }
        .progress-bar-bg {
            height: 12px;
            background: #21262d;
            border-radius: 6px;
            overflow: hidden;
            display: flex;
        }
        .progress-bar-fill {
            height: 100%;
            background: var(--magenta);
            border-radius: 6px;
            width: ${percentage}%;
            transition: width 1s ease;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
        }
        th {
            text-align: left;
            border-bottom: 1px solid var(--border);
            padding: 12px 8px;
            color: var(--text-dim);
            font-weight: 500;
            text-transform: uppercase;
            font-size: 11px;
        }
        td {
            padding: 12px 8px;
            border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .badge {
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
        }
        .badge.jira { background: rgba(88, 166, 255, 0.1); color: var(--cyan); }
        .badge.personal { background: rgba(63, 185, 80, 0.1); color: var(--green); }
        .identifier { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; color: var(--cyan); font-weight: 600; }
        .time { font-weight: 600; color: var(--yellow); text-align: right; }
        .label { color: var(--text); }
        footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid var(--border);
            font-size: 12px;
            color: var(--text-dim);
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div>
                <h1>Kelar Log Summary: ${period.toUpperCase()}</h1>
                <div class="meta">Generated on ${dateStr}</div>
            </div>
            <div style="text-align: right">
                <div style="font-size: 24px; font-weight: 800; color: var(--text)">${percentage}%</div>
                <div class="meta">Goal Status</div>
            </div>
        </header>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Grand Total</div>
                <div class="stat-value">${formatMinutes(totalMinutesAll)}</div>
                <div class="meta">${totalMinutesAll}m logged</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Entries Found</div>
                <div class="stat-value">${logs.length}</div>
                <div class="meta">${personalCount} personal items</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Monthly Goal</div>
                <div class="stat-value">${targetHours} Hours</div>
                <div class="meta">Through the ${calculationDay}th</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Time Remaining</div>
                <div class="stat-value">${daysRemaining} Days</div>
                <div class="meta">Until deadline</div>
            </div>
        </div>

        <div class="progress-section">
            <div class="progress-header">
                <span style="font-weight: 600">Goal Completion</span>
                <span>${percentage}% of ${targetHours}h</span>
            </div>
            <div class="progress-bar-bg">
                <div class="progress-bar-fill"></div>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th width="80">Date</th>
                    <th width="100">Type</th>
                    <th width="120">ID</th>
                    <th>Task / Description</th>
                    <th width="100" style="text-align: right">Time</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>

        <footer>
            Generated by Kelar CLI &bull; Keep it focused, keep it productive.
        </footer>
    </div>
</body>
</html>
  `;
}
