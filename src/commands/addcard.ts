import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { getRarityName } from '../utils/cards.js';

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
      .setDescription('Card rarity (1=Common, 2=Rare, 3=Epic, 4=Legendary)')
      .setRequired(true)
      .addChoices(
        { name: 'Common (1)', value: 1 },
        { name: 'Rare (2)', value: 2 },
        { name: 'Epic (3)', value: 3 },
        { name: 'Legendary (4)', value: 4 }
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
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '❌ You need Administrator permission to use this command!', ephemeral: true });
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
    await interaction.reply({ content: '❌ Error adding card to database.', ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle('✅ Card Added!')
    .setDescription(`Successfully added **${name}** from ${group}`)
    .addFields(
      { name: 'Card ID', value: `${data[0].card_id}`, inline: true },
      { name: 'Rarity', value: getRarityName(rarity), inline: true },
      { name: 'Group', value: group, inline: true }
    )
    .setTimestamp();

  if (era) {
    embed.addFields({ name: 'Era', value: era, inline: true });
  }

  if (imageUrl) {
    embed.setThumbnail(imageUrl);
  }

  await interaction.reply({ embeds: [embed] });
}
