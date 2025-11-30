import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { getRarityEmoji } from '../utils/cards.js';

function getRarityColor(rarity: number): number {
  const colors: { [key: number]: number } = {
    1: 0xcccccc,
    2: 0x66ff66,
    3: 0x0066ff,
    4: 0xff00ff,
    5: 0xffff00
  };
  return colors[rarity] || 0xffffff;
}

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
  const userId = interaction.user.id;

  const { data: card, error } = await supabase
    .from('cards')
    .select('*')
    .eq('cardcode', cardcode)
    .single();

  if (error || !card) {
    await interaction.editReply({ content: `<:IMG_9904:1443371148543791218> Card with code **${cardcode}** not found!` });
    return;
  }

  // Check if user owns this card
  const { data: inventoryItem } = await supabase
    .from('inventory')
    .select('*')
    .eq('user_id', userId)
    .eq('card_id', card.card_id)
    .single();

  const rarityEmoji = getRarityEmoji(card.rarity);
  let description = `**${card.name}** (${card.group}) ${rarityEmoji}\n${card.era || 'N/A'} • \`${card.cardcode}\``;
  
  if (inventoryItem && inventoryItem.quantity > 0) {
    description += ` • 📦 **${inventoryItem.quantity}**`;
  }

  const embed = new EmbedBuilder()
    .setColor(getRarityColor(card.rarity))
    .setTitle('🏖️ Card Info')
    .setDescription(description)
    .setFooter({ text: `Rarity: ${card.rarity}/5 • Droppable: ${card.droppable ? 'Yes' : 'No'}` })
    .setTimestamp();

  if (card.image_url) {
    embed.setImage(card.image_url);
  }

  await interaction.editReply({ embeds: [embed] });
}
