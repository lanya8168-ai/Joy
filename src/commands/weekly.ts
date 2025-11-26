import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { formatCooldown } from '../utils/cooldowns.js';
import { mergeCardImages } from '../utils/imageUtils.js';
import { getRandomRarity, getRarityEmoji } from '../utils/cards.js';

const WEEKLY_REWARD = 1500;
const WEEKLY_COOLDOWN_HOURS = 168;

export const data = new SlashCommandBuilder()
  .setName('weekly')
  .setDescription('Claim your weekly coin reward!');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const userId = interaction.user.id;

  const { data, error } = await supabase.rpc('claim_weekly_reward', {
    p_user_id: userId,
    p_reward: WEEKLY_REWARD,
    p_cooldown_hours: WEEKLY_COOLDOWN_HOURS
  });

  if (error || !data) {
    await interaction.editReply({ content: '❌ Error claiming weekly reward. Please try again!' });
    return;
  }

  const result = data as any;

  if (!result || !result.success) {
    if (result.error === 'user_not_found') {
      await interaction.editReply({ content: '❌ Please use `/start` first to create your account!' });
      return;
    }

    if (result.error === 'on_cooldown') {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('⏰ Weekly Reward On Cooldown')
        .setDescription(`Come back in **${formatCooldown(result.cooldown_remaining_ms)}**`)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    await interaction.editReply({ content: '❌ Error claiming weekly reward. Please try again!' });
    return;
  }

  // Get all droppable cards
  const { data: allCards } = await supabase
    .from('cards')
    .select('*')
    .eq('droppable', true);

  if (!allCards || allCards.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Weekly Reward Claimed!')
      .setDescription(`You received **${result.reward} coins**!\n\n*No cards available yet.*`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Select 4 random cards with higher rarity 5 chance
  const selectedCards = [];
  for (let i = 0; i < 4; i++) {
    // Boost rarity 5 chance to 80% for weekly rewards
    const random = Math.random() * 100;
    let rarity: number;
    if (random < 80) {
      rarity = 5; // 80% chance for legendary
    } else if (random < 90) {
      rarity = 4; // 10% chance for epic
    } else if (random < 95) {
      rarity = 3; // 5% chance for rare
    } else if (random < 98) {
      rarity = 2; // 3% chance for uncommon
    } else {
      rarity = 1; // 2% chance for common
    }
    
    const cardsOfRarity = allCards.filter(c => c.rarity === rarity);
    const card = cardsOfRarity.length > 0
      ? cardsOfRarity[Math.floor(Math.random() * cardsOfRarity.length)]
      : allCards[Math.floor(Math.random() * allCards.length)];
    selectedCards.push(card);

    // Add to inventory
    const { data: existingItem } = await supabase
      .from('inventory')
      .select('*')
      .eq('user_id', userId)
      .eq('card_id', card.card_id)
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
          card_id: card.card_id,
          quantity: 1
        });
    }
  }

  // Create card info description
  const cardInfos = selectedCards.map((card, index) => {
    const rarityEmoji = getRarityEmoji(card.rarity);
    return `**Card ${index + 1}:** ${card.name} (${card.group}) ${rarityEmoji} • ${card.era || 'N/A'} • \`${card.cardcode}\``;
  }).join('\n');

  const description = `You received **${result.reward} coins**!\n\n**You also received 4 cards:**\n${cardInfos}`;

  let attachment = null;
  try {
    const imageUrls = selectedCards
      .filter(card => card.image_url)
      .map(card => card.image_url);

    if (imageUrls.length > 0) {
      const mergedImageBuffer = await mergeCardImages(imageUrls);
      attachment = new AttachmentBuilder(mergedImageBuffer, { name: 'weekly_cards.png' });
    }
  } catch (error) {
    console.error('Error merging images:', error);
  }

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle('<a:5blu_bubbles:1436124726010318870> Weekly Reward Claimed!')
    .setDescription(description)
    .setTimestamp();

  if (attachment) {
    embed.setImage('attachment://weekly_cards.png');
    await interaction.editReply({ embeds: [embed], files: [attachment] });
  } else {
    await interaction.editReply({ embeds: [embed] });
  }
}
