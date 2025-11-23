import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { getRandomRarity, getRarityEmoji, getRarityColor, getRarityName } from '../utils/cards.js';

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

  const { data, error } = await supabase.rpc('open_card_pack', {
    p_user_id: userId,
    p_pack_cost: PACK_COST,
    p_card_id: selectedCard.card_id
  });

  if (error || !data) {
    await interaction.reply({ content: '❌ Error opening pack. Please try again!', ephemeral: true });
    return;
  }

  const result = data as any;

  if (!result.success) {
    if (result.error === 'user_not_found') {
      await interaction.reply({ content: '❌ Please use `/start` first to create your account!', ephemeral: true });
      return;
    }

    if (result.error === 'insufficient_funds') {
      await interaction.reply({ 
        content: `❌ You need ${PACK_COST} coins to open a pack! You have ${result.available} coins.\nUse \`/daily\`, \`/weekly\`, or \`/surf\` to earn more!`, 
        ephemeral: true 
      });
      return;
    }

    await interaction.reply({ content: '❌ Error opening pack. Please try again!', ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(getRarityColor(selectedCard.rarity))
    .setTitle('🎴 Card Drop!')
    .setDescription(`You opened a card pack!`)
    .addFields(
      { name: 'Card Name', value: selectedCard.name, inline: true },
      { name: 'Group', value: selectedCard.group, inline: true },
      { name: 'Rarity', value: `${getRarityEmoji(selectedCard.rarity)} ${getRarityName(selectedCard.rarity)}`, inline: true },
      { name: 'Remaining Coins', value: `${result.new_balance}`, inline: true }
    )
    .setTimestamp();

  if (selectedCard.era) {
    embed.addFields({ name: 'Era', value: selectedCard.era, inline: true });
  }

  if (selectedCard.image_url) {
    embed.setImage(selectedCard.image_url);
  }

  await interaction.reply({ embeds: [embed] });
}
