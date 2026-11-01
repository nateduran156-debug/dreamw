import {
  SlashCommandBuilder,
} from "discord.js";
import { GROUP_URL, TAGS } from "./config.js";
import {
  addAdmin,
  addRaidPoints,
  addBotWhitelist,
  canUseBot,
  getCommandHistory,
  getLeaderboardMessage,
  getRaidLeaderboard,
  isAdmin,
  listAdmins,
  listBotWhitelist,
  removeAdmin,
  removeBotWhitelist,
  setLeaderboardMessage,
} from "./storage.js";
import { applyTag, getRobloxAvatarUrl, stripTag } from "./roblox.js";
import { COLORS, leaderboardPayload, respond } from "./ui.js";

const tagChoiceOptions = [
  { name: "DREAM", value: "dream" },
];

function requireGuild(interaction) {
  return Boolean(interaction.guildId);
}

function canManageBot(interaction, context) {
  return isAdmin(interaction.guildId, interaction.user.id, context.ownerId);
}

function requireBotAllowlist(command) {
  return {
    ...command,
    async execute(interaction, context = {}) {
      if (!interaction.guildId) {
        return respond(interaction, "Server Only", [
          "> Use this bot in a server where it is installed.",
        ]);
      }

      if (!canUseBot(interaction.guildId, interaction.user.id, context.ownerId)) {
        return respond(interaction, "Access Not Whitelisted", [
          "> Ask the bot owner or a bot admin to add you with `/whitelist-member add`.",
        ], { color: COLORS.red });
      }

      return command.execute(interaction, context);
    },
  };
}

function mentions(ids) {
  if (!ids.length) return ["> None yet."];
  return ids.map((id) => `> <@${id}>`);
}

function userIdOption(subcommand) {
  subcommand.addUserOption((option) =>
    option
      .setName("user")
      .setDescription("The Discord user")
      .setRequired(true),
  );
  return subcommand;
}

function whitelistCommand(name, description) {
  return new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .addSubcommand((subcommand) =>
      userIdOption(
        subcommand
          .setName("add")
          .setDescription("Allow a user to use bot commands"),
      ),
    )
    .addSubcommand((subcommand) =>
      userIdOption(
        subcommand
          .setName("remove")
          .setDescription("Remove bot-command access from a user"),
      ),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("list").setDescription("List users allowed to use the bot"),
    );
}

function adminCommand() {
  return new SlashCommandBuilder()
    .setName("whitelist-admin")
    .setDescription("Manage bot administrators")
    .addSubcommand((subcommand) =>
      userIdOption(
        subcommand
          .setName("add")
          .setDescription("Add a bot admin"),
      ),
    )
    .addSubcommand((subcommand) =>
      userIdOption(
        subcommand
          .setName("remove")
          .setDescription("Remove a bot admin"),
      ),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("list").setDescription("List bot admins"),
    );
}

function tagCommand(tagKey) {
  const tag = TAGS[tagKey];
  return {
    data: new SlashCommandBuilder()
      .setName(tag.command)
      .setDescription(`Give the ${tag.label} Roblox group tag (rank ${tag.rank})`)
      .addStringOption((option) =>
        option
          .setName("username")
          .setDescription("Roblox username to update")
          .setRequired(true),
      ),
    async execute(interaction, context) {
      if (!requireGuild(interaction)) {
        return respond(interaction, "Server Only", ["> Use this command in a server."]);
      }
      if (
        !canUseBot(interaction.guildId, interaction.user.id, context.ownerId)
      ) {
        return respond(interaction, "No Access", [
          "> Ask a bot admin to add you with `/whitelist-member add`.",
        ], { color: COLORS.red });
      }

      await interaction.deferReply({ ephemeral: false });
      try {
        const result = await applyTag(
          interaction.options.getString("username", true),
          tagKey,
          context.robloxApiKey,
        );
        return respond(interaction, "Tag Applied", [
          `> ${result.username} was given the ${tag.label} role.`,
          `> Roblox group rank: ${tag.rank}.`,
        ], {
          color: COLORS.green,
          ephemeral: false,
          thumbnailUrl: await getRobloxAvatarUrl(result.userId),
          thumbnailAlt: `${result.username}'s circular Roblox avatar`,
        });
      } catch (error) {
        return respond(interaction, "Tag Not Applied", [
          `> ${error.message}`,
        ], {
          color: COLORS.red,
          ephemeral: false,
          thumbnailUrl: error.robloxUserId
            ? await getRobloxAvatarUrl(error.robloxUserId)
            : null,
          thumbnailAlt: error.robloxUsername
            ? `${error.robloxUsername}'s circular Roblox avatar`
            : undefined,
        });
      }
    },
  };
}

async function updateLeaderboardMessage(guild, channel, message) {
  const rows = getRaidLeaderboard(guild.id, 10);
  const lines = rows.length
    ? rows.map(
        (entry, index) =>
          `> ${index + 1}. <@${entry.userId}> — ${entry.amount} points`,
      )
    : ["> No raid points have been added yet."];
  const payload = leaderboardPayload(
    lines,
    rows.map((entry) => entry.userId),
    { suppressNotifications: !message },
  );

  if (message) return message.edit(payload);
  return channel.send(payload);
}

