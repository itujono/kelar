# Tech Debt Audit — Kelar CLI (riva-jira)

Generated: 2026-05-05 | Updated: 2026-05-05 (partial resolution)

## Executive Summary

- **2 Critical findings**, **7 High**, **19 Medium**, **12 Low** across 9 dimensions
- Largest debt concentration: duplicated UI logic across 3 module variants (log/pr/tix), each reimplementing windowed scrolling, sort menus, filter state, and key bindings from scratch
- `src/jira.ts` (540 LOC) is the closest thing to a god file — it mixes HTTP concerns, caching, data transformation, and domain logic. Combined with `src/bitbucket.ts` (226 LOC), they form a pattern of copy-pasted fetch+auth+error-handling boilerplate repeated ~15 times total
- ~~Test coverage: 7 tests covering only `utils.ts`. Zero tests for API clients, state hooks, database layer, or any UI component~~ Test coverage: 34 tests across `utils.ts` (18) and `db.ts` (16). API clients and hooks remain untested.
- `zod` is a declared dependency but never imported anywhere — dead dep
- Multiple `as any` casts bypass TypeScript, and `extractAdfText` is entirely untyped

## Architectural Mental Model

Kelar is a terminal-based TUI for managing Jira worklogs and Bitbucket PRs, built with Ink (React for CLI), Bun runtime, and SQLite for local persistence. The architecture has three parallel "modules" — **log**, **pr**, **tix** — each following the pattern: CLI command (`src/commands/`) → state hook (`src/hooks/`) → table/detail/controls UI components (`src/components/`).

Data flows: CLI entry (`src/cli.tsx`) renders a command component, which instantiates a state hook (e.g., `useLogView`, `usePRView`, `useTixView`). Hooks manage all state, keyboard input, and API orchestration via `@tanstack/react-query`. API clients (`src/jira.ts`, `src/bitbucket.ts`) hit REST endpoints directly with `fetch`. Config and sync timestamps live in SQLite (`src/db.ts`). The `tix` module uniquely uses React Context (`TixContext`) while the other two pass props directly.

The three modules are structurally similar but independently implemented — they share no abstraction for sort/filter/navigation, leading to significant duplication.

## Findings

