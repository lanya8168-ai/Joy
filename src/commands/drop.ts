import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { getRandomRarity, getRarityColor, getRarityEmoji } from '../utils/cards.js';
import { isAdminUser } from '../utils/constants.js';
import { scheduleReminder } from '../utils/reminders.js';

const COOLDOWN_MINUTES = 2;

export const data = new SlashCommandBuilder()
  .setName('drop')
  .setDescription('Open a FREE card pack! (2 minute cooldown)');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const userId = interaction.user.id;

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!user) {
    await interaction.editReply({ content: '<:fairy2:1457128704282071196> Please use `/start` first to create your account!' });
    return;
  }

  // Check cooldown (skip for admin users)
  if (!isAdminUser(userId) && user.last_drop) {
    const lastDropTime = new Date(user.last_drop).getTime();
    const nowTime = Date.now();
    const minutesPassed = (nowTime - lastDropTime) / (1000 * 60);

    if (minutesPassed < COOLDOWN_MINUTES) {
      const secondsRemaining = Math.ceil((COOLDOWN_MINUTES - minutesPassed) * 60);
      await interaction.editReply({
        content: `⏳ You can use /drop again in **${secondsRemaining}** seconds!`
      });
      return;
    }
  }

  // Check for event/birthday drop (10% chance)
  let selectedCard;
  if (Math.random() < 0.10) {
    const { data: eventCards } = await supabase
      .from('cards')
      .select('*')
      .eq('droppable', true)
      .not('event_type', 'is', null);
    
    if (eventCards && eventCards.length > 0) {
      selectedCard = eventCards[Math.floor(Math.random() * eventCards.length)];
    }
  }

  if (!selectedCard) {
    const rarity = getRandomRarity();
    const { data: possibleCards } = await supabase
      .from('cards')
      .select('*')
      .eq('droppable', true)
      .eq('rarity', rarity)
      .eq('is_limited', false) // Normal drops don't include limited by default
      .is('event_type', null);

    if (possibleCards && possibleCards.length > 0) {
      selectedCard = possibleCards[Math.floor(Math.random() * possibleCards.length)];
    } else {
      // Fallback to any droppable card if specific rarity is empty
      const { data: fallbackCards } = await supabase
        .from('cards')
        .select('*')
        .eq('droppable', true)
        .eq('is_limited', false)
        .is('event_type', null);
      selectedCard = fallbackCards?.[Math.floor(Math.random() * (fallbackCards?.length || 1))];
    }
  }

  if (!selectedCard) {
    if (userId === '1403958587843149937') {
      // Mock card for owner testing
      selectedCard = {
        card_id: 0,
        name: 'Test Idol',
        group: 'Test Group',
        era: 'Test Era',
        rarity: 5,
        cardcode: 'TEST001',
        image_url: 'https://placehold.co/600x400?text=Test+Card'
      };
    } else {
      await interaction.editReply({
        content: '<:fairy2:1457128704282071196> No droppable cards available yet!'
      });
      return;
    }
  }

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
    await interaction.editReply({ content: `<:fairy2:1457128704282071196> Error processing drop: ${error.message}` });
    return;
  }

  const rarityEmoji = getRarityEmoji(selectedCard.rarity);
  const description = `**${selectedCard.name}** (${selectedCard.group}) ${rarityEmoji}\n${selectedCard.era || 'N/A'} • \`${selectedCard.cardcode}\``;
  
  const nextAvailable = new Date(Date.now() + COOLDOWN_MINUTES * 60 * 1000);
  const embed = new EmbedBuilder()
    .setColor(getRarityColor(selectedCard.rarity))
    .setAuthor({
      name: interaction.user.username,
      iconURL: interaction.user.avatarURL() || undefined
    })
    .setTitle('<:wings5:1457127829438332969> You explored and found..')
    .setDescription(description)
    .addFields(
      { name: '⏰ Next Available', value: `<t:${Math.floor(nextAvailable.getTime() / 1000)}:R>`, inline: true }
    )
    .setTimestamp();

  if (selectedCard.image_url) {
    embed.setImage(selectedCard.image_url);
  }

  // Schedule reminder for next drop
  const client = interaction.client;
  scheduleReminder(client, userId, interaction.channelId, 'drop', COOLDOWN_MINUTES * 60 * 1000);

  await interaction.editReply({ embeds: [embed] });
}