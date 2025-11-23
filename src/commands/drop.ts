import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { getRandomRarity, getRarityEmoji, getRarityColor } from '../utils/cards.js';

const COOLDOWN_MINUTES = 2;

export const data = new SlashCommandBuilder()
  .setName('drop')
  .setDescription('Open a FREE card pack! (2 minute cooldown)');

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

  // Check cooldown
  if (user.last_drop) {
    const lastDropTime = new Date(user.last_drop).getTime();
    const nowTime = Date.now();
    const minutesPassed = (nowTime - lastDropTime) / (1000 * 60);
    
    if (minutesPassed < COOLDOWN_MINUTES) {
      const secondsRemaining = Math.ceil((COOLDOWN_MINUTES - minutesPassed) * 60);
      await interaction.reply({ 
        content: `⏳ You can use /drop again in **${secondsRemaining}** seconds!`, 
        ephemeral: true 
      });
      return;
    }
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

  // Add card to inventory and update last_drop time
  const { data: existingItem } = await supabase
    .from('inventory')
    .select('*')
    .eq('user_id', userId)
    .eq('card_id', selectedCard.card_id)
    .single();

  if (existingItem) {
    // Update quantity
    await supabase
      .from('inventory')
      .update({ quantity: existingItem.quantity + 1 })
      .eq('id', existingItem.id);
  } else {
    // Insert new item
    await supabase
      .from('inventory')
      .insert({
        user_id: userId,
        card_id: selectedCard.card_id,
        quantity: 1
      });
  }

  // Update last_drop timestamp
  const { error } = await supabase
    .from('users')
    .update({ last_drop: new Date().toISOString() })
    .eq('user_id', userId);

  if (error) {
    await interaction.reply({ content: '❌ Error processing drop. Please try again!', ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(getRarityColor(selectedCard.rarity))
    .setTitle('🎴 Card Drop!')
    .setDescription(`You opened a FREE card pack!`)
    .addFields(
      { name: 'Card Name', value: selectedCard.name, inline: true },
      { name: 'Group', value: selectedCard.group, inline: true },
      { name: 'Rarity', value: `${getRarityEmoji(selectedCard.rarity)} ${selectedCard.rarity}`, inline: true },
      { name: 'Next Drop', value: `In 2 minutes`, inline: true }
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
