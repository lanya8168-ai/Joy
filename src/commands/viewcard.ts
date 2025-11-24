import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';

export const data = new SlashCommandBuilder()
  .setName('viewcard')
  .setDescription('View card information by card code')
  .addStringOption(option =>
    option.setName('cardcode')
      .setDescription('Card code (e.g., BP001)')
      .setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const cardcode = interaction.options.getString('cardcode', true).toUpperCase();

  const { data: card, error } = await supabase
    .from('cards')
    .select('*')
    .eq('cardcode', cardcode)
    .single();

  if (error || !card) {
    await interaction.editReply({ content: `❌ Card with code **${cardcode}** not found!` });
    return;
  }

  const rarityEmojis: { [key: number]: string } = {
    1: '⚪',
    2: '🟢',
    3: '🔵',
    4: '🟣',
    5: '🟡'
  };

  const rarityNames: { [key: number]: string } = {
    1: 'Common',
    2: 'Uncommon',
    3: 'Rare',
    4: 'Epic',
    5: 'Legendary'
  };

  const embed = new EmbedBuilder()
    .setColor(0x00d4ff)
    .setTitle(`🎴 ${card.name}`)
    .setDescription(`**${card.group}**`)
    .addFields(
      { name: 'Card Code', value: `\`${card.cardcode}\``, inline: true },
      { name: 'Rarity', value: `${rarityEmojis[card.rarity] || '❓'} ${rarityNames[card.rarity] || 'Unknown'}`, inline: true },
      { name: 'Era', value: card.era || 'N/A', inline: true },
      { name: 'Droppable', value: card.droppable ? '✅ Yes' : '❌ No', inline: true }
    )
    .setTimestamp();

  if (card.image_url) {
    embed.setImage(card.image_url);
  }

  await interaction.editReply({ embeds: [embed] });
}
