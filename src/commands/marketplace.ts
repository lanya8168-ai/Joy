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
      .addIntegerOption(option =>
        option.setName('card_id')
          .setDescription('The ID of the card to sell')
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
      .addIntegerOption(option =>
        option.setName('listing_id')
          .setDescription('The listing ID to purchase')
          .setRequired(true)));

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'list') {
    await handleList(interaction);
  } else if (subcommand === 'browse') {
    await handleBrowse(interaction);
  } else if (subcommand === 'buy') {
    await handleBuy(interaction);
  }
}

async function handleList(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  const cardId = interaction.options.getInteger('card_id', true);
  const price = interaction.options.getInteger('price', true);
  const quantity = interaction.options.getInteger('quantity') || 1;

  const { data, error } = await supabase.rpc('list_card_on_marketplace', {
    p_user_id: userId,
    p_card_id: cardId,
    p_price: price,
    p_quantity: quantity
  });

  if (error || !data) {
    await interaction.reply({ content: '❌ Error creating listing.', ephemeral: true });
    return;
  }

  const result = data as any;

  if (!result.success) {
    if (result.error === 'insufficient_cards') {
      await interaction.reply({ 
        content: `❌ You don't have enough of this card! You have ${result.available}. Check your inventory with \`/inventory\`.`, 
        ephemeral: true 
      });
      return;
    }

    await interaction.reply({ content: '❌ Error creating listing.', ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle('✅ Card Listed!')
    .setDescription(`Your card has been listed on the marketplace!`)
    .addFields(
      { name: 'Listing ID', value: `${result.listing_id}`, inline: true },
      { name: 'Price', value: `${result.price} coins`, inline: true },
      { name: 'Quantity', value: `${result.quantity}`, inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleBrowse(interaction: ChatInputCommandInteraction) {
  const { data: listings } = await supabase
    .from('marketplace')
    .select(`
      listing_id,
      price,
      quantity,
      seller_id,
      cards (
        card_id,
        name,
        group,
        rarity
      )
    `)
    .limit(10);

  if (!listings || listings.length === 0) {
    await interaction.reply({ content: '🛒 The marketplace is empty! No cards are currently for sale.', ephemeral: true });
    return;
  }

  const listingText = listings
    .map((listing: any) => {
      const card = listing.cards;
      return `**ID ${listing.listing_id}** | ${getRarityEmoji(card.rarity)} ${card.name} (${card.group}) | ${listing.price} coins | x${listing.quantity}`;
    })
    .join('\n');

  const embed = new EmbedBuilder()
    .setColor(0xffd700)
    .setTitle('🛒 Marketplace')
    .setDescription(listingText)
    .setFooter({ text: 'Use /mp buy <listing_id> to purchase' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleBuy(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  const listingId = interaction.options.getInteger('listing_id', true);

  const { data: listing } = await supabase
    .from('marketplace')
    .select(`
      *,
      cards (
        card_id,
        name,
        group,
        rarity
      )
    `)
    .eq('listing_id', listingId)
    .single();

  if (!listing) {
    await interaction.reply({ content: '❌ Listing not found!', ephemeral: true });
    return;
  }

  const { data, error } = await supabase.rpc('purchase_marketplace_listing', {
    p_buyer_id: userId,
    p_listing_id: listingId
  });

  if (error || !data) {
    await interaction.reply({ content: '❌ Error purchasing card.', ephemeral: true });
    return;
  }

  const result = data as any;

  if (!result.success) {
    if (result.error === 'listing_not_found') {
      await interaction.reply({ content: '❌ Listing not found or already sold!', ephemeral: true });
      return;
    }

    if (result.error === 'cannot_buy_own_listing') {
      await interaction.reply({ content: '❌ You cannot buy your own listing!', ephemeral: true });
      return;
    }

    if (result.error === 'buyer_not_found') {
      await interaction.reply({ content: '❌ Please use `/start` first to create your account!', ephemeral: true });
      return;
    }

    if (result.error === 'insufficient_funds') {
      await interaction.reply({ 
        content: `❌ You need ${result.required} coins! You have ${result.available} coins.`, 
        ephemeral: true 
      });
      return;
    }

    await interaction.reply({ content: '❌ Error purchasing card.', ephemeral: true });
    return;
  }

  const card = listing.cards as any;
  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle('✅ Purchase Complete!')
    .setDescription(`You bought ${card.name}!`)
    .addFields(
      { name: 'Card', value: `${getRarityEmoji(card.rarity)} ${card.name} (${card.group})`, inline: true },
      { name: 'Price', value: `${result.price} coins`, inline: true },
      { name: 'Remaining Coins', value: `${result.new_balance}`, inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
