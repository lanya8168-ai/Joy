import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { formatCooldown } from '../utils/cooldowns.js';
import { mergeCardImages } from '../utils/imageUtils.js';
import { BOOSTER_ROLE_ID, isAdminUser } from '../utils/constants.js';
import { scheduleReminder } from '../utils/reminders.js';

const BONANZA_COOLDOWN_HOURS = 6;

export const data = new SlashCommandBuilder()
  .setName('bonanza')
  .setDescription('Exclusive booster mega reward! (6 hour cooldown)');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const userId = interaction.user.id;

  const member = interaction.member as any;
  if (!isAdminUser(userId) && !member?.roles?.cache?.has(BOOSTER_ROLE_ID)) {
    return interaction.editReply({ content: '🧚 Boosters only!' });
  }

  const { data: user } = await supabase.from('users').select('*').eq('user_id', userId).single();
  if (!user) return interaction.editReply({ content: '🧚 Use `/start` first!' });

  const lastBonanza = user.last_bonanza ? new Date(user.last_bonanza).getTime() : 0;
  if (!isAdminUser(userId) && Date.now() - lastBonanza < BONANZA_COOLDOWN_HOURS * 60 * 60 * 1000) {
    const remaining = (BONANZA_COOLDOWN_HOURS * 60 * 60 * 1000) - (Date.now() - lastBonanza);
    return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xff69b4).setTitle('⏰ Cooldown').setDescription(`Back in **${formatCooldown(remaining)}**`)] });
  }

  const rewardCoins = 25000;
  const { data: legendaryCards } = await supabase.from('cards').select('*').eq('rarity', 5).eq('droppable', true);

  if (!legendaryCards || legendaryCards.length === 0) {
    await supabase.from('users').update({ coins: user.coins + rewardCoins, last_bonanza: new Date().toISOString() }).eq('user_id', userId);
    return interaction.editReply({ content: `🧚 Received **${rewardCoins} coins**!` });
  }

  const pulled = [];
  for (let i = 0; i < 20; i++) {
    const card = legendaryCards[Math.floor(Math.random() * legendaryCards.length)];
    pulled.push(card);
    const { data: ex } = await supabase.from('inventory').select('*').eq('user_id', userId).eq('card_id', card.card_id).maybeSingle();
    if (ex) await supabase.from('inventory').update({ quantity: (ex as any).quantity + 1 }).eq('id', (ex as any).id);
    else await supabase.from('inventory').insert({ user_id: userId, card_id: card.card_id, quantity: 1 });
  }

  await supabase.from('users').update({ coins: user.coins + rewardCoins, last_bonanza: new Date().toISOString() }).eq('user_id', userId);

  const embed = new EmbedBuilder()
    .setColor(0xff69b4)
    .setTitle('🏘️ Bonanza Claimed!')
    .setDescription(`Received **${rewardCoins} coins** and **20 legendary cards**!`);

  scheduleReminder(interaction.client, userId, interaction.channelId, 'bonanza', BONANZA_COOLDOWN_HOURS * 60 * 60 * 1000);
  await interaction.editReply({ embeds: [embed] });
}
