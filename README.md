# Kelar CLI 🍗

**Kelar** is a fast, terminal-based Jira and Bitbucket manager built with **Bun**, **TypeScript**, and **Ink**. It provides a premium TUI (Terminal User Interface) to manage your productivity, tracking worklogs and pull request health with real-time analytics.

## Features

- **Jira Work Logs**: Smart time parsing (`1h 30m`), automatic rounding, and monthly goal tracking.
- **Bitbucket PR Observability**: Track pull requests, approvals, feedback cycles, and velocity metrics directly in the terminal.
- **Intelligent Sync & Mirror**: Maintains a local SQLite database (`~/.kelar/kelar.db`) with smart caching.
- **Capture Mode**: Generate high-fidelity HTML dashboards for your work progress.
- **Privacy First**: All credentials and data stay on your machine in a local SQLite database.

## Installation

1.  **Clone the repository**.
2.  **Install dependencies**:
    ```bash
    bun install
    ```
3.  **Link the binary**:
    ```bash
    bun link
    ```
    *Now you can use the `kelar` command from anywhere.*

## Configuration

### Work Logs (Jira)
```bash
kelar log config set JIRA_DOMAIN your-domain.atlassian.net
kelar log config set JIRA_EMAIL your@email.com
kelar log config set JIRA_TOKEN your_api_token
kelar log config set JIRA_ACCOUNT_ID your_jira_account_id
kelar log config set PERSONAL_TICKET_ID IMM-123  # Target for personal work strings
kelar log config set MONTHLY_TARGET_HOURS 180    # Your monthly hours quota
kelar log config set LAST_CALCULATION_DAY 25     # Deadline day each month
```

### Pull Requests (Bitbucket)
```bash
kelar pr config set BITBUCKET_EMAIL your@email.com
kelar pr config set BITBUCKET_TOKEN your_atlassian_api_token
kelar pr config set BITBUCKET_WORKSPACE workspace-slug
kelar pr config set BITBUCKET_REPO_SLUG repo-slug
kelar pr config set BITBUCKET_USERNAME your_username  # For "MINE" filter
```

## Usage

### Work Logs

#### Logging New Work
```bash
# Log with a comment
kelar log new IMM-123 '1h 30m' "Refactoring the API"

# Log without a comment (It will prompt you!)
kelar log new IMM-123 45m
```

#### Viewing Summaries
```bash
# Available periods: day, week, month
kelar log view month
```
- **Goal Tracking**: Shows progress bars, deadline countdowns, and percentages.
- **Interactive Filtering**: Press **`/`** to filter by ticket, summary, or type.

#### Capturing Reports
```bash
kelar log capture month
```
Generates a styled `kelar-report-month-YYYY-MM-DD.html` file for sharing with management.

### Pull Requests

The `pr` command provides a real-time view of your team's code review status.

```bash
# View your active PRs
kelar pr list

# View all open PRs in the repository
kelar pr list --all
```

#### Dual-Pane Dashboard
- **Table View**: Browse PRs with relative timestamps (`~ 2 hours`), approval counts, and health metrics (`FB` for comments, `UN` for open tasks). Includes a personal **"Me"** column tracking your approval status on team PRs.
- **Detail Pane**: Get a deep-dive into the selected PR:
    - **Velocity Metrics**: Track **Lead Time** and **Pick-up Latency** (time to first peer interaction).
    - **Reviewer Status**: See who has approved (`✓`) vs. who is still pending (`○`).
    - **Peer Feedback**: Detailed breakdown of **Resolved** vs. **Unresolved** comments from your peers.
- **Interactive Controls**:
    - **`↑/↓`**: Navigate the list.
    - **`/`**: Enter **Filter Mode** to search by Title, Branch, or ID.
    - **`s`**: Open **Sort Menu** (Newest, Oldest, Lead Time, Pickup Latency).
    - **`o`**: Instantly **Open** the PR in your default browser.
    - **`c`**: **Copy** the source branch name to your clipboard.
    - **`r`**: **Refetch** latest data from Bitbucket.


## Data Storage & Security

- **Local Database**: All worklogs and configuration (including your tokens) are stored in `~/.kelar/kelar.db`.
- **Safe for Contribution**: Data is stored outside the project folder, so you can safely push code without leaking secrets.
- **Privacy**: No data is shared outside of your machine and your designated Atlassian domains.

## Technical Details

- **Runtime**: Bun
- **UI Engine**: Ink-based flexbox layouts
- **Database**: SQLite (via `bun:sqlite`)
- **API**: Jira Cloud & Bitbucket Cloud REST APIs (v3/v2)
- **Timezone**: Syncs using a fixed `+0700` offset.
