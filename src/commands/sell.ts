import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { getRarityEmoji } from '../utils/cards.js';

const RARITY_PRICES: { [key: number]: number } = {
  5: 10000,
  4: 7500,
  3: 5000,
  2: 2500,
  1: 1000
};

export const data = new SlashCommandBuilder()
  .setName('sell')
  .setDescription('Sell cards from your inventory')
  .addStringOption(option =>
    option.setName('cards')
      .setDescription('Card codes separated by commas (e.g., BP001, LSCW#501)')
      .setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const userId = interaction.user.id;
  const cardsInput = interaction.options.getString('cards', true);

  const { data: user } = await supabase.from('users').select('*').eq('user_id', userId).single();
  if (!user) return interaction.editReply({ content: '🧚 Use `/start` first!' });

  const cardcodes = cardsInput.split(',').map(c => c.trim().toUpperCase());
  const soldCards = [];
  const failedCards = [];
  let totalCoins = 0;

  for (const code of cardcodes) {
    const { data: card } = await supabase.from('cards').select('*').eq('cardcode', code).maybeSingle();
    if (!card) {
      failedCards.push(`${code} (not found)`);
      continue;
    }

    const { data: inv } = await supabase.from('inventory').select('*').eq('user_id', userId).eq('card_id', card.card_id).maybeSingle();
    if (!inv || inv.quantity < 1) {
      failedCards.push(`${code} (don't own)`);
      continue;
    }

    if (inv.quantity > 1) {
      await supabase.from('inventory').update({ quantity: inv.quantity - 1 }).eq('id', inv.id);
    } else {
      await supabase.from('inventory').delete().eq('id', inv.id);
    }

    const price = RARITY_PRICES[card.rarity] || 0;
    totalCoins += price;
    soldCards.push(`**${card.name}** ${getRarityEmoji(card.rarity)} (\`${card.cardcode}\`) • ${price} coins`);
  }

  if (totalCoins > 0) {
    await supabase.from('users').update({ coins: user.coins + totalCoins }).eq('user_id', userId);
  }

  let description = soldCards.length > 0 ? `🏘️ Sold:\n${soldCards.join('\n')}\n\n💰 **Total: +${totalCoins} coins**` : '';
  if (failedCards.length > 0) description += `\n\n🧚 Failed:\n${failedCards.join('\n')}`;

  if (!description) return interaction.editReply({ content: '🧚 No cards were sold!' });

  const embed = new EmbedBuilder()
    .setColor(0xff69b4)
    .setTitle('🌲 Cards Sold!')
    .setDescription(description)
    .addFields({ name: 'New Balance', value: `${user.coins + totalCoins} coins` });

  await interaction.editReply({ embeds: [embed] });
}
