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
kelar pr config set BITBUCKET_USERNAME your_username  # For identifying your work, approvals, and replies
```

### Tickets (Jira)
The `tix` module shares the same configuration as the **Work Logs** module. If you've already configured your Jira domain, email, and token above, you're all set!

> [!TIP]
> **Identity Discovery**: Kelar automatically fetches your canonical Bitbucket profile (nickname, account ID) to ensure your approvals and replies are correctly identified, even if your login username differs from your display name.

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
kelar log list month
```
- Shows progress bars, deadline countdowns, and percentages.
- Interactive Controls:
    - **`↑/↓`**: Navigate logs.
    - **`/`**: Real-time filtering.
    - **`p`**: Quickly switch period (**Today**, **This Week**, **This Month**).
    - **`s`**: Open **Sort Menu** (Newest, Oldest, Longest, Shortest).

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

#### Table View
- All list views (Logs, Tickets, PRs) utilize a standardized, high-fidelity `Table` component with rounded borders and integrated metadata headers/footers.
- Tables intelligently scale by shrinking flexible text columns (like `Title` or `Label`) while preserving vital fixed-width columns (`ID`, `Status`, `Prio`), ensuring a perfect fit across different terminal widths and side panes.
- Browse PRs with relative timestamps (`~ 2 hours`), approval counts, and refined metrics:
    - **`FB`**: Total Feedbacks (comments made by peers).
    - **`NR`**: Not Replied (unresolved peer comments that haven't received a reply from you yet).
    - **`Me`**: A personal status column tracking your own approval state on team PRs.
- Get a deep-dive into the selected PR:
    - Track **Lead Time** and **Pick-up Latency** (time to first peer interaction).
    - See who has approved (`✓`) vs. who is still pending (`○`).
    - Detailed breakdown of **Resolved** vs. **Not Replied** comments from your peers, relative to your own identity.
- Interactive Controls:
    - **`↑/↓`**: Navigate the list.
    - **`/`**: Enter **Filter Mode** to search by Title, Branch, or ID.
    - **`s`**: Open **Sort Menu** (Newest, Oldest, Lead Time, Pickup Latency).
    - **`o`**: Instantly **Open** the PR in your default browser.
    - **`c`**: **Copy** the source branch name to your clipboard.
    - **`r`**: **Refetch** latest data from Bitbucket.

### Tickets (Jira Engineering Intelligence)

The `tix` command targets "Engineering Intelligence" over raw data mirroring. It focuses on observability, dependencies, and monthly goal tracking.

```bash
# View your active tickets
kelar tix list

# View active tickets for a team member (select peer)
kelar tix list --peer
```

#### Observability Dashboard
- Browse tickets with a compact layout featuring **ID, Prio, Title, Status, Assignee, Est, Log, Created, and Updated** columns.
- Tracks your current selection, sort order, and **Daily Context Score** (count of unique tickets you've worked on today).
- The ticket table footer tracks your overall monthly stats (Total, To-Do, In Progress, Review, and "Zombie" tickets) within the single unified view.
- Detail Pane:
    - Lists **Project** and **Reporter** for the selected ticket.
    - Highlights stagnant "In Progress" tickets with no activity in >48 hours (zombie tickets).
    - Recursive ASCII visualization of "Blocked By" links.
- Visual progress bar, percentage tracking against your hours goal, and a deadline countdown.
- Interactive Controls:
    - **`l`**: **Log Work** with a multi-field modal (Time & Comment).
    - **`m`**: **Move** ticket status via interactive transition selection.
    - **`e`**: **Estimate** original time.
    - **`v`**: **View** full ticket description (parsed from Atlassian ADF to readable text).
    - **`p`**: Toggle between your tickets (**Me**) and **Peer** selection.
    - **`o`**: **Open** the ticket in your default browser.
    - **`c`**: **Copy** the Jira link to your clipboard.
    - **`/`**: Real-time filtering.
    - **`s`**: Open **Sort Menu** (Newest, Oldest, Updated, High Priority).
    - **`r`**: **Refetch** latest data and clear cache.

## Command Reference

### Work Logs (`log`)
| Command | Arguments | Description |
| :--- | :--- | :--- |
| `kelar log new` | `<id> <time> [msg]` | Log new work. Prompts for comment if `msg` is missing. |
| `kelar log list` | `[period]` | View logs for `day`, `week`, or `month` (default). |
| `kelar log capture` | `[period]` | Generate a high-fidelity HTML report for a period. |
| `kelar log config list`| - | View current Jira configuration. |
| `kelar log config set` | `<key> <val>` | Update Jira config (e.g. `JIRA_TOKEN`, `MONTHLY_TARGET_HOURS`). |

### Pull Requests (`pr`)
| Command | Arguments | Description |
| :--- | :--- | :--- |
| `kelar pr list` | `[--all] [--sort <type>]` | View active PRs. `--sort` options: `newest`, `oldest`, `longest`, `shortest`. |
| `kelar pr config list` | - | View current Bitbucket configuration. |
| `kelar pr config set` | `<key> <val>` | Update Bitbucket config (e.g. `BITBUCKET_REPO_SLUG`). |

### Tickets (`tix`)
| Command | Arguments | Description |
| :--- | :--- | :--- |
| `kelar tix list` | `[--peer]` | View your tickets. Use `--peer` to interactively select a teammate. |

## Data Storage & Security

- All worklogs and configuration (including your tokens) are stored in `~/.kelar/kelar.db`.
- Data is stored outside the project folder, so you can safely push code without leaking secrets.
- No data is shared outside of your machine and your designated Atlassian domains.

## Technical Details

- Bun
- Ink-based flexbox layouts
- SQLite (via `bun:sqlite`)
- Jira Cloud & Bitbucket Cloud REST APIs (v3/v2)
- Timezone using a fixed GMT+7 offset.
