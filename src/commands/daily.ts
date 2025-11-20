import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { getCooldownRemaining, formatCooldown } from '../utils/cooldowns.js';

const DAILY_REWARD = 50;
const DAILY_COOLDOWN_HOURS = 24;

export const data = new SlashCommandBuilder()
  .setName('daily')
  .setDescription('Claim your daily coin reward!');

export async function execute(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!user) {
    await interaction.reply({ content: '❌ Please use `/start` first to create your account!', ephemeral: true });
    return;
  }

  const cooldown = getCooldownRemaining(user.last_daily, DAILY_COOLDOWN_HOURS);

  if (cooldown > 0) {
    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('⏰ Daily Reward On Cooldown')
      .setDescription(`Come back in **${formatCooldown(cooldown)}**`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  const { error } = await supabase
    .from('users')
    .update({
      coins: user.coins + DAILY_REWARD,
      last_daily: new Date().toISOString()
    })
    .eq('user_id', userId);

  if (error) {
    await interaction.reply({ content: '❌ Error claiming daily reward. Please try again!', ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle('✅ Daily Reward Claimed!')
    .setDescription(`You received **${DAILY_REWARD} coins**!`)
    .addFields(
      { name: 'Previous Balance', value: `${user.coins} coins`, inline: true },
      { name: 'New Balance', value: `${user.coins + DAILY_REWARD} coins`, inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
