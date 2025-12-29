import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { mergeCardImages } from '../utils/imageUtils.js';
import { getRarityEmoji } from '../utils/cards.js';

export const data = new SlashCommandBuilder()
  .setName('gift')
  .setDescription('Gift cards to another user')
  .addUserOption(option =>
    option.setName('user')
      .setDescription('User to gift to')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('cards')
      .setDescription('Card codes with optional amounts (e.g., BP001 x2, LSCW#501, BP002 x5)')
      .setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const senderUserId = interaction.user.id;
  const receiverUser = interaction.options.getUser('user', true);
  const receiverUserId = receiverUser.id;
  const cardsInput = interaction.options.getString('cards', true);

  // ... (existence checks)

  // Parse card codes and amounts
  const parts = cardsInput.split(',').map(c => c.trim());
  const cardsToGift = [];
  const failedCards = [];

  const { data: allCards } = await supabase.from('cards').select('*');

  for (const part of parts) {
    const [code, amountStr] = part.split(' x');
    const cardcode = code.trim();
    const amount = amountStr ? parseInt(amountStr) : 1;

    const card = allCards?.find((c: any) => c.cardcode.toLowerCase() === cardcode.toLowerCase());
    if (!card) {
      failedCards.push(`${cardcode} (not found)`);
      continue;
    }

    const { data: inv } = await supabase.from('inventory').select('*').eq('user_id', senderUserId).eq('card_id', card.card_id).single();
    if (!inv || inv.quantity < amount) {
      failedCards.push(`${cardcode} (not enough qty)`);
      continue;
    }

    cardsToGift.push({ card, amount });
  }

  if (cardsToGift.length === 0) {
    let errorMsg = '<:IMG_9904:1443371148543791218> No valid cards to gift!';
    if (failedCards.length > 0) {
      errorMsg += `\n${failedCards.join('\n')}`;
    }
    await interaction.editReply({ content: errorMsg });
    return;
  }

  // Build confirmation embed
  const confirmCards = cardsToGift
    .map(({ card }) => {
      const rarityEmoji = getRarityEmoji(card.rarity);
      return `${card.name} (${card.group}) ${rarityEmoji} • \`${card.cardcode}\``;
    })
    .join('\n');

  const confirmEmbed = new EmbedBuilder()
    .setColor(0x00d4ff)
    .setTitle('🎁 Confirm Beach Gift')
    .setDescription(`Send to ${receiverUser.username}?\n\n${confirmCards}`)
    .setTimestamp();

  // Merge images for preview
  let attachment = null;
  try {
    const imageUrls = cardsToGift
      .map(({ card }: any) => card.image_url)
      .filter((url: string) => url);

    if (imageUrls.length > 0) {
      const mergedImageBuffer = await mergeCardImages(imageUrls);
      attachment = new AttachmentBuilder(mergedImageBuffer, { name: 'gift_preview.png' });
      confirmEmbed.setImage('attachment://gift_preview.png');
    }
  } catch (error) {
    console.error('Error merging images:', error);
  }

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`gift_confirm_${senderUserId}_${receiverUserId}`)
        .setLabel('Yes')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`gift_cancel_${senderUserId}`)
        .setLabel('No')
        .setStyle(ButtonStyle.Danger)
    );

  if (attachment) {
    await interaction.editReply({ embeds: [confirmEmbed], files: [attachment], components: [row] });
  } else {
    await interaction.editReply({ embeds: [confirmEmbed], components: [row] });
  }
}
