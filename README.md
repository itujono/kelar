# Kelar CLI 🛠️

**Kelar** is a fast, Terminal-based UI (TUI) tool built with **Bun**, **TypeScript**, and **Ink** to manage your Jira worklogs. It synchronizes your personal work logs between a local SQLite database and Jira Cloud.

## Features

- **Smart Time Parsing**: Supports strings like `45m`, `1h`, or `1h 30m`.
- **Automatic Rounding**: All logs are automatically rounded up to the nearest 5-minute increment (e.g., `42m` → `45m`).
- **Jira Sync**: Automatically detects Jira keys (e.g., `PROJ-123`) and posts worklogs directly to tickets.
- **Personal Logs**: Use descriptive strings (e.g., "Design Sync") to log work to a default personal ticket.
- **Local Persistence**: Maintains a local SQLite database (`~/.kelar/kelar.db`) as your source of truth.
- **TUI Dashboard**: Clean, boxed tables for summarizing hours spent by day, week, or month.

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

Before logging work, you need to set up your Jira credentials:

```bash
kelar log config set JIRA_DOMAIN your-domain.atlassian.net
kelar log config set JIRA_EMAIL your@email.com
kelar log config set JIRA_TOKEN your_api_token
kelar log config set JIRA_ACCOUNT_ID your_jira_account_id
kelar log config set PERSONAL_TICKET_ID IMM-123  # Target for personal strings
```

You can view your current configuration with:
```bash
kelar log config list
```

## Usage

### Logging New Work

Kelar intelligently routes your logs based on the identifier:

- **Jira Tickets**: If the identifier matches a Jira Key regex (`/^[A-Z]+-\d+$/`).
- **Personal Strings**: If the identifier is anything else, it logs to your `PERSONAL_TICKET_ID`.

```bash
# Log to a specific project ticket
kelar log new IMM-123 45m

# Log a personal activity (goes to your PERSONAL_TICKET_ID)
kelar log new "Team Sync" 1h
```

### Viewing Logs

Summarize your activity for different periods:

```bash
# Today's logs (default)
kelar log view day

# This week's logs (starting Monday)
kelar log view week

# This month's logs
kelar log view month
```

## Technical Details

- **Database**: Stores logs in `~/.kelar/kelar.db`.
- **Timezone**: All logs are synced to Jira with a fixed `+0700` offset.
- **Auth**: Uses Basic Auth (`email:token`).
- **Rounding Logic**: `Math.ceil(minutes / 5) * 5`.
