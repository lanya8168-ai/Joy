import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { isAdminUser } from '../utils/constants.js';

export const data = new SlashCommandBuilder()
  .setName('staffpay')
  .setDescription('Staff only: Send coins to a user')
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
  if (!isAdminUser(interaction.member)) {
    return interaction.reply({ content: '🧚 This command is for Staff only!', ephemeral: true });
  }

  await interaction.deferReply();
  const receiverUser = interaction.options.getUser('user', true);
  const amount = interaction.options.getInteger('amount', true);

  const { data: receiver } = await supabase.from('users').select('*').eq('user_id', receiverUser.id).maybeSingle();
  if (!receiver) return interaction.editReply({ content: '🧚 User needs to use `/start`!' });

  await supabase.from('users').update({ coins: receiver.coins + amount }).eq('user_id', receiverUser.id);

  const embed = new EmbedBuilder()
    .setColor(0xff69b4)
    .setTitle('💸 Staff Payment Sent!')
    .setDescription(`🌲 You sent **${amount} coins** to ${receiverUser.username}!\n\n💰 Their new balance: **${receiver.coins + amount} coins**`);

  await interaction.editReply({ embeds: [embed] });
}