async function refreshSavedLeaderboard(guild) {
  const saved = getLeaderboardMessage(guild.id);
  if (!saved) return false;
  const channel = await guild.channels.fetch(saved.channelId).catch(() => null);
  if (!channel?.isTextBased()) return false;
  const message = await channel.messages.fetch(saved.messageId).catch(() => null);
  if (!message) return false;
  await updateLeaderboardMessage(guild, channel, message);
  return true;
}

function raidPointsCommand() {
  return {
    data: new SlashCommandBuilder()
      .setName("raidpoints")
      .setDescription("Add raid points or manage the live leaderboard")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("add")
          .setDescription("Add points to a server member")
          .addUserOption((option) =>
            option.setName("user").setDescription("Member to award").setRequired(true),
          )
          .addIntegerOption((option) =>
            option
              .setName("amount")
              .setDescription("Points to add, from 1 to 1000")
              .setMinValue(1)
              .setMaxValue(1000)
              .setRequired(true),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("lb")
          .setDescription("Post or refresh the live leaderboard in this channel"),
      ),
    async execute(interaction, context) {
      if (!requireGuild(interaction)) {
        return respond(interaction, "Server Only", ["> Use this command in a server."]);
      }

      const action = interaction.options.getSubcommand();
      if (action === "add") {
        if (!canManageBot(interaction, context)) {
          return respond(interaction, "No Access", [
            "> Only bot admins can add raid points.",
          ], { color: COLORS.red });
        }
        await interaction.deferReply({ ephemeral: true });
        const user = interaction.options.getUser("user", true);
        const amount = interaction.options.getInteger("amount", true);
        const total = addRaidPoints(interaction.guildId, user.id, amount);
        let liveUpdated = false;
        try {
          liveUpdated = await refreshSavedLeaderboard(interaction.guild);
        } catch (error) {
          console.error("Could not refresh the live leaderboard.", error);
        }
        return respond(interaction, "Raid Points Added", [
          `> Added ${amount} point${amount === 1 ? "" : "s"} for ${user.username}.`,
          `> New total: ${total}.`,
          liveUpdated
            ? "> The leaderboard was updated."
            : "> Run `/raidpoints lb` in a channel to post the live leaderboard.",
        ], { color: COLORS.green });
      }

      await interaction.deferReply({ ephemeral: true });
      try {
        const saved = getLeaderboardMessage(interaction.guildId);
        let channel = interaction.channel;
        let message = null;
        if (saved) {
          const savedChannel = await interaction.guild.channels
            .fetch(saved.channelId)
            .catch(() => null);
          const savedMessage = savedChannel?.isTextBased()
            ? await savedChannel.messages.fetch(saved.messageId).catch(() => null)
            : null;
          if (savedChannel?.isTextBased() && savedMessage) {
            channel = savedChannel;
            message = savedMessage;
          }
        }
        if (!channel?.isTextBased()) {
          return respond(interaction, "Could Not Post", [
            "> Choose a text channel where the bot can send messages.",
          ], { color: COLORS.red });
        }

        const posted = await updateLeaderboardMessage(interaction.guild, channel, message);
        setLeaderboardMessage(interaction.guildId, posted.channelId, posted.id);
        return respond(interaction, "Leaderboard Ready", [
          `> Live leaderboard: <#${posted.channelId}>`,
          "> It will refresh whenever raid points are added.",
        ], { color: COLORS.green });
      } catch (error) {
        return respond(interaction, "Could Not Post", [
          `> ${error.message}`,
        ], { color: COLORS.red });
      }
    },
  };
}

function whitelistHandlers(name, kind) {
  const listFunction = kind === "admins" ? listAdmins : listBotWhitelist;
  const addFunction = kind === "admins" ? addAdmin : addBotWhitelist;
  const removeFunction = kind === "admins" ? removeAdmin : removeBotWhitelist;

  return {
    data: kind === "admins"
      ? adminCommand()
      : whitelistCommand(name, "Manage who can use this bot"),
    async execute(interaction, context) {
      if (!requireGuild(interaction)) {
        return respond(interaction, "Server Only", ["> Use this command in a server."]);
      }
      if (
        kind === "admins" &&
        !isAdmin(interaction.guildId, interaction.user.id, context.ownerId)
      ) {
        return respond(interaction, "No Access", [
          "> Only the bot owner or an existing bot admin can manage bot admins.",
        ], { color: COLORS.red });
      }
      if (kind !== "admins" && !canManageBot(interaction, context)) {
        return respond(interaction, "No Access", [
          "> Only bot admins can manage the bot whitelist.",
        ], { color: COLORS.red });
      }

      const action = interaction.options.getSubcommand();
      if (action === "list") {
        const ids = listFunction(interaction.guildId);
        return respond(interaction, kind === "admins" ? "Bot Admins" : "Bot Allowlist", [
          ...mentions(ids),
        ]);
      }

      const user = interaction.options.getUser("user", true);
      if (kind === "admins" && user.id === context.ownerId) {
        return respond(interaction, "Not Changed", [
          "> The bot owner does not need to be added to the admin list.",
        ]);
      }

      if (action === "add") addFunction(interaction.guildId, user.id);
      else removeFunction(interaction.guildId, user.id);

      return respond(interaction, action === "add" ? "Whitelist Updated" : "Whitelist Updated", [
        action === "add"
          ? `> ${user.username} can now ${kind === "admins" ? "run bot admin commands" : "use the bot commands"}.`
          : `> ${user.username} can no longer ${kind === "admins" ? "run bot admin commands" : "use the bot commands"}.`,
      ], { color: COLORS.green });
    },
  };
}

