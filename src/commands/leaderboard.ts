import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';

export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('View the top collectors and richest users')
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
    const { data: users, error } = await supabase
      .from('users')
      .select('user_id, coins')
      .order('coins', { ascending: false })
      .limit(10);

    if (error || !users) return interaction.editReply('Error fetching leaderboard.');

    const embed = new EmbedBuilder()
      .setTitle('💰 Richest Users Leaderboard')
      .setColor(0xFFD700)
      .setDescription(
        users.map((u, i) => `**${i + 1}.** <@${u.user_id}> — ${u.coins.toLocaleString()} coins`).join('\n') || 'No data found.'
      );

    return interaction.editReply({ embeds: [embed] });
  }

  if (subcommand === 'collection') {
    // Count unique cards per user
    const { data: counts, error } = await supabase
      .rpc('get_top_collectors'); // We will need to create this RPC

    if (error || !counts) {
      // Fallback: If RPC doesn't exist yet, try to fetch and count manually (limited to top 1000 rows for safety)
      const { data: allInventory } = await supabase.from('inventory').select('user_id, card_id');
      if (!allInventory) return interaction.editReply('Error fetching collection data.');
      
      const userCounts: Record<string, Set<number>> = {};
      allInventory.forEach(item => {
        if (!userCounts[item.user_id]) userCounts[item.user_id] = new Set();
        userCounts[item.user_id].add(item.card_id);
      });

      const sorted = Object.entries(userCounts)
        .map(([userId, cards]) => ({ userId, count: cards.size }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const embed = new EmbedBuilder()
        .setTitle('🎴 Top Collectors Leaderboard')
        .setColor(0x00FF00)
        .setDescription(
          sorted.map((u, i) => `**${i + 1}.** <@${u.userId}> — ${u.count} unique cards`).join('\n') || 'No data found.'
        );

      return interaction.editReply({ embeds: [embed] });
    }

    const embed = new EmbedBuilder()
      .setTitle('🎴 Top Collectors Leaderboard')
      .setColor(0x00FF00)
      .setDescription(
        counts.map((u: any, i: number) => `**${i + 1}.** <@${u.user_id}> — ${u.card_count} unique cards`).join('\n')
      );

    return interaction.editReply({ embeds: [embed] });
  }
}
