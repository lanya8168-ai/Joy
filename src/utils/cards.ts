import { Card } from '../database/supabase.js';

export function getRandomRarity(): number {
  const random = Math.random() * 100;
  
  if (random < 50) return 1; // Common
  if (random < 75) return 2; // Uncommon
  if (random < 90) return 3; // Rare
  if (random < 98) return 4; // Epic
  return 5; // Legendary
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
