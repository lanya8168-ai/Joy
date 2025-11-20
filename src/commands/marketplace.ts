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

  const { data: inventoryItem } = await supabase
    .from('inventory')
    .select('*')
    .eq('user_id', userId)
    .eq('card_id', cardId)
    .single();

  if (!inventoryItem || inventoryItem.quantity < quantity) {
    await interaction.reply({ 
      content: `❌ You don't have enough of this card! Check your inventory with \`/inventory\`.`, 
      ephemeral: true 
    });
    return;
  }

  const { error: updateError } = await supabase
    .from('inventory')
    .update({ quantity: inventoryItem.quantity - quantity })
    .eq('user_id', userId)
    .eq('card_id', cardId);

  if (updateError) {
    await interaction.reply({ content: '❌ Error updating inventory.', ephemeral: true });
    return;
  }

  if (inventoryItem.quantity - quantity === 0) {
    await supabase
      .from('inventory')
      .delete()
      .eq('user_id', userId)
      .eq('card_id', cardId);
  }

  const { error: listError } = await supabase
    .from('marketplace')
    .insert([{
      seller_id: userId,
      card_id: cardId,
      price: price,
      quantity: quantity
    }]);

  if (listError) {
    await interaction.reply({ content: '❌ Error creating listing.', ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle('✅ Card Listed!')
    .setDescription(`Your card has been listed on the marketplace!`)
    .addFields(
      { name: 'Card ID', value: `${cardId}`, inline: true },
      { name: 'Price', value: `${price} coins`, inline: true },
      { name: 'Quantity', value: `${quantity}`, inline: true }
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

  if (listing.seller_id === userId) {
    await interaction.reply({ content: '❌ You cannot buy your own listing!', ephemeral: true });
    return;
  }

  const { data: buyer } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!buyer || buyer.coins < listing.price) {
    await interaction.reply({ 
      content: `❌ You need ${listing.price} coins! You have ${buyer?.coins || 0} coins.`, 
      ephemeral: true 
    });
    return;
  }

  await supabase
    .from('users')
    .update({ coins: buyer.coins - listing.price })
    .eq('user_id', userId);

  const { data: seller } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', listing.seller_id)
    .single();

  if (seller) {
    await supabase
      .from('users')
      .update({ coins: seller.coins + listing.price })
      .eq('user_id', listing.seller_id);
  }

  const { data: existingCard } = await supabase
    .from('inventory')
    .select('*')
    .eq('user_id', userId)
    .eq('card_id', listing.card_id)
    .single();

  if (existingCard) {
    await supabase
      .from('inventory')
      .update({ quantity: existingCard.quantity + listing.quantity })
      .eq('id', existingCard.id);
  } else {
    await supabase
      .from('inventory')
      .insert([{
        user_id: userId,
        card_id: listing.card_id,
        quantity: listing.quantity
      }]);
  }

  await supabase
    .from('marketplace')
    .delete()
    .eq('listing_id', listingId);

  const card = listing.cards as any;
  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle('✅ Purchase Complete!')
    .setDescription(`You bought ${card.name}!`)
    .addFields(
      { name: 'Card', value: `${getRarityEmoji(card.rarity)} ${card.name} (${card.group})`, inline: true },
      { name: 'Price', value: `${listing.price} coins`, inline: true },
      { name: 'Remaining Coins', value: `${buyer.coins - listing.price}`, inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
