import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { getRarityEmoji } from '../utils/cards.js';

export const data = new SlashCommandBuilder()
  .setName('inventory')
  .setDescription('View your K-pop card collection');

export async function execute(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!user) {
    await interaction.reply({ content: '❌ Please use `/start` first to create your account!', ephemeral: true });
    return;
  }

  const { data: inventory } = await supabase
    .from('inventory')
    .select(`
      quantity,
      cards (
        card_id,
        name,
        group,
        era,
        rarity
      )
    `)
    .eq('user_id', userId);

  if (!inventory || inventory.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0x808080)
      .setTitle('📦 Your Inventory')
      .setDescription('Your collection is empty! Use `/drop` to get cards.')
      .addFields({ name: 'Coins', value: `${user.coins}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    return;
  }

  const cardList = inventory
    .map((item: any) => {
      const card = item.cards;
      const eraText = card.era ? ` - ${card.era}` : '';
      return `${getRarityEmoji(card.rarity)} **${card.name}** (${card.group}${eraText}) x${item.quantity}`;
    })
    .join('\n');

  const totalCards = inventory.reduce((sum: number, item: any) => sum + item.quantity, 0);

  const embed = new EmbedBuilder()
    .setColor(0xff69b4)
    .setTitle('📦 Your K-pop Card Collection')
    .setDescription(cardList.length > 4096 ? cardList.substring(0, 4090) + '...' : cardList)
    .addFields(
      { name: 'Total Cards', value: `${totalCards}`, inline: true },
      { name: 'Unique Cards', value: `${inventory.length}`, inline: true },
      { name: 'Coins', value: `${user.coins}`, inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
