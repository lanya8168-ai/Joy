import { Card } from '../database/supabase.js';

export function getRandomRarity(): number {
  const random = Math.random() * 100;
  
  if (random < 50) return 1; // Common
  if (random < 80) return 2; // Rare
  if (random < 95) return 3; // Epic
  return 4; // Legendary
}

export function getRarityName(rarity: number): string {
  switch (rarity) {
    case 1: return 'Common';
    case 2: return 'Rare';
    case 3: return 'Epic';
    case 4: return 'Legendary';
    default: return 'Unknown';
  }
}

export function getRarityEmoji(rarity: number): string {
  switch (rarity) {
    case 1: return '⚪';
    case 2: return '🔵';
    case 3: return '🟣';
    case 4: return '🟡';
    default: return '⚪';
  }
}

export function getRarityColor(rarity: number): number {
  switch (rarity) {
    case 1: return 0x808080;
    case 2: return 0x0099ff;
    case 3: return 0x9933ff;
    case 4: return 0xffcc00;
    default: return 0x808080;
  }
}
