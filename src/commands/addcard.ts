import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { supabase } from '../database/supabase.js';

export const data = new SlashCommandBuilder()
  .setName('addcard')
  .setDescription('Add a new K-pop card or edit existing by cardcode (Admin only)')
  .addStringOption(option =>
    option.setName('cardcode')
      .setDescription('Card code/ID (e.g., BP001) - leave empty to add new card')
      .setRequired(false))
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
  .addStringOption(option =>
    option.setName('image_url')
      .setDescription('Image URL for the card')
      .setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  // Defer the reply FIRST to allow time for database operations
  await interaction.deferReply();

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.editReply({ content: '<:IMG_9904:1443371148543791218> You need Administrator permission to use this command!' });
    return;
  }

  const cardcodeInput = interaction.options.getString('cardcode');
  const name = interaction.options.getString('name');
  const group = interaction.options.getString('group');
  const rarity = interaction.options.getInteger('rarity');
  const era = interaction.options.getString('era');
  const droppable = interaction.options.getBoolean('droppable');
  const imageUrl = interaction.options.getString('image_url');

  // EDIT MODE: cardcode provided
  if (cardcodeInput) {
    const { data: existingCard } = await supabase
      .from('cards')
      .select('*')
      .eq('cardcode', cardcodeInput.toUpperCase())
      .single();

    if (!existingCard) {
      await interaction.editReply({ content: `<:IMG_9904:1443371148543791218> Card with code **${cardcodeInput}** not found!` });
      return;
    }

    const updates: any = {};
    if (name) updates.name = name;
    if (group) updates.group = group;
    if (rarity) updates.rarity = rarity;
    if (era) updates.era = era;
    if (droppable !== null) updates.droppable = droppable;
    if (imageUrl) updates.image_url = imageUrl;

    if (Object.keys(updates).length === 0) {
      await interaction.editReply({ content: '<:IMG_9904:1443371148543791218> Please provide at least one field to update!' });
      return;
    }

    const { error } = await supabase
      .from('cards')
      .update(updates)
      .eq('card_id', existingCard.card_id);

    if (error) {
      console.error('Database error:', error);
      await interaction.editReply({ content: `<:IMG_9904:1443371148543791218> Error updating card: ${error.message}` });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xffaa00)
      .setTitle('<:IMG_9902:1443367697286172874> Card Updated!')
      .setDescription(`Successfully updated card **${cardcodeInput}**`)
      .addFields({ name: 'Card ID', value: `${existingCard.card_id}`, inline: true })
      .setTimestamp();

    if (name) embed.addFields({ name: 'Name', value: `${existingCard.name} → ${name}`, inline: true });
    if (group) embed.addFields({ name: 'Group', value: `${existingCard.group} → ${group}`, inline: true });
    if (rarity) embed.addFields({ name: 'Rarity', value: `${existingCard.rarity} → ${rarity}`, inline: true });
    if (era) embed.addFields({ name: 'Era', value: `${existingCard.era || 'None'} → ${era}`, inline: true });
    if (droppable !== null) embed.addFields({ name: 'Droppable', value: droppable ? '<:IMG_9902:1443367697286172874> Yes' : '<:IMG_9904:1443371148543791218> No', inline: true });
    if (imageUrl) embed.setThumbnail(imageUrl);

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // ADD MODE: no cardcode provided
  if (!name || !group || !rarity) {
    await interaction.editReply({ content: '<:IMG_9904:1443371148543791218> To add a new card, please provide: name, group, and rarity!' });
    return;
  }

  const newCardcode = interaction.options.getString('cardcode') || `NEW${Date.now()}`;

  const { data, error } = await supabase
    .from('cards')
    .insert([{
      name: name,
      group: group,
      cardcode: newCardcode.toUpperCase(),
      era: era,
      rarity: rarity,
      droppable: droppable ?? true,
      image_url: imageUrl
    }])
    .select();

  if (error) {
    console.error('Database error:', error);
    await interaction.editReply({ content: `<:IMG_9904:1443371148543791218> Error adding card to database: ${error.message}` });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle('<:IMG_9902:1443367697286172874> Card Added!')
    .setDescription(`Successfully added **${name}** from ${group}`)
    .addFields(
      { name: 'Card ID', value: `${data[0].card_id}`, inline: true },
      { name: 'Card Code', value: `${data[0].cardcode}`, inline: true },
      { name: 'Rarity', value: `${rarity}`, inline: true },
      { name: 'Group', value: group, inline: true },
      { name: 'Droppable', value: droppable ?? true ? '<:IMG_9902:1443367697286172874> Yes' : '<:IMG_9904:1443371148543791218> No', inline: true }
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
