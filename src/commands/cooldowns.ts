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
    await interaction.editReply({ content: '<:fairy2:1457128704282071196> Please use `/start` first to create your account!' });
    return;
  }

  const dailyCooldown = getCooldownRemaining(user.last_daily, 24);
  const weeklyCooldown = getCooldownRemaining(user.last_weekly, 168);
  const surfCooldown = getCooldownRemaining(user.last_surf, 1);
  const dropCooldown = getCooldownRemaining(user.last_drop, 0.0333); // 2 minutes = 0.0333 hours

  const embed = new EmbedBuilder()
    .setColor(0x9933ff)
    .setTitle('⏰ Your Cooldowns')
    .addFields(
      { name: '📅 Daily Reward', value: formatCooldown(dailyCooldown), inline: true },
      { name: '📆 Weekly Reward', value: formatCooldown(weeklyCooldown), inline: true },
      { name: '<a:5surfboard:1433597347031683114> Surf', value: formatCooldown(surfCooldown), inline: true },
      { name: '🎣 Drop', value: formatCooldown(dropCooldown), inline: true }
    )
    .setFooter({ text: 'All times are approximate' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
