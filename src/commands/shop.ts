import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';

const PACKS = [
  { id: '1', name: 'Starter Pack', cost: 100, cards: 1 },
  { id: '2', name: 'Double Pack', cost: 200, cards: 2 },
  { id: '3', name: 'Premium Pack', cost: 500, cards: 5 },
  { id: '4', name: 'Ultimate Pack', cost: 1000, cards: 10 }
];

export const data = new SlashCommandBuilder()
  .setName('shop')
  .setDescription('Buy card packs')
  .addSubcommand(subcommand =>
    subcommand
      .setName('browse')
      .setDescription('View available packs'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('buy')
      .setDescription('Buy a card pack')
      .addStringOption(option =>
        option.setName('pack')
          .setDescription('Pack type to buy')
          .setRequired(true)
          .addChoices(
            { name: 'Starter Pack - 100 coins (1 card)', value: '1' },
            { name: 'Double Pack - 200 coins (2 cards)', value: '2' },
            { name: 'Premium Pack - 500 coins (5 cards)', value: '3' },
            { name: 'Ultimate Pack - 1000 coins (10 cards)', value: '4' }
          )));

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'browse') {
    await handleBrowse(interaction);
  } else if (subcommand === 'buy') {
    await handleBuy(interaction);
  }
}

async function handleBrowse(interaction: ChatInputCommandInteraction) {
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

  const packList = PACKS
    .map(pack => `**${pack.name}** - ${pack.cost} coins → ${pack.cards} card(s)`)
    .join('\n');

  const embed = new EmbedBuilder()
    .setColor(0xffd700)
    .setTitle('🛒 Card Pack Shop')
    .setDescription('Buy packs with your coins!')
    .addFields(
      {
        name: '📦 Available Packs',
        value: packList,
        inline: false
      },
      {
        name: '💰 Your Balance',
        value: `${user.coins} coins`,
        inline: false
      },
      {
        name: '📝 How to Buy',
        value: 'Use `/shop buy` and select the pack you want!',
        inline: false
      }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleBuy(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  const packId = interaction.options.getString('pack', true);

  const pack = PACKS.find(p => p.id === packId);
  if (!pack) {
    await interaction.reply({ content: '❌ Invalid pack!', ephemeral: true });
    return;
  }

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!user) {
    await interaction.reply({ content: '❌ Please use `/start` first to create your account!', ephemeral: true });
    return;
  }

  if (user.coins < pack.cost) {
    await interaction.reply({ 
      content: `❌ You need ${pack.cost} coins but only have ${user.coins}!\nUse \`/daily\`, \`/weekly\`, or \`/surf\` to earn more coins.`, 
      ephemeral: true 
    });
    return;
  }

  const { data: allCards } = await supabase
    .from('cards')
    .select('*');

  if (!allCards || allCards.length === 0) {
    await interaction.reply({ 
      content: '❌ No cards available yet! Ask an admin to add cards.', 
      ephemeral: true 
    });
    return;
  }

  // Deduct coins
  const newBalance = user.coins - pack.cost;
  await supabase
    .from('users')
    .update({ coins: newBalance })
    .eq('user_id', userId);

  // Give cards
  const cardsList = [];
  for (let i = 0; i < pack.cards; i++) {
    const randomCard = allCards[Math.floor(Math.random() * allCards.length)];
    cardsList.push(randomCard);

    const { data: existingItem } = await supabase
      .from('inventory')
      .select('*')
      .eq('user_id', userId)
      .eq('card_id', randomCard.card_id)
      .single();

    if (existingItem) {
      await supabase
        .from('inventory')
        .update({ quantity: existingItem.quantity + 1 })
        .eq('id', existingItem.id);
    } else {
      await supabase
        .from('inventory')
        .insert({
          user_id: userId,
          card_id: randomCard.card_id,
          quantity: 1
        });
    }
  }

  const cardsInfo = cardsList
    .map((card: any) => `• **${card.name}** (${card.group}) - Rarity: ${card.rarity}`)
    .join('\n');

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle(`✅ ${pack.name} Purchased!`)
    .setDescription(`You bought the ${pack.name} for ${pack.cost} coins!`)
    .addFields(
      {
        name: '🎴 Cards Received',
        value: cardsInfo || 'No cards',
        inline: false
      },
      {
        name: '💰 New Balance',
        value: `${newBalance} coins`,
        inline: true
      }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
