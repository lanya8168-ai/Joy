import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { supabase } from '../database/supabase.js';

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
    await interaction.editReply({ content: '❌ This command is staff only!' });
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

    giftedCards.push(`**${card.name}** (\`${card.cardcode}\`)`);
  }

  let description = '';
  if (giftedCards.length > 0) {
    description = `✅ Staff gifted to ${receiverUser.username}:\n${giftedCards.join('\n')}`;
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
    .setColor(0xff00ff)
    .setTitle('🎁 Staff Gift Sent!')
    .setDescription(description)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
