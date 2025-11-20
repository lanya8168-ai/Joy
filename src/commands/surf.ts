import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { getCooldownRemaining, formatCooldown } from '../utils/cooldowns.js';

const SURF_COOLDOWN_HOURS = 1;

export const data = new SlashCommandBuilder()
  .setName('surf')
  .setDescription('Surf for coins!');

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

  const cooldown = getCooldownRemaining(user.last_surf, SURF_COOLDOWN_HOURS);

  if (cooldown > 0) {
    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('⏰ Surf On Cooldown')
      .setDescription(`Come back in **${formatCooldown(cooldown)}**`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  const reward = Math.floor(Math.random() * 20) + 10;

  const { error } = await supabase
    .from('users')
    .update({
      coins: user.coins + reward,
      last_surf: new Date().toISOString()
    })
    .eq('user_id', userId);

  if (error) {
    await interaction.reply({ content: '❌ Error surfing. Please try again!', ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x00bfff)
    .setTitle('🏄 Surfing Complete!')
    .setDescription(`You found **${reward} coins** while surfing!`)
    .addFields(
      { name: 'Reward', value: `${reward} coins`, inline: true },
      { name: 'New Balance', value: `${user.coins + reward} coins`, inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
