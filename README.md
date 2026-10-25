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
5. Run `npm start` (or `pnpm start`). This registers commands globally, then starts the bot. After updating the bot, run `npm run deploy` or restart with `npm start` so Discord receives the latest command list. Global command changes can take a little while to appear in Discord.

Do not put a bot token or Open Cloud key in chat, source code, or a committed `.env` file. In Replit, add secret values through Tools > Secrets.

## Commands

All commands are registered globally and can be used in any server where the bot is installed.

### Roblox tags

- `/tag-1738 username` — assigns the group role at rank 17 to that Roblox account.
- `/tag-dream username` — assigns the group role at rank 6 to that Roblox account.
- `/strip-tag username section` — removes only the selected tag role from one Roblox account. `section` must be `1738` or `dream`; this only changes one username at a time.
- `/tag-history limit` — admins view recent bot commands, who ran them, and their targets (up to 25 entries).
- `/group` — posts the Roblox community link.

The bot resolves the username, looks up the account's group membership record, then assigns or unassigns the selected role. The account must already be in the group, and the Open Cloud key's Roblox user must be allowed to manage its roles.

### Raid points

- `/raidpoints add user amount` — adds 1–1000 points to a Discord member. Admins and the bot owner can use it.
- `/raidpoints lb` — posts the leaderboard in the channel where it is used. The bot stores that message and edits it whenever points are added.

Points are saved per server in `data/bot-data.json`. Keep that folder on persistent storage if you host the bot somewhere that resets local files.

### Whitelists

- `/whitelist-admin add user` — lets the bot owner or a Discord server Administrator add a bot admin.
- `/whitelist-admin remove user` — removes a bot admin.
- `/whitelist-admin list` — lists bot admins.
- `/whitelist-member add user` — lets an admin allow a member to use the Roblox tag commands.
- `/whitelist-member remove user` — removes tag-command access.
- `/whitelist-member list` — lists users allowed to use tag commands.
- `/tag-wl add|remove|list user` — a shorter alias for managing the tag-command whitelist.

The bot owner, a Discord server Administrator, or a bot admin can manage raid points and view history. Discord server Administrators and the configured bot owner can manage the bot-admin whitelist. Bot admins can manage the member/tag whitelist. The owner can use all commands. Command replies silently mention the person who ran the command.

## Safety and data

- Roblox API keys and Discord bot tokens are read from environment variables and never written to bot data.
- Only one Roblox account can be changed per tag command; there is no bulk "everyone" operation.
- Local whitelist and raid point data is stored in `data/bot-data.json`. It does not include credentials.
- Up to 500 recent command audit records are stored per server in the same file. The history is recorded from the time this version is installed.
- Roblox tag changes post public results with a circular Roblox headshot when the thumbnail service is available.
- Command responses use cyan Discord Components V2 cards with the `>` detail-line format from the supplied reference. No emojis are used.
