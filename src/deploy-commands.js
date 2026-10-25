import { REST, Routes } from "discord.js";
import { getRuntimeConfig } from "./config.js";
import { getCommandPayloads } from "./commands.js";

const config = getRuntimeConfig();
if (config.missing.length) {
  console.error(`Missing required settings: ${config.missing.join(", ")}`);
  process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(config.discordToken);
const result = await rest.put(
  Routes.applicationCommands(config.discordClientId),
  { body: getCommandPayloads() },
);
console.log(`Registered ${result.length} slash commands globally.`);
