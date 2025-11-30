import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { supabase } from '../database/supabase.js';

export const data = new SlashCommandBuilder()
  .setName('staffpay')
  .setDescription('Staff only: Send coins to a user')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption(option =>
    option.setName('user')
      .setDescription('User to pay')
      .setRequired(true))
  .addIntegerOption(option =>
    option.setName('amount')
      .setDescription('Number of coins to send')
      .setRequired(true)
      .setMinValue(1));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.editReply({ content: '<:IMG_9904:1443371148543791218> This command is staff only!' });
    return;
  }

  const receiverUser = interaction.options.getUser('user', true);
  const receiverUserId = receiverUser.id;
  const amount = interaction.options.getInteger('amount', true);

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

  // Update receiver coins
  await supabase
    .from('users')
    .update({ coins: receiver.coins + amount })
    .eq('user_id', receiverUserId);

  const embed = new EmbedBuilder()
    .setColor(0x00d4ff)
    .setTitle('💸 Staff Payment Sent!')
    .setDescription(`🏖️ You sent **${amount} coins** to ${receiverUser.username}!\n\n💰 Their new balance: **${receiver.coins + amount} coins**`)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
