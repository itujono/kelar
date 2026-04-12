#!/usr/bin/env bun
import { render } from "ink";
import { Command } from "commander";
import { LogNew } from "./commands/LogNew";
import { LogView, type SortType } from "./commands/LogView";
import { LogConfig } from "./commands/LogConfig";
import { setAppConfig, type ConfigKey, CONFIG_KEYS } from "./config";
import { Text, Box } from "ink";

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

// log view [period]
log
  .command("view")
  .argument("[period]", "Period to view (day, week, month)", "day")
  .option("-s, --sort <type>", "Sort by (longest, shortest, newest, oldest)", "oldest")
  .action(async (period, options) => {
    const { waitUntilExit } = render(<LogView period={period} sortBy={options.sort as SortType} />);
    await waitUntilExit();
  });

// log config [subcommand]
const config = log.command("config").description("Manage configuration");

config
  .command("list")
  .description("List current configuration")
  .action(async () => {
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

// Handle 'log config' to default to 'list'
config.action(async () => {
  const { waitUntilExit } = render(<LogConfig />);
  await waitUntilExit();
});

program.parse(process.argv);
