import { Card } from '../database/supabase.js';

export function getRandomRarity(): 'common' | 'rare' | 'epic' | 'legendary' {
  const random = Math.random() * 100;
  
  if (random < 50) return 'common';
  if (random < 80) return 'rare';
  if (random < 95) return 'epic';
  return 'legendary';
}

export function getRarityEmoji(rarity: string): string {
  switch (rarity) {
    case 'common': return '⚪';
    case 'rare': return '🔵';
    case 'epic': return '🟣';
    case 'legendary': return '🟡';
    default: return '⚪';
  }
}

export function getRarityColor(rarity: string): number {
  switch (rarity) {
    case 'common': return 0x808080;
    case 'rare': return 0x0099ff;
    case 'epic': return 0x9933ff;
    case 'legendary': return 0xffcc00;
    default: return 0x808080;
  }
}
