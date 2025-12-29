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
    option.setName('card1')
      .setDescription('First card code')
      .setRequired(true))
  .addIntegerOption(option =>
    option.setName('amount1')
      .setDescription('Amount for first card')
      .setRequired(false)
      .setMinValue(1))
  .addStringOption(option =>
    option.setName('card2')
      .setDescription('Second card code')
      .setRequired(false))
  .addIntegerOption(option =>
    option.setName('amount2')
      .setDescription('Amount for second card')
      .setRequired(false)
      .setMinValue(1))
  .addStringOption(option =>
    option.setName('card3')
      .setDescription('Third card code')
      .setRequired(false))
  .addIntegerOption(option =>
    option.setName('amount3')
      .setDescription('Amount for third card')
      .setRequired(false)
      .setMinValue(1))
  .addStringOption(option =>
    option.setName('card4')
      .setDescription('Fourth card code')
      .setRequired(false))
  .addIntegerOption(option =>
    option.setName('amount4')
      .setDescription('Amount for fourth card')
      .setRequired(false)
      .setMinValue(1))
  .addStringOption(option =>
    option.setName('card5')
      .setDescription('Fifth card code')
      .setRequired(false))
  .addIntegerOption(option =>
    option.setName('amount5')
      .setDescription('Amount for fifth card')
      .setRequired(false)
      .setMinValue(1))
  .addStringOption(option =>
    option.setName('card6')
      .setDescription('Sixth card code')
      .setRequired(false))
  .addIntegerOption(option =>
    option.setName('amount6')
      .setDescription('Amount for sixth card')
      .setRequired(false)
      .setMinValue(1))
  .addStringOption(option =>
    option.setName('card7')
      .setDescription('Seventh card code')
      .setRequired(false))
  .addIntegerOption(option =>
    option.setName('amount7')
      .setDescription('Amount for seventh card')
      .setRequired(false)
      .setMinValue(1))
  .addStringOption(option =>
    option.setName('card8')
      .setDescription('Eighth card code')
      .setRequired(false))
  .addIntegerOption(option =>
    option.setName('amount8')
      .setDescription('Amount for eighth card')
      .setRequired(false)
      .setMinValue(1));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const senderUserId = interaction.user.id;
  const receiverUser = interaction.options.getUser('user', true);
  const receiverUserId = receiverUser.id;

  //Existence checks
  const { data: sender } = await supabase.from('users').select('*').eq('user_id', senderUserId).single();
  if (!sender) return interaction.editReply({ content: '<:IMG_9904:1443371148543791218> Please use `/start` first!' });

  const { data: receiver } = await supabase.from('users').select('*').eq('user_id', receiverUserId).single();
  if (!receiver) return interaction.editReply({ content: `<:IMG_9904:1443371148543791218> ${receiverUser.username} needs to use \`/start\` first!` });

  if (senderUserId === receiverUserId) return interaction.editReply({ content: '<:IMG_9904:1443371148543791218> You can\'t gift to yourself!' });

  const cardsToGift = [];
  const failedCards = [];
  const { data: allCards } = await supabase.from('cards').select('*');

  for (let i = 1; i <= 8; i++) {
    const code = interaction.options.getString(`card${i}`);
    if (!code) continue;

    const amount = interaction.options.getInteger(`amount${i}`) || 1;
    const card = allCards?.find((c: any) => c.cardcode.toLowerCase() === code.toLowerCase());

    if (!card) {
      failedCards.push(`${code} (not found)`);
      continue;
    }

    const { data: inv } = await supabase.from('inventory').select('*').eq('user_id', senderUserId).eq('card_id', card.card_id).single();
    if (!inv || inv.quantity < amount) {
      failedCards.push(`${code} (not enough qty)`);
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
      const mergedImageBuffer = await mergeCardImages(imageUrls.slice(0, 5)); // Limit to 5 for preview
      attachment = new AttachmentBuilder(mergedImageBuffer, { name: 'gift_preview.png' });
      confirmEmbed.setImage('attachment://gift_preview.png');
    }
  } catch (error) {
    console.error('Error merging images:', error);
  }

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`gift_confirm_${senderUserId}_${receiverUserId}_${cardsToGift.map(c => `${c.card.card_id}:${c.amount}`).join(',')}`)
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
