import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { getRarityEmoji } from '../utils/cards.js';
import { mergeCardImages } from '../utils/imageUtils.js';

const CARDS_PER_PAGE = 5;

export const data = new SlashCommandBuilder()
  .setName('collect')
  .setDescription('View all collectible cards')
  .addStringOption(option => option.setName('idol').setDescription('Filter by idol'))
  .addStringOption(option => option.setName('group').setDescription('Filter by group'))
  .addIntegerOption(option => option.setName('rarity').setDescription('Filter by rarity').setMinValue(1).setMaxValue(5))
  .addBooleanOption(option => option.setName('missing').setDescription('Only show missing'))
  .addUserOption(option => option.setName('user').setDescription('Check another user'));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const userId = interaction.options.getUser('user')?.id || interaction.user.id;
  const idol = interaction.options.getString('idol');
  const group = interaction.options.getString('group');
  const rarity = interaction.options.getInteger('rarity');
  const missing = interaction.options.getBoolean('missing');

  let query = supabase.from('cards').select('*').order('group').order('name');
  if (idol) query = query.ilike('name', `%${idol}%`);
  if (group) query = query.ilike('group', `%${group}%`);
  if (rarity) query = query.eq('rarity', rarity);

  const { data: cards } = await query;
  if (!cards || cards.length === 0) return interaction.editReply('No cards found!');

  const { data: inv } = await supabase.from('inventory').select('card_id').eq('user_id', userId);
  const owned = new Set(inv?.map(i => i.card_id) || []);

  let display = cards;
  if (missing) display = cards.filter(c => !owned.has(c.card_id));
  if (display.length === 0) return interaction.editReply('No cards match!');

  const page = 1;
  const totalPages = Math.ceil(display.length / CARDS_PER_PAGE);
  const start = (page - 1) * CARDS_PER_PAGE;
  const paged = display.slice(start, start + CARDS_PER_PAGE);

  const list = paged.map(c => `${owned.has(c.card_id) ? '🏘️' : '🧚'} **${c.name}** (${c.group}) ${getRarityEmoji(c.rarity)} • \`${c.cardcode}\``).join('\n');

  const embed = new EmbedBuilder()
    .setColor(0xff69b4)
    .setTitle('🌸 Collection')
    .setDescription(list)
    .setFooter({ text: `Page ${page}/${totalPages}` });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`collect_prev_${userId}_${page}`).setLabel('←').setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId('page_num').setLabel(`${page}/${totalPages}`).setStyle(ButtonStyle.Primary).setDisabled(true),
    new ButtonBuilder().setCustomId(`collect_next_${userId}_${page}`).setLabel('→').setStyle(ButtonStyle.Secondary).setDisabled(totalPages <= 1)
  );

  await interaction.editReply({ embeds: [embed], components: [row] });
}
