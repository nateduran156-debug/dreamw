# Roblox Raid Points Discord Bot

A small Discord bot for the To You In A Thousand Years Roblox community. It assigns the two requested Roblox group ranks, tracks raid points, and keeps a live leaderboard message updated.

The bot uses Roblox Open Cloud. It does not accept, request, or save a `.ROBLOSECURITY` cookie.

## Setup

1. Create a Discord application and bot in the Discord Developer Portal. Add the bot to your server with the `bot` and `applications.commands` scopes.
2. Create a Roblox Open Cloud API key for a Roblox account that can manage member roles in the group. Give it the minimum needed `group:read` and `group:write` permissions for group `1103375761`.
3. Copy `.env.example` to `.env` for local hosting, or set each variable as a secret/environment variable on your hosting provider:
   - `DISCORD_BOT_TOKEN` — secret bot token
   - `DISCORD_CLIENT_ID` — Discord application ID
   - `BOT_OWNER_ID` — Discord user ID that controls the admin whitelist
   - `ROBLOX_OPEN_CLOUD_API_KEY` — secret Open Cloud key
4. Install dependencies with `npm install` (or `pnpm install`).
5. Run `pnpm start`. This registers commands globally, then starts the bot. Global commands can take a little while to appear in Discord.

Do not put a bot token or Open Cloud key in chat, source code, or a committed `.env` file. In Replit, add secret values through Tools > Secrets.

## Commands

All commands are registered globally and can be used in any server where the bot is installed.

### Roblox tags

- `/tag-1738 username` — assigns the group role at rank 17 to that Roblox account.
- `/tag-dream username` — assigns the group role at rank 6 to that Roblox account.
- `/strip-tag username section` — resets one Roblox account to the group's base rank (rank 0). `section` must be `1738` or `dream`; this only changes one username at a time.
- `/group` — posts the Roblox community link.

The bot resolves the username, looks up the account's group membership record, then assigns the requested role. It does not check the member's current rank first. The account must already be in the group, and the Open Cloud key's Roblox user must be allowed to manage its roles.

### Raid points

- `/raidpoints add user amount` — adds 1–1000 points to a Discord member. Admins and the bot owner can use it.
- `/raidpoints lb` — posts the leaderboard in the channel where it is used. The bot stores that message and edits it whenever points are added.

Points are saved per server in `data/bot-data.json`. Keep that folder on persistent storage if you host the bot somewhere that resets local files.

### Whitelists

- `/whitelist-admin add user` — lets the bot owner add an admin.
- `/whitelist-admin remove user` — lets the bot owner remove an admin.
- `/whitelist-admin list` — lets the bot owner view the server's admins.
- `/whitelist-member add user` — lets an admin allow a member to use the Roblox tag commands.
- `/whitelist-member remove user` — removes tag-command access.
- `/whitelist-member list` — lists users allowed to use tag commands.
- `/tag-wl add|remove|list user` — a shorter alias for managing the tag-command whitelist.
- `/help` — displays the bot's commands and access rules.

Admins can manage the member/tag whitelist and raid points. Only `BOT_OWNER_ID` can manage admins. The owner can use all commands.

## Safety and data

- Roblox API keys and Discord bot tokens are read from environment variables and never written to bot data.
- Only one Roblox account can be changed per tag command; there is no bulk "everyone" operation.
- Local whitelist and raid point data is stored in `data/bot-data.json`. It does not include credentials.
- Command responses use Discord Components V2 cards with the `>` detail-line format from the supplied reference. No emojis are used.
