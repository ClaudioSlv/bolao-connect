export function participantAccessCookieName(slug: string) {
  const safeSlug = slug.toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(0, 80);
  return `btp_participant_${safeSlug}`;
}
