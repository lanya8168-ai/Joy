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
    await interaction.editReply({ content: '<:fairy2:1457128704282071196> Error creating your account. Please try again!' });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0xff69b4)
    .setTitle('🌲 Welcome to the Fairy Garden!')
    .setDescription('Your magical journey begins now! ✨')
    .addFields(
      { name: '<:fairy2:1457128704282071196> Starting Coins', value: '100', inline: true },
      { name: '<:rarity_star:1442247814540296343> Cards', value: '0', inline: true },
      { name: '\u200B', value: '\u200B' },
      { name: '✨ Commands', value: '<:cottage:1457128646274973766> `/daily` - Daily rewards\n<:photos:1457128756316602410> `/weekly` - Weekly rewards\n<:fairy2:1457128704282071196> `/explore` - Explore for coins\n<:wings5:1457127829438332969> `/drop` - Seek cards\n<:rarity_star:1442247814540296343> `/inventory` - View your collection\n<:fairy2:1457128704282071196> `/shop` - Buy card packs\n<:cottage:1457128646274973766> `/mp` - Marketplace' }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
