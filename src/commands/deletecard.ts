import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { isAdminUser } from '../utils/constants.js';

export const data = new SlashCommandBuilder()
  .setName('deletecard')
  .setDescription('Delete a card from the database (Staff only)')
  .addIntegerOption(option =>
    option.setName('card_id')
      .setDescription('The ID of the card to delete')
      .setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!isAdminUser(interaction.member)) {
    return interaction.reply({ content: '🧚 This command is for Staff only!', ephemeral: true });
  }

  await interaction.deferReply();
  const cardId = interaction.options.getInteger('card_id', true);

  const { data: card } = await supabase
    .from('cards')
    .select('*')
    .eq('card_id', cardId)
    .maybeSingle();

  if (!card) {
    await interaction.editReply({ content: '🧚 Card not found!' });
    return;
  }

  const { error } = await supabase
    .from('cards')
    .delete()
    .eq('card_id', cardId);

  if (error) {
    console.error('Delete error:', error);
    await interaction.editReply({ content: '🧚 Error deleting card. It might be referenced in inventories or marketplace listings.' });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0xff69b4)
    .setTitle('🗑️ Card Deleted')
    .setDescription(`Deleted **${card.name}** from ${card.group}`)
    .addFields(
      { name: 'Card ID', value: `${cardId}` },
      { name: 'Rarity', value: `${card.rarity}` }
    );

  await interaction.editReply({ embeds: [embed] });
}
