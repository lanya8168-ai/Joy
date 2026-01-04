import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { formatCooldown } from '../utils/cooldowns.js';
import { mergeCardImages } from '../utils/imageUtils.js';
import { AttachmentBuilder } from 'discord.js';
import { BOOSTER_ROLE_ID, isAdminUser } from '../utils/constants.js';

const BOOSTER_COOLDOWN_HOURS = 6;

export const data = new SlashCommandBuilder()
  .setName('booster')
  .setDescription('Exclusive booster reward! (6 hour cooldown)');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const userId = interaction.user.id;

  // Check if user is booster or admin
  const member = interaction.member as any;
  if (!isAdminUser(userId) && !member?.roles?.cache?.has(BOOSTER_ROLE_ID)) {
    await interaction.editReply({ 
      content: '<:fairy2:1457128704282071196> This command is only available to boosters!' 
    });
    return;
  }

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!user) {
    await interaction.editReply({ content: '<:fairy2:1457128704282071196> Please use `/start` first to create your account!' });
    return;
  }

  // Check cooldown (skip for admin users) - handle missing column gracefully
  const lastBooster = user.last_booster;
  if (!isAdminUser(userId) && lastBooster && new Date(lastBooster).getTime() > Date.now() - BOOSTER_COOLDOWN_HOURS * 60 * 60 * 1000) {
    const cooldownMs = new Date(lastBooster).getTime() + (BOOSTER_COOLDOWN_HOURS * 60 * 60 * 1000) - Date.now();
    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('⏰ Booster Reward On Cooldown')
      .setDescription(`Come back in **${formatCooldown(cooldownMs)}**`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Give 10,000 coins - try with last_booster, fallback without it
  const newBalance = user.coins + 10000;
  let updateError = null;
  
  // Try updating with last_booster column first
  const { error: error1 } = await supabase.from('users').update({ coins: newBalance, last_booster: new Date().toISOString() }).eq('user_id', userId);
  
  if (error1 && error1.code === 'PGRST204') {
    // Column doesn't exist, update only coins
    const { error: error2 } = await supabase.from('users').update({ coins: newBalance }).eq('user_id', userId);
    updateError = error2;
  } else {
    updateError = error1;
  }
  
  if (updateError) {
    console.error('Error updating coins:', updateError);
    await interaction.editReply({ content: '<:fairy2:1457128704282071196> Error claiming booster reward. Please try again!' });
    return;
  }

  // Get all cards
  const { data: allCards } = await supabase.from('cards').select('*');

  if (!allCards || allCards.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0xffd700)
      .setTitle('<a:5surfboard:1433597347031683114> Booster Reward Claimed!')
      .setDescription(`<:fairy2:1457128704282071196> You received **10,000 coins**!\n\n*No cards available yet.*`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Give 15 random cards - batch for performance
  const selectedCards = [];
  const cardCounts = new Map<number, number>();
  
  for (let i = 0; i < 15; i++) {
    const randomCard = allCards[Math.floor(Math.random() * allCards.length)];
    selectedCards.push(randomCard);
    cardCounts.set(randomCard.card_id, (cardCounts.get(randomCard.card_id) || 0) + 1);
  }

  // Get existing inventory items for all selected cards
  const cardIds = Array.from(cardCounts.keys());
  const { data: existingItems } = await supabase
    .from('inventory')
    .select('*')
    .eq('user_id', userId)
    .in('card_id', cardIds);

  const existingMap = new Map((existingItems || []).map(item => [item.card_id, item]));

  // Batch updates and inserts
  for (const [cardId, count] of cardCounts) {
    const existing = existingMap.get(cardId);
    if (existing) {
      await supabase.from('inventory').update({ quantity: existing.quantity + count }).eq('id', existing.id);
    } else {
      await supabase.from('inventory').insert({ user_id: userId, card_id: cardId, quantity: count });
    }
  }

  const cardsInfo = selectedCards
    .map((card: any) => `• **${card.name}** (${card.group}) • ${card.era || 'N/A'} • \`${card.cardcode}\``)
    .join('\n');

  let attachment = null;
  try {
    const imageUrls = selectedCards.filter((card: any) => card.image_url).map((card: any) => card.image_url);
    if (imageUrls.length > 0) {
      const mergedImageBuffer = await mergeCardImages(imageUrls, 5);
      attachment = new AttachmentBuilder(mergedImageBuffer, { name: 'booster_cards.png' });
    }
  } catch (error) {
    console.error('Error merging images:', error);
  }

  const embed = new EmbedBuilder()
    .setColor(0x00d4ff)
    .setTitle('🌿 Booster Reward Claimed!')
    .setDescription(`<:rarity_star:1442247814540296343> You received **10,000 coins** and **15 cards**!`)
    .addFields(
      {
        name: '<:1_flower:1436124715797315687> Cards Received',
        value: cardsInfo,
        inline: false
      },
      {
        name: '<:fairy2:1457128704282071196> New Balance',
        value: `${newBalance} coins`,
        inline: true
      }
    )
    .setTimestamp();

  if (attachment) {
    embed.setImage('attachment://booster_cards.png');
    await interaction.editReply({ embeds: [embed], files: [attachment] });
  } else {
    await interaction.editReply({ embeds: [embed] });
  }
}
