import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { mergeCardImages } from '../utils/imageUtils.js';
import { getRarityEmoji } from '../utils/cards.js';

export const data = new SlashCommandBuilder()
  .setName('staffgift')
  .setDescription('Staff only: Gift cards to a user')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
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

  // Check if sender has admin permissions
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.editReply({ content: '<:IMG_9904:1443371148543791218> This command is staff only!' });
    return;
  }

  // Check receiver exists
  const { data: receiver } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', receiverUserId)
    .single();

  if (!receiver) {
    await interaction.editReply({ content: `<:IMG_9904:1443371148543791218> ${receiverUser.username} needs to use \`/start\` first!` });
    return;
  }

  // Prevent self-gifting
  if (senderUserId === receiverUserId) {
    await interaction.editReply({ content: '<:IMG_9904:1443371148543791218> You can\'t gift to yourself!' });
    return;
  }

  // Parse card codes
  const cardcodes = cardsInput.split(',').map(c => c.trim().toUpperCase());
  const cardsToGift = [];
  const failedCards = [];

  // Fetch all cards and validate
  for (const cardcode of cardcodes) {
    const { data: card } = await supabase
      .from('cards')
      .select('*')
      .ilike('cardcode', cardcode)
      .single();

    if (!card) {
      failedCards.push(`${cardcode} (not found)`);
      continue;
    }

    cardsToGift.push(card);
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
    .map((card) => {
      const rarityEmoji = getRarityEmoji(card.rarity);
      return `${card.name} (${card.group}) ${rarityEmoji} • \`${card.cardcode}\``;
    })
    .join('\n');

  const confirmEmbed = new EmbedBuilder()
    .setColor(0xff00ff)
    .setTitle('🏖️ Confirm Staff Gift')
    .setDescription(`Send to ${receiverUser.username}?\n\n${confirmCards}`)
    .setTimestamp();

  // Merge images for preview
  let attachment = null;
  try {
    const imageUrls = cardsToGift
      .map((card: any) => card.image_url)
      .filter((url: string) => url);

    if (imageUrls.length > 0) {
      const mergedImageBuffer = await mergeCardImages(imageUrls);
      attachment = new AttachmentBuilder(mergedImageBuffer, { name: 'staffgift_preview.png' });
      confirmEmbed.setImage('attachment://staffgift_preview.png');
    }
  } catch (error) {
    console.error('Error merging images:', error);
  }

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`staffgift_confirm_${senderUserId}_${receiverUserId}`)
        .setLabel('Yes')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`staffgift_cancel_${senderUserId}`)
        .setLabel('No')
        .setStyle(ButtonStyle.Danger)
    );

  if (attachment) {
    await interaction.editReply({ embeds: [confirmEmbed], files: [attachment], components: [row] });
  } else {
    await interaction.editReply({ embeds: [confirmEmbed], components: [row] });
  }
}
