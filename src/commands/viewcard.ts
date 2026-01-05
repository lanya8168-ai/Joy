import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { getRarityEmoji } from '../utils/cards.js';

export const data = new SlashCommandBuilder()
  .setName('viewcard')
  .setDescription('View card information by card code')
  .addStringOption(option =>
    option.setName('cardcode')
      .setDescription('Card code (e.g., BP001)')
      .setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const cardcode = interaction.options.getString('cardcode', true).toUpperCase();
  const { data: card } = await supabase.from('cards').select('*').eq('cardcode', cardcode).maybeSingle();

  if (!card) return interaction.editReply({ content: '🧚 Card not found!' });

  const { data: inv } = await supabase.from('inventory').select('*').eq('user_id', interaction.user.id).eq('card_id', card.card_id).maybeSingle();

  const embed = new EmbedBuilder()
    .setColor(0xff69b4)
    .setTitle('🌲 Card Info')
    .setDescription(`**${card.name}** (${card.group}) ${getRarityEmoji(card.rarity)}\n${card.era || 'N/A'} • \`${card.cardcode}\` ${inv ? `• copies: **${inv.quantity}**` : ''}`)
    .setFooter({ text: `Rarity: ${card.rarity}/5 • Droppable: ${card.droppable ? 'Yes' : 'No'}` });

  if (card.image_url) embed.setImage(card.image_url);
  await interaction.editReply({ embeds: [embed] });
}
