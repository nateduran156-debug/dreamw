import test from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getRuntimeConfig, GROUP_ID, GROUP_URL, TAGS } from "../src/config.js";
import { cardPayload } from "../src/ui.js";

process.env.BOT_DATA_FILE ??= join(
  tmpdir(),
  `discord-roblox-bot-test-${process.pid}.json`,
);
const { getCommandPayloads, getCommands } = await import("../src/commands.js");

test("registers the requested command set globally by name", () => {
  const commands = getCommandPayloads();
  const names = commands.map((command) => command.name);

  for (const required of [
    "tag-1738",
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

  assert.ok(!names.includes("help"), "/help should not be registered");
  assert.equal(new Set(names).size, names.length);
});

test("uses the specified Roblox group and ranks", () => {
  assert.equal(GROUP_ID, "1103375761");
  assert.match(GROUP_URL, /1103375761/);
  assert.equal(TAGS["1738"].rank, 17);
  assert.equal(TAGS.dream.rank, 6);
});

test("requires runtime secrets without exposing their values", () => {
  const config = getRuntimeConfig({});
  assert.deepEqual(config.missing, [
    "DISCORD_BOT_TOKEN",
    "DISCORD_CLIENT_ID",
    "BOT_OWNER_ID",
    "ROBLOX_OPEN_CLOUD_API_KEY",
  ]);
});

test("reference-style cards use quote-prefixed details and no emoji", () => {
  const payload = cardPayload("Test", ["> Rank: 17"], 0x00d1ff, true);
  assert.equal(payload.flags & (1 << 15), 1 << 15);
  assert.equal(payload.flags & (1 << 6), 1 << 6);
  assert.equal(payload.components[0].components[2].content, "> Rank: 17");
  assert.equal(payload.components[0].accent_color, 0x00d1ff);
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

test("a Discord server Administrator can use the whitelist commands", async () => {
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

  assert.equal(
    responsePayload.components[0].components[0].components[0].content,
    "## Tag Whitelist",
  );
  assert.deepEqual(responsePayload.allowedMentions.users, ["server-admin"]);
});

test("a Discord server Administrator can add raid points", async () => {
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

  assert.match(
    responsePayload.components[0].components[2].content,
    /Added 7 points for Player/,
  );
  assert.match(
    responsePayload.components[0].components[2].content,
    /New total: 7/,
  );
});

test("raidpoints lb posts and saves the cyan leaderboard", async () => {
  let responsePayload;
  let leaderboardPayload;
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
    responsePayload.components[0].components[0].components[0].content,
    "## Leaderboard Ready",
  );
});

test("the group command responds with a silent mention", async () => {
  let responsePayload;
  const interaction = {
    user: { id: "group-user", username: "GroupUser" },
    reply: async (payload) => {
      responsePayload = payload;
      return payload;
    },
  };
  const command = getCommands().find((entry) => entry.data.name === "group");

  await command.execute(interaction);

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
