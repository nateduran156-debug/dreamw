const COMPONENTS_V2 = 1 << 15;
const EPHEMERAL = 1 << 6;
const SUPPRESS_NOTIFICATIONS = 1 << 12;

export const COLORS = Object.freeze({
  cyan: 0x00d1ff,
  blue: 0x00d1ff,
  green: 0x00d1ff,
  red: 0x00d1ff,
  yellow: 0x00d1ff,
});

export function cardPayload(
  title,
  lines,
  color = COLORS.blue,
  ephemeral = false,
  options = {},
) {
  const body = Array.isArray(lines) ? lines.join("\n") : lines;
  const mentionUserIds = [
    ...(options.mentionUserId ? [String(options.mentionUserId)] : []),
    ...(options.mentionUserIds ?? []).map(String),
  ];
  const uniqueMentionUserIds = [...new Set(mentionUserIds)];
  const suppressNotifications =
    options.suppressNotifications ?? uniqueMentionUserIds.length > 0;
  const titleComponent = options.thumbnailUrl
    ? {
        type: 9,
        components: [{ type: 10, content: `## ${title}` }],
        accessory: {
          type: 11,
          media: { url: options.thumbnailUrl },
          description: options.thumbnailAlt ?? title,
        },
      }
    : { type: 10, content: `## ${title}` };

  return {
    flags:
      COMPONENTS_V2 |
      (ephemeral ? EPHEMERAL : 0) |
      (suppressNotifications ? SUPPRESS_NOTIFICATIONS : 0),
    allowedMentions: uniqueMentionUserIds.length
      ? { parse: [], users: uniqueMentionUserIds, repliedUser: false }
      : { parse: [] },
    components: [
      {
        type: 17,
        accent_color: color,
        components: [
          titleComponent,
          { type: 14, divider: true, spacing: 1 },
          { type: 10, content: body },
        ],
      },
    ],
  };
}

export async function respond(interaction, title, lines, options = {}) {
  const mentionUserId = interaction.user?.id;
  const responseLines = mentionUserId
    ? [`> <@${mentionUserId}>`, ...(Array.isArray(lines) ? lines : [lines])]
    : lines;
  const payload = cardPayload(
    title,
    responseLines,
    options.color ?? COLORS.blue,
    options.ephemeral ?? true,
    {
      thumbnailUrl: options.thumbnailUrl,
      thumbnailAlt: options.thumbnailAlt,
      mentionUserId,
    },
  );

  if (interaction.deferred || interaction.replied) {
    payload.flags &= ~(EPHEMERAL | SUPPRESS_NOTIFICATIONS);
    return interaction.editReply(payload);
  }
  return interaction.reply(payload);
}

export function leaderboardPayload(
  lines,
  mentionUserIds = [],
  options = {},
) {
  return cardPayload("Raid Points Leaderboard", lines, COLORS.blue, false, {
    mentionUserIds,
    suppressNotifications: options.suppressNotifications,
  });
}