| ID | Category | File:Line | Severity | Effort | Description | Recommendation |
|----|----------|-----------|----------|--------|-------------|----------------|
| F001 | Architectural decay | `src/jira.ts:115-133` | High | M | `getAuthHeader()` and `getBaseUrl()` read fresh config from SQLite on every API call. These are called ~15 times across the two API files, each time doing a new DB read + string construction + Base64 encode. | Memoize or inject config once. Create a shared `createApiClient(config)` factory that captures auth headers. |
| F002 | Architectural decay | `src/jira.ts` (540 LOC) | Medium | M | Single file handles all Jira API concerns: auth, URL construction, HTTP, caching, pagination, data filtering (`BANNED_KEYWORDS`), and response parsing. No separation of concerns. | Split into `jira/client.ts` (HTTP+auth), `jira/worklog.ts`, `jira/issues.ts`, `jira/users.ts`. |
| F003 | Architectural decay | `src/hooks/useLogView.ts`, `src/hooks/usePRView.ts`, `src/hooks/useTixShortcuts.ts` | High | L | Three independent `useInput` implementations each handle sorting, filtering, navigation, and module-specific actions. An attempt to extract a shared `useListNavigation` hook was reverted because Ink's `useInput` doesn't support multiple hooks per component well. The three modules still have duplicated sort/filter/navigation state machines with subtle inconsistencies. | Extract shared state factory (sort/filter/selection state) without `useInput`, letting each module wire its own keybindings. Or refactor Ink integration to allow a single `useInput` per module that delegates to composed handlers. |
| F004 | Consistency rot | `src/components/log/LogTable.tsx:47`, `src/components/pr/PRTable.tsx:45`, `src/components/tix/TixTable.tsx:70`, `src/components/tix/UserSelection.tsx:43` | Medium | S | Windowed scrolling logic (`startIndex`, `WINDOW_SIZE`, centered slicing) is copy-pasted across 4 files with identical structure. `WINDOW_SIZE=18` hardcoded in 3 files, `10` in one. | Extract `useWindowedSlice(list, selectedIndex, windowSize)` hook. |
| F005 | Consistency rot | `src/components/log/LogTable.tsx:57-64`, `src/components/pr/PRTable.tsx:52-109` | Medium | M | Table row data mapping with `_raw` escape hatches is duplicated in each table component. Each constructs ad-hoc objects with different shapes, all carrying an untyped `_raw` field and cast through `as any`. | Create a typed table data preparation utility, or make `Table` generic enough to handle per-row metadata without `_raw`. |
| F006 | Consistency rot | `src/components/pr/PRTable.tsx:56-69`, `src/components/pr/PRDetailPane.tsx:52-73` | Medium | S | "Is me" user identity matching logic (comparing `account_id`, `nickname`, `display_name`) is duplicated between `PRTable` and `PRDetailPane`. Both call `getBitbucketConfig()` independently. | Extract `useIsMe()` hook or `isMe(user, config)` utility in `src/bitbucket.ts`. |
| F007 | Consistency rot | `src/components/tix/TixTable.tsx:12-18` | Low | S | `formatSeconds()` is defined locally in `TixTable` instead of using `formatMinutes` from `utils.ts`. `PRDetailPane` has yet another `formatDuration(ms)`. Three formatting functions doing similar work in different time units. | Unify all duration formatting in `src/utils.ts` with `formatMinutes`, `formatSeconds`, `formatMs`. |
| F008 | Consistency rot | `src/components/pr/PRTable.tsx:27`, `src/commands/PRView.tsx:58` | Low | S | Identical "No active pull requests found." string in two files. | Extract to a shared constant or let `PRTable` handle all empty states. |
| F009 | Type & contract debt | `src/utils.ts:100` | High | M | `extractAdfText(doc: any)` — the entire ADF parser is typed as `any`, including the recursive call at line 106 `(c: any)`. This is the function that parses user content from Jira tickets; incorrect assumptions about ADF structure will silently fail. | Define `JiraAdfDoc` type (already exists at `jira.ts:88-98`) and use it as the parameter type. Extend it with proper typing for inner nodes. |
| F010 | Type & contract debt | `src/components/pr/PRTable.tsx:115` | Medium | S | `as any` cast on columns array to accommodate the `_raw` escape hatch. Suppresses all type checking on the column definitions. | Define proper row types and remove `_raw` pattern, or type the Table column interface to accept metadata. |
| F011 | Type & contract debt | `src/db.ts:81,83` | Medium | S | Two `as any` casts on `db.prepare().all()` return values. SQLite queries return untyped rows, and the casts bypass any runtime validation. | Use `zod` (already installed) to validate DB reads, or at minimum cast to `LogDbRow[]` with a runtime check. |
| F012 | Type & contract debt | `src/cli.tsx:180` | Low | S | `setAppConfig(upperKey as any, value)` — Bitbucket config keys bypass the type system instead of extending the `setAppConfig` signature. | Add a `setBitbucketConfig` function or widen `setAppConfig` to accept both config key types. |
| F013 | Type & contract debt | `src/jira.ts:225,291` | Medium | M | `JSON.parse(cachedData)` and `JSON.parse(cachedUsers)` return untyped values from the SQLite cache. No runtime validation. If cache corruption occurs, the app will crash on property access. | Use zod schemas to validate cached data before returning, or at minimum add try/catch with cache eviction on parse failure. |
| F014 | Type & contract debt | `src/jira.ts:154,206,265,310,361,446,473` | High | M | Every API response is cast with `as Promise<JiraIssue>`, `as Promise<JiraWorklog>`, etc. — these are type assertions, not runtime checks. If the Jira API changes its response shape, the app will silently operate on malformed data. | Create response validation functions (zod schemas would be natural given the dependency) and validate at trust boundaries. |
| F015 | Test debt | `tests/utils.test.ts` | Critical | L | ~~Only 7 tests, all covering `utils.ts`. Zero coverage for API clients, DB layer, hooks, UI components, report generator.~~ **PARTIALLY RESOLVED**: Now 34 tests across `utils.ts` (18) and `db.ts` (16). Added tests for `extractAdfText`, `escapeHtml`, and all `dbOps` CRUD operations. API clients, hooks, and UI components remain untested. | Priority: (1) Unit tests for `jira.ts`/`bitbucket.ts` API functions with mocked fetch, (2) Integration tests for `useLogView` state machine. |
| F016 | Test debt | `src/components/log/LogTable.tsx:90`, `src/components/pr/PRTable.tsx:127` | Medium | M | `indexOf` inside `renderCell` makes components untestable in isolation since the callback depends on the parent's data array reference. This pattern makes unit tests for cell rendering fragile. | Pass `rowIndex` as an explicit prop or restructure to avoid `indexOf` in render. |
| F017 | Dependency & config debt | `package.json:31` | Low | S | `zod` is listed as a dependency but never imported anywhere in the codebase. Dead dependency adding to bundle size. | Either remove it or use it for the API validation gaps identified in F013/F014. |
| F018 | Dependency & config debt | `package.json:18` | Low | S | `@types/react-dom` is listed as a devDependency but the project (an Ink CLI app) doesn't use `react-dom`. Dead devDependency. | Remove from package.json. |
| F019 | Dependency & config debt | `src/utils.ts:78-95` | Medium | M | `getNowWithOffset()` constructs timestamps using manual date arithmetic with a hardcoded `+0700` offset. This is the GMT+7 offset mentioned in the README. It doesn't handle DST, timezone changes, or users in other timezones. | Use `date-fns-tz` (or Bun's `Intl` support) to generate proper offset-aware timestamps. At minimum, extract the offset as a configurable constant. |
| F020 | Performance & resource hygiene | `src/components/log/LogTable.tsx:116,128-130` | Low | S | Progress ratio `(totalMinutes / (targetHours * 60))` is computed 3 times in the same render. | Extract to a local variable. |
| F021 | Performance & resource hygiene | `src/components/pr/PRTable.tsx:20-22`, `src/components/pr/PRDetailPane.tsx:57-58` | Medium | S | `getBitbucketConfig()` is called on every render (inside component body) and every `isMe()` invocation. Each call reads from SQLite. Should be memoized. | Wrap in `useMemo` or pass via context/props. |
| F022 | Performance & resource hygiene | `src/components/log/LogTable.tsx:90`, `src/components/pr/PRTable.tsx:127`, `src/components/tix/TixTable.tsx:104` | Low | S | `indexOf` calls in `renderCell` are O(n) per row per render. The tix variant is particularly wasteful since `selectedIndex - start` already yields the correct local index. | Pass `rowIndex` directly instead of searching for it. |
| F023 | Performance & resource hygiene | `src/components/tix/TixTable.tsx:60-66` | Low | S | Three `.filter()` calls iterate `tickets` separately for `todo`, `inReview`, `inProgress`. Should be a single pass accumulating three counts. | Use a single `.reduce()` or a loop to compute all three counts in one pass. |
| F024 | Performance & resource hygiene | `src/jira.ts:488-540` | Medium | M | `fetchUserWorklogs` fetches all matching issues, then for each issue potentially makes another API call (`fetchIssueWorklogs`), with a final `O(n²)` dedup using `allWorklogs.find(existing => existing.id === wl.id)`. For a user with 50+ issues, this creates a thundering herd of API calls. | Use `Promise.all` with concurrency limiting, and use a `Set<string>` for dedup instead of `.find()`. |
| F025 | Error handling & observability | `src/hooks/useLogView.ts:142-144` | Medium | M | Catch block discards the error object, only preserving `err.message`. Stack traces and error types are lost. Same pattern in `src/commands/LogNew.tsx:85`. | Store the full error or at least include error type information in state. |
| F026 | Error handling & observability | `src/jira.ts:488-540` | Medium | S | `fetchUserWorklogs` has a try/catch per issue at line 104 that swallows errors (`console.error` then continue). If worklog fetch fails for an issue, the user gets no indication and their totals will be wrong. | Surface partial failure to the caller. Return a result type that includes warnings for incomplete data. |
| F027 | Error handling & observability | `src/db.ts:30-36` | Medium | S | Migration attempts (`ALTER TABLE logs ADD COLUMN`) are silently caught with empty `catch {}`. If the column already exists, SQLite throws, which is fine — but if the migration fails for another reason (corrupt DB, permissions), it's silently ignored. | Check for column existence before altering, or log the specific error. |
| F028 | Security hygiene | `src/db.ts:6-7` | Low | S | Tokens are stored in plaintext in SQLite (`~/.kelar/kelar.db`). This is intentional per the README ("Privacy First: All credentials and data stay on your machine"), but worth noting. The `LogConfig` component does mask tokens on display (`src/commands/LogConfig.tsx:19`). | Consider encrypting tokens at rest, or at minimum documenting the risk in the README. |
| F029 | Security hygiene | `src/components/pr/PRTable.tsx:66` | High | S | ~~`display?.includes(myHandle || "")` — identity matching bug~~ **RESOLVED**: Changed to `myHandle && display?.includes(myHandle)` so empty `myHandle` no longer matches everyone. | Fixed |
| F030 | Security hygiene | `src/report.ts:17-25` | Medium | M | ~~HTML report uses string interpolation without escaping, vulnerable to XSS via ticket data~~ **RESOLVED**: Added `escapeHtml()` utility that escapes `&`, `<`, `>`, `"` before interpolation. | Fixed |
| F031 | Documentation drift | `README.md:26` | Low | S | README says `bun link` to install, but doesn't mention that `bun run dev` is the development command (only listed in `package.json` scripts). | Add a "Development" section to the README. |
| F032 | Architectural decay | `src/cli.tsx:103-123,151-170,179-201` | Low | M | All config-set actions use `render` + `setTimeout(unmount, 50ms)` + `process.exit()` to display a confirmation message. The `process.exit()` after `setTimeout` is a code smell — Ink should handle unmount naturally, and the 50ms timeout is arbitrary. | Use Ink's `useApp().exit()` consistently instead of `process.exit()`, and remove the setTimeout pattern. |
| F033 | Architectural decay | `src/components/Table.tsx:10` | Low | S | `Table` component's `renderCell` callback types `value` as `any`. This is the core shared component but has no type safety on cell values. | Type `renderCell` with a constrained generic based on `T`. |
| F034 | Architectural decay | `src/hooks/useTixView.ts:19` | Medium | M | `useMemo(() => getAppConfig(), [])` — config is memoized once on mount and never refreshed. If the user changes config while the TUI is running, the stale config is used. Same in `useLogView.ts:16`. | Either accept that config is read-once (document it), or add a config refresh mechanism. |
| F035 | Consistency rot | `src/contexts/TixContext.tsx` | Medium | M | Only the `tix` module uses React Context; `log` and `pr` pass props directly through component hierarchies. This inconsistency makes the codebase harder to navigate — you need to understand two different state distribution patterns. | Pick one pattern. Either all modules use context, or none do. Context makes sense if the prop drilling is deep; otherwise, direct props are simpler. |
| F036 | Performance & resource hygiene | `src/components/log/LogDetailPane.tsx:13-15` | Low | S | `allLogs` is filtered and sorted on every render without memoization. For large datasets, this is O(n log n) per render. | Wrap in `useMemo` with appropriate dependencies. |
| F037 | Performance & resource hygiene | `src/hooks/usePRView.ts:50-56` | Medium | M | ~~`useQueries` fires a comments fetch for every PR in the filtered list simultaneously~~ **RESOLVED**: Changed to only fetch comments for visible (windowed) PRs, reducing concurrent requests from N to ~18. Also fixed `indexOf` O(n) lookup in PRTable renderCell by passing `rowIndex`. | Fixed |
| F038 | Consistency rot | `src/hooks/useTixShortcuts.ts:64` | Low | S | `getAppConfig()` called inside `useInput` callback — not memoized, re-reads from SQLite on every keypress. | Move to `useMemo` or pass config as a ref. |
| F039 | Architectural decay | `src/db.ts:14` | Low | S | `export const db = new Database(DB_PATH)` — database is opened as a module-level side effect. Importing `db.ts` for any reason (even just types) creates a file handle. This makes testing impossible without file system mocking. | Use a lazy initializer or dependency injection. Export a `getDb()` function that creates the connection on first access. |
| F040 | Error handling & observability | `src/components/pr/PRDetailPane.tsx:96-101` | Low | S | `velocity?.leadTime || null` uses logical OR. If `leadTime` is `0` (falsy), it falls back to `null` and displays "N/A" instead of "0m". | Use nullish coalescing: `velocity?.leadTime ?? null`. |
| F041 | Dependency & config debt | `src/hooks/useLogView.ts:12` | Low | S | `CACHE_THRESHOLD_MINUTES = 5` is hardcoded as a module constant, yet the cache in `jira.ts:217` uses `CACHE_DURATION = 2 * 60 * 1000` (2 minutes). Two different cache invalidation systems with different durations. | Consolidate caching strategy. Either use react-query's cache (already configured with 5min `staleTime`) or the DB-based cache, not both. |

