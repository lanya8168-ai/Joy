import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';

export const data = new SlashCommandBuilder()
  .setName('pay')
  .setDescription('Send coins to another user')
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

  const senderUserId = interaction.user.id;
  const receiverUser = interaction.options.getUser('user', true);
  const receiverUserId = receiverUser.id;
  const amount = interaction.options.getInteger('amount', true);

  // Check sender exists
  const { data: sender } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', senderUserId)
    .single();

  if (!sender) {
    await interaction.editReply({ content: '🧚 Please use `/start` first to create your account!' });
    return;
  }

  // Check receiver exists
  const { data: receiver } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', receiverUserId)
    .single();

  if (!receiver) {
    await interaction.editReply({ content: `🧚 ${receiverUser.username} needs to use \`/start\` first!` });
    return;
  }

  // Prevent self-payment
  if (senderUserId === receiverUserId) {
    await interaction.editReply({ content: '🧚 You can\'t pay yourself!' });
    return;
  }

  // Check sender has enough coins
  if (sender.coins < amount) {
    await interaction.editReply({ content: `🧚 You only have **${sender.coins}** coins, but tried to pay **${amount}**!` });
    return;
  }

  // Update sender coins
  await supabase
    .from('users')
    .update({ coins: sender.coins - amount })
    .eq('user_id', senderUserId);

  // Update receiver coins
  await supabase
    .from('users')
    .update({ coins: receiver.coins + amount })
    .eq('user_id', receiverUserId);

  const embed = new EmbedBuilder()
    .setColor(0x00d4ff)
    .setTitle('💸 Coins Sent!')
    .setDescription(`🌲 You sent **${amount} coins** to ${receiverUser.username}!\n\n💰 Your new balance: **${sender.coins - amount} coins**`)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
