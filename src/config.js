export const GROUP_ID = "1103375761";
export const GROUP_URL =
  "https://www.roblox.com/communities/1103375761/to-you-in-a-thousand-years#!/about";

export const TAGS = Object.freeze({
  "1738": { command: "tag-1738", label: "1738", rank: 17 },
  dream: { command: "tag-dream", label: "DREAM", rank: 6 },
});

export function getRuntimeConfig(env = process.env) {
  const missing = [
    "DISCORD_BOT_TOKEN",
    "DISCORD_CLIENT_ID",
    "BOT_OWNER_ID",
    "ROBLOX_OPEN_CLOUD_API_KEY",
  ].filter((key) => !env[key]?.trim());

  return {
    missing,
    discordToken: env.DISCORD_BOT_TOKEN?.trim(),
    discordClientId: env.DISCORD_CLIENT_ID?.trim(),
    ownerId: env.BOT_OWNER_ID?.trim(),
    robloxApiKey: env.ROBLOX_OPEN_CLOUD_API_KEY?.trim(),
  };
}