function stripTagCommand() {
  return {
    data: new SlashCommandBuilder()
      .setName("strip-tag")
      .setDescription("Remove one selected tag role from a Roblox account")
      .addStringOption((option) =>
        option
          .setName("username")
          .setDescription("Roblox username to update")
          .setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName("section")
          .setDescription("Tag section to remove")
          .setRequired(true)
          .addChoices(...tagChoiceOptions),
      ),
    async execute(interaction, context) {
      if (!requireGuild(interaction)) {
        return respond(interaction, "Server Only", ["> Use this command in a server."]);
      }
      if (
        !canUseBot(interaction.guildId, interaction.user.id, context.ownerId)
      ) {
        return respond(interaction, "No Access", [
          "> Ask a bot admin to add you with `/whitelist-member add`.",
        ], { color: COLORS.red });
      }

      await interaction.deferReply({ ephemeral: false });
      try {
        const username = interaction.options.getString("username", true);
        const section = interaction.options.getString("section", true);
        const result = await stripTag(username, section, context.robloxApiKey);
        return respond(interaction, "Tag Removed", [
          `> The ${TAGS[section].label} role was removed from ${result.username}.`,
        ], {
          color: COLORS.green,
          ephemeral: false,
          thumbnailUrl: await getRobloxAvatarUrl(result.userId),
          thumbnailAlt: `${result.username}'s circular Roblox avatar`,
        });
      } catch (error) {
        return respond(interaction, "Tag Not Removed", [
          `> ${error.message}`,
        ], {
          color: COLORS.red,
          ephemeral: false,
          thumbnailUrl: error.robloxUserId
            ? await getRobloxAvatarUrl(error.robloxUserId)
            : null,
          thumbnailAlt: error.robloxUsername
            ? `${error.robloxUsername}'s circular Roblox avatar`
            : undefined,
        });
      }
    },
  };
}

function tagHistoryCommand() {
  return {
    data: new SlashCommandBuilder()
      .setName("tag-history")
      .setDescription("Show recent bot command activity and targets")
      .addIntegerOption((option) =>
        option
          .setName("limit")
          .setDescription("Number of recent actions to show (1–25)")
          .setMinValue(1)
          .setMaxValue(25),
      ),
    async execute(interaction, context) {
      if (!requireGuild(interaction)) {
        return respond(interaction, "Server Only", ["> Use this command in a server."]);
      }
      if (!canManageBot(interaction, context)) {
        return respond(interaction, "No Access", [
          "> Only bot admins can view command history.",
        ], { color: COLORS.red });
      }

      const limit = interaction.options.getInteger("limit") ?? 10;
      const entries = getCommandHistory(interaction.guildId, limit);
      const lines = entries.length
        ? entries.map((entry) => {
            const timestamp = Math.floor(Date.parse(entry.timestamp) / 1000);
            const when = Number.isFinite(timestamp) ? `<t:${timestamp}:f>` : "Unknown time";
            const target = entry.target || "no target";
            const outcome = entry.outcome === "error" ? "error" : "ran";
            return `> ${when} — <@${entry.actorId}> ran \`${entry.command}\` → ${target} (${outcome})`;
          })
        : ["> No command history has been recorded yet."];
      return respond(interaction, "Recent Command History", lines, {
        color: COLORS.blue,
      });
    },
  };
}

const commands = [
  tagCommand("dream"),
  raidPointsCommand(),
  whitelistHandlers("whitelist-admin", "admins"),
  whitelistHandlers("whitelist-member", "members"),
  whitelistHandlers("tag-wl", "members"),
  stripTagCommand(),
  tagHistoryCommand(),
  {
    data: new SlashCommandBuilder()
      .setName("group")
      .setDescription("Show the Roblox community link"),
    async execute(interaction) {
      return respond(interaction, "Roblox Group", [
        `> ${GROUP_URL}`,
      ], { ephemeral: false });
    },
  },
];

export function getCommands() {
  return commands.map(requireBotAllowlist);
}

export function getCommandPayloads() {
  return commands.map((command) => command.data.toJSON());
}
