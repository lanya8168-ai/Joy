import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { getRandomRarity, getRarityEmoji, getRarityColor } from '../utils/cards.js';

const PACK_COST = 50;

export const data = new SlashCommandBuilder()
  .setName('drop')
  .setDescription('Open a card pack and get a random K-pop card!');

export async function execute(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!user) {
    await interaction.reply({ content: '❌ Please use `/start` first to create your account!', ephemeral: true });
    return;
  }

  if (user.coins < PACK_COST) {
    await interaction.reply({ 
      content: `❌ You need ${PACK_COST} coins to open a pack! You have ${user.coins} coins.\nUse \`/daily\`, \`/weekly\`, or \`/surf\` to earn more!`, 
      ephemeral: true 
    });
    return;
  }

  const { data: allCards } = await supabase
    .from('cards')
    .select('*');

  if (!allCards || allCards.length === 0) {
    await interaction.reply({ 
      content: '❌ No cards available yet! Ask an admin to add cards using `/addcard`.', 
      ephemeral: true 
    });
    return;
  }

  const rarity = getRandomRarity();
  const cardsOfRarity = allCards.filter(c => c.rarity === rarity);
  const selectedCard = cardsOfRarity.length > 0 
    ? cardsOfRarity[Math.floor(Math.random() * cardsOfRarity.length)]
    : allCards[Math.floor(Math.random() * allCards.length)];

  const { error: updateCoinsError } = await supabase
    .from('users')
    .update({ coins: user.coins - PACK_COST })
    .eq('user_id', userId);

  if (updateCoinsError) {
    await interaction.reply({ content: '❌ Error processing payment. Please try again!', ephemeral: true });
    return;
  }

  const { data: existingCard } = await supabase
    .from('inventory')
    .select('*')
    .eq('user_id', userId)
    .eq('card_id', selectedCard.card_id)
    .single();

  if (existingCard) {
    await supabase
      .from('inventory')
      .update({ quantity: existingCard.quantity + 1 })
      .eq('id', existingCard.id);
  } else {
    await supabase
      .from('inventory')
      .insert([{
        user_id: userId,
        card_id: selectedCard.card_id,
        quantity: 1
      }]);
  }

  const embed = new EmbedBuilder()
    .setColor(getRarityColor(selectedCard.rarity))
    .setTitle('🎴 Card Drop!')
    .setDescription(`You opened a card pack!`)
    .addFields(
      { name: 'Card Name', value: selectedCard.name, inline: true },
      { name: 'Group', value: selectedCard.group, inline: true },
      { name: 'Rarity', value: `${getRarityEmoji(selectedCard.rarity)} ${selectedCard.rarity.toUpperCase()}`, inline: true },
      { name: 'Remaining Coins', value: `${user.coins - PACK_COST}`, inline: true }
    )
    .setTimestamp();

  if (selectedCard.image_url) {
    embed.setImage(selectedCard.image_url);
  }

  await interaction.reply({ embeds: [embed] });
}
