import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { getRarityEmoji } from '../utils/cards.js';

export const data = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('View or edit your profile')
  .addSubcommand(s => s.setName('view').setDescription('View profile').addUserOption(o => o.setName('user').setDescription('User')))
  .addSubcommand(s => s.setName('bio').setDescription('Edit bio').addStringOption(o => o.setName('text').setDescription('Bio').setRequired(true).setMaxLength(200)))
  .addSubcommand(s => s.setName('color').setDescription('Edit color').addStringOption(o => o.setName('hex').setDescription('#hex').setRequired(true)))
  .addSubcommand(s => s.setName('favorite').setDescription('Set your favorite card').addStringOption(o => o.setName('cardcode').setDescription('Card code (e.g. BP001)').setRequired(true)));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const sub = interaction.options.getSubcommand();
  const userId = interaction.user.id;

  if (sub === 'view') {
    const target = interaction.options.getUser('user') || interaction.user;
    const { data: user } = await supabase.from('users').select('*').eq('user_id', target.id).maybeSingle();
    if (!user) return interaction.editReply('User not found! Use `/start` to begin.');
    
    const embed = new EmbedBuilder()
      .setColor(parseInt((user as any).profile_color?.replace('#', '') || 'ff69b4', 16))
      .setTitle(`${target.username}'s Profile`)
      .setDescription((user as any).bio || 'No bio set')
      .addFields(
        { name: '🧚 Coins', value: `${(user as any).coins}`, inline: true },
        { name: '📅 Joined', value: `<t:${Math.floor(new Date((user as any).created_at).getTime() / 1000)}:F>`, inline: true }
      );

    if ((user as any).favorite_card) {
      const { data: card } = await supabase.from('cards').select('*').eq('card_id', (user as any).favorite_card).maybeSingle();
      if (card) {
        embed.addFields({ name: '✨ Favorite Card', value: `${getRarityEmoji(card.rarity)} **${card.name}** (${card.group})` });
        if (card.image_url) embed.setThumbnail(card.image_url);
      }
    }

    return interaction.editReply({ embeds: [embed] });
  }

  if (sub === 'bio') {
    const text = interaction.options.getString('text', true);
    await supabase.from('users').update({ bio: text }).eq('user_id', userId);
    return interaction.editReply('Bio updated!');
  }

  if (sub === 'color') {
    const hex = interaction.options.getString('hex', true);
    if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return interaction.editReply('Invalid hex! Example: #ff69b4');
    await supabase.from('users').update({ profile_color: hex }).eq('user_id', userId);
    return interaction.editReply('Color updated!');
  }

  if (sub === 'favorite') {
    const code = interaction.options.getString('cardcode', true).toUpperCase();
    const { data: card } = await supabase.from('cards').select('*').eq('cardcode', code).maybeSingle();
    if (!card) return interaction.editReply('Card not found!');

    const { data: inv } = await supabase.from('inventory').select('*').eq('user_id', userId).eq('card_id', card.card_id).maybeSingle();
    if (!inv) return interaction.editReply('You don\'t own this card!');

    const { error } = await supabase.from('users').update({ favorite_card: card.card_id }).eq('user_id', userId);
    if (error) return interaction.editReply('Failed to update favorite card. Ensure the database column exists.');
    
    return interaction.editReply(`Favorite card set to **${card.name}**!`);
  }
}
