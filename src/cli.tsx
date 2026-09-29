#!/usr/bin/env bun
import React from "react";
import { render, useApp } from "ink";
import { Command } from "commander";
import { LogNew } from "./commands/LogNew";
import { LogView } from "./commands/LogView";
import { type SortType } from "./hooks/useLogView";
import { LogConfig } from "./commands/LogConfig";
import { setAppConfig, type ConfigKey, CONFIG_KEYS, BITBUCKET_CONFIG_KEYS, type BitbucketConfigKey, getBitbucketConfig } from "./config";
import { Text, Box } from "ink";
import { PRView } from "./commands/PRView";
import { TixView } from "./commands/TixView";
import { type PRSortType } from "./hooks/usePRView";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./queryClient";

const GlobalProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
);

function ExitMessage({ children, code = 0 }: { children: React.ReactNode; code?: number }) {
  const { exit } = useApp();
  React.useEffect(() => {
    const timer = setTimeout(() => {
      process.exitCode = code;
      exit();
    }, 50);
    return () => clearTimeout(timer);
  }, []);
  return <Box padding={1}>{children}</Box>;
}

const program = new Command();

program
  .name("kelar")
  .description("Manage Jira worklogs from your terminal")
  .version("1.0.0");

const log = program.command("log").description("Manage work logs");

// log new <identifier> <time>
log
  .command("new")
  .argument("<identifier>", "Jira key (e.g. IMM-123) or a string for personal log")
  .argument("<time>", "Time spent (e.g. 45m, 1h, 1h 30m)")
  .argument("[comment]", "Optional comment for the worklog")
  .action(async (identifier, time, comment) => {
    const { waitUntilExit } = render(
      <GlobalProviders>
        <LogNew identifier={identifier} time={time} initialComment={comment} />
      </GlobalProviders>
    );
    await waitUntilExit();
  });

// log list [period]
log
  .command("list")
  .alias("view")
  .description("List work logs for a period")
  .argument("[period]", "Period to view (day, yesterday, week, month)", "month")
  .option("-s, --sort <type>", "Sort by (longest, shortest, newest, oldest)", "newest")
  .action(async (period, options) => {
    const { waitUntilExit } = render(
      <GlobalProviders>
        <LogView period={period} sortBy={options.sort as SortType} />
      </GlobalProviders>
    );
    await waitUntilExit();
  });

// log generate [period]
log
  .command("generate")
  .description("Generate an HTML report of the work log table")
  .argument("[period]", "Period to view (day, yesterday, week, month)", "day")
  .option("-s, --sort <type>", "Sort by (longest, shortest, newest, oldest)", "newest")
  .action(async (period, options) => {
    const { waitUntilExit } = render(
      <GlobalProviders>
        <LogView period={period} sortBy={options.sort as SortType} isGenerateMode />
      </GlobalProviders>
    );
    await waitUntilExit();
  });

// log config [subcommand]
const config = log.command("config").description("Manage configuration");

config
  .command("list")
  .alias("view")
  .description("View current configuration")
  .action(async () => {
    const { waitUntilExit } = render(
      <GlobalProviders>
        <LogConfig />
      </GlobalProviders>
    );
    await waitUntilExit();
  });

config
  .command("set")
  .description("Update a configuration value")
  .argument("<key>", "Config key (JIRA_DOMAIN, JIRA_EMAIL, JIRA_TOKEN, JIRA_ACCOUNT_ID, PERSONAL_TICKET_ID, MONTHLY_TARGET_HOURS, LAST_CALCULATION_DAY)")
  .argument("<value>", "New value")
  .action(async (key, value) => {
    const upperKey = key.toUpperCase() as ConfigKey;
    if (CONFIG_KEYS[upperKey]) {
      setAppConfig(upperKey, value);
      const { waitUntilExit } = render(
        <ExitMessage>
          <Text color="green">✅ Updated {upperKey} successfully!</Text>
        </ExitMessage>
      );
      await waitUntilExit();
    } else {
      const { waitUntilExit } = render(
        <ExitMessage code={1}>
          <Text color="red">❌ Invalid config key: {key}</Text>
        </ExitMessage>
      );
      await waitUntilExit();
    }
  });

// pr list [--all]
const pr = program.command("pr").description("Manage pull requests");

pr
  .command("list")
  .description("List open pull requests")
  .option("-a, --all", "Show all pull requests in the repository", false)
  .option("-s, --sort <type>", "Sort by (updated, oldest_updated, newest, oldest)", "updated")
  .action(async (options) => {
    const { waitUntilExit } = render(
      <GlobalProviders>
        <PRView showAll={options.all} sortBy={options.sort as PRSortType} />
      </GlobalProviders>
    );
    await waitUntilExit();
  });

// pr config [subcommand]
const prConfig = pr.command("config").description("Manage Bitbucket configuration");

prConfig
  .command("list")
  .alias("view")
  .description("View Bitbucket configuration")
  .action(async () => {
    const prConf = getBitbucketConfig();
    const { waitUntilExit } = render(
      <GlobalProviders>
        <ExitMessage>
          <Box flexDirection="column">
            <Text bold underline color="cyan">Bitbucket Configuration</Text>
            {Object.entries(prConf).map(([k, val]) => (
              <Box key={k} marginTop={1}>
                <Box width={25}>
                  <Text bold>{k}: </Text>
                </Box>
                <Text color={val ? "white" : "dim"}>{val || "Not Set"}</Text>
              </Box>
            ))}
          </Box>
        </ExitMessage>
      </GlobalProviders>
    );
    await waitUntilExit();
  });

prConfig
  .command("set")
  .description("Update a Bitbucket configuration value")
  .argument("<key>", "Config key (BITBUCKET_EMAIL, BITBUCKET_USERNAME, BITBUCKET_TOKEN, BITBUCKET_WORKSPACE, BITBUCKET_REPO_SLUG)")
  .argument("<value>", "New value")
  .action(async (key, value) => {
    const upperKey = key.toUpperCase() as BitbucketConfigKey;
    if (BITBUCKET_CONFIG_KEYS[upperKey]) {
      setAppConfig(upperKey, value);
      const { waitUntilExit } = render(
        <ExitMessage>
          <Text color="green">✅ Updated Bitbucket {upperKey} successfully!</Text>
        </ExitMessage>
      );
      await waitUntilExit();
    } else {
      const { waitUntilExit } = render(
        <ExitMessage code={1}>
          <Text color="red">❌ Invalid Bitbucket config key: {key}</Text>
        </ExitMessage>
      );
      await waitUntilExit();
    }
  });

// tix list [--peer]
const tix = program.command("tix").description("Manage Jira tickets");

tix
  .command("list")
  .description("List active Jira tickets")
  .option("-p, --peer", "Show searchable list of team members to observe", false)
  .action(async (options) => {
    const { waitUntilExit } = render(
      <GlobalProviders>
        <TixView isPeerMode={options.peer} />
      </GlobalProviders>
    );
    await waitUntilExit();
  });

await program.parseAsync(process.argv);
