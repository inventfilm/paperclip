#!/usr/bin/env node
import { Command } from "commander";
import { onboard } from "./commands/onboard.js";
import { doctor } from "./commands/doctor.js";
import { envCommand } from "./commands/env.js";
import { configure } from "./commands/configure.js";
import { heartbeatRun } from "./commands/heartbeat-run.js";

const program = new Command();

program
  .name("paperclip")
  .description("Paperclip CLI — setup, diagnose, and configure your instance")
  .version("0.0.1");

program
  .command("onboard")
  .description("Interactive first-run setup wizard")
  .option("-c, --config <path>", "Path to config file")
  .action(onboard);

program
  .command("doctor")
  .description("Run diagnostic checks on your Paperclip setup")
  .option("-c, --config <path>", "Path to config file")
  .option("--repair", "Attempt to repair issues automatically")
  .alias("--fix")
  .option("-y, --yes", "Skip repair confirmation prompts")
  .action(doctor);

program
  .command("env")
  .description("Print environment variables for deployment")
  .option("-c, --config <path>", "Path to config file")
  .action(envCommand);

program
  .command("configure")
  .description("Update configuration sections")
  .option("-c, --config <path>", "Path to config file")
  .option("-s, --section <section>", "Section to configure (llm, database, logging, server, secrets)")
  .action(configure);

const heartbeat = program.command("heartbeat").description("Heartbeat utilities");

heartbeat
  .command("run")
  .description("Run one agent heartbeat and stream live logs")
  .requiredOption("-a, --agent-id <agentId>", "Agent ID to invoke")
  .option("-c, --config <path>", "Path to config file")
  .option("--api-base <url>", "Base URL for the Paperclip server API")
  .option(
    "--source <source>",
    "Invocation source (timer | assignment | on_demand | automation)",
    "on_demand",
  )
  .option("--trigger <trigger>", "Trigger detail (manual | ping | callback | system)", "manual")
  .option("--timeout-ms <ms>", "Max time to wait before giving up", "0")
  .option("--debug", "Show raw adapter stdout/stderr JSON chunks")
  .action(heartbeatRun);

program.parse();
