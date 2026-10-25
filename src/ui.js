const COMPONENTS_V2 = 1 << 15;
const EPHEMERAL = 1 << 6;

export const COLORS = Object.freeze({
  blue: 0x5865f2,
  green: 0x57f287,
  red: 0xed4245,
  yellow: 0xfee75c,
});

export function cardPayload(title, lines, color = COLORS.blue, ephemeral = false) {
  const body = Array.isArray(lines) ? lines.join("\n") : lines;

  return {
    flags: COMPONENTS_V2 | (ephemeral ? EPHEMERAL : 0),
    allowedMentions: { parse: [] },
    components: [
      {
        type: 17,
        accent_color: color,
        components: [
          { type: 10, content: `## ${title}` },
          { type: 14, divider: true, spacing: 1 },
          { type: 10, content: body },
        ],
      },
    ],
  };
}

export async function respond(interaction, title, lines, options = {}) {
  const payload = cardPayload(
    title,
    lines,
    options.color ?? COLORS.blue,
    options.ephemeral ?? true,
  );

  if (interaction.deferred || interaction.replied) {
    payload.flags &= ~EPHEMERAL;
    return interaction.editReply(payload);
  }
  return interaction.reply(payload);
}

export function leaderboardPayload(lines) {
  return cardPayload("Raid Points Leaderboard", lines, COLORS.blue, false);
}
