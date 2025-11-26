import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { formatCooldown } from '../utils/cooldowns.js';

const SURF_COOLDOWN_HOURS = 1;

export const data = new SlashCommandBuilder()
  .setName('surf')
  .setDescription('Surf for coins!');

export async function execute(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  const reward = Math.floor(Math.random() * 20) + 10;

  const { data, error } = await supabase.rpc('claim_surf_reward', {
    p_user_id: userId,
    p_reward: reward,
    p_cooldown_hours: SURF_COOLDOWN_HOURS
  });

  if (error || !data) {
    await interaction.reply({ content: '❌ Error surfing. Please try again!', ephemeral: true });
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
        .setTitle('⏰ Surf On Cooldown')
        .setDescription(`Come back in **${formatCooldown(result.cooldown_remaining_ms)}**`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    await interaction.reply({ content: '❌ Error surfing. Please try again!', ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x00bfff)
    .setTitle('<a:5ball:1435457849072550023> Surfing Complete!')
    .setDescription(`You found **${result.reward} coins** while surfing!`)
    .addFields(
      { name: '<:06_sparks:1430048824344449156> Reward', value: `${result.reward} coins`, inline: true },
      { name: '<:2_shell:1436124721413357770> New Balance', value: `${result.new_balance} coins`, inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
