import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { mergeCardImages } from '../utils/imageUtils.js';

export const data = new SlashCommandBuilder()
  .setName('gift')
  .setDescription('Gift cards to another user')
  .addUserOption(option =>
    option.setName('user')
      .setDescription('User to gift to')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('cards')
      .setDescription('Card codes separated by commas (e.g., BP001, LSCW#501, BP002)')
      .setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const senderUserId = interaction.user.id;
  const receiverUser = interaction.options.getUser('user', true);
  const receiverUserId = receiverUser.id;
  const cardsInput = interaction.options.getString('cards', true);

  // Check sender exists
  const { data: sender } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', senderUserId)
    .single();

  if (!sender) {
    await interaction.editReply({ content: '❌ Please use `/start` first to create your account!' });
    return;
  }

  // Check receiver exists
  const { data: receiver } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', receiverUserId)
    .single();

  if (!receiver) {
    await interaction.editReply({ content: `❌ ${receiverUser.username} needs to use \`/start\` first!` });
    return;
  }

  // Prevent self-gifting
  if (senderUserId === receiverUserId) {
    await interaction.editReply({ content: '❌ You can\'t gift to yourself!' });
    return;
  }

  // Parse card codes
  const cardcodes = cardsInput.split(',').map(c => c.trim().toUpperCase());
  const giftedCards = [];
  const giftedCardObjects = [];
  const failedCards = [];

  for (const cardcode of cardcodes) {
    // Find the card
    const { data: card } = await supabase
      .from('cards')
      .select('*')
      .eq('cardcode', cardcode)
      .single();

    if (!card) {
      failedCards.push(`${cardcode} (not found)`);
      continue;
    }

    // Check sender has the card
    const { data: senderInventory } = await supabase
      .from('inventory')
      .select('*')
      .eq('user_id', senderUserId)
      .eq('card_id', card.card_id)
      .single();

    if (!senderInventory || senderInventory.quantity < 1) {
      failedCards.push(`${cardcode} (don't own)`);
      continue;
    }

    // Update sender inventory
    const newSenderQuantity = senderInventory.quantity - 1;
    if (newSenderQuantity > 0) {
      await supabase
        .from('inventory')
        .update({ quantity: newSenderQuantity })
        .eq('id', senderInventory.id);
    } else {
      await supabase
        .from('inventory')
        .delete()
        .eq('id', senderInventory.id);
    }

    // Update receiver inventory
    const { data: receiverInventory } = await supabase
      .from('inventory')
      .select('*')
      .eq('user_id', receiverUserId)
      .eq('card_id', card.card_id)
      .single();

    if (receiverInventory) {
      await supabase
        .from('inventory')
        .update({ quantity: receiverInventory.quantity + 1 })
        .eq('id', receiverInventory.id);
    } else {
      await supabase
        .from('inventory')
        .insert({
          user_id: receiverUserId,
          card_id: card.card_id,
          quantity: 1
        });
    }

    const rarityStars = '⭐'.repeat(card.rarity);
    giftedCards.push(`${card.name} (${card.group}) ${rarityStars} • \`${card.cardcode}\``);
    giftedCardObjects.push(card);
  }

  let description = '';
  if (giftedCards.length > 0) {
    description = `✅ Gifted to ${receiverUser.username}:\n${giftedCards.join('\n')}`;
  }

  if (failedCards.length > 0) {
    if (description) description += '\n\n';
    description += `❌ Failed:\n${failedCards.join('\n')}`;
  }

  if (!description) {
    await interaction.editReply({ content: '❌ No cards were gifted!' });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle('🎁 Gift Sent!')
    .setDescription(description)
    .setTimestamp();

  // Merge images if cards were gifted
  let attachment = null;
  try {
    const imageUrls = giftedCardObjects
      .map((card: any) => card.image_url)
      .filter((url: string) => url);

    if (imageUrls.length > 0) {
      const mergedImageBuffer = await mergeCardImages(imageUrls);
      attachment = new AttachmentBuilder(mergedImageBuffer, { name: 'gifted_cards.png' });
      embed.setImage('attachment://gifted_cards.png');
    }
  } catch (error) {
    console.error('Error merging images:', error);
  }

  if (attachment) {
    await interaction.editReply({ embeds: [embed], files: [attachment] });
  } else {
    await interaction.editReply({ embeds: [embed] });
  }
}
