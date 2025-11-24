import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';

export const data = new SlashCommandBuilder()
  .setName('gift')
  .setDescription('Gift cards to another user')
  .addUserOption(option =>
    option.setName('user')
      .setDescription('User to gift to')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('cardcode')
      .setDescription('Card code to gift (e.g., BP001)')
      .setRequired(true))
  .addIntegerOption(option =>
    option.setName('quantity')
      .setDescription('Number of copies to gift')
      .setRequired(true)
      .setMinValue(1));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const senderUserId = interaction.user.id;
  const receiverUser = interaction.options.getUser('user', true);
  const receiverUserId = receiverUser.id;
  const cardcode = interaction.options.getString('cardcode', true).toUpperCase();
  const quantity = interaction.options.getInteger('quantity', true);

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

  // Find the card
  const { data: card } = await supabase
    .from('cards')
    .select('*')
    .eq('cardcode', cardcode)
    .single();

  if (!card) {
    await interaction.editReply({ content: `❌ Card with code **${cardcode}** not found!` });
    return;
  }

  // Check sender has the card and quantity
  const { data: senderInventory } = await supabase
    .from('inventory')
    .select('*')
    .eq('user_id', senderUserId)
    .eq('card_id', card.card_id)
    .single();

  if (!senderInventory || senderInventory.quantity < quantity) {
    const available = senderInventory?.quantity || 0;
    await interaction.editReply({ content: `❌ You only have **${available}** copy/copies of this card, but tried to gift **${quantity}**!` });
    return;
  }

  // Update sender inventory
  const newSenderQuantity = senderInventory.quantity - quantity;
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
      .update({ quantity: receiverInventory.quantity + quantity })
      .eq('id', receiverInventory.id);
  } else {
    await supabase
      .from('inventory')
      .insert({
        user_id: receiverUserId,
        card_id: card.card_id,
        quantity: quantity
      });
  }

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle('🎁 Gift Sent!')
    .setDescription(`You gifted **${quantity}** copy/copies of **${card.name}** (\`${card.cardcode}\`) to ${receiverUser.username}!`)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
