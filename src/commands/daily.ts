import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { formatCooldown } from '../utils/cooldowns.js';

const MIN_COINS = 50;
const MAX_COINS = 100;
const DAILY_COOLDOWN_HOURS = 24;

export const data = new SlashCommandBuilder()
  .setName('daily')
  .setDescription('Claim your daily coin reward!');

export async function execute(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;

  const dailyReward = Math.floor(Math.random() * (MAX_COINS - MIN_COINS + 1)) + MIN_COINS;

  const { data, error } = await supabase.rpc('claim_daily_reward', {
    p_user_id: userId,
    p_reward: dailyReward,
    p_cooldown_hours: DAILY_COOLDOWN_HOURS
  });

  if (error || !data) {
    await interaction.reply({ content: '❌ Error claiming daily reward. Please try again!', ephemeral: true });
    return;
  }

  const result = data as any;

  if (!result || !result.success) {
    if (result.error === 'user_not_found') {
      await interaction.reply({ content: '❌ Please use `/start` first to create your account!', ephemeral: true });
      return;
    }

    if (result.error === 'on_cooldown') {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('⏰ Daily Reward On Cooldown')
        .setDescription(`Come back in **${formatCooldown(result.cooldown_remaining_ms)}**`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    await interaction.reply({ content: '❌ Error claiming daily reward. Please try again!', ephemeral: true });
    return;
  }

  // Get a random legendary card
  const { data: legendaryCards } = await supabase
    .from('cards')
    .select('*')
    .eq('rarity', 5)
    .eq('droppable', true);

  if (!legendaryCards || legendaryCards.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('Daily Reward Claimed!')
      .setDescription(`<:2_shell:1436124721413357770> You received **${result.reward} coins**!\n\n*No legendary cards available yet.*`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    return;
  }

  const selectedCard = legendaryCards[Math.floor(Math.random() * legendaryCards.length)];

  // Add card to inventory
  const { data: existingItem } = await supabase
    .from('inventory')
    .select('*')
    .eq('user_id', userId)
    .eq('card_id', selectedCard.card_id)
    .single();

  if (existingItem) {
    await supabase
      .from('inventory')
      .update({ quantity: existingItem.quantity + 1 })
      .eq('id', existingItem.id);
  } else {
    await supabase
      .from('inventory')
      .insert({
        user_id: userId,
        card_id: selectedCard.card_id,
        quantity: 1
      });
  }

  const cardInfo = `**Idol:** ${selectedCard.name}\n**Group:** ${selectedCard.group}\n**Era:** ${selectedCard.era || 'N/A'}\n**Rarity:** 5\n**Card code:** \`${selectedCard.cardcode}\``;

  const embed = new EmbedBuilder()
    .setColor(0xffd700)
    .setTitle('Daily Reward Claimed!')
    .setDescription(`<:2_shell:1436124721413357770> You received **${dailyReward} coins**!\n\n**You also received:**\n${cardInfo}`)
    .setTimestamp();

  if (selectedCard.image_url) {
    embed.setImage(selectedCard.image_url);
  }

  await interaction.reply({ embeds: [embed] });
}
