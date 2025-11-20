import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { formatCooldown } from '../utils/cooldowns.js';

const WEEKLY_REWARD = 300;
const WEEKLY_COOLDOWN_HOURS = 168;

export const data = new SlashCommandBuilder()
  .setName('weekly')
  .setDescription('Claim your weekly coin reward!');

export async function execute(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;

  const { data, error } = await supabase.rpc('claim_weekly_reward', {
    p_user_id: userId,
    p_reward: WEEKLY_REWARD,
    p_cooldown_hours: WEEKLY_COOLDOWN_HOURS
  });

  if (error || !data) {
    await interaction.reply({ content: '❌ Error claiming weekly reward. Please try again!', ephemeral: true });
    return;
  }

  const result = data as any;

  if (!result.success) {
    if (result.error === 'user_not_found') {
      await interaction.reply({ content: '❌ Please use `/start` first to create your account!', ephemeral: true });
      return;
    }

    if (result.error === 'on_cooldown') {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('⏰ Weekly Reward On Cooldown')
        .setDescription(`Come back in **${formatCooldown(result.cooldown_remaining_ms)}**`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    await interaction.reply({ content: '❌ Error claiming weekly reward. Please try again!', ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle('✅ Weekly Reward Claimed!')
    .setDescription(`You received **${result.reward} coins**!`)
    .addFields(
      { name: 'Previous Balance', value: `${result.old_balance} coins`, inline: true },
      { name: 'New Balance', value: `${result.new_balance} coins`, inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
