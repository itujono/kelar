#!/usr/bin/env bun
import { render } from "ink";
import { Command } from "commander";
import { LogNew } from "./commands/LogNew";
import { LogView, type SortType } from "./commands/LogView";
import { LogConfig } from "./commands/LogConfig";
import { setAppConfig, type ConfigKey, CONFIG_KEYS, BITBUCKET_CONFIG_KEYS, type BitbucketConfigKey, getBitbucketConfig } from "./config";
import { Text, Box } from "ink";
import { PRView } from "./commands/PRView";
import { TixView } from "./commands/TixView";


const program = new Command();

program
  .name("kelar")
  .description("Manage Jira worklogs with Bun and Ink")
  .version("1.0.0");

const log = program.command("log").description("Manage work logs");

// log new <identifier> <time>
log
  .command("new")
  .argument("<identifier>", "Jira key (e.g. IMM-123) or a string for personal log")
  .argument("<time>", "Time spent (e.g. 45m, 1h, 1h 30m)")
  .argument("[comment]", "Optional comment for the worklog")
  .action(async (identifier, time, comment) => {
    const { waitUntilExit } = render(<LogNew identifier={identifier} time={time} initialComment={comment} />);
    await waitUntilExit();
  });

// log list [period]
log
  .command("list")
  .argument("[period]", "Period to view (day, week, month)", "month")
  .option("-s, --sort <type>", "Sort by (longest, shortest, newest, oldest)", "oldest")
  .action(async (period, options) => {
    const { waitUntilExit } = render(<LogView period={period} sortBy={options.sort as SortType} />);
    await waitUntilExit();
  });

log.command("view").argument("[period]", "Period to view (day, week, month)", "month").action(async (period) => {
  const { waitUntilExit } = render(<LogView period={period} sortBy="oldest" />);
  await waitUntilExit();
});

// log capture [period]
log
  .command("capture")
  .description("Capture a snapshot of the work log table for sharing")
  .argument("[period]", "Period to view (day, week, month)", "day")
  .option("-s, --sort <type>", "Sort by (longest, shortest, newest, oldest)", "oldest")
  .action(async (period, options) => {
    const { waitUntilExit } = render(<LogView period={period} sortBy={options.sort as SortType} isCaptureMode />);
    await waitUntilExit();
  });

// log config [subcommand]
const config = log.command("config").description("Manage configuration");

config
  .command("list")
  .description("View current configuration")
  .action(async () => {
    const { waitUntilExit } = render(<LogConfig />);
    await waitUntilExit();
  });

config.command("view").action(async () => {
  const { waitUntilExit } = render(<LogConfig />);
  await waitUntilExit();
});

config
  .command("set")
  .description("Update a configuration value")
  .argument("<key>", "Config key (JIRA_DOMAIN, JIRA_EMAIL, JIRA_TOKEN, JIRA_ACCOUNT_ID, PERSONAL_TICKET_ID, MONTHLY_TARGET_HOURS, LAST_CALCULATION_DAY)")
  .argument("<value>", "New value")
  .action((key, value) => {
    const upperKey = key.toUpperCase() as ConfigKey;
    if (CONFIG_KEYS[upperKey]) {
      setAppConfig(upperKey, value);
      const { unmount } = render(
        <Box padding={1}>
          <Text color="green">✅ Updated {upperKey} successfully!</Text>
        </Box>
      );
      // Give it a tiny bit of time to render then unmount clean
      setTimeout(() => {
        unmount();
        process.exit(0);
      }, 50);
    } else {
      const { unmount } = render(
        <Box padding={1}>
          <Text color="red">❌ Invalid config key: {key}</Text>
        </Box>
      );
      setTimeout(() => {
        unmount();
        process.exit(1);
      }, 50);
    }
  });

// pr list [--all]
const pr = program.command("pr").description("Manage pull requests");

pr
  .command("list")
  .description("List open pull requests")
  .option("-a, --all", "Show all pull requests in the repository", false)
  .action(async (options) => {
    const { waitUntilExit } = render(<PRView showAll={options.all} />);
    await waitUntilExit();
  });

// pr config [subcommand]
const prConfig = pr.command("config").description("Manage Bitbucket configuration");

prConfig
  .command("view")
  .description("View Bitbucket configuration")
  .action(async () => {
    const config = getBitbucketConfig();
    const { unmount } = render(
      <Box padding={1} flexDirection="column">
        <Text bold underline color="cyan">Bitbucket Configuration</Text>
        {Object.entries(config).map(([key, value]) => (
          <Box key={key} marginTop={1}>
            <Box width={25}>
              <Text bold>{key}: </Text>
            </Box>
            <Text color={value ? "white" : "dim"}>{value || "Not Set"}</Text>
          </Box>
        ))}

      </Box>
    );
    setTimeout(() => {
      unmount();
      process.exit(0);
    }, 50);
  });

prConfig
  .command("set")
  .description("Update a Bitbucket configuration value")
  .argument("<key>", "Config key (BITBUCKET_EMAIL, BITBUCKET_USERNAME, BITBUCKET_TOKEN, BITBUCKET_WORKSPACE, BITBUCKET_REPO_SLUG)")
  .argument("<value>", "New value")


  .action((key, value) => {
    const upperKey = key.toUpperCase() as BitbucketConfigKey;
    if (BITBUCKET_CONFIG_KEYS[upperKey]) {
      setAppConfig(upperKey as any, value);
      const { unmount } = render(
        <Box padding={1}>
          <Text color="green">✅ Updated Bitbucket {upperKey} successfully!</Text>
        </Box>
      );
      setTimeout(() => {
        unmount();
        process.exit(0);
      }, 50);
    } else {
      const { unmount } = render(
        <Box padding={1}>
          <Text color="red">❌ Invalid Bitbucket config key: {key}</Text>
        </Box>
      );
      setTimeout(() => {
        unmount();
        process.exit(1);
      }, 50);
    }
  });

// tix list [--peer]
const tix = program.command("tix").description("Manage Jira tickets");

tix
  .command("list")
  .description("List active Jira tickets")
  .option("-p, --peer", "Show searchable list of team members to observe", false)
  .action(async (options) => {
    const { waitUntilExit } = render(<TixView isPeerMode={options.peer} />);
    await waitUntilExit();
  });

program.parse(process.argv);

