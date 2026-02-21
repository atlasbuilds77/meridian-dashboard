const configuredAdminIds = (process.env.ADMIN_DISCORD_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

export function getAdminDiscordIds(): string[] {
  return configuredAdminIds;
}

export function isAdminDiscordId(discordId: string): boolean {
  return configuredAdminIds.includes(discordId);
}

export function hasConfiguredAdminIds(): boolean {
  return configuredAdminIds.length > 0;
}
