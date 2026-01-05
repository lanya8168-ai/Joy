import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';

export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('View the top collectors')
  .addSubcommand(subcommand =>
    subcommand
      .setName('coins')
      .setDescription('Show users with the most coins'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('collection')
      .setDescription('Show users with the most unique cards'));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'coins') {
    const { data: topCoins } = await supabase
      .from('users')
      .select('user_id, coins')
      .order('coins', { ascending: false })
      .limit(10);

    const description = (await Promise.all((topCoins || []).map(async (u, i) => {
      let username = u.user_id;
      try {
        const user = await interaction.client.users.fetch(u.user_id);
        username = user.username;
      } catch (e) {}
      return `${i + 1}. **${username}** • ${u.coins} coins`;
    }))).join('\n');

    const embed = new EmbedBuilder()
      .setColor(0xff69b4)
      .setTitle('💰 Coin Leaderboard')
      .setDescription(description || 'No users yet!');

    await interaction.editReply({ embeds: [embed] });
  } else if (subcommand === 'collection') {
    const { data: topCollections } = await supabase
      .rpc('get_top_collections');

    const description = (await Promise.all((topCollections || []).map(async (u: any, i: number) => {
      let username = u.user_id;
      try {
        const user = await interaction.client.users.fetch(u.user_id);
        username = user.username;
      } catch (e) {}
      return `${i + 1}. **${username}** • ${u.unique_cards} cards`;
    }))).join('\n');

    const embed = new EmbedBuilder()
      .setColor(0xff69b4)
      .setTitle('🏆 Collection Leaderboard')
      .setDescription(description || 'No collectors yet!');

    await interaction.editReply({ embeds: [embed] });
  }
}
