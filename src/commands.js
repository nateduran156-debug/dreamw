import {
  SlashCommandBuilder,
} from "discord.js";
import { GROUP_URL, TAGS } from "./config.js";
import {
  addAdmin,
  addRaidPoints,
  addTagWhitelist,
  canUseTags,
  getLeaderboardMessage,
  getRaidLeaderboard,
  isAdmin,
  isOwner,
  listAdmins,
  listTagWhitelist,
  removeAdmin,
  removeTagWhitelist,
  setLeaderboardMessage,
} from "./storage.js";
import { applyTag, stripTag } from "./roblox.js";
import { COLORS, leaderboardPayload, respond } from "./ui.js";

const tagChoiceOptions = [
  { name: "1738", value: "1738" },
  { name: "DREAM", value: "dream" },
];

function requireGuild(interaction) {
  return Boolean(interaction.guildId);
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
          .setDescription("Allow a user to use the Roblox tag commands"),
      ),
    )
    .addSubcommand((subcommand) =>
      userIdOption(
        subcommand
          .setName("remove")
          .setDescription("Remove tag-command access from a user"),
      ),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("list").setDescription("List users allowed to use tags"),
    );
}

function adminCommand() {
  return new SlashCommandBuilder()
    .setName("whitelist-admin")
    .setDescription("Manage who can run admin commands")
    .addSubcommand((subcommand) =>
      userIdOption(
        subcommand
          .setName("add")
          .setDescription("Add a server admin"),
      ),
    )
    .addSubcommand((subcommand) =>
      userIdOption(
        subcommand
          .setName("remove")
          .setDescription("Remove a server admin"),
      ),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("list").setDescription("List server admins"),
    );
}

function tagCommand(name, label, rank) {
  return {
    data: new SlashCommandBuilder()
      .setName(name)
      .setDescription(`Give the ${label} Roblox group tag (rank ${rank})`)
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
      if (!canUseTags(interaction.guildId, interaction.user.id, context.ownerId)) {
        return respond(interaction, "No Access", [
          "> Ask an admin to add you with `/tag-wl add`.",
        ], { color: COLORS.red });
      }

      await interaction.deferReply({ ephemeral: true });
      try {
        const result = await applyTag(
          interaction.options.getString("username", true),
          label === "DREAM" ? "dream" : "1738",
          context.robloxApiKey,
        );
        return respond(interaction, "Tag Applied", [
          `> ${result.username} was given the ${label} role.`,
          `> Roblox group rank: ${rank}.`,
        ], { color: COLORS.green });
      } catch (error) {
        return respond(interaction, "Tag Not Applied", [
          `> ${error.message}`,
        ], { color: COLORS.red });
      }
    },
  };
}

async function updateLeaderboardMessage(guild, channel, message) {
  const rows = getRaidLeaderboard(guild.id, 10);
  const lines = rows.length
    ? await Promise.all(
        rows.map(async (entry, index) => {
          const member = await guild.members.fetch(entry.userId).catch(() => null);
          const name = member?.displayName ?? `User ${entry.userId}`;
          return `> ${index + 1}. ${name} — ${entry.amount} points`;
        }),
      )
    : ["> No raid points have been added yet."];
  const payload = leaderboardPayload(lines);

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
        if (!isAdmin(interaction.guildId, interaction.user.id, context.ownerId)) {
          return respond(interaction, "No Access", [
            "> Only admins can add raid points.",
          ], { color: COLORS.red });
        }
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
  const listFunction = kind === "admins" ? listAdmins : listTagWhitelist;
  const addFunction = kind === "admins" ? addAdmin : addTagWhitelist;
  const removeFunction = kind === "admins" ? removeAdmin : removeTagWhitelist;

  return {
    data: kind === "admins"
      ? adminCommand()
      : whitelistCommand(name, "Manage who can use the Roblox tag commands"),
    async execute(interaction, context) {
      if (!requireGuild(interaction)) {
        return respond(interaction, "Server Only", ["> Use this command in a server."]);
      }
      if (kind === "admins" && !isOwner(interaction.user.id, context.ownerId)) {
        return respond(interaction, "No Access", [
          "> Only the bot owner can manage admins.",
        ], { color: COLORS.red });
      }
      if (kind !== "admins" && !isAdmin(interaction.guildId, interaction.user.id, context.ownerId)) {
        return respond(interaction, "No Access", [
          "> Only admins can manage the tag whitelist.",
        ], { color: COLORS.red });
      }

      const action = interaction.options.getSubcommand();
      if (action === "list") {
        const ids = listFunction(interaction.guildId);
        return respond(interaction, kind === "admins" ? "Server Admins" : "Tag Whitelist", [
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
          ? `> ${user.username} can now ${kind === "admins" ? "run admin commands" : "use the tag commands"}.`
          : `> ${user.username} can no longer ${kind === "admins" ? "run admin commands" : "use the tag commands"}.`,
      ], { color: COLORS.green });
    },
  };
}

function stripTagCommand() {
  return {
    data: new SlashCommandBuilder()
      .setName("strip-tag")
      .setDescription("Reset one Roblox account to the group's base rank")
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
      if (!canUseTags(interaction.guildId, interaction.user.id, context.ownerId)) {
        return respond(interaction, "No Access", [
          "> Ask an admin to add you with `/tag-wl add`.",
        ], { color: COLORS.red });
      }

      await interaction.deferReply({ ephemeral: true });
      try {
        const username = interaction.options.getString("username", true);
        const section = interaction.options.getString("section", true);
        const result = await stripTag(username, context.robloxApiKey);
        return respond(interaction, "Tag Removed", [
          `> ${result.username} was reset to the group's base rank.`,
          `> Section: ${section === "dream" ? "DREAM" : "1738"}.`,
        ], { color: COLORS.green });
      } catch (error) {
        return respond(interaction, "Tag Not Removed", [
          `> ${error.message}`,
        ], { color: COLORS.red });
      }
    },
  };
}

function helpCommand() {
  return {
    data: new SlashCommandBuilder()
      .setName("help")
      .setDescription("Show bot commands and access rules"),
    async execute(interaction) {
      return respond(interaction, "Bot Commands", [
        "> `/tag-1738 username` — assign Roblox group rank 17.",
        "> `/tag-dream username` — assign Roblox group rank 6.",
        "> `/strip-tag username section` — reset one account to rank 0.",
        "> `/group` — show the Roblox community link.",
        "> `/raidpoints add user amount` — admins add points.",
        "> `/raidpoints lb` — post or refresh the live leaderboard.",
        "> `/whitelist-admin add|remove|list` — owner manages admins.",
        "> `/whitelist-member add|remove|list` — admins manage tag access.",
        "> `/tag-wl add|remove|list` — same tag-access whitelist, shorter command.",
        "> Only the bot owner can manage admins. Admins manage the tag whitelist and raid points.",
      ]);
    },
  };
}

const commands = [
  tagCommand(TAGS["1738"].command, TAGS["1738"].label, TAGS["1738"].rank),
  tagCommand(TAGS.dream.command, TAGS.dream.label, TAGS.dream.rank),
  raidPointsCommand(),
  whitelistHandlers("whitelist-admin", "admins"),
  whitelistHandlers("whitelist-member", "members"),
  whitelistHandlers("tag-wl", "members"),
  stripTagCommand(),
  helpCommand(),
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
  return commands;
}

export function getCommandPayloads() {
  return commands.map((command) => command.data.toJSON());
}
