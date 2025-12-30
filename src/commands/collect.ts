import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { getRarityEmoji } from '../utils/cards.js';
import { mergeCardImages } from '../utils/imageUtils.js';

const CARDS_PER_PAGE = 5;

export const data = new SlashCommandBuilder()
  .setName('collect')
  .setDescription('View all collectible cards with ownership status')
  .addStringOption(option =>
    option.setName('idol')
      .setDescription('Filter by idol name')
      .setRequired(false))
  .addStringOption(option =>
    option.setName('group')
      .setDescription('Filter by group')
      .setRequired(false))
  .addStringOption(option =>
    option.setName('era')
      .setDescription('Filter by era')
      .setRequired(false))
  .addIntegerOption(option =>
    option.setName('rarity')
      .setDescription('Filter by rarity (1-5)')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(5))
  .addBooleanOption(option =>
    option.setName('missing')
      .setDescription('Only show cards you are missing')
      .setRequired(false))
  .addUserOption(option =>
    option.setName('user')
      .setDescription('Check another user\'s collection')
      .setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  
  const userId = interaction.options.getUser('user')?.id || interaction.user.id;
  const idolFilter = interaction.options.getString('idol');
  const groupFilter = interaction.options.getString('group');
  const eraFilter = interaction.options.getString('era');
  const rarityFilter = interaction.options.getInteger('rarity');
  const missingFilter = interaction.options.getBoolean('missing');

  // Get all cards
  let query = supabase.from('cards').select('*').order('group', { ascending: true }).order('name', { ascending: true });
  
  if (idolFilter) {
    query = query.ilike('name', `%${idolFilter}%`);
  }
  if (groupFilter) {
    query = query.ilike('group', `%${groupFilter}%`);
  }
  if (eraFilter) {
    query = query.ilike('era', `%${eraFilter}%`);
  }
  if (rarityFilter) {
    query = query.eq('rarity', rarityFilter);
  }

  const { data: allCards } = await query;

  if (!allCards || allCards.length === 0) {
    await interaction.editReply({ content: '<:IMG_9904:1443371148543791218> No cards match your filters!' });
    return;
  }

  // Get user's inventory
  const { data: userInventory } = await supabase
    .from('inventory')
    .select('card_id')
    .eq('user_id', userId);

  const userCardIds = new Set(userInventory?.map(item => item.card_id) || []);

  let displayCards = allCards;
  if (missingFilter) {
    displayCards = allCards.filter(card => !userCardIds.has(card.card_id));
  }

  if (displayCards.length === 0) {
    await interaction.editReply({ content: '<:IMG_9904:1443371148543791218> You have collected all cards matching these filters!' });
    return;
  }

  // Paginate
  const totalPages = Math.ceil(displayCards.length / CARDS_PER_PAGE);
  const page = 1;

  await showCollectPage(interaction, displayCards, userCardIds, page, totalPages, userId, idolFilter, groupFilter, eraFilter, rarityFilter);
}

async function showCollectPage(
  interaction: ChatInputCommandInteraction,
  allCards: any[],
  userCardIds: Set<number>,
  page: number,
  totalPages: number,
  userId: string,
  idolFilter: string | null,
  groupFilter: string | null,
  eraFilter: string | null,
  rarityFilter: number | null
) {
  const startIndex = (page - 1) * CARDS_PER_PAGE;
  const endIndex = startIndex + CARDS_PER_PAGE;
  const pageCards = allCards.slice(startIndex, endIndex);

  const cardList = pageCards
    .map((card: any, index: number) => {
      const hasCard = userCardIds.has(card.card_id);
      const checkMark = hasCard ? '<:IMG_9902:1443367697286172874>' : '<:IMG_9904:1443371148543791218>';
      const rarityEmoji = getRarityEmoji(card.rarity);
      const eraText = card.era ? ` • ${card.era}` : '';
      return `${checkMark} **${card.name}** (${card.group}) ${rarityEmoji}${eraText} • \`${card.cardcode}\``;
    })
    .join('\n');

  let attachment = null;
  try {
    const imageUrls = pageCards
      .filter((card: any) => card.image_url)
      .map((card: any) => card.image_url);

    if (imageUrls.length > 0) {
      const mergedImageBuffer = await mergeCardImages(imageUrls);
      attachment = new AttachmentBuilder(mergedImageBuffer, { name: 'collect_cards.png' });
    }
  } catch (error) {
    console.error('Error merging images:', error);
  }

  const filterText = [
    idolFilter && `Idol: ${idolFilter}`,
    groupFilter && `Group: ${groupFilter}`,
    eraFilter && `Era: ${eraFilter}`,
    rarityFilter && `Rarity: ${rarityFilter}★`
  ].filter(Boolean).join(' • ') || 'No filters';

  // Count owned and missing in filtered results
  const ownedInFiltered = allCards.filter((card: any) => userCardIds.has(card.card_id)).length;
  const missingInFiltered = allCards.length - ownedInFiltered;

  const embed = new EmbedBuilder()
    .setColor(0x87ceeb)
    .setTitle('<:1_flower:1436124715797315687> Card Collection')
    .setDescription(cardList || 'No cards on this page')
    .addFields(
      { name: 'Filters', value: filterText, inline: false },
      { name: '<:IMG_9902:1443367697286172874> Progress', value: `${ownedInFiltered} cards collected`, inline: true },
      { name: '<:IMG_9904:1443371148543791218> Missing', value: `${missingInFiltered} cards`, inline: true }
    )
    .setFooter({ text: `Page ${page} / ${totalPages}` })
    .setTimestamp();

  if (attachment) {
    embed.setImage('attachment://collect_cards.png');
  }

  // Create pagination buttons
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`collect_prev_${userId}_${idolFilter || 'all'}_${groupFilter || 'all'}_${eraFilter || 'all'}_${rarityFilter || 'all'}`)
        .setLabel('← Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 1),
      new ButtonBuilder()
        .setCustomId(`collect_page`)
        .setLabel(`${page} / ${totalPages}`)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`collect_next_${userId}_${idolFilter || 'all'}_${groupFilter || 'all'}_${eraFilter || 'all'}_${rarityFilter || 'all'}`)
        .setLabel('Next →')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === totalPages)
    );

  if (attachment) {
    await interaction.editReply({ embeds: [embed], files: [attachment], components: [row as any] });
  } else {
    await interaction.editReply({ embeds: [embed], components: [row as any] });
  }
}
