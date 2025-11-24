import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { supabase } from '../database/supabase.js';

const CARDS_PER_PAGE = 5;

export const data = new SlashCommandBuilder()
  .setName('cardid')
  .setDescription('View all card IDs with pagination')
  .addIntegerOption(option =>
    option.setName('page')
      .setDescription('Page number (default: 1)')
      .setRequired(false)
      .setMinValue(1));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const page = interaction.options.getInteger('page') || 1;
  const userId = interaction.user.id;

  const { data: allCards } = await supabase
    .from('cards')
    .select('*')
    .order('card_id', { ascending: true });

  if (!allCards || allCards.length === 0) {
    await interaction.editReply({ content: '❌ No cards available yet!' });
    return;
  }

  // Calculate pagination
  const totalPages = Math.ceil(allCards.length / CARDS_PER_PAGE);
  const validPage = Math.max(1, Math.min(page, totalPages));
  const startIndex = (validPage - 1) * CARDS_PER_PAGE;
  const endIndex = startIndex + CARDS_PER_PAGE;
  const pageCards = allCards.slice(startIndex, endIndex);

  const cardList = pageCards
    .map((card: any) => {
      return `**ID: ${card.card_id}** • ${card.name} (${card.group}) • \`${card.cardcode}\` • Rarity: ${card.rarity}`;
    })
    .join('\n');

  const embed = new EmbedBuilder()
    .setColor(0x00d4ff)
    .setTitle('🎴 All Card IDs')
    .setDescription(cardList)
    .setFooter({ text: `Page ${validPage} / ${totalPages}` })
    .setTimestamp();

  // Create pagination buttons
  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`cardid_prev_${userId}`)
        .setLabel('← Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(validPage === 1),
      new ButtonBuilder()
        .setCustomId(`cardid_page`)
        .setLabel(`${validPage} / ${totalPages}`)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`cardid_next_${userId}`)
        .setLabel('Next →')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(validPage === totalPages)
    );

  await interaction.editReply({ embeds: [embed], components: [row] });
}
