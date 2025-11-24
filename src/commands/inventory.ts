import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { mergeCardImages } from '../utils/imageUtils.js';

export const data = new SlashCommandBuilder()
  .setName('inventory')
  .setDescription('View your K-pop card collection')
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
      .setRequired(false));

const CARDS_PER_PAGE = 3;

export async function execute(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  const page = interaction.options.getInteger('page') || 1;
  const rarityFilter = interaction.options.getInteger('rarity');
  const groupFilter = interaction.options.getString('group');

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!user) {
    await interaction.reply({ content: '❌ Please use `/start` first to create your account!', ephemeral: true });
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
        image_url
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

    await interaction.reply({ embeds: [embed] });
    return;
  }

  // Apply filters
  let filteredInventory = inventory;
  
  if (rarityFilter !== null && rarityFilter !== undefined) {
    filteredInventory = filteredInventory.filter((item: any) => item.cards.rarity === rarityFilter);
  }
  
  if (groupFilter) {
    filteredInventory = filteredInventory.filter((item: any) => 
      item.cards.group.toLowerCase() === groupFilter.toLowerCase()
    );
  }

  if (filteredInventory.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0x808080)
      .setTitle('📦 Your Inventory')
      .setDescription('No cards match your filters!')
      .addFields({ name: 'Coins', value: `${user.coins}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    return;
  }

  // Calculate pagination
  const totalPages = Math.ceil(filteredInventory.length / CARDS_PER_PAGE);
  const validPage = Math.max(1, Math.min(page, totalPages));
  const startIndex = (validPage - 1) * CARDS_PER_PAGE;
  const endIndex = startIndex + CARDS_PER_PAGE;
  const pageCards = filteredInventory.slice(startIndex, endIndex);

  const cardList = pageCards
    .map((item: any, index: number) => {
      const card = item.cards;
      const eraText = card.era ? ` - ${card.era}` : '';
      return `**Card ${index + 1}:** ${card.name} (${card.group}${eraText}) - Rarity ${card.rarity} - \`${card.cardcode}\` - Qty: ${item.quantity}`;
    })
    .join('\n');

  const totalCards = inventory.reduce((sum: number, item: any) => sum + item.quantity, 0);
  const filterSummary = rarityFilter || groupFilter 
    ? `\n\n*(Filtered: ${rarityFilter ? `Rarity ${rarityFilter}` : ''} ${groupFilter ? `Group: ${groupFilter}` : ''})*`
    : '';

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

  const embed = new EmbedBuilder()
    .setColor(0xff69b4)
    .setTitle('📦 Your K-pop Card Collection')
    .setDescription(cardList + filterSummary)
    .addFields(
      { name: 'Total Cards', value: `${totalCards}`, inline: true },
      { name: 'Unique Cards', value: `${inventory.length}`, inline: true },
      { name: 'Coins', value: `${user.coins}`, inline: true },
      { name: 'Page', value: `${validPage} / ${totalPages}`, inline: true }
    )
    .setTimestamp();

  if (attachment) {
    embed.setImage('attachment://inventory_cards.png');
    await interaction.reply({ embeds: [embed], files: [attachment] });
  } else {
    await interaction.reply({ embeds: [embed] });
  }
}
