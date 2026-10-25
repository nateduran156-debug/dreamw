import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const dataPath = resolve(
  process.env.BOT_DATA_FILE ?? "data/bot-data.json",
);

function emptyState() {
  return {
    guilds: {},
  };
}

function readState() {
  try {
    const parsed = JSON.parse(readFileSync(dataPath, "utf8"));
    if (parsed && typeof parsed === "object" && parsed.guilds) return parsed;
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Could not read bot data; starting with an empty state.", error);
    }
  }

  return emptyState();
}

function writeState(state) {
  mkdirSync(dirname(dataPath), { recursive: true });
  const temporaryPath = `${dataPath}.tmp`;
  writeFileSync(temporaryPath, JSON.stringify(state, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  renameSync(temporaryPath, dataPath);
}

function getGuildState(state, guildId) {
  state.guilds[guildId] ??= {
    admins: [],
    tagWhitelist: [],
    raidPoints: {},
    leaderboard: null,
  };
  return state.guilds[guildId];
}

export function isOwner(userId, ownerId) {
  return userId === ownerId;
}

export function isAdmin(guildId, userId, ownerId) {
  if (isOwner(userId, ownerId)) return true;
  const state = readState();
  return getGuildState(state, guildId).admins.includes(userId);
}

export function canUseTags(guildId, userId, ownerId) {
  if (isAdmin(guildId, userId, ownerId)) return true;
  const state = readState();
  return getGuildState(state, guildId).tagWhitelist.includes(userId);
}

export function addAdmin(guildId, userId) {
  const state = readState();
  const guild = getGuildState(state, guildId);
  if (!guild.admins.includes(userId)) guild.admins.push(userId);
  writeState(state);
}

export function removeAdmin(guildId, userId) {
  const state = readState();
  const guild = getGuildState(state, guildId);
  guild.admins = guild.admins.filter((id) => id !== userId);
  writeState(state);
}

export function listAdmins(guildId) {
  const state = readState();
  return [...getGuildState(state, guildId).admins];
}

export function addTagWhitelist(guildId, userId) {
  const state = readState();
  const guild = getGuildState(state, guildId);
  if (!guild.tagWhitelist.includes(userId)) guild.tagWhitelist.push(userId);
  writeState(state);
}

export function removeTagWhitelist(guildId, userId) {
  const state = readState();
  const guild = getGuildState(state, guildId);
  guild.tagWhitelist = guild.tagWhitelist.filter((id) => id !== userId);
  writeState(state);
}

export function listTagWhitelist(guildId) {
  const state = readState();
  return [...getGuildState(state, guildId).tagWhitelist];
}

export function addRaidPoints(guildId, userId, amount) {
  const state = readState();
  const guild = getGuildState(state, guildId);
  guild.raidPoints[userId] = (guild.raidPoints[userId] ?? 0) + amount;
  writeState(state);
  return guild.raidPoints[userId];
}

export function getRaidLeaderboard(guildId, limit = 10) {
  const state = readState();
  const points = getGuildState(state, guildId).raidPoints;
  return Object.entries(points)
    .map(([userId, amount]) => ({ userId, amount }))
    .sort((a, b) => b.amount - a.amount || a.userId.localeCompare(b.userId))
    .slice(0, limit);
}

export function getLeaderboardMessage(guildId) {
  const state = readState();
  return getGuildState(state, guildId).leaderboard;
}

export function setLeaderboardMessage(guildId, channelId, messageId) {
  const state = readState();
  getGuildState(state, guildId).leaderboard = { channelId, messageId };
  writeState(state);
}

export function getDataFilePath() {
  return dataPath;
}
