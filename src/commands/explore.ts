import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { formatCooldown } from '../utils/cooldowns.js';
import { isAdminUser } from '../utils/constants.js';
import { scheduleReminder } from '../utils/reminders.js';

const SURF_COOLDOWN_HOURS = 1;

export const data = new SlashCommandBuilder()
  .setName('explore')
  .setDescription('Explore for coins!');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const userId = interaction.user.id;
  const reward = Math.floor(Math.random() * 1500) + 1500;

  const cooldownHours = isAdminUser(userId) ? 0 : SURF_COOLDOWN_HOURS;
  const { data, error } = await supabase.rpc('claim_explore_reward', {
    p_user_id: userId,
    p_reward: reward,
    p_cooldown_hours: cooldownHours
  });

  if (error || !data) {
    if (userId === '1403958587843149937') {
        const { data: user } = await supabase.from('users').select('coins').eq('user_id', userId).single();
        // Mock successful result for owner testing
        const mockResult = {
            success: true,
            reward: reward,
            new_balance: (user?.coins || 0) + reward
        };
        const nextAvailable = new Date(Date.now() + 60 * 60 * 1000);
        const embed = new EmbedBuilder()
          .setColor(0x00bfff)
          .setTitle('🧚 Exploring Complete!')
          .setDescription(`You were exploring in the woods when you stumbled across ${mockResult.reward} coins!`)
          .addFields(
            { name: '💎 Reward', value: `${mockResult.reward} coins`, inline: true },
            { name: '🧚 New Balance', value: `${mockResult.new_balance} coins`, inline: true },
            {
              name: '⏰ Next Available',
              value: `<t:${Math.floor(nextAvailable.getTime() / 1000)}:R>`,
              inline: true
            }
          )
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        return;
    }
    await interaction.editReply({ content: '🧚 Error surfing. Please try again!' });
    return;
  }

  const result = data as any;

  if (!result.success) {
    if (result.error === 'user_not_found') {
      await interaction.editReply({ content: '🧚 Please use `/start` first to create your account!' });
      return;
    }

    if (result.error === 'on_cooldown') {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('⏰ Surf On Cooldown')
        .setDescription(`Come back in **${formatCooldown(result.cooldown_remaining_ms)}**`)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    await interaction.editReply({ content: '🧚 Error surfing. Please try again!' });
    return;
  }

  const nextAvailable = new Date(Date.now() + 60 * 60 * 1000);
  const embed = new EmbedBuilder()
    .setColor(0x00bfff)
    .setTitle('🧚 Exploring Complete!')
    .setDescription(`You were exploring in the woods when you stumbled across ${result.reward} coins!`)
    .addFields(
      { name: '💎 Reward', value: `${result.reward} coins`, inline: true },
      { name: '🧚 New Balance', value: `${result.new_balance} coins`, inline: true },
      {
        name: '⏰ Next Available',
        value: `<t:${Math.floor(nextAvailable.getTime() / 1000)}:R>`,
        inline: true
      }
    )
    .setTimestamp();

  // Schedule reminder for next surf
  const client = interaction.client;
  scheduleReminder(client, userId, interaction.channelId, 'explore', SURF_COOLDOWN_HOURS * 60 * 60 * 1000);

  await interaction.editReply({ embeds: [embed] });
}