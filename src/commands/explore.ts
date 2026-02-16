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
  
  // Pass the member object to check for both ID and Role
  const isStaff = isAdminUser(interaction.member);
  const cooldownHours = isStaff ? 0 : EXPLORE_COOLDOWN_HOURS;

  const { data, error } = await supabase.rpc('claim_explore_reward', {
    p_user_id: userId,
    p_reward: reward,
    p_cooldown_hours: cooldownHours
  });

  if (error) {
    console.error('Explore RPC Error:', error);
    return interaction.editReply({ content: '🧚 Error exploring. Please try again later!' });
  }

  const result = data as any;
  if (!result || !result.success) {
    if (result?.error === 'user_not_found') {
      return interaction.editReply({ content: '🧚 Please use `/start` first to create your account!' });
    }
    if (result?.error === 'on_cooldown') {
      const embed = new EmbedBuilder()
        .setColor(0xff69b4)
        .setTitle('⏰ Explore On Cooldown')
        .setDescription(`Come back in **${formatCooldown(result.cooldown_remaining_ms)}**`);
      return interaction.editReply({ embeds: [embed] });
    }
    return interaction.editReply({ content: '🧚 Error exploring. Something went wrong.' });
  }

  const cooldownMs = result.cooldown_remaining_ms || (EXPLORE_COOLDOWN_HOURS * 60 * 60 * 1000);
  const nextAvailable = new Date(Date.now() + (isStaff ? 0 : cooldownMs));
  
  const embed = new EmbedBuilder()
    .setColor(0xff69b4)
    .setTitle('🧚 Exploring Complete!')
    .setDescription(`You found **${result.reward || reward} coins** in the magical woods!`)
    .addFields(
      { name: '💎 Reward', value: `${result.reward || reward} coins`, inline: true },
      { name: '🧚 Balance', value: `${result.new_balance} coins`, inline: true }
    );

  if (!isStaff) {
    embed.addFields({ name: '⏰ Next', value: `<t:${Math.floor(nextAvailable.getTime() / 1000)}:R>`, inline: true });
    scheduleReminder(interaction.client, userId, interaction.channelId, 'explore', EXPLORE_COOLDOWN_HOURS * 60 * 60 * 1000);
  } else {
    embed.addFields({ name: '✨ Staff Perk', value: 'No cooldown active!', inline: true });
  }

  await interaction.editReply({ embeds: [embed] });
}
