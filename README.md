# Roblox Raid Points Discord Bot

A small Discord bot for the To You In A Thousand Years Roblox community. It assigns the DREAM group rank, tracks raid points, and keeps a live leaderboard message updated.

The bot uses Roblox Open Cloud. It does not accept, request, or save a `.ROBLOSECURITY` cookie.

## Setup

1. Create a Discord application and bot in the Discord Developer Portal. Add the bot to your server with the `bot` and `applications.commands` scopes.
2. For Roblox tag commands, create a Roblox Open Cloud API key for an account that can manage member roles in group `1103375761`. Give it the minimum needed `group:read` and `group:write` permissions.
3. Copy `.env.example` to `.env` for local hosting, or set each variable as a secret/environment variable on your hosting provider:
   - `DISCORD_BOT_TOKEN` — secret bot token
   - `DISCORD_CLIENT_ID` — Discord application ID
   - `BOT_OWNER_ID` — Discord user ID for the bot owner and initial allowlist manager
   - `ROBLOX_OPEN_CLOUD_API_KEY` — secret Open Cloud key (only needed for Roblox tag commands)
4. Install dependencies with `npm install` (or `pnpm install`).
5. Run `npm start` (or `pnpm start`). This registers commands globally, then starts the bot. After updating the bot, run `npm run deploy` or restart with `npm start` so Discord receives the latest command list. Global command changes can take a little while to appear in Discord.

Do not put a bot token or Open Cloud key in chat, source code, or a committed `.env` file. In Replit, add secret values through Tools > Secrets.

## Commands

All commands are registered globally and can be used in a server where the bot is installed. Commands are restricted to the configured bot owner, bot admins, and members on that server's bot allowlist. A Discord server Administrator role does not grant access by itself.

### Roblox tags

- `/tag-dream username` — assigns the group role at rank 6 to that Roblox account.
- `/strip-tag username section` — removes the DREAM tag role from one Roblox account. This only changes one username at a time.
- `/tag-history limit` — bot admins view recent bot commands, who ran them, and their targets (up to 25 entries).
- `/group` — posts the Roblox community link.

The bot resolves the username, looks up the account's group membership record, then assigns or unassigns the selected role. The account must already be in the group, and the Open Cloud key's Roblox user must be allowed to manage its roles.

### Raid points

- `/raidpoints add user amount` — adds 1–1000 points to a Discord member. Bot admins and the bot owner can use it.
- `/raidpoints lb` — posts the top 10 in the channel where it is used. Players in the top 10 are mentioned without notifications. The bot stores that message and edits it whenever points are added.

Points are saved per server in `data/bot-data.json`. Keep that folder on persistent storage if you host the bot somewhere that resets local files.

### Whitelists

- `/whitelist-admin add user` — lets the bot owner or an existing bot admin add a bot admin.
- `/whitelist-admin remove user` — removes a bot admin.
- `/whitelist-admin list` — lists bot admins.
- `/whitelist-member add user` — lets a bot admin allow a member to use the bot's commands.
- `/whitelist-member remove user` — removes the member's bot access.
- `/whitelist-member list` — lists members allowed to use the bot.
- `/tag-wl add|remove|list user` — a shorter alias for managing the bot allowlist.

Every command requires bot access. The configured bot owner and existing bot admins always have access; everyone else—including Discord server Administrators—must be explicitly added with `/whitelist-member add`. The Discord Administrator role never bypasses the bot allowlist. Members on the bot allowlist can use regular commands; only the bot owner and bot admins can add raid points, view command history, or manage either whitelist. The bot owner can use all commands and is the initial operator who can add members or bot admins. Command replies silently mention the person who ran them.

## Safety and data

- Roblox API keys and Discord bot tokens are read from environment variables and never written to bot data.
- Only one Roblox account can be changed per tag command; there is no bulk "everyone" operation.
- Local whitelist and raid point data is stored in `data/bot-data.json`. It does not include credentials.
- Up to 500 recent command audit records are stored per server in the same file. The history is recorded from the time this version is installed.
- Roblox tag changes post public results with a circular Roblox headshot when the thumbnail service is available.
- Command responses use cyan Discord Components V2 cards with the `>` detail-line format from the supplied reference. No emojis are used.
