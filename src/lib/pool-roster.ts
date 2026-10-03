export type PoolDeadlines = { payment_deadline: string | null; waitlist_payment_deadline?: string | null };
export function finalPoolDeadline(pool: PoolDeadlines): string | null {
  const values = [pool.payment_deadline, pool.waitlist_payment_deadline].filter((v): v is string => Boolean(v));
  return values.sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
}
export function rosterAvailable(pool: PoolDeadlines, now = Date.now()): boolean {
  const deadline = finalPoolDeadline(pool);
  return Boolean(deadline && now > Date.parse(deadline));
}
export function participantDeadline(pool: PoolDeadlines, participant: { payment_deadline_override?: string | null; status?: string }): string | null {
  return participant.payment_deadline_override || (participant.status === "waitlisted" ? finalPoolDeadline(pool) : pool.payment_deadline);
}

export function verifiedPixPaidAt(pix: { horario?: unknown }[], now = Date.now()): string | null {
  const times = pix.map(item => Date.parse(String(item.horario || "")));
  return times.length && times.every(time => Number.isFinite(time) && time <= now)
    ? new Date(Math.max(...times)).toISOString() : null;
}
