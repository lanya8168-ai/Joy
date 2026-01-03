import { supabase } from './src/database/supabase.js';

async function wipeDatabase() {
  console.log('🧹 Starting full database wipe...');

  // 1. Wipe inventory
  const { error: invError } = await supabase.from('inventory').delete().neq('id', -1);
  if (invError) console.error('Error wiping inventory:', invError);
  else console.log('✅ Inventory wiped.');

  // 2. Wipe marketplace
  const { error: mpError } = await supabase.from('marketplace').delete().neq('listing_id', -1);
  if (mpError) console.error('Error wiping marketplace:', mpError);
  else console.log('✅ Marketplace wiped.');

  // 3. Wipe cards
  const { error: cardError } = await supabase.from('cards').delete().neq('card_id', -1);
  if (cardError) console.error('Error wiping cards:', cardError);
  else console.log('✅ Cards wiped.');

  // 4. Reset user balances and cooldowns
  const { error: userError } = await supabase.from('users').update({
    coins: 0,
    last_daily: null,
    last_weekly: null,
    last_surf: null,
    last_drop: null
  }).neq('user_id', '0');
  if (userError) console.error('Error resetting users:', userError);
  else console.log('✅ User balances and cooldowns reset.');

  console.log('✨ Database wipe complete!');
  process.exit(0);
}

wipeDatabase();
