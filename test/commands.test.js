import test from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getRuntimeConfig, GROUP_ID, GROUP_URL, TAGS } from "../src/config.js";
import { cardPayload, respond } from "../src/ui.js";

process.env.BOT_DATA_FILE ??= join(
  tmpdir(),
  `discord-roblox-bot-test-${process.pid}.json`,
);
const { addBotWhitelist } = await import("../src/storage.js");
const { getCommandPayloads, getCommands } = await import("../src/commands.js");

function responseTitle(payload) {
  const heading = payload.components[0].components[0];
  return heading.type === 9
    ? heading.components[0].content
    : heading.content;
}

test("registers the requested command set globally by name", () => {
  const commands = getCommandPayloads();
  const names = commands.map((command) => command.name);

  for (const required of [
    "tag-dream",
    "raidpoints",
    "whitelist-admin",
    "whitelist-member",
    "tag-wl",
    "strip-tag",
    "tag-history",
    "group",
  ]) {
    assert.ok(names.includes(required), `missing /${required}`);
  }

  assert.ok(!names.includes("tag-1738"), "/tag-1738 should be removed");
  assert.ok(!names.includes("help"), "/help should not be registered");
  assert.equal(new Set(names).size, names.length);
  const stripTag = commands.find((command) => command.name === "strip-tag");
  assert.deepEqual(
    stripTag.options.find((option) => option.name === "section").choices.map(
      ({ name, value }) => ({ name, value }),
    ),
    [{ name: "DREAM", value: "dream" }],
  );
});

test("uses the specified Roblox group and DREAM rank", () => {
  assert.equal(GROUP_ID, "1103375761");
  assert.match(GROUP_URL, /1103375761/);
  assert.equal(TAGS.dream.rank, 6);
});

test("only requires Discord settings to start and deploy commands", () => {
  const config = getRuntimeConfig({});
  assert.deepEqual(config.missing, [
    "DISCORD_BOT_TOKEN",
    "DISCORD_CLIENT_ID",
    "BOT_OWNER_ID",
  ]);
  assert.equal(config.robloxApiKey, undefined);
});

test("reference-style cards use quote-prefixed details and no emoji", () => {
  const payload = cardPayload("Test", ["> Rank: 17"], 0x00d1ff, true);
  assert.equal(payload.flags & (1 << 15), 1 << 15);
  assert.equal(payload.flags & (1 << 6), 1 << 6);
  assert.equal(payload.components[0].components[2].content, "> Rank: 17");
  assert.equal(payload.components[0].accent_color, 0x00d1ff);
});

test("cards without an avatar use a valid text heading", () => {
  const payload = cardPayload("Raid Points Added", ["> Added points."], 0x00d1ff);
  const heading = payload.components[0].components[0];

  assert.equal(heading.type, 10);
  assert.equal(heading.content, "## Raid Points Added");
});

test("command replies silently mention the invoking user", async () => {
  const payload = cardPayload(
    "Test",
    ["> <@12345>", "> Done."],
    0x00d1ff,
    true,
    { mentionUserId: "12345" },
  );

  assert.deepEqual(payload.allowedMentions, {
    parse: [],
    users: ["12345"],
    repliedUser: false,
  });
  assert.equal(payload.flags & (1 << 12), 1 << 12);
});

test("deferred replies only use flags allowed when editing", async () => {
  let responsePayload;
  const interaction = {
    user: { id: "12345" },
    deferred: true,
    editReply: async (payload) => {
      responsePayload = payload;
      return payload;
    },
  };

  await respond(interaction, "Done", ["> Finished."]);

  assert.equal(responsePayload.flags & (1 << 15), 1 << 15);
  assert.equal(responsePayload.flags & (1 << 6), 0);
  assert.equal(responsePayload.flags & (1 << 12), 0);
});

test("a Discord server Administrator cannot use commands without bot allowlist access", async () => {
  let responsePayload;
  const interaction = {
    guildId: "guild-whitelist-test",
    user: { id: "server-admin", username: "ServerAdmin" },
    memberPermissions: { has: () => true },
    options: { getSubcommand: () => "list" },
    reply: async (payload) => {
      responsePayload = payload;
      return payload;
    },
  };
  const command = getCommands().find(
    (entry) => entry.data.name === "whitelist-member",
  );

  await command.execute(interaction, { ownerId: "bot-owner" });

  assert.equal(responseTitle(responsePayload), "## Access Not Whitelisted");
});

test("a Discord server Administrator cannot add raid points without bot allowlist access", async () => {
  let responsePayload;
  const interaction = {
    guildId: "guild-raid-points-test",
    guild: { id: "guild-raid-points-test" },
    user: { id: "server-admin", username: "ServerAdmin" },
    memberPermissions: { has: () => true },
    options: {
      getSubcommand: () => "add",
      getUser: () => ({ id: "target-user", username: "Player" }),
      getInteger: () => 7,
    },
    reply: async (payload) => {
      responsePayload = payload;
      return payload;
    },
  };
  const command = getCommands().find(
    (entry) => entry.data.name === "raidpoints",
  );

  await command.execute(interaction, { ownerId: "bot-owner" });

  assert.equal(responseTitle(responsePayload), "## Access Not Whitelisted");
});

