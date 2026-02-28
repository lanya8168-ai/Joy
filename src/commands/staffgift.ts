import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { mergeCardImages } from '../utils/imageUtils.js';
import { getRarityEmoji } from '../utils/cards.js';
import { isAdminUser } from '../utils/constants.js';

export const data = new SlashCommandBuilder()
  .setName('staffgift')
  .setDescription('Staff only: Gift cards to a user')
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
      .setMinValue(1));

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!isAdminUser(interaction.member)) {
    return interaction.reply({ content: '🧚 This command is for Staff only!', ephemeral: true });
  }

  await interaction.deferReply();
  const senderUserId = interaction.user.id;
  const receiverUser = interaction.options.getUser('user', true);
  const receiverUserId = receiverUser.id;

  const { data: receiver } = await supabase.from('users').select('*').eq('user_id', receiverUserId).maybeSingle();
  if (!receiver) return interaction.editReply({ content: '🧚 User needs to use `/start`!' });

  const code1 = interaction.options.getString('card1', true).toUpperCase();
  const amount1 = interaction.options.getInteger('amount1') || 1;

  const { data: card } = await supabase.from('cards').select('*').eq('cardcode', code1).maybeSingle();
  if (!card) return interaction.editReply({ content: '🧚 Card not found!' });

  const confirmEmbed = new EmbedBuilder()
    .setColor(0xff69b4)
    .setTitle('🌲 Confirm Staff Gift')
    .setDescription(`Send ${amount1}x **${card.name}** (${card.group}) to ${receiverUser.username}?`);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`staffgift_confirm_${senderUserId}_${receiverUserId}_${card.card_id}:${amount1}`).setLabel('Yes').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`staffgift_cancel_${senderUserId}`).setLabel('No').setStyle(ButtonStyle.Danger)
  );

  await interaction.editReply({ embeds: [confirmEmbed], components: [row] });
}
