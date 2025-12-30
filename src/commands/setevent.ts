import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { supabase } from '../database/supabase.js';

export const data = new SlashCommandBuilder()
  .setName('setevent')
  .setDescription('Mark a card as event or birthday (Admin only)')
  .addStringOption(option =>
    option.setName('cardcode')
      .setDescription('Card code')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('type')
      .setDescription('Type of event')
      .setRequired(true)
      .addChoices(
        { name: 'Event', value: 'event' },
        { name: 'Birthday', value: 'birthday' },
        { name: 'None', value: 'none' }
      ))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const cardcode = interaction.options.getString('cardcode', true);
  const type = interaction.options.getString('type', true);

  const { error } = await supabase
    .from('cards')
    .update({ event_type: type === 'none' ? null : type })
    .eq('cardcode', cardcode);

  if (error) {
    return interaction.editReply(`Error setting event type: ${error.message}`);
  }

  await interaction.editReply(`Successfully set **${cardcode}** as **${type}**!`);
}
