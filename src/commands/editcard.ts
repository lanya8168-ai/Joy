import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { getRarityName } from '../utils/cards.js';

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
      .setDescription('New rarity (1=Common, 2=Rare, 3=Epic, 4=Legendary)')
      .setRequired(false)
      .addChoices(
        { name: 'Common (1)', value: 1 },
        { name: 'Rare (2)', value: 2 },
        { name: 'Epic (3)', value: 3 },
        { name: 'Legendary (4)', value: 4 }
      ))
  .addStringOption(option =>
    option.setName('image_url')
      .setDescription('New image URL')
      .setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '❌ You need Administrator permission to use this command!', ephemeral: true });
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
    await interaction.reply({ content: '❌ Card not found!', ephemeral: true });
    return;
  }

  const updates: any = {};
  if (name) updates.name = name;
  if (group) updates.group = group;
  if (era) updates.era = era;
  if (rarity) updates.rarity = rarity;
  if (imageUrl) updates.image_url = imageUrl;

  if (Object.keys(updates).length === 0) {
    await interaction.reply({ content: '❌ Please provide at least one field to update!', ephemeral: true });
    return;
  }

  const { error } = await supabase
    .from('cards')
    .update(updates)
    .eq('card_id', cardId);

  if (error) {
    await interaction.reply({ content: '❌ Error updating card.', ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x00bfff)
    .setTitle('✏️ Card Updated!')
    .setDescription(`Successfully updated card ID ${cardId}`)
    .addFields(
      { name: 'Previous Name', value: existingCard.name, inline: true },
      { name: 'New Name', value: name || existingCard.name, inline: true },
      { name: 'Rarity', value: rarity ? getRarityName(rarity) : getRarityName(existingCard.rarity), inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
