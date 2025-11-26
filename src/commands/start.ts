import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';

export const data = new SlashCommandBuilder()
  .setName('start')
  .setDescription('Start your K-pop card collecting journey!');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const userId = interaction.user.id;

  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (existingUser) {
    const embed = new EmbedBuilder()
      .setColor(0xff69b4)
      .setTitle('Welcome Back!')
      .setDescription(`You already have an account with **${existingUser.coins} coins**!`)
      .addFields(
        { name: 'Total Cards', value: 'Use `/inventory` to view', inline: true },
        { name: 'Coins', value: `${existingUser.coins}`, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    return;
  }

  const { error } = await supabase
    .from('users')
    .insert([{ user_id: userId, coins: 100 }]);

  if (error) {
    await interaction.reply({ content: '❌ Error creating your account. Please try again!', ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0xff69b4)
    .setTitle('🌸 Welcome to K-pop Card Collecting!')
    .setDescription('Your beach adventure begins now! 💫')
    .addFields(
      { name: '🐚 Starting Coins', value: '100', inline: true },
      { name: '⭐ Cards', value: '0', inline: true },
      { name: '\u200B', value: '\u200B' },
      { name: '⭐ Commands', value: '🌸 `/daily` - Daily coins\n💫 `/weekly` - Weekly coins\n⚽ `/surf` - Surf for coins\n🛟 `/drop` - Dive for cards\n⭐ `/inventory` - View your collection\n🎀 `/shop` - Buy card packs\n🦋 `/mp` - Marketplace' }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
