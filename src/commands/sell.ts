import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { getRarityEmoji } from '../utils/cards.js';

const RARITY_PRICES: { [key: number]: number } = {
  5: 10000,
  4: 7500,
  3: 5000,
  2: 2500,
  1: 1000
};

export const data = new SlashCommandBuilder()
  .setName('sell')
  .setDescription('Sell cards from your inventory')
  .addStringOption(option =>
    option.setName('cards')
      .setDescription('Card codes separated by commas (e.g., BP001, LSCW#501)')
      .setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const userId = interaction.user.id;
  const cardsInput = interaction.options.getString('cards', true);

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!user) {
    await interaction.editReply({ content: '<:IMG_9904:1443371148543791218> Please use `/start` first to create your account!' });
    return;
  }

  // Parse card codes
  const cardcodes = cardsInput.split(',').map(c => c.trim().toUpperCase());
  const soldCards = [];
  const failedCards = [];
  let totalCoins = 0;

  for (const cardcode of cardcodes) {
    // Find the card
    const { data: card } = await supabase
      .from('cards')
      .select('*')
      .ilike('cardcode', cardcode)
      .single();

    if (!card) {
      failedCards.push(`${cardcode} (not found)`);
      continue;
    }

    // Check user has the card
    const { data: inventory } = await supabase
      .from('inventory')
      .select('*')
      .eq('user_id', userId)
      .eq('card_id', card.card_id)
      .single();

    if (!inventory || inventory.quantity < 1) {
      failedCards.push(`${cardcode} (don't own)`);
      continue;
    }

    // Remove card from inventory
    const newQuantity = inventory.quantity - 1;
    if (newQuantity > 0) {
      await supabase
        .from('inventory')
        .update({ quantity: newQuantity })
        .eq('id', inventory.id);
    } else {
      await supabase
        .from('inventory')
        .delete()
        .eq('id', inventory.id);
    }

    // Calculate price based on rarity
    const price = RARITY_PRICES[card.rarity] || 0;
    totalCoins += price;

    const rarityEmoji = getRarityEmoji(card.rarity);
    soldCards.push(`**${card.name}** ${rarityEmoji} (\`${card.cardcode}\`) • ${price} coins`);
  }

  if (totalCoins > 0) {
    // Add coins to user
    await supabase
      .from('users')
      .update({ coins: user.coins + totalCoins })
      .eq('user_id', userId);
  }

  let description = '';
  if (soldCards.length > 0) {
    description = `<:IMG_9902:1443367697286172874> Sold:\n${soldCards.join('\n')}\n\n💰 **Total: +${totalCoins} coins**`;
  }

  if (failedCards.length > 0) {
    if (description) description += '\n\n';
    description += `<:IMG_9904:1443371148543791218> Failed:\n${failedCards.join('\n')}`;
  }

  if (!description) {
    await interaction.editReply({ content: '<:IMG_9904:1443371148543791218> No cards were sold!' });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0xffd700)
    .setTitle('🏖️ Cards Sold!')
    .setDescription(description)
    .addFields({ name: 'New Balance', value: `${user.coins + totalCoins} coins`, inline: true })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
