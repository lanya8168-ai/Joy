import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ButtonInteraction, CacheType } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { getRarityEmoji } from '../utils/cards.js';
import { mergeCardImages } from '../utils/imageUtils.js';

const CARDS_PER_PAGE = 3;

export const data = new SlashCommandBuilder()
  .setName('collect')
  .setDescription('View all collectible cards')
  .addStringOption(option => option.setName('idol').setDescription('Filter by idol'))
  .addStringOption(option => option.setName('group').setDescription('Filter by group'))
  .addIntegerOption(option => option.setName('rarity').setDescription('Filter by rarity').setMinValue(1).setMaxValue(5))
  .addBooleanOption(option => option.setName('missing').setDescription('Only show missing'))
  .addIntegerOption(option => option.setName('page').setDescription('Page number').setMinValue(1))
  .addUserOption(option => option.setName('user').setDescription('Check another user'));

export async function execute(interaction: ChatInputCommandInteraction | ButtonInteraction) {
  const isButton = interaction.isButton();
  if (!isButton) {
    await (interaction as ChatInputCommandInteraction).deferReply();
  }
  
  const options = (interaction as ChatInputCommandInteraction).options;
  const targetUser = options?.getUser('user');
  const userId = targetUser?.id || interaction.user.id;
  const idol = options?.getString('idol');
  const group = options?.getString('group');
  const rarity = options?.getInteger('rarity');
  const missing = options?.getBoolean('missing');
  const page = options?.getInteger('page') || 1;

  let query = supabase.from('cards').select('*').order('group').order('name');
  if (idol) query = query.ilike('name', `%${idol}%`);
  if (group) query = query.ilike('group', `%${group}%`);
  if (rarity) query = query.eq('rarity', rarity);

  const { data: cards } = await query;
  if (!cards || cards.length === 0) {
    const msg = { content: 'No cards found!', components: [] };
    return interaction.editReply(msg);
  }

  const { data: inv } = await supabase.from('inventory').select('card_id').eq('user_id', userId);
  const owned = new Set(inv?.map(i => i.card_id) || []);

  let display = cards;
  if (missing) display = cards.filter(c => !owned.has(c.card_id));
  if (display.length === 0) {
    const msg = { content: 'No cards match!', components: [] };
    return interaction.editReply(msg);
  }

  const totalPages = Math.ceil(display.length / CARDS_PER_PAGE);
  const validPage = Math.max(1, Math.min(page, totalPages));
  const start = (validPage - 1) * CARDS_PER_PAGE;
  const paged = display.slice(start, start + CARDS_PER_PAGE);

  const list = paged.map(c => `${owned.has(c.card_id) ? '🏘️' : '🧚'} **${c.name}** (${c.group}) ${getRarityEmoji(c.rarity)} • \`${c.cardcode}\``).join('\n');

  let attachment = null;
  try {
    const images = paged.map(c => c.image_url).filter(Boolean);
    if (images.length > 0) {
      const buffer = await mergeCardImages(images);
      attachment = new AttachmentBuilder(buffer, { name: 'collect.png' });
    }
  } catch (e) { console.error(e); }

  const embed = new EmbedBuilder()
    .setColor(0xff69b4)
    .setTitle('🌸 Collection')
    .setDescription(list)
    .setFooter({ text: `Page ${validPage}/${totalPages}` });

  if (attachment) embed.setImage('attachment://collect.png');

  const filterString = `${idol || 'all'}_${group || 'all'}_${rarity || 'all'}_${missing ? '1' : '0'}`;
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`collect_prev_${userId}_${validPage}_${filterString}`)
      .setLabel('←')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(validPage === 1),
    new ButtonBuilder()
      .setCustomId('collect_page')
      .setLabel(`${validPage}/${totalPages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`collect_next_${userId}_${validPage}_${filterString}`)
      .setLabel('→')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(validPage === totalPages)
  );

  const response = { embeds: [embed], components: [row], files: attachment ? [attachment] : [] };
  await interaction.editReply(response);
}
