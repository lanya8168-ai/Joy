export function getCooldownRemaining(lastUsed: string | null, cooldownHours: number): number {
  if (!lastUsed) return 0;
  
  const lastUsedTime = new Date(lastUsed).getTime();
  const now = Date.now();
  const cooldownMs = cooldownHours * 60 * 60 * 1000;
  const elapsed = now - lastUsedTime;
  
  return Math.max(0, cooldownMs - elapsed);
}

export function formatCooldown(ms: number): string {
  if (ms === 0) return 'Ready!';
  
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);
  
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);
  
  return parts.join(' ');
}
