import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { supabase } from '../database/supabase.js';

export const data = new SlashCommandBuilder()
  .setName('addcard')
  .setDescription('Add or edit a K-pop card by cardcode (Admin only)')
  .addStringOption(option =>
    option.setName('cardcode')
      .setDescription('Card code/ID (e.g., BP001) - use this to add or edit')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('name')
      .setDescription('Card name (e.g., member name)')
      .setRequired(false))
  .addStringOption(option =>
    option.setName('group')
      .setDescription('K-pop group name')
      .setRequired(false))
  .addIntegerOption(option =>
    option.setName('rarity')
      .setDescription('Card rarity (1-5)')
      .setRequired(false)
      .addChoices(
        { name: 'Common (1)', value: 1 },
        { name: 'Uncommon (2)', value: 2 },
        { name: 'Rare (3)', value: 3 },
        { name: 'Epic (4)', value: 4 },
        { name: 'Legendary (5)', value: 5 }
      ))
  .addStringOption(option =>
    option.setName('era')
      .setDescription('Era or album name (optional)')
      .setRequired(false))
  .addBooleanOption(option =>
    option.setName('droppable')
      .setDescription('Can this card be dropped? (default: true)')
      .setRequired(false))
  .addBooleanOption(option =>
    option.setName('is_limited')
      .setDescription('Is this a limited edition card?')
      .setRequired(false))
  .addStringOption(option =>
    option.setName('event_type')
      .setDescription('Set event type (event, birthday)')
      .setRequired(false)
      .addChoices(
        { name: 'Event', value: 'event' },
        { name: 'Birthday', value: 'birthday' }
      ))
  .addStringOption(option =>
    option.setName('image_url')
      .setDescription('Image URL for the card')
      .setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  // Defer the reply FIRST to allow time for database operations
  await interaction.deferReply();

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.editReply({ content: '<:fairy2:1457128704282071196> You need Administrator permission to use this command!' });
    return;
  }

  const cardcode = interaction.options.getString('cardcode', true);
  const name = interaction.options.getString('name');
  const group = interaction.options.getString('group');
  const rarity = interaction.options.getInteger('rarity');
  const era = interaction.options.getString('era');
  const droppable = interaction.options.getBoolean('droppable');
  const isLimited = interaction.options.getBoolean('is_limited');
  const eventType = interaction.options.getString('event_type');
  const imageUrl = interaction.options.getString('image_url');

  // Check if card exists with this cardcode
  const { data: existingCard } = await supabase
    .from('cards')
    .select('*')
    .eq('cardcode', cardcode.toUpperCase())
    .maybeSingle();

  // EDIT MODE: card exists
  if (existingCard) {
    const updates: any = {};
    if (name) updates.name = name;
    if (group) updates.group = group;
    if (rarity) updates.rarity = rarity;
    if (era) updates.era = era;
    if (droppable !== null) updates.droppable = droppable;
    if (isLimited !== null) updates.is_limited = isLimited;
    if (eventType !== null) updates.event_type = eventType;
    if (imageUrl) updates.image_url = imageUrl;

    if (Object.keys(updates).length === 0) {
      await interaction.editReply({ content: '<:fairy2:1457128704282071196> Please provide at least one field to update!' });
      return;
    }

    const { error } = await supabase
      .from('cards')
      .update(updates)
      .eq('card_id', existingCard.card_id);

    if (error) {
      console.error('Database error:', error);
      await interaction.editReply({ content: `<:fairy2:1457128704282071196> Error updating card: ${error.message}` });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xffaa00)
      .setTitle('<:cottage:1457128646274973766> Card Updated!')
      .setDescription(`Successfully updated card **${cardcode}**`)
      .addFields({ name: 'Card ID', value: `${existingCard.card_id}`, inline: true })
      .setTimestamp();

    if (name) embed.addFields({ name: 'Name', value: `${existingCard.name} → ${name}`, inline: true });
    if (group) embed.addFields({ name: 'Group', value: `${existingCard.group} → ${group}`, inline: true });
    if (rarity) embed.addFields({ name: 'Rarity', value: `${existingCard.rarity} → ${rarity}`, inline: true });
    if (era) embed.addFields({ name: 'Era', value: `${existingCard.era || 'None'} → ${era}`, inline: true });
    if (droppable !== null) embed.addFields({ name: 'Droppable', value: droppable ? '<:cottage:1457128646274973766> Yes' : '<:fairy2:1457128704282071196> No', inline: true });
    if (imageUrl) embed.setThumbnail(imageUrl);

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // ADD MODE: card doesn't exist, create new one
  if (!name || !group || !rarity) {
    await interaction.editReply({ content: '<:fairy2:1457128704282071196> To add a new card with code **' + cardcode + '**, please provide: name, group, and rarity!' });
    return;
  }

  const { data, error } = await supabase
    .from('cards')
    .insert([{
      name: name,
      group: group,
      cardcode: cardcode,
      era: era,
      rarity: rarity,
      droppable: droppable ?? true,
      is_limited: isLimited ?? false,
      event_type: eventType,
      image_url: imageUrl
    }])
    .select();

  if (error) {
    console.error('Database error:', error);
    await interaction.editReply({ content: `<:fairy2:1457128704282071196> Error adding card to database: ${error.message}` });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle('<:cottage:1457128646274973766> Card Added!')
    .setDescription(`Successfully added **${name}** from ${group}`)
    .addFields(
      { name: 'Card ID', value: `${data[0].card_id}`, inline: true },
      { name: 'Card Code', value: cardcode, inline: true },
      { name: 'Rarity', value: `${rarity}`, inline: true },
      { name: 'Group', value: group, inline: true },
      { name: 'Droppable', value: droppable ?? true ? '<:cottage:1457128646274973766> Yes' : '<:fairy2:1457128704282071196> No', inline: true }
    )
    .setTimestamp();

  if (era) {
    embed.addFields({ name: 'Era', value: era, inline: true });
  }

  if (imageUrl) {
    embed.setThumbnail(imageUrl);
  }

  await interaction.editReply({ embeds: [embed] });
}
