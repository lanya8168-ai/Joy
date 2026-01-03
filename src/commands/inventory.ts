import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { mergeCardImages } from '../utils/imageUtils.js';
import { getRarityEmoji } from '../utils/cards.js';

export const data = new SlashCommandBuilder()
  .setName('inventory')
  .setDescription('View your K-pop card collection')
  .addUserOption(option =>
    option.setName('user')
      .setDescription('User to check inventory for (default: yourself)')
      .setRequired(false))
  .addIntegerOption(option =>
    option.setName('page')
      .setDescription('Page number (default: 1)')
      .setRequired(false)
      .setMinValue(1))
  .addIntegerOption(option =>
    option.setName('rarity')
      .setDescription('Filter by rarity (1-5)')
      .setRequired(false)
      .addChoices(
        { name: 'Common (1)', value: 1 },
        { name: 'Uncommon (2)', value: 2 },
        { name: 'Rare (3)', value: 3 },
        { name: 'Epic (4)', value: 4 },
        { name: 'Legendary (5)', value: 5 }
      ))
  .addStringOption(option =>
    option.setName('group')
      .setDescription('Filter by group name')
      .setRequired(false))
  .addStringOption(option =>
    option.setName('idol')
      .setDescription('Filter by idol/member name')
      .setRequired(false))
  .addStringOption(option =>
    option.setName('search')
      .setDescription('Search for a specific idol or group name')
      .setRequired(false))
  .addStringOption(option =>
    option.setName('era')
      .setDescription('Filter by era')
      .setRequired(false));

const CARDS_PER_PAGE = 3;

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const targetUser = interaction.options.getUser('user');
  const userId = targetUser ? targetUser.id : interaction.user.id;
  const page = interaction.options.getInteger('page') || 1;
  const rarityFilter = interaction.options.getInteger('rarity');
  const groupFilter = interaction.options.getString('group');
  const idolFilter = interaction.options.getString('idol');
  const eraFilter = interaction.options.getString('era');
  const searchFilter = interaction.options.getString('search');

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!user) {
    await interaction.editReply({ content: '<:IMG_9904:1443371148543791218> Please use `/start` first to create your account!' });
    return;
  }

  let query = supabase
    .from('inventory')
    .select(`
      quantity,
      cards (
        card_id,
        name,
        group,
        era,
        rarity,
        cardcode,
        image_url,
        droppable
      )
    `)
    .eq('user_id', userId);

  const { data: inventory } = await query;

  if (!inventory || inventory.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0x808080)
      .setTitle('📦 Your Inventory')
      .setDescription('Your collection is empty! Use `/drop` to get cards.')
      .addFields({ name: 'Coins', value: `${user.coins}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Apply filters
  let filteredInventory = inventory;
  
  if (rarityFilter !== null && rarityFilter !== undefined) {
    filteredInventory = filteredInventory.filter((item: any) => item.cards.rarity === rarityFilter);
  }
  
  if (groupFilter) {
    const groups = groupFilter.split(',').map(s => s.trim().toLowerCase());
    filteredInventory = filteredInventory.filter((item: any) => 
      groups.some(g => item.cards.group.toLowerCase().includes(g))
    );
  }

  if (idolFilter) {
    const idols = idolFilter.split(',').map(s => s.trim().toLowerCase());
    filteredInventory = filteredInventory.filter((item: any) =>
      idols.some(i => item.cards.name.toLowerCase().includes(i))
    );
  }

  if (eraFilter) {
    const eras = eraFilter.split(',').map(s => s.trim().toLowerCase());
    filteredInventory = filteredInventory.filter((item: any) =>
      item.cards.era && eras.some(e => item.cards.era.toLowerCase().includes(e))
    );
  }

  if (searchFilter) {
    const search = searchFilter.toLowerCase();
    filteredInventory = filteredInventory.filter((item: any) =>
      item.cards.name.toLowerCase().includes(search) || 
      item.cards.group.toLowerCase().includes(search) ||
      (item.cards.era && item.cards.era.toLowerCase().includes(search))
    );
  }

  if (filteredInventory.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0x808080)
      .setTitle('📦 Your Inventory')
      .setDescription('No cards match your filters!')
      .addFields({ name: 'Coins', value: `${user.coins}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Alphabetical sorting (Group -> Name)
  filteredInventory.sort((a: any, b: any) => {
    const groupA = a.cards.group.toLowerCase();
    const groupB = b.cards.group.toLowerCase();
    if (groupA < groupB) return -1;
    if (groupA > groupB) return 1;
    
    const nameA = a.cards.name.toLowerCase();
    const nameB = b.cards.name.toLowerCase();
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;
    return 0;
  });

  // Calculate pagination
  const totalPages = Math.ceil(filteredInventory.length / CARDS_PER_PAGE);
  const validPage = Math.max(1, Math.min(page, totalPages));
  const startIndex = (validPage - 1) * CARDS_PER_PAGE;
  const endIndex = startIndex + CARDS_PER_PAGE;
  const pageCards = filteredInventory.slice(startIndex, endIndex);

  const cardList = pageCards
    .map((item: any, index: number) => {
      const card = item.cards;
      const eraText = card.era ? ` • ${card.era}` : '';
      const rarityEmoji = getRarityEmoji(card.rarity);
      return `**Card ${index + 1}:** ${card.name} (${card.group}) ${rarityEmoji}${eraText} • \`${card.cardcode}\` • Qty: ${item.quantity}`;
    })
    .join('\n');

  let attachment = null;
  try {
    const imageUrls = pageCards
      .map((item: any) => item.cards.image_url)
      .filter((url: string) => url);

    if (imageUrls.length > 0) {
      const mergedImageBuffer = await mergeCardImages(imageUrls);
      attachment = new AttachmentBuilder(mergedImageBuffer, { name: 'inventory_cards.png' });
    }
  } catch (error) {
    console.error('Error merging images:', error);
  }

  const isOwnInventory = userId === interaction.user.id;
  const title = isOwnInventory ? '🌲 Your K-pop Card Collection' : `🌲 ${targetUser?.username}'s K-pop Card Collection`;

  const embed = new EmbedBuilder()
    .setColor(0xff69b4)
    .setTitle(title)
    .setDescription(cardList)
    .setFooter({ text: `${filteredInventory.length} cards total` })
    .setTimestamp();

  if (attachment) {
    embed.setImage('attachment://inventory_cards.png');
  }

  // Create pagination buttons - include idolFilter in customId
  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`inv_prev_${userId}_${rarityFilter || 'all'}_${groupFilter || 'all'}_${eraFilter || 'all'}_${idolFilter || 'all'}_${searchFilter || 'all'}`)
        .setLabel('← Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(validPage === 1),
      new ButtonBuilder()
        .setCustomId(`inv_page`)
        .setLabel(`${validPage} / ${totalPages}`)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`inv_next_${userId}_${rarityFilter || 'all'}_${groupFilter || 'all'}_${eraFilter || 'all'}_${idolFilter || 'all'}_${searchFilter || 'all'}`)
        .setLabel('Next →')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(validPage === totalPages)
    );

  if (attachment) {
    await interaction.editReply({ embeds: [embed], files: [attachment], components: [row] });
  } else {
    await interaction.editReply({ embeds: [embed], components: [row] });
  }
}
