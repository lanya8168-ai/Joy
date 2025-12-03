import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { formatCooldown } from '../utils/cooldowns.js';
import { isAdminUser } from '../utils/constants.js';

const SURF_COOLDOWN_HOURS = 1;

export const data = new SlashCommandBuilder()
  .setName('surf')
  .setDescription('Surf for coins!');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const userId = interaction.user.id;
  const reward = Math.floor(Math.random() * 1500) + 1500;

  const cooldownHours = isAdminUser(userId) ? 0 : SURF_COOLDOWN_HOURS;
  const { data, error } = await supabase.rpc('claim_surf_reward', {
    p_user_id: userId,
    p_reward: reward,
    p_cooldown_hours: cooldownHours
  });

  if (error || !data) {
    await interaction.editReply({ content: '<:IMG_9904:1443371148543791218> Error surfing. Please try again!' });
    return;
  }

  const result = data as any;

  if (!result.success) {
    if (result.error === 'user_not_found') {
      await interaction.editReply({ content: '<:IMG_9904:1443371148543791218> Please use `/start` first to create your account!' });
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

    await interaction.editReply({ content: '<:IMG_9904:1443371148543791218> Error surfing. Please try again!' });
    return;
  }

  const nextAvailable = new Date(Date.now() + 60 * 60 * 1000);
  const embed = new EmbedBuilder()
    .setColor(0x00bfff)
    .setTitle('<a:5lifesaver:1435457784576610374> Surfing Complete!')
    .setDescription(`You found **${result.reward} coins** while surfing!`)
    .addFields(
      { name: '<a:5ball:1435457849072550023> Reward', value: `${result.reward} coins`, inline: true },
      { name: '<:2_shell:1436124721413357770> New Balance', value: `${result.new_balance} coins`, inline: true },
      {
        name: '⏰ Next Available',
        value: `<t:${Math.floor(nextAvailable.getTime() / 1000)}:R>`,
        inline: true
      }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}