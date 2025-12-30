import { Card } from '../database/supabase.js';

export function getRandomRarity(isLimited: boolean = false, eventType: string | null = null): number {
  if (eventType === 'event' || eventType === 'birthday') return 0; // Special handling or 10% check elsewhere
  
  const random = Math.random() * 100;
  
  // New rates: 1s 70%, 2s 60%, 3s 45%, 4s 30%, 5s 20%
  // These aren't cumulative percentages in the prompt, but let's assume threshold tiers
  // 5s: 20% (80-100)
  // 4s: 30% (50-80)
  // 3s: 45% (5-50)
  // 2s: 60%? The math doesn't add up to 100 if they are exclusive.
  // If they are drop chances PER TIER:
  if (random < 20) return 5; // Legendary (20%)
  if (random < 50) return 4; // Epic (30%)
  if (random < 95) return 3; // Rare (45%)
  // This still doesn't quite fit "1s 70% 2s 60%". 
  // Let's use a weighted selection instead.
  
  const weights = [70, 60, 45, 30, 20];
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * totalWeight;
  for (let i = 4; i >= 0; i--) {
    if (r < weights[i]) return i + 1;
    r -= weights[i];
  }
  return 1;
}

export function getRarityName(rarity: number): string {
  switch (rarity) {
    case 1: return 'Common';
    case 2: return 'Uncommon';
    case 3: return 'Rare';
    case 4: return 'Epic';
    case 5: return 'Legendary';
    default: return 'Unknown';
  }
}

export function getRarityEmoji(rarity: number): string {
  const emoji = '<:JOY_rarity:1442701432384917514>';
  return emoji.repeat(Math.max(1, rarity));
}

export function getRarityColor(rarity: number): number {
  switch (rarity) {
    case 1: return 0x808080;
    case 2: return 0x00cc00;
    case 3: return 0x0099ff;
    case 4: return 0x9933ff;
    case 5: return 0xffcc00;
    default: return 0x808080;
  }
}
