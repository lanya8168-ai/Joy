
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';

export const data = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('View or edit your profile')
  .addSubcommand(subcommand =>
    subcommand
      .setName('view')
      .setDescription('View a user profile')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('User to view (default: yourself)')
          .setRequired(false)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('bio')
      .setDescription('Edit your profile bio')
      .addStringOption(option =>
        option.setName('text')
          .setDescription('Your bio text (max 200 characters)')
          .setRequired(true)
          .setMaxLength(200)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('color')
      .setDescription('Edit your profile color')
      .addStringOption(option =>
        option.setName('hex')
          .setDescription('Hex color code (e.g., #ff69b4)')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('favoritecard')
      .setDescription('Set your favorite card')
      .addStringOption(option =>
        option.setName('cardcode')
          .setDescription('Card code (e.g., BP001)')
          .setRequired(true)));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'view') {
    await handleView(interaction);
  } else if (subcommand === 'bio') {
    await handleBio(interaction);
  } else if (subcommand === 'color') {
    await handleColor(interaction);
  } else if (subcommand === 'favoritecard') {
    await handleFavoriteCard(interaction);
  }
}

async function handleView(interaction: ChatInputCommandInteraction) {
  const targetUser = interaction.options.getUser('user') || interaction.user;
  const userId = targetUser.id;

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!user) {
    await interaction.editReply({ content: '🧚 This user has not started their journey yet!' });
    return;
  }

  // Get inventory count
  const { data: inventoryItems } = await supabase
    .from('inventory')
    .select('quantity')
    .eq('user_id', userId);

  const totalCards = inventoryItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  // Get favorite card info
  let favoriteCardText = 'Not set';
  if (user.favorite_card_id) {
    const { data: favoriteCard } = await supabase
      .from('cards')
      .select('*')
      .eq('card_id', user.favorite_card_id)
      .single();

    if (favoriteCard) {
      favoriteCardText = `${favoriteCard.name} (${favoriteCard.group}) • \`${favoriteCard.cardcode}\``;
    }
  }

  const color = parseInt(user.profile_color?.replace('#', '') || 'ff69b4', 16);

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${targetUser.username}'s Profile`)
    .setThumbnail(targetUser.displayAvatarURL())
    .addFields(
      { name: '🧚 Coins', value: `${user.coins}`, inline: true },
      { name: '⭐ Total Cards', value: `${totalCards}`, inline: true },
      { name: '\u200B', value: '\u200B', inline: false },
      { name: '📜 Bio', value: user.bio || '*No bio set*', inline: false },
      { name: '🧚 Favorite Card', value: favoriteCardText, inline: false }
    )
    .setFooter({ text: `Profile Color: ${user.profile_color || '#ff69b4'}` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleBio(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  const bioText = interaction.options.getString('text', true);

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!user) {
    await interaction.editReply({ content: '🧚 Please use `/start` first to create your account!' });
    return;
  }

  const { error } = await supabase
    .from('users')
    .update({ bio: bioText })
    .eq('user_id', userId);

  if (error) {
    console.error('Error updating bio:', error);
    await interaction.editReply({ content: '🧚 Failed to update bio. Please try again!' });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle('✅ Bio Updated!')
    .setDescription(`Your bio has been set to:\n\n${bioText}`)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleColor(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  const hexColor = interaction.options.getString('hex', true);

  // Validate hex color
  const hexRegex = /^#[0-9A-Fa-f]{6}$/;
  if (!hexRegex.test(hexColor)) {
    await interaction.editReply({ content: '🧚 Invalid hex color! Use format: #ff69b4' });
    return;
  }

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!user) {
    await interaction.editReply({ content: '🧚 Please use `/start` first to create your account!' });
    return;
  }

  const { error } = await supabase
    .from('users')
    .update({ profile_color: hexColor })
    .eq('user_id', userId);

  if (error) {
    console.error('Error updating profile color:', error);
    await interaction.editReply({ content: '🧚 Failed to update profile color. Please try again!' });
    return;
  }

  const color = parseInt(hexColor.replace('#', ''), 16);

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle('✅ Profile Color Updated!')
    .setDescription(`Your profile color has been set to ${hexColor}`)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleFavoriteCard(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  const cardcode = interaction.options.getString('cardcode', true).toUpperCase();

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!user) {
    await interaction.editReply({ content: '🧚 Please use `/start` first to create your account!' });
    return;
  }

  // Check if card exists
  const { data: card } = await supabase
    .from('cards')
    .select('*')
    .eq('cardcode', cardcode)
    .single();

  if (!card) {
    await interaction.editReply({ content: '🧚 Card not found! Check the cardcode and try again.' });
    return;
  }

  // Check if user owns the card
  const { data: inventoryItem } = await supabase
    .from('inventory')
    .select('*')
    .eq('user_id', userId)
    .eq('card_id', card.card_id)
    .single();

  if (!inventoryItem) {
    await interaction.editReply({ content: '🧚 You don\'t own this card! You can only set cards you own as favorites.' });
    return;
  }

  const { error } = await supabase
    .from('users')
    .update({ favorite_card_id: card.card_id })
    .eq('user_id', userId);

  if (error) {
    console.error('Error updating favorite card:', error);
    await interaction.editReply({ content: '🧚 Failed to update favorite card. Please try again!' });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle('✅ Favorite Card Set!')
    .setDescription(`Your favorite card is now:\n**${card.name}** (${card.group}) • \`${card.cardcode}\``)
    .setTimestamp();

  if (card.image_url) {
    embed.setThumbnail(card.image_url);
  }

  await interaction.editReply({ embeds: [embed] });
}
