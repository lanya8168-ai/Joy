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

  if (senderUserId === receiverUserId) {
    await interaction.editReply({ content: '🧚 You can\'t pay yourself!' });
    return;
  }

  const { data: sender } = await supabase.from('users').select('*').eq('user_id', senderUserId).single();
  const { data: receiver } = await supabase.from('users').select('*').eq('user_id', receiverUserId).single();

  if (!sender) {
    await interaction.editReply({ content: '🧚 Use `/start` first!' });
    return;
  }

  if (!receiver) {
    await interaction.editReply({ content: `🧚 ${receiverUser.username} needs to use \`/start\` first!` });
    return;
  }

  if (sender.coins < amount) {
    await interaction.editReply({ content: `🧚 You only have **${sender.coins}** coins!` });
    return;
  }

  await supabase.from('users').update({ coins: sender.coins - amount }).eq('user_id', senderUserId);
  await supabase.from('users').update({ coins: (receiver.coins || 0) + amount }).eq('user_id', receiverUserId);

  const embed = new EmbedBuilder()
    .setColor(0xff69b4)
    .setTitle('💸 Coins Sent!')
    .setDescription(`🌲 You sent **${amount} coins** to ${receiverUser.username}!\n\n💰 Your new balance: **${sender.coins - amount} coins**`);

  await interaction.editReply({ embeds: [embed] });
}
