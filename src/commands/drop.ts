import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { getRandomRarity, getRarityColor, getRarityEmoji } from '../utils/cards.js';

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

  // Check cooldown (skip for whitelisted user)
  if (userId !== '1403958587843149937' && user.last_drop) {
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
    .select('*')
    .eq('droppable', true);

  if (!allCards || allCards.length === 0) {
    await interaction.reply({ 
      content: '❌ No droppable cards available yet! Ask an admin to add cards using `/addcard`.', 
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
    console.error('Drop error updating last_drop:', error);
    await interaction.reply({ content: `❌ Error processing drop: ${error.message}`, ephemeral: true });
    return;
  }

  const rarityEmoji = getRarityEmoji(selectedCard.rarity);
  const description = `**${selectedCard.name}** (${selectedCard.group}) ${rarityEmoji}\n${selectedCard.era || 'N/A'} • \`${selectedCard.cardcode}\``;

  const embed = new EmbedBuilder()
    .setColor(getRarityColor(selectedCard.rarity))
    .setAuthor({ 
      name: interaction.user.username, 
      iconURL: interaction.user.avatarURL() || undefined 
    })
    .setTitle('🤿 You dove and found..')
    .setDescription(description)
    .setFooter({ text: '🏖️ Card dropped' })
    .setTimestamp();

  if (selectedCard.image_url) {
    embed.setImage(selectedCard.image_url);
  }

  await interaction.reply({ embeds: [embed] });
}
