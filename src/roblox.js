import { GROUP_ID, TAGS } from "./config.js";

const USERS_API = "https://users.roblox.com/v1";
const GROUPS_API = "https://groups.roblox.com/v1";
const CLOUD_API = "https://apis.roblox.com/cloud/v2";

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      data?.errors?.[0]?.message ??
      data?.message ??
      `Roblox returned HTTP ${response.status}.`;
    throw new Error(message);
  }
  return data;
}

export async function findRobloxUser(username) {
  const response = await fetch(`${USERS_API}/usernames/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      usernames: [username],
      excludeBannedUsers: false,
    }),
  });
  const data = await readJson(response);
  return data.data?.[0] ?? null;
}

async function getMembershipId(userId, apiKey) {
  const params = new URLSearchParams({
    maxPageSize: "1",
    filter: `user == 'users/${userId}'`,
  });
  const response = await fetch(
    `${CLOUD_API}/groups/${GROUP_ID}/memberships?${params.toString()}`,
    { headers: { "x-api-key": apiKey } },
  );
  const data = await readJson(response);
  const membership = data.groupMemberships?.[0];
  if (!membership?.path) {
    throw new Error("That Roblox account is not a member of the group.");
  }
  return membership.path.split("/").at(-1);
}

async function getRoleIdForRank(rank) {
  const response = await fetch(`${GROUPS_API}/groups/${GROUP_ID}/roles`);
  const data = await readJson(response);
  const role = data.roles?.find((entry) => Number(entry.rank) === rank);
  if (!role) {
    throw new Error(`The group does not have a role at rank ${rank}.`);
  }
  return role.id;
}

async function changeRole(username, rank, apiKey, action) {
  if (!apiKey) {
    throw new Error("The Roblox Open Cloud API key is not configured.");
  }

  const user = await findRobloxUser(username);
  if (!user) throw new Error(`No Roblox account named "${username}" was found.`);

  try {
    const [membershipId, roleId] = await Promise.all([
      getMembershipId(user.id, apiKey),
      getRoleIdForRank(rank),
    ]);
    const response = await fetch(
      `${CLOUD_API}/groups/${GROUP_ID}/memberships/${membershipId}:${action}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          role: `groups/${GROUP_ID}/roles/${roleId}`,
        }),
      },
    );
    await readJson(response);
    return { username: user.name, userId: user.id, rank };
  } catch (error) {
    if (error instanceof Error) {
      error.robloxUsername = user.name;
      error.robloxUserId = user.id;
    }
    throw error;
  }
}

export async function assignRank(username, rank, apiKey) {
  return changeRole(username, rank, apiKey, "assignRole");
}

export async function applyTag(username, tagKey, apiKey) {
  const tag = TAGS[tagKey];
  if (!tag) throw new Error("Unknown tag section.");
  return assignRank(username, tag.rank, apiKey);
}

export async function stripTag(username, tagKey, apiKey) {
  const tag = TAGS[tagKey];
  if (!tag) throw new Error("Unknown tag section.");
  return changeRole(username, tag.rank, apiKey, "unassignRole");
}

export async function getRobloxAvatarUrl(userId) {
  const params = new URLSearchParams({
    userIds: String(userId),
    size: "150x150",
    format: "Png",
    isCircular: "true",
  });

  try {
    const response = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?${params}`,
    );
    if (!response.ok) return null;
    const data = await response.json().catch(() => ({}));
    const thumbnail = data.data?.find(
      (entry) => Number(entry.targetId) === Number(userId),
    ) ?? data.data?.[0];
    return thumbnail?.imageUrl ?? null;
  } catch {
    return null;
  }
}
