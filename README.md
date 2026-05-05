# Kelar CLI

A terminal-based Jira and Bitbucket manager. Track worklogs, monitor pull requests, and stay on top of your tickets — all from the command line.

## Command Reference

### Work Logs (`log`)

| Command | Description |
| :--- | :--- |
| `kelar log new <id> <time> [msg]` | Log work. Parses `1h 30m`, `45m`, etc. |
| `kelar log list [period]` | View logs for `day`, `week`, or `month`. |
| `kelar log generate [period]` | Generate an HTML report. |
| `kelar log config list` | View Jira config. |
| `kelar log config set <key> <val>` | Update a config value. |

### Pull Requests (`pr`)

| Command | Description |
| :--- | :--- |
| `kelar pr list [--all]` | View your open PRs. `--all` shows the whole repo. |
| `kelar pr config list` | View Bitbucket config. |
| `kelar pr config set <key> <val>` | Update a config value. |

### Tickets (`tix`)

| Command | Description |
| :--- | :--- |
| `kelar tix list [--peer]` | View your active tickets. `--peer` to browse a teammate's. |

## Installation

```bash
bun install
bun link
```

Now `kelar` is available anywhere.

## Configuration

### Jira (required for `log` and `tix`)

```bash
kelar log config set JIRA_DOMAIN       your-domain.atlassian.net
kelar log config set JIRA_EMAIL        your@email.com
kelar log config set JIRA_TOKEN        your_api_token
kelar log config set JIRA_ACCOUNT_ID   your_account_id
kelar log config set PERSONAL_TICKET_ID IMM-123
kelar log config set MONTHLY_TARGET_HOURS 180
kelar log config set LAST_CALCULATION_DAY 25
```

### Bitbucket (required for `pr`)

```bash
kelar pr config set BITBUCKET_EMAIL      your@email.com
kelar pr config set BITBUCKET_TOKEN      your_api_token
kelar pr config set BITBUCKET_WORKSPACE  workspace-slug
kelar pr config set BITBUCKET_REPO_SLUG  repo-slug
kelar pr config set BITBUCKET_USERNAME   your_username
```

## Usage

```bash
# Log time
kelar log new IMM-123 '1h 30m' "Refactoring the API"

# View monthly summary
kelar log list month

# Generate an HTML report
kelar log generate month

# Check your PRs
kelar pr list

# Browse your tickets
kelar tix list
```

Each view is interactive — navigate with arrow keys, filter with `/`, sort with `s`, and press `q` to quit. Open items in your browser with `o`.

## Data Storage

- Everything lives in `~/.kelar/kelar.db` — a local SQLite database.
- Tokens are stored in plaintext. Keep your machine secured.
- No data leaves your machine.

### Inspect the database

```bash
sqlite3 ~/.kelar/kelar.db
```

## Development

```bash
bun run dev       # Run the CLI in dev mode
bun test          # Run tests
bun run typecheck # Type check
```

Built with Bun, TypeScript, Ink, SQLite. Talks to Jira Cloud REST API v3 and Bitbucket Cloud API v2.
