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
    await interaction.editReply({ content: '<:IMG_9904:1443371148543791218> Error claiming daily reward. Please try again!' });
    return;
  }

  const result = data as any;

  if (!result || !result.success) {
    if (result.error === 'user_not_found') {
      await interaction.editReply({ content: '<:IMG_9904:1443371148543791218> Please use `/start` first to create your account!' });
      return;
    }

    if (result.error === 'on_cooldown') {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('⏰ Daily Reward On Cooldown')
        .setDescription(`Come back in **${formatCooldown(result.cooldown_remaining_ms)}**`)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    await interaction.editReply({ content: '<:IMG_9904:1443371148543791218> Error claiming daily reward. Please try again!' });
    return;
  }

  // Get a random legendary card
  const { data: legendaryCards } = await supabase
    .from('cards')
    .select('*')
    .eq('rarity', 5)
    .eq('droppable', true);

  if (!legendaryCards || legendaryCards.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('Daily Reward Claimed!')
      .setDescription(`<:2_shell:1436124721413357770> You received **${result.reward} coins**!\n\n*No legendary cards available yet.*`)
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

  const coinsEarned = result.reward;
  const newBalance = result.balance;
  const randomLegendary = selectedCard;

  const nextAvailable = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const embed = new EmbedBuilder()
    .setColor(0xffcc00)
    .setTitle('<:1_petal:1436124714526445761> Daily Reward Claimed!')
    .setDescription(`<:2_shell:1436124721413357770> You received **${coinsEarned} coins** and a **legendary card**!`)
    .addFields(
      {
        name: '<a:5blu_bubbles:1436124726010318870> Card Received',
        value: `${getRarityEmoji(randomLegendary.rarity)} **${randomLegendary.name}** (${randomLegendary.group}) • ${randomLegendary.era || 'N/A'} • \`${randomLegendary.cardcode}\``,
        inline: false
      },
      {
        name: '<:2_shell:1436124721413357770> New Balance',
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