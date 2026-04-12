#!/usr/bin/env bun
import { render } from "ink";
import { Command } from "commander";
import { LogNew } from "./commands/LogNew";
import { LogView } from "./commands/LogView";
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
  .action((identifier, time) => {
    render(<LogNew identifier={identifier} time={time} />);
  });

// log view [period]
log
  .command("view")
  .argument("[period]", "Period to view (day, week, month)", "day")
  .action((period) => {
    render(<LogView period={period} />);
  });

// log config [subcommand]
const config = log.command("config").description("Manage configuration");

config
  .command("list")
  .description("List current configuration")
  .action(() => {
    render(<LogConfig />);
  });

config
  .command("set")
  .description("Update a configuration value")
  .argument("<key>", "Config key (JIRA_DOMAIN, JIRA_EMAIL, JIRA_TOKEN, JIRA_ACCOUNT_ID, PERSONAL_TICKET_ID)")
  .argument("<value>", "New value")
  .action((key, value) => {
    const upperKey = key.toUpperCase() as ConfigKey;
    if (CONFIG_KEYS[upperKey]) {
      setAppConfig(upperKey, value);
      render(
        <Box padding={1}>
          <Text color="green">✅ Updated {upperKey} successfully!</Text>
        </Box>
      );
    } else {
      render(
        <Box padding={1}>
          <Text color="red">❌ Invalid config key: {key}</Text>
        </Box>
      );
    }
  });

// Handle 'log config' to default to 'list'
config.action(() => {
  render(<LogConfig />);
});

program.parse(process.argv);
