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

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const { error } = await supabase
    .from('users')
    .insert([{ user_id: userId, coins: 100 }]);

  if (error) {
    await interaction.editReply({ content: '<:IMG_9904:1443371148543791218> Error creating your account. Please try again!' });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0xff69b4)
    .setTitle('<:1_petal:1436124714526445761> Welcome to K-pop Card Collecting!')
    .setDescription('Your beach adventure begins now! <a:5blu_bubbles:1436124726010318870>')
    .addFields(
      { name: '<:2_shell:1436124721413357770> Starting Coins', value: '100', inline: true },
      { name: '<:06_whitestar:1430048829700313100> Cards', value: '0', inline: true },
      { name: '\u200B', value: '\u200B' },
      { name: '<:06_whitestar:1430048829700313100> Commands', value: '<:1_petal:1436124714526445761> `/daily` - Daily coins\n<a:5blu_bubbles:1436124726010318870> `/weekly` - Weekly coins\n<a:5ball:1435457849072550023> `/surf` - Surf for coins\n<a:5lifesaver:1435457784576610374> `/drop` - Dive for cards\n<:06_whitestar:1430048829700313100> `/inventory` - View your collection\n<a:hj_bowpurple:1363505358869495878> `/shop` - Buy card packs\n<a:hj_white_butterfly:1362859754279665895> `/mp` - Marketplace' }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
