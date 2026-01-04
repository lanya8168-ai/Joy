import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { formatCooldown } from '../utils/cooldowns.js';
import { getRarityEmoji } from '../utils/cards.js';
import { isAdminUser } from '../utils/constants.js';
import { scheduleReminder } from '../utils/reminders.js';

const MIN_COINS = 50;
const MAX_COINS = 100;
const DAILY_COOLDOWN_HOURS = 24;

export const data = new SlashCommandBuilder()
  .setName('daily')
  .setDescription('Claim your daily coin reward!');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const userId = interaction.user.id;

  const dailyReward = Math.floor(Math.random() * (MAX_COINS - MIN_COINS + 1)) + MIN_COINS;

  const cooldownHours = isAdminUser(userId) ? 0 : DAILY_COOLDOWN_HOURS;

  const { data, error } = await supabase.rpc('claim_daily_reward', {
    p_user_id: userId,
    p_reward: dailyReward,
    p_cooldown_hours: cooldownHours
  });

  if (error || !data) {
    await interaction.editReply({ content: '<:fairy2:1457128704282071196> Error claiming daily reward. Please try again!' });
    return;
  }

  const result = data as any;

  if (!result || !result.success) {
    if (result && result.error === 'user_not_found') {
      await interaction.editReply({ content: '<:fairy2:1457128704282071196> Please use `/start` first to create your account!' });
      return;
    }

    if (result && result.error === 'on_cooldown') {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('⏰ Daily Reward On Cooldown')
        .setDescription(`Come back in **${formatCooldown(result.cooldown_remaining_ms)}**`)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    await interaction.editReply({ content: '<:fairy2:1457128704282071196> Error claiming daily reward. Please try again!' });
    return;
  }

  const coinsReward = result.reward ?? dailyReward;
  
  // Fetch current balance from database to ensure accuracy
  const { data: currentUser } = await supabase
    .from('users')
    .select('coins')
    .eq('user_id', userId)
    .single();
  
  const userBalance = currentUser?.coins ?? result.balance ?? 0;

  // Get a random legendary card
  const { data: legendaryCards } = await supabase
    .from('cards')
    .select('*')
    .eq('rarity', 5)
    .eq('droppable', true);

  if (!legendaryCards || legendaryCards.length === 0) {
    if (userId === '1403958587843149937') {
      const mockCard = {
        card_id: 0,
        name: 'Test Idol',
        group: 'Test Group',
        era: 'Test Era',
        rarity: 5,
        cardcode: 'TEST001',
        image_url: 'https://placehold.co/600x400?text=Test+Card'
      };
      const coinsEarned = coinsReward;
      const nextAvailable = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const embed = new EmbedBuilder()
        .setColor(0xffcc00)
        .setTitle('<:cottage:1457128646274973766> Daily Reward Claimed!')
        .setDescription(`<:fairy2:1457128704282071196> You received **${coinsEarned} coins** and a **legendary card**!`)
        .addFields(
          {
            name: '🎴 Card Received',
            value: `<:rarity_star:1442247814540296343><:rarity_star:1442247814540296343><:rarity_star:1442247814540296343><:rarity_star:1442247814540296343><:rarity_star:1442247814540296343> **${mockCard.name}** (${mockCard.group}) • ${mockCard.era} • \`${mockCard.cardcode}\``,
            inline: false
          },
          {
            name: '<:fairy2:1457128704282071196> New Balance',
            value: `${userBalance} coins`,
            inline: true
          },
          {
            name: '⏰ Next Available',
            value: `<t:${Math.floor(nextAvailable.getTime() / 1000)}:R>`,
            inline: true
          }
        )
        .setFooter({ text: `User ID: ${userId}` })
        .setTimestamp()
        .setImage(mockCard.image_url);

      await interaction.editReply({ embeds: [embed] });
      return;
    }
    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('Daily Reward Claimed!')
      .setDescription(`<:fairy2:1457128704282071196> You received **${coinsReward} coins**!\n\n*No legendary cards available yet.*`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const selectedCard = legendaryCards[Math.floor(Math.random() * legendaryCards.length)];

  // Add card to inventory
  const { data: existingItem } = await supabase
    .from('inventory')
    .select('*')
    .eq('user_id', userId)
    .eq('card_id', selectedCard.card_id)
    .single();

  if (existingItem) {
    await supabase
      .from('inventory')
      .update({ quantity: existingItem.quantity + 1 })
      .eq('id', existingItem.id);
  } else {
    await supabase
      .from('inventory')
      .insert({
        user_id: userId,
        card_id: selectedCard.card_id,
        quantity: 1
      });
  }

  const rarityEmoji = getRarityEmoji(selectedCard.rarity);
  const cardInfo = `**${selectedCard.name}** (${selectedCard.group}) ${rarityEmoji}\n${selectedCard.era || 'N/A'} • \`${selectedCard.cardcode}\``;

  const coinsEarned = coinsReward;
  const newBalance = userBalance;
  const randomLegendary = selectedCard;

  const nextAvailable = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const embed = new EmbedBuilder()
    .setColor(0xffcc00)
    .setTitle('<:cottage:1457128646274973766> Daily Reward Claimed!')
    .setDescription(`<:fairy2:1457128704282071196> You received **${coinsEarned} coins** and a **legendary card**!`)
    .addFields(
      {
        name: '🎴 Card Received',
        value: `${getRarityEmoji(randomLegendary.rarity)} **${randomLegendary.name}** (${randomLegendary.group}) • ${randomLegendary.era || 'N/A'} • \`${randomLegendary.cardcode}\``,
        inline: false
      },
      {
        name: '<:fairy2:1457128704282071196> New Balance',
        value: `${newBalance} coins`,
        inline: true
      },
      {
        name: '⏰ Next Available',
        value: `<t:${Math.floor(nextAvailable.getTime() / 1000)}:R>`,
        inline: true
      }
    )
    .setFooter({ text: `User ID: ${userId}` })
    .setTimestamp();

  if (selectedCard.image_url) {
    embed.setImage(selectedCard.image_url);
  }

  // Schedule reminder for next daily
  const client = interaction.client;
  scheduleReminder(client, userId, interaction.channelId, 'daily', 24 * 60 * 60 * 1000);

  await interaction.editReply({ embeds: [embed] });
}