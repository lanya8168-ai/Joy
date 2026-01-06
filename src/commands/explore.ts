import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { formatCooldown } from '../utils/cooldowns.js';
import { isAdminUser } from '../utils/constants.js';
import { scheduleReminder } from '../utils/reminders.js';

const EXPLORE_COOLDOWN_HOURS = 1;

export const data = new SlashCommandBuilder()
  .setName('explore')
  .setDescription('Explore for coins!');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const userId = interaction.user.id;
  const reward = Math.floor(Math.random() * 1500) + 1500;
  const cooldownHours = isAdminUser(userId) ? 0 : EXPLORE_COOLDOWN_HOURS;

  const { data, error } = await supabase.rpc('claim_explore_reward', {
    p_user_id: userId,
    p_reward: reward,
    p_cooldown_hours: cooldownHours
  });

  if (error || !data) {
    await interaction.editReply({ content: '🧚 Error exploring. Please try again!' });
    return;
  }

  const result = data as any;
  if (!result.success) {
    if (result.error === 'user_not_found') return interaction.editReply({ content: '🧚 Use `/start` first!' });
    if (result.error === 'on_cooldown') {
      const embed = new EmbedBuilder()
        .setColor(0xff69b4)
        .setTitle('⏰ Explore On Cooldown')
        .setDescription(`Come back in **${formatCooldown(result.cooldown_remaining_ms)}**`);
      return interaction.editReply({ embeds: [embed] });
    }
    return interaction.editReply({ content: '🧚 Error exploring.' });
  }

  const nextAvailable = new Date(Date.now() + result.cooldown_remaining_ms);
  const embed = new EmbedBuilder()
    .setColor(0xff69b4)
    .setTitle('🧚 Exploring Complete!')
    .setDescription(`You found ${result.reward} coins in the magical woods!`)
    .addFields(
      { name: '💎 Reward', value: `${result.reward} coins` },
      { name: '🧚 Balance', value: `${result.new_balance} coins` },
      { name: '⏰ Next', value: `<t:${Math.floor(nextAvailable.getTime() / 1000)}:R>` }
    );

  scheduleReminder(interaction.client, userId, interaction.channelId, 'explore', EXPLORE_COOLDOWN_HOURS * 60 * 60 * 1000);
  await interaction.editReply({ embeds: [embed] });
}
