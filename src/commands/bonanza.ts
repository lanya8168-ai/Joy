import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { formatCooldown } from '../utils/cooldowns.js';
import { mergeCardImages } from '../utils/imageUtils.js';
import { BOOSTER_ROLE_ID, isAdminUser } from '../utils/constants.js';
import { scheduleReminder } from '../utils/reminders.js';

const BONANZA_COOLDOWN_HOURS = 6;

export const data = new SlashCommandBuilder()
  .setName('bonanza')
  .setDescription('Exclusive booster mega reward! (6 hour cooldown)');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const userId = interaction.user.id;

  // Check if user is booster or admin
  const member = interaction.member as any;
  if (!isAdminUser(userId) && !member?.roles?.cache?.has(BOOSTER_ROLE_ID)) {
    await interaction.editReply({ 
      content: '<:IMG_9904:1443371148543791218> This command is only available to boosters!' 
    });
    return;
  }

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!user) {
    await interaction.editReply({ content: '<:IMG_9904:1443371148543791218> Please use `/start` first to create your account!' });
    return;
  }

  // Check cooldown (skip for admin users) - handle missing column gracefully
  const lastBonanza = user.last_bonanza;
  if (!isAdminUser(userId) && lastBonanza && new Date(lastBonanza).getTime() > Date.now() - BONANZA_COOLDOWN_HOURS * 60 * 60 * 1000) {
    const cooldownMs = new Date(lastBonanza).getTime() + (BONANZA_COOLDOWN_HOURS * 60 * 60 * 1000) - Date.now();
    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('⏰ Bonanza On Cooldown')
      .setDescription(`Come back in **${formatCooldown(cooldownMs)}**`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Give 25,000 coins - try with last_bonanza, fallback without it
  const newBalance = user.coins + 25000;
  let updateError = null;
  
  // Try updating with last_bonanza column first
  const { error: error1 } = await supabase.from('users').update({ coins: newBalance, last_bonanza: new Date().toISOString() }).eq('user_id', userId);
  
  if (error1 && error1.code === 'PGRST204') {
    // Column doesn't exist, update only coins
    const { error: error2 } = await supabase.from('users').update({ coins: newBalance }).eq('user_id', userId);
    updateError = error2;
  } else {
    updateError = error1;
  }
  
  if (updateError) {
    console.error('Error updating coins:', updateError);
    await interaction.editReply({ content: '<:IMG_9904:1443371148543791218> Error claiming bonanza. Please try again!' });
    return;
  }

  // Get legendary cards only (droppable)
  const { data: legendaryCards } = await supabase.from('cards').select('*').eq('rarity', 5).eq('droppable', true);

  if (!legendaryCards || legendaryCards.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0x00d4ff)
      .setTitle('<a:5octo:1435458063740960778> Bonanza Claimed!')
      .setDescription(`<:fullstar:1387609456824680528> You received **25,000 coins**!\n\n*No legendary cards available yet.*`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Give 20 legendary cards - batch for performance
  const selectedCards = [];
  const cardCounts = new Map<number, number>();
  
  for (let i = 0; i < 20; i++) {
    const randomCard = legendaryCards[Math.floor(Math.random() * legendaryCards.length)];
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

  let attachment = null;
  try {
    const imageUrls = selectedCards.filter((card: any) => card.image_url).map((card: any) => card.image_url);
    if (imageUrls.length > 0) {
      const mergedImageBuffer = await mergeCardImages(imageUrls, 5);
      attachment = new AttachmentBuilder(mergedImageBuffer, { name: 'bonanza_cards.png' });
    }
  } catch (error) {
    console.error('Error merging images:', error);
  }

  const nextAvailable = new Date(Date.now() + 6 * 60 * 60 * 1000);
  const embed = new EmbedBuilder()
    .setColor(0xffcc00)
    .setTitle('<a:5octo:1435458063740960778> Bonanza Claimed!')
    .setDescription(`<:fullstar:1387609456824680528> You received **25,000 coins** and **20 legendary cards**!`)
    .addFields(
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

  // Schedule reminder for next bonanza
  const client = interaction.client;
  scheduleReminder(client, userId, interaction.channelId, 'bonanza', BONANZA_COOLDOWN_HOURS * 60 * 60 * 1000);

  if (attachment) {
    embed.setImage('attachment://bonanza_cards.png');
    await interaction.editReply({ embeds: [embed], files: [attachment] });
  } else {
    await interaction.editReply({ embeds: [embed] });
  }
}
