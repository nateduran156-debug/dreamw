import { Client, Events, GatewayIntentBits } from "discord.js";
import { getRuntimeConfig } from "./config.js";
import { getCommands } from "./commands.js";
import { COLORS, cardPayload } from "./ui.js";

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
  if (!command) return;

  try {
    await command.execute(interaction, {
      ownerId: config.ownerId,
      robloxApiKey: config.robloxApiKey,
    });
  } catch (error) {
    console.error(`/${interaction.commandName} failed.`, error);
    const message = cardPayload(
      "Command Error",
      ["> That command failed. Check the bot logs and try again."],
      COLORS.red,
      true,
    );
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(message).catch(() => {});
    } else {
      await interaction.reply(message).catch(() => {});
    }
  }
});

client.on(Events.Error, (error) => {
  console.error("Discord client error.", error);
});

await client.login(config.discordToken);