## Top 5 "If You Fix Nothing Else, Fix These"

### 1. F029 — ~~"Is me" identity matching bug in PRTable~~ RESOLVED
Fixed. `myHandle || ""` changed to `myHandle && display?.includes(myHandle)`.
**Impact**: Security-relevant — every PR participant could be misidentified as "you" when `BITBUCKET_USERNAME` is not set. This directly affects the `Me`, `FB`, and `NR` columns.
```ts
// src/components/pr/PRTable.tsx:66 — current
display?.includes(myHandle || "")

// Fix:
myHandle && display?.toLowerCase().includes(myHandle.toLowerCase())
```

### 2. F015 — Test coverage for critical paths
**Impact**: Zero tests on the DB layer, API clients, and state hooks. Any regression in `db.ts` would corrupt user data silently.
**Recommendation**: Start with `db.ts` unit tests (CRUD operations), then `jira.ts`/`bitbucket.ts` with mocked `fetch`. The zod dependency is already available for response validation.

### 3. F003 — Extract shared keyboard/navigation state machine
**Impact**: Three modules independently implement sorting, filtering, period-switching, and navigation. Bug fixes must be applied 3 times. The inconsistency (e.g., filter behavior resetting selection in PR but not Log) will grow. An initial attempt to extract a `useListNavigation` hook with its own `useInput` was reverted because Ink only supports one active `useInput` handler per component.
**Recommendation**: Extract a state-only factory (sort/filter/selection state setters) without calling `useInput`, then have each module compose its own single `useInput` that delegates to the shared handlers.

