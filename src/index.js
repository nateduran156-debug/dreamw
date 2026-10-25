import { Client, Events, GatewayIntentBits } from "discord.js";
import { getRuntimeConfig } from "./config.js";
import { getCommands } from "./commands.js";
import { recordCommandAudit } from "./storage.js";
import { COLORS, respond } from "./ui.js";

const config = getRuntimeConfig();
if (config.missing.length) {
  console.error(`Missing required settings: ${config.missing.join(", ")}`);
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});
const commandMap = new Map(
  getCommands().map((command) => [command.data.name, command]),
);
let handledReady = false;

client.once(Events.ClientReady, (readyClient) => {
  if (handledReady) return;
  handledReady = true;
  console.log(`Online as ${readyClient.user.tag}.`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = commandMap.get(interaction.commandName);
  if (!command) {
    await respond(interaction, "Command Not Available", [
      "> This command is no longer registered. Refresh the command list and try again.",
    ], { color: COLORS.cyan }).catch(() => {});
    return;
  }

  let auditOutcome = "completed";
  try {
    await command.execute(interaction, {
      ownerId: config.ownerId,
      robloxApiKey: config.robloxApiKey,
    });
  } catch (error) {
    auditOutcome = "error";
    console.error(`/${interaction.commandName} failed.`, error);
    await respond(
      interaction,
      "Command Error",
      ["> That command failed. Check the bot logs and try again."],
      { color: COLORS.cyan },
    ).catch(() => {});
  } finally {
    if (interaction.guildId) {
      try {
        const subcommand = interaction.options.getSubcommand(false);
        const robloxUsername = interaction.options.getString("username");
        const targetUser = interaction.options.getUser("user");
        const target = robloxUsername
          ? `Roblox username: ${robloxUsername}`
          : targetUser
            ? `<@${targetUser.id}>`
            : "";
        recordCommandAudit(interaction.guildId, {
          actorId: interaction.user.id,
          command: `/${interaction.commandName}${subcommand ? ` ${subcommand}` : ""}`,
          target,
          outcome: auditOutcome,
        });
      } catch (error) {
        console.error("Could not save command history.", error);
      }
    }
  }
});

client.on(Events.Error, (error) => {
  console.error("Discord client error.", error);
});

await client.login(config.discordToken);
