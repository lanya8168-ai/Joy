import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { supabase } from './database/supabase.js';
import { formatCooldown } from './utils/cooldowns.js';
import { mergeCardImages } from './utils/imageUtils.js';
import { getRarityEmoji } from './utils/cards.js';
import { isAdminUser } from './utils/constants.js';
import { scheduleReminder } from './utils/reminders.js';

const WEEKLY_REWARD = 1500;
const WEEKLY_COOLDOWN_HOURS = 168;

export const data = new SlashCommandBuilder()
setName('weekly')
setDescription('Claim your weekly coin reward!');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const userId = interaction.user.id;

  const cooldownHours = isAdminUser(userId) ? 0 : WEEKLY_COOLDOWN_HOURS;

  const { data, error } = await supabase.rpc('claim_weekly_reward', {
    p_user_id: userId,
    p_reward: WEEKLY_REWARD,
    p_cooldown_hours: cooldownHours
  });

  if (error || !data) {
    await interaction.editReply({ content: '🧚 Error claiming weekly reward. Please try again!' });
    return;
  }

  const result = data as any;

  if (!result || !result.success) {
    if (result.error === 'user_not_found') {
      await interaction.editReply({ content: '🧚 Please use `/start` first to create your account!' });
      return;
    }

    if (result.error === 'on_cooldown') {
      const embed = new EmbedBuilder()
setColor(0xff69b4)
setTitle('⏰ Weekly Reward On Cooldown')
setDescription(`Come back in **${formatCooldown(result.cooldown_remaining_ms)}**`);

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    await interaction.editReply({ content: '🧚 Error claiming weekly reward. Please try again!' });
    return;
  }

  const { data: allCards } = await supabase
from('cards')
select('*')
eq('droppable', true);

  const nextAvailable = new Date(Date.now() + WEEKLY_COOLDOWN_HOURS * 60 * 60 * 1000);

  if (!allCards || allCards.length === 0) {
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
      const cardInfos = Array(4).fill(0).map((_, i) => `**Card ${i + 1}:** ${mockCard.name} (${mockCard.group}) ⭐⭐⭐⭐⭐ • ${mockCard.era} • \`${mockCard.cardcode}\``).join('\n');
      const embed = new EmbedBuilder()
setColor(0xff69b4)
setTitle('📸 Weekly')
setDescription(`Received **${result.reward} coins**!\n\n**You also received 4 cards:**\n${cardInfos}`);
addFields({ name: '⏰ Next', value: `<t:${Math.floor(nextAvailable.getTime() / 1000)}:R>` });
      await interaction.editReply({ embeds: [embed] });
      return;
    }
    const embed = new EmbedBuilder()
setColor(0xff69b4)
setTitle('🏘️ Weekly')
setDescription(`Received **${result.reward} coins**!\n\n*No cards available yet.*`);

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const selectedCards = [];
  for (let i = 0; i < 4; i++) {
    const random = Math.random() * 100;
    let rarity: number;
    if (random < 80) rarity = 5;
    else if (random < 90) rarity = 4;
    else if (random < 95) rarity = 3;
    else if (random < 98) rarity = 2;
    else rarity = 1;

    const cardsOfRarity = allCards.filter(c => c.rarity === rarity);
    const card = cardsOfRarity.length > 0
      ? cardsOfRarity[Math.floor(Math.random() * cardsOfRarity.length)]
      : allCards[Math.floor(Math.random() * allCards.length)];
    selectedCards.push(card);

    const { data: existingItem } = await supabase
from('inventory')
select('*')
eq('user_id', userId)
eq('card_id', card.card_id)
single()

    if (existingItem) {
      await supabase.from('inventory').update({ quantity: existingItem.quantity + 1 }).eq('id', existingItem.id);
    } else {
      await supabase.from('inventory').insert({ user_id: userId, card_id: card.card_id, quantity: 1 });
    }
  }

  const cardInfos = selectedCards.map((card, index) => {
    const rarityEmoji = getRarityEmoji(card.rarity);
    return `**Card ${index + 1}:** ${card.name} (${card.group}) ${rarityEmoji} • ${card.era || 'N/A'} • \`${card.cardcode}\``;
  }).join('\n');

  const description = `Received **${result.reward} coins**!\n\n**You also received 4 cards:**\n${cardInfos}`;

  let attachment = null;
  try {
    const imageUrls = selectedCards.map(card => card.image_url).filter(Boolean);
    if (imageUrls.length > 0) {
      const mergedImageBuffer = await mergeCardImages(imageUrls);
      attachment = new AttachmentBuilder(mergedImageBuffer, { name: 'weekly_cards.png' });
    }
  } catch (error) {
    console.error('Error merging images:', error);
  }

  const embed = new EmbedBuilder()
setColor(0xff69b4)
setTitle('📸 Weekly')
setDescription(description);
addFields({ name: '⏰ Next', value: `<t:${Math.floor(nextAvailable.getTime() / 1000)}:R>` });

  scheduleReminder(interaction.client, userId, interaction.channelId, 'weekly', WEEKLY_COOLDOWN_HOURS * 60 * 60 * 1000);

  await interaction.editReply({ 
    embeds: [embed], 
    files: attachment ? [attachment] : [] 
  });
}
