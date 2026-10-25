import test from "node:test";
import assert from "node:assert/strict";
import { getCommandPayloads } from "../src/commands.js";
import { getRuntimeConfig, GROUP_ID, GROUP_URL, TAGS } from "../src/config.js";
import { cardPayload } from "../src/ui.js";

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
    "group",
    "help",
  ]) {
    assert.ok(names.includes(required), `missing /${required}`);
  }

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
  const payload = cardPayload("Test", ["> Rank: 17"], 0x5865f2, true);
  assert.equal(payload.flags & (1 << 15), 1 << 15);
  assert.equal(payload.flags & (1 << 6), 1 << 6);
  assert.equal(payload.components[0].components[2].content, "> Rank: 17");
});