### 4. F030 — ~~XSS in HTML report generation~~ RESOLVED
Fixed. Added `escapeHtml()` utility in `src/report.ts` and applied it to all user-data interpolations (`identifier`, `label`).
**Impact**: `report.ts` interpolates arbitrary Jira ticket data into HTML without escaping. A ticket titled `<img onerror=alert(1)>` would be rendered as-is.
```ts
// src/report.ts:20 — current
<td>${log.identifier}</td>

// Fix: create an escapeHtml utility
function escapeHtml(s: string) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
// Then: <td>${escapeHtml(log.identifier)}</td>
```

### 5. F037 — ~~PR comments fire N simultaneous requests~~ RESOLVED
Changed from fetching comments for all filtered PRs to only the visible window (18 PRs max). Also fixed `indexOf` O(n) lookup in `PRTable` renderCell by passing `rowIndex` directly.
**Impact**: If a repo has 30+ open PRs, opening `kelar pr list` fires 30+ concurrent HTTP requests for comments. This slows load, risks rate limiting, and wastes bandwidth on data for PRs the user won't select.
**Recommendation**: Fetch comments only for the selected/active PR, with prefetching for adjacent PRs.

## Quick Wins

- [x] F029: Fix `myHandle || ""` identity bug — 1 line change
- [x] F040: Change `||` to `??` for `leadTime`/`pickupLatency` display — 2 lines
- [x] F017: Removed unused `zod` dependency
- [x] F018: Removed unused `@types/react-dom` devDependency
- [x] F008: Removed unreachable empty-state guard from PRTable (PRView handles it upstream with additional context)
- [x] F020: Extract progress ratio to variables in `LogTable` — 3 computations → 1
- [x] F022: Replace `indexOf` in `renderCell` callbacks with `rowIndex` prop (LogTable + TixTable + PRTable)
- [x] F023: Replace 3 `.filter()` calls in `TixTable` with single-pass `.reduce()`