test("an allowlisted server Administrator can post the live leaderboard", async () => {
  let responsePayload;
  let leaderboardPayload;
  await addBotWhitelist("guild-leaderboard-test", "leaderboard-user");
  const channel = {
    id: "leaderboard-channel",
    isTextBased: () => true,
    send: async (payload) => {
      leaderboardPayload = payload;
      return { channelId: "leaderboard-channel", id: "leaderboard-message" };
    },
  };
  const interaction = {
    guildId: "guild-leaderboard-test",
    guild: {
      id: "guild-leaderboard-test",
      channels: { fetch: async () => channel },
    },
    channel,
    user: { id: "leaderboard-user", username: "LeaderboardUser" },
    memberPermissions: { has: () => true },
    options: { getSubcommand: () => "lb" },
    deferred: false,
    replied: false,
    deferReply: async () => {
      interaction.deferred = true;
    },
    editReply: async (payload) => {
      responsePayload = payload;
      return payload;
    },
  };
  const command = getCommands().find(
    (entry) => entry.data.name === "raidpoints",
  );

  await command.execute(interaction, { ownerId: "bot-owner" });

  assert.equal(leaderboardPayload.components[0].accent_color, 0x00d1ff);
  assert.equal(
    responseTitle(responsePayload),
    "## Leaderboard Ready",
  );
});

test("raid point updates defer before refreshing a saved leaderboard", async () => {
  const { setLeaderboardMessage } = await import("../src/storage.js");
  const guildId = "guild-raid-points-defer-test";
  setLeaderboardMessage(guildId, "leaderboard-channel", "leaderboard-message");

  let deferred = false;
  const message = {
    edit: async () => message,
  };
  const channel = {
    id: "leaderboard-channel",
    isTextBased: () => true,
    messages: {
      fetch: async () => {
        assert.equal(deferred, true);
        return message;
      },
    },
  };
  const interaction = {
    guildId,
    guild: {
      id: guildId,
      channels: { fetch: async () => channel },
      members: { fetch: async () => ({ displayName: "Player" }) },
    },
    user: { id: "raid-admin", username: "RaidAdmin" },
    options: {
      getSubcommand: () => "add",
      getUser: () => ({ id: "raid-target", username: "Player" }),
      getInteger: () => 7,
    },
    deferReply: async (options) => {
      assert.deepEqual(options, { ephemeral: true });
      deferred = true;
      interaction.deferred = true;
    },
    editReply: async (payload) => payload,
  };
  const command = getCommands().find(
    (entry) => entry.data.name === "raidpoints",
  );

  await command.execute(interaction, { ownerId: "raid-admin" });
  assert.equal(deferred, true);
});

test("the allowlisted bot owner can use the group command", async () => {
  let responsePayload;
  const interaction = {
    guildId: "guild-group-test",
    user: { id: "group-user", username: "GroupUser" },
    reply: async (payload) => {
      responsePayload = payload;
      return payload;
    },
  };
  const command = getCommands().find((entry) => entry.data.name === "group");

  await command.execute(interaction, { ownerId: "group-user" });

  assert.equal(responsePayload.allowedMentions.users[0], "group-user");
  assert.equal(responsePayload.flags & (1 << 12), 1 << 12);
  assert.match(responsePayload.components[0].components[2].content, /<@group-user>/);
});

test("cards can put an avatar thumbnail beside the title", () => {
  const payload = cardPayload(
    "Tag Applied",
    ["> Updated user."],
    0x57f287,
    false,
    { thumbnailUrl: "https://example.com/avatar.png", thumbnailAlt: "User avatar" },
  );
  const section = payload.components[0].components[0];
  assert.equal(section.type, 9);
  assert.equal(section.accessory.type, 11);
  assert.equal(section.accessory.media.url, "https://example.com/avatar.png");
  assert.equal(payload.flags & (1 << 6), 0);
});

test("strip-tag defers publicly and shows the circular target avatar", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const address = String(url);
    if (address.includes("/usernames/users")) {
      return { ok: true, json: async () => ({ data: [{ id: 12345, name: "Tester" }] }) };
    }
    if (address.includes("/memberships?")) {
      return {
        ok: true,
        json: async () => ({
          groupMemberships: [{ path: "groups/1103375761/memberships/9876" }],
        }),
      };
    }
    if (address.endsWith("/roles")) {
      return { ok: true, json: async () => ({ roles: [{ id: "role-6", rank: 6 }] }) };
    }
    if (address.includes(":unassignRole")) {
      return { ok: true, json: async () => ({ path: "groups/1103375761/memberships/9876" }) };
    }
    if (address.includes("avatar-headshot")) {
      return {
        ok: true,
        json: async () => ({
          data: [{ targetId: 12345, imageUrl: "https://images.example/round.png" }],
        }),
      };
    }
    throw new Error(`Unexpected request: ${address}`);
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  let deferredOptions;
  let responsePayload;
  const interaction = {
    guildId: "guild-1",
    user: { id: "owner-1" },
    deferred: false,
    replied: false,
    options: {
      getString: (name) => (name === "username" ? "Tester" : "dream"),
    },
    deferReply: async (options) => {
      deferredOptions = options;
      interaction.deferred = true;
    },
    editReply: async (payload) => {
      responsePayload = payload;
      return payload;
    },
  };
  const command = getCommands().find((entry) => entry.data.name === "strip-tag");

  await command.execute(interaction, {
    ownerId: "owner-1",
    robloxApiKey: "test-api-key",
  });

  assert.deepEqual(deferredOptions, { ephemeral: false });
  assert.equal(responsePayload.components[0].components[0].accessory.media.url,
    "https://images.example/round.png");
  assert.equal(responsePayload.flags & (1 << 6), 0);
});
