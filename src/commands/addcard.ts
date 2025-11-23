import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { supabase } from '../database/supabase.js';

export const data = new SlashCommandBuilder()
  .setName('addcard')
  .setDescription('Add a new K-pop card to the database (Admin only)')
  .addStringOption(option =>
    option.setName('name')
      .setDescription('Card name (e.g., member name)')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('group')
      .setDescription('K-pop group name')
      .setRequired(true))
  .addIntegerOption(option =>
    option.setName('rarity')
      .setDescription('Card rarity (1-5)')
      .setRequired(true)
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
  .addStringOption(option =>
    option.setName('image_url')
      .setDescription('Image URL for the card')
      .setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  // Defer the reply FIRST to allow time for database operations
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.editReply({ content: '❌ You need Administrator permission to use this command!' });
    return;
  }

  const name = interaction.options.getString('name', true);
  const group = interaction.options.getString('group', true);
  const era = interaction.options.getString('era');
  const rarity = interaction.options.getInteger('rarity', true);
  const imageUrl = interaction.options.getString('image_url');

  const { data, error } = await supabase
    .from('cards')
    .insert([{
      name: name,
      group: group,
      era: era,
      rarity: rarity,
      image_url: imageUrl
    }])
    .select();

  if (error) {
    console.error('Database error:', error);
    await interaction.editReply({ content: `❌ Error adding card to database: ${error.message}` });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle('✅ Card Added!')
    .setDescription(`Successfully added **${name}** from ${group}`)
    .addFields(
      { name: 'Card ID', value: `${data[0].card_id}`, inline: true },
      { name: 'Rarity', value: `${rarity}`, inline: true },
      { name: 'Group', value: group, inline: true }
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