## Things That Look Bad But Are Actually Fine

- **`src/db.ts:30-36` — Silent catch on migration ALTER TABLE.** This looks like it should be `IF NOT EXISTS`, but SQLite doesn't support `IF NOT EXISTS` for `ALTER TABLE ADD COLUMN`. The try/catch is the idiomatic way to handle idempotent schema migrations in SQLite, and the only error that should occur is "duplicate column," which is safe to ignore. This is the correct approach.

- **`Bun.spawn(["open", url])` and `Bun.spawn(["pbcopy"])` at `src/hooks/usePRView.ts:226,231` and `src/hooks/useTixShortcuts.ts:188,193`.** These look like platform-specific `open`/`pbcopy` commands that would break on Linux. This is intentional — the README documents this as a macOS-first tool, and `open`/`pbcopy` are standard macOS utilities. If cross-platform support is desired, that's a feature request, not debt.

- **`new Date()` calls scattered across hooks (`useLogView.ts:49`, `useTixView.ts:54`, `utils.ts:80`).** These make the code harder to unit test since `Date.now()` is unmockable in some setups, but Bun's test runner handles Date mocking fine. For a CLI tool that runs once and exits, deterministic time isn't a production concern — only a testing one, and the test coverage gap is the root problem, not the `new Date()` calls.

