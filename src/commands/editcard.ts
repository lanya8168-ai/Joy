import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { supabase } from '../database/supabase.js';

export const data = new SlashCommandBuilder()
  .setName('editcard')
  .setDescription('Edit a card in the database (Admin only)')
  .addIntegerOption(option =>
    option.setName('card_id')
      .setDescription('The ID of the card to edit')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('name')
      .setDescription('New card name')
      .setRequired(false))
  .addStringOption(option =>
    option.setName('group')
      .setDescription('New group name')
      .setRequired(false))
  .addStringOption(option =>
    option.setName('era')
      .setDescription('New era or album name')
      .setRequired(false))
  .addIntegerOption(option =>
    option.setName('rarity')
      .setDescription('New rarity (1-5)')
      .setRequired(false)
      .addChoices(
        { name: 'Common (1)', value: 1 },
        { name: 'Uncommon (2)', value: 2 },
        { name: 'Rare (3)', value: 3 },
        { name: 'Epic (4)', value: 4 },
        { name: 'Legendary (5)', value: 5 }
      ))
  .addStringOption(option =>
    option.setName('image_url')
      .setDescription('New image URL')
      .setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  // Defer the reply FIRST to allow time for database operations
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.editReply({ content: '❌ You need Administrator permission to use this command!' });
    return;
  }

  const cardId = interaction.options.getInteger('card_id', true);
  const name = interaction.options.getString('name');
  const group = interaction.options.getString('group');
  const era = interaction.options.getString('era');
  const rarity = interaction.options.getInteger('rarity');
  const imageUrl = interaction.options.getString('image_url');

  const { data: existingCard } = await supabase
    .from('cards')
    .select('*')
    .eq('card_id', cardId)
    .single();

  if (!existingCard) {
    await interaction.editReply({ content: '❌ Card not found!' });
    return;
  }

  const updates: any = {};
  if (name) updates.name = name;
  if (group) updates.group = group;
  if (era) updates.era = era;
  if (rarity) updates.rarity = rarity;
  if (imageUrl) updates.image_url = imageUrl;

  if (Object.keys(updates).length === 0) {
    await interaction.editReply({ content: '❌ Please provide at least one field to update!' });
    return;
  }

  const { error } = await supabase
    .from('cards')
    .update(updates)
    .eq('card_id', cardId);

  if (error) {
    await interaction.editReply({ content: '❌ Error updating card.' });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x00bfff)
    .setTitle('✏️ Card Updated!')
    .setDescription(`Successfully updated card ID ${cardId}`)
    .addFields(
      { name: 'Previous Name', value: existingCard.name, inline: true },
      { name: 'New Name', value: name || existingCard.name, inline: true },
      { name: 'Rarity', value: `${rarity || existingCard.rarity}`, inline: true }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
