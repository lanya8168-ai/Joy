import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { supabase } from '../database/supabase.js';

export const data = new SlashCommandBuilder()
  .setName('editcard')
  .setDescription('Edit a card by cardcode (Admin only)')
  .addStringOption(option =>
    option.setName('cardcode')
      .setDescription('Card code/ID to edit (e.g., NWSK#101)')
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
    option.setName('new_cardcode')
      .setDescription('New card code (to rename the code itself)')
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
  .addBooleanOption(option =>
    option.setName('droppable')
      .setDescription('Can this card be dropped?')
      .setRequired(false))
  .addBooleanOption(option =>
    option.setName('is_limited')
      .setDescription('Is this a limited edition card?')
      .setRequired(false))
  .addStringOption(option =>
    option.setName('event_type')
      .setDescription('Set event type')
      .setRequired(false)
      .addChoices(
        { name: 'Event', value: 'event' },
        { name: 'Birthday', value: 'birthday' },
        { name: 'None', value: 'none' }
      ))
  .addStringOption(option =>
    option.setName('image_url')
      .setDescription('New image URL')
      .setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  // Defer the reply FIRST to allow time for database operations
  await interaction.deferReply();

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.editReply({ content: '🧚 You need Administrator permission to use this command!' });
    return;
  }

  const cardcode = interaction.options.getString('cardcode', true);
  const name = interaction.options.getString('name');
  const group = interaction.options.getString('group');
  const newCardcode = interaction.options.getString('new_cardcode');
  const era = interaction.options.getString('era');
  const rarity = interaction.options.getInteger('rarity');
  const droppable = interaction.options.getBoolean('droppable');
  const isLimited = interaction.options.getBoolean('is_limited');
  const eventType = interaction.options.getString('event_type');
  const imageUrl = interaction.options.getString('image_url');

  const { data: existingCard } = await supabase
    .from('cards')
    .select('*')
    .eq('cardcode', cardcode.toUpperCase())
    .maybeSingle();

  if (!existingCard) {
    await interaction.editReply({ content: `🧚 Card with code **${cardcode}** not found!` });
    return;
  }

  const updates: any = {};
  if (name) updates.name = name;
  if (group) updates.group = group;
  if (newCardcode) updates.cardcode = newCardcode.toUpperCase();
  if (era) updates.era = era;
  if (rarity) updates.rarity = rarity;
  if (droppable !== null) updates.droppable = droppable;
  if (isLimited !== null) updates.is_limited = isLimited;
  if (eventType) updates.event_type = eventType === 'none' ? null : eventType;
  if (imageUrl) updates.image_url = imageUrl;

  if (Object.keys(updates).length === 0) {
    await interaction.editReply({ content: '🧚 Please provide at least one field to update!' });
    return;
  }

  const { error } = await supabase
    .from('cards')
    .update(updates)
    .eq('card_id', existingCard.card_id);

  if (error) {
    console.error('Database error:', error);
    await interaction.editReply({ content: `🧚 Error updating card: ${error.message}` });
    return;
  }

  const fields = [];
  
  if (name) {
    fields.push({ name: 'Name', value: `${existingCard.name} → ${name}`, inline: false });
  }
  if (group) {
    fields.push({ name: 'Group', value: `${existingCard.group} → ${group}`, inline: false });
  }
  if (newCardcode) {
    fields.push({ name: 'Card Code', value: `${existingCard.cardcode} → ${newCardcode.toUpperCase()}`, inline: false });
  }
  if (era) {
    fields.push({ name: 'Era', value: `${existingCard.era || 'None'} → ${era}`, inline: false });
  }
  if (rarity) {
    fields.push({ name: 'Rarity', value: `${existingCard.rarity} → ${rarity}`, inline: false });
  }
  if (droppable !== null) {
    fields.push({ name: 'Droppable', value: `${existingCard.droppable ? 'Yes' : 'No'} → ${droppable ? 'Yes' : 'No'}`, inline: false });
  }
  if (imageUrl) {
    fields.push({ name: 'Image URL', value: 'Updated', inline: false });
  }

  const embed = new EmbedBuilder()
    .setColor(0x00bfff)
    .setTitle('✏️ Card Updated!')
    .setDescription(`Successfully updated card **${cardcode}**`)
    .addFields(...fields)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