- **`src/report.ts` — The entire file is a 235-line template literal generating HTML.** This looks like it should use a templating engine, but for a CLI tool that generates a single static HTML report, a template literal is the pragmatic choice. Adding a template engine would be an over-engineering step for a file that changes rarely and has no dynamic partials.

- **`src/utils.ts:78-95` — Hardcoded GMT+7 offset.** This looks like it should use the system timezone, but the README explicitly states "Timezone using a fixed GMT+7 offset." This is an intentional product decision (the developer works in GMT+7), not an accidental limitation.

## Open Questions

- **Is the `tix` module's use of React Context intentional or accidental?** It's the only module using context; `log` and `pr` use prop drilling. Should the codebase standardize?
- **Is `zod` intended for future use or a leftover?** It's declared in `package.json` but never imported. If it's meant for API response validation (which it should be, given F013/F014), it should be used. If not, it should be removed.
- **Is the lack of tests for `db.ts` an acceptable risk?** The DB layer has SQL queries and a migration system with no tests, but it's a local-only SQLite DB. What's the intended test strategy?
- **Are the `fetchPRTasks` and `fetchPRStatuses` functions in `bitbucket.ts` (knip-flagged as unused exports) intended for future features?** If not, they should be removed.
- **Is the `process.exit()` pattern in `cli.tsx` intentional?** Ink has `useApp().exit()` and it's used in some places, but command handlers for config-set still use `process.exit()` directly.