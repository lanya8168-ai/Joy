import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { supabase } from '../database/supabase.js';

export const data = new SlashCommandBuilder()
  .setName('deletecard')
  .setDescription('Delete a card from the database (Admin only)')
  .addIntegerOption(option =>
    option.setName('card_id')
      .setDescription('The ID of the card to delete')
      .setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '🧚 You need Administrator permission to use this command!', ephemeral: true });
    return;
  }

  const cardId = interaction.options.getInteger('card_id', true);

  const { data: card } = await supabase
    .from('cards')
    .select('*')
    .eq('card_id', cardId)
    .single();

  if (!card) {
    await interaction.reply({ content: '🧚 Card not found!', ephemeral: true });
    return;
  }

  const { error } = await supabase
    .from('cards')
    .delete()
    .eq('card_id', cardId);

  if (error) {
    await interaction.reply({ content: '🧚 Error deleting card.', ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle('🗑️ Card Deleted')
    .setDescription(`Successfully deleted **${card.name}** from ${card.group}`)
    .addFields(
      { name: 'Card ID', value: `${cardId}`, inline: true },
      { name: 'Rarity', value: `${card.rarity}`, inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
