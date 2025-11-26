import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { formatCooldown } from '../utils/cooldowns.js';

const SURF_COOLDOWN_HOURS = 1;

export const data = new SlashCommandBuilder()
  .setName('surf')
  .setDescription('Surf for coins!');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const userId = interaction.user.id;
  const reward = Math.floor(Math.random() * 100) + 50;

  const { data, error } = await supabase.rpc('claim_surf_reward', {
    p_user_id: userId,
    p_reward: reward,
    p_cooldown_hours: SURF_COOLDOWN_HOURS
  });

  if (error || !data) {
    await interaction.editReply({ content: '<:DSwhiteno:1416237223979782306> Error surfing. Please try again!' });
    return;
  }

  const result = data as any;

  if (!result.success) {
    if (result.error === 'user_not_found') {
      await interaction.editReply({ content: '<:DSwhiteno:1416237223979782306> Please use `/start` first to create your account!' });
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

    await interaction.editReply({ content: '<:DSwhiteno:1416237223979782306> Error surfing. Please try again!' });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x00bfff)
    .setTitle('<a:5lifesaver:1435457784576610374> Surfing Complete!')
    .setDescription(`You found **${result.reward} coins** while surfing!`)
    .addFields(
      { name: '<a:hj_redstar:1363127624318320861> Reward', value: `${result.reward} coins`, inline: true },
      { name: '<a:hj_redstar:1363127624318320861> New Balance', value: `${result.new_balance} coins`, inline: true }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
