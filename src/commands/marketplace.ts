import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { getRarityEmoji } from '../utils/cards.js';

export const data = new SlashCommandBuilder()
  .setName('mp')
  .setDescription('Browse the marketplace')
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('List a card for sale')
      .addStringOption(option =>
        option.setName('cardcode')
          .setDescription('Card code (e.g., BP001)')
          .setRequired(true))
      .addIntegerOption(option =>
        option.setName('price')
          .setDescription('Price in coins')
          .setRequired(true)
          .setMinValue(1))
      .addIntegerOption(option =>
        option.setName('quantity')
          .setDescription('Quantity to sell')
          .setMinValue(1)
          .setRequired(false)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('browse')
      .setDescription('Browse available cards'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('buy')
      .setDescription('Buy a card from the marketplace')
      .addStringOption(option =>
        option.setName('code')
          .setDescription('The listing code to purchase (e.g., 691.BCA)')
          .setRequired(true)));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'list') {
    await handleList(interaction);
  } else if (subcommand === 'browse') {
    await handleBrowse(interaction);
  } else if (subcommand === 'buy') {
    await handleBuy(interaction);
  }
}

function generateListingCode(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 3; i++) code += chars.charAt(Math.floor(Math.random() * 36));
  code += '.';
  for (let i = 0; i < 3; i++) code += chars.charAt(Math.floor(Math.random() * 36));
  return code;
}

async function handleList(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  const cardcode = interaction.options.getString('cardcode', true).toUpperCase();
  const price = interaction.options.getInteger('price', true);
  const quantity = interaction.options.getInteger('quantity') || 1;

  // Get card by cardcode
  const { data: card } = await supabase
    .from('cards')
    .select('card_id')
    .eq('cardcode', cardcode)
    .single();

  if (!card) {
    await interaction.editReply({ content: '<:IMG_9904:1443371148543791218> Card not found! Check the card code.' });
    return;
  }

  // Generate unique listing code
  const listingCode = generateListingCode();

  const { data, error } = await supabase.rpc('list_card_on_marketplace', {
    p_user_id: userId,
    p_card_id: card.card_id,
    p_price: price,
    p_quantity: quantity,
    p_code: listingCode
  });

  if (error || !data) {
    await interaction.editReply({ content: '<:IMG_9904:1443371148543791218> Error creating listing.' });
    return;
  }

  const result = data as any;

  if (!result.success) {
    if (result.error === 'insufficient_cards') {
      await interaction.editReply({ 
        content: `<:IMG_9904:1443371148543791218> You don't have enough of this card! You have ${result.available}. Check your inventory with \`/inventory\`.`
      });
      return;
    }

    await interaction.editReply({ content: '<:IMG_9904:1443371148543791218> Error creating listing.' });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x00d4ff)
    .setTitle('<:IMG_9902:1443367697286172874> Card Listed!')
    .setDescription(`Your card has been listed on the marketplace!`)
    .addFields(
      { name: 'Listing Code', value: `\`${listingCode}\``, inline: true },
      { name: 'Price', value: `${result.price} coins`, inline: true },
      { name: 'Quantity', value: `${result.quantity}`, inline: true }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleBrowse(interaction: ChatInputCommandInteraction) {
  const { data: listings } = await supabase
    .from('marketplace')
    .select(`
      code,
      price,
      quantity,
      seller_id,
      cards (
        card_id,
        name,
        group,
        era,
        rarity,
        cardcode
      )
    `)
    .limit(10);

  if (!listings || listings.length === 0) {
    await interaction.editReply({ content: '🛒 The marketplace is empty! No cards are currently for sale.' });
    return;
  }

  const listingText = listings
    .map((listing: any) => {
      const card = listing.cards;
      const eraText = card.era ? ` - ${card.era}` : '';
      return `**\`${listing.code}\`** | ${getRarityEmoji(card.rarity)} ${card.name} (${card.group}${eraText}) • \`${card.cardcode}\` | ${listing.price} coins | x${listing.quantity}`;
    })
    .join('\n');

  const embed = new EmbedBuilder()
    .setColor(0x00d4ff)
    .setTitle('🏖️ Beach Marketplace')
    .setDescription(listingText)
    .setFooter({ text: 'Use /mp buy <code> to purchase' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleBuy(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  const code = interaction.options.getString('code', true).toUpperCase();

  const { data: listing } = await supabase
    .from('marketplace')
    .select(`
      listing_id,
      code,
      *,
      cards (
        card_id,
        name,
        group,
        era,
        rarity
      )
    `)
    .eq('code', code)
    .single();

  if (!listing) {
    await interaction.editReply({ content: '<:IMG_9904:1443371148543791218> Listing not found! Check the code.' });
    return;
  }

  const { data, error } = await supabase.rpc('purchase_marketplace_listing', {
    p_buyer_id: userId,
    p_listing_id: listing.listing_id
  });

  if (error || !data) {
    await interaction.editReply({ content: '<:IMG_9904:1443371148543791218> Error purchasing card.' });
    return;
  }

  const result = data as any;

  if (!result.success) {
    if (result.error === 'listing_not_found') {
      await interaction.editReply({ content: '<:IMG_9904:1443371148543791218> Listing not found or already sold!' });
      return;
    }

    if (result.error === 'cannot_buy_own_listing') {
      await interaction.editReply({ content: '<:IMG_9904:1443371148543791218> You cannot buy your own listing!' });
      return;
    }

    if (result.error === 'buyer_not_found') {
      await interaction.editReply({ content: '<:IMG_9904:1443371148543791218> Please use `/start` first to create your account!' });
      return;
    }

    if (result.error === 'insufficient_funds') {
      await interaction.editReply({ 
        content: `<:IMG_9904:1443371148543791218> You need ${result.required} coins! You have ${result.available} coins.`
      });
      return;
    }

    await interaction.editReply({ content: '<:IMG_9904:1443371148543791218> Error purchasing card.' });
    return;
  }

  const card = listing.cards as any;
  const eraText = card.era ? ` - ${card.era}` : '';
  const embed = new EmbedBuilder()
    .setColor(0x00d4ff)
    .setTitle('<:IMG_9902:1443367697286172874> Purchase Complete!')
    .setDescription(`You bought ${card.name}!`)
    .addFields(
      { name: 'Card', value: `${getRarityEmoji(card.rarity)} ${card.name} (${card.group}${eraText})`, inline: true },
      { name: 'Price', value: `${result.price} coins`, inline: true },
      { name: 'Remaining Coins', value: `${result.new_balance}`, inline: true }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
