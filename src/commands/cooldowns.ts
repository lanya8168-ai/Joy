import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { getCooldownRemaining, formatCooldown } from '../utils/cooldowns.js';

export const data = new SlashCommandBuilder()
  .setName('cooldowns')
  .setDescription('Check all your command cooldowns');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const userId = interaction.user.id;

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!user) {
    await interaction.editReply({ content: '🧚 Please use `/start` first to create your account!' });
    return;
  }

  const dailyCooldown = getCooldownRemaining(user.last_daily, 24);
  const weeklyCooldown = getCooldownRemaining(user.last_weekly, 168);
  const surfCooldown = getCooldownRemaining(user.last_surf, 1);
  const dropCooldown = getCooldownRemaining(user.last_drop, 0.0333); // 2 minutes = 0.0333 hours

  const embed = new EmbedBuilder()
    .setColor(0xff69b4)
    .setTitle('⏰ Cooldowns')
    .addFields(
      { name: '📅 Daily Reward', value: formatCooldown(dailyCooldown), },
      { name: '📆 Weekly Reward', value: formatCooldown(weeklyCooldown), },
      { name: '🧚 Explore', value: formatCooldown(surfCooldown), },
      { name: '🦋 Drop', value: formatCooldown(dropCooldown), }
    )
    .setFooter({ text: 'All times are approximate' })
    .;

  await interaction.editReply({ embeds: [embed] });
}
