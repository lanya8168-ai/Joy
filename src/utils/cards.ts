import { Card } from '../database/supabase.js';

export function getRandomRarity(): number {
  const random = Math.random() * 100;
  
  // Rarity drop rates from prompt:
  // 5s: 20%
  // 4s: 30%
  // 3s: 45%
  // 2s: 60%
  // 1s: 70%
  
  // These are not exclusive, so we pick the highest available rarity
  // Priority: 5 -> 4 -> 3 -> 2 -> 1
  if (random < 20) return 5;
  if (random < 30) return 4;
  if (random < 45) return 3;
  if (random < 60) return 2;
  if (random < 70) return 1;
  
  // Fallback to 1 if random > 70
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
