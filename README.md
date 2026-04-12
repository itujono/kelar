# Kelar CLI 🍗

**Kelar** is a fast, terminal-based Jira worklog manager built with **Bun**, **TypeScript**, and **Ink**. It provides a premium TUI (Terminal User Interface) to manage your productivity, automatically mirroring your Jira Cloud worklogs to a local SQLite database with smart caching.

## Features

- **Smart Time Parsing**: Supports standard Jira formats like `1h`, `45m`, or `1h 30m`.
- **Automatic Rounding**: Automatically rounds every entry up to the nearest 5-minute increment (e.g., `42m` → `45m`).
- **Intelligent Sync & Mirror**:
    - **Persistence**: Maintains a local SQLite database (`~/.kelar/kelar.db`).
    - **Smart Caching**: Syncs with Jira every 5 minutes; repeated views within that window load instantly from local storage.
    - **Cloud First**: Mirroring architecture ensures your local dashboard and Jira are always in sync.
- **Validation**: Automatically validates Jira ticket existence and provides friendly warnings if a ticket is unassigned or assigned to someone else.
- **Personal Log Highlighting**: Non-Jira logs are color-coded in **green** for easy differentiation in summaries.

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

Set up your Jira credentials before your first log:

```bash
kelar log config set JIRA_DOMAIN your-domain.atlassian.net
kelar log config set JIRA_EMAIL your@email.com
kelar log config set JIRA_TOKEN your_api_token
kelar log config set JIRA_ACCOUNT_ID your_jira_account_id
kelar log config set PERSONAL_TICKET_ID IMM-123  # Target for personal work strings
```

View current config with `kelar log config list`.

## Usage

### Logging New Work

Kelar routes logs based on the identifier provided:
- **Jira Keys**: (e.g., `IMM-123`) Validates the ticket exists and matches your account.
- **Personal Strings**: (e.g., "Deep Work") Logs to your `PERSONAL_TICKET_ID`.

```bash
# Log with a comment (Quotes needed for spaces)
kelar log new IMM-123 '1h 30m' "Refactoring the API"

# Log without a comment (It will prompt you!)
kelar log new IMM-123 45m

# Pro-tip: No space in time avoids the need for quotes
kelar log new "Team Sync" 1h45m
```

### Viewing Summaries

The `view` command mirrors Jira to your local database and caches the result for 5 minutes.

```bash
# Available periods: day, week, month
# Week starts every Monday; Month starts on the 1st.
kelar log view [period]
```

#### Advanced Sorting
Use the `--sort` (or `-s`) flag to organize your table:
```bash
# See your week's biggest tasks first
kelar log view week --sort longest

# See newest activity at the top
kelar log view month -s newest

# View options: oldest (default), newest, longest, shortest
```

## Data Storage & Security

Kelar is designed to be safe for open-source contribution:
- **Local Database**: All worklogs and configuration (including your Jira Token) are stored in a local SQLite database at `~/.kelar/kelar.db`.
- **Safe for GitHub**: Since your data is stored in your local machine rather than the project folder, you can safely commit and push your code to GitHub without accidentally leaking your API tokens.
- **Privacy**: The local SQLite database acts as a private mirror; no data is shared outside of your machine and your designated Jira Cloud domain.

## Technical Details

- **Database**: `~/.kelar/kelar.db`
- **Timezone**: Syncs with Jira using a fixed `+0700` offset.
- **JQL Search**: Utilizes the modern `POST /rest/api/3/search/jql` endpoint.
- **UI Engine**: Ink-based flexbox layouts with custom Unicode grid rendering.
