import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { mergeCardImages } from '../utils/imageUtils.js';

const PACKS = [
  { id: '1', name: 'Sandy Shells', cost: 500, cards: 1 },
  { id: '2', name: 'Tide Pool', cost: 1000, cards: 2 },
  { id: '3', name: 'Coral Reef', cost: 3000, cards: 5 },
  { id: '4', name: 'Deep Dive', cost: 5000, cards: 10 },
  { id: '5', name: 'Legendary Treasure', cost: 35000, cards: 3, rarity: 5 },
  { id: '6', name: 'Beach Vibes (5 cards)', cost: 8000, cards: 5, groupPack: true },
  { id: '7', name: 'Tropical Paradise (10 cards)', cost: 15000, cards: 10, groupPack: true }
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
            { name: 'Sandy Shells - 500 coins (1 card)', value: '1' },
            { name: 'Tide Pool - 1000 coins (2 cards)', value: '2' },
            { name: 'Coral Reef - 3000 coins (5 cards)', value: '3' },
            { name: 'Deep Dive - 5000 coins (10 cards)', value: '4' },
            { name: 'Legendary Treasure - 35000 coins (3 legendary)', value: '5' },
            { name: 'Beach Vibes - 8000 coins (5 cards)', value: '6' },
            { name: 'Tropical Paradise - 15000 coins (10 cards)', value: '7' }
          ))
      .addStringOption(option =>
        option.setName('group_or_idol')
          .setDescription('Group or idol name for Beach Vibes/Tropical Paradise')
          .setRequired(false)));

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
    await interaction.reply({ content: '<:DSwhiteno:1416237223979782306> Please use `/start` first to create your account!', ephemeral: true });
    return;
  }

  const packList = PACKS
    .map(pack => `**${pack.name}** - ${pack.cost} coins → ${pack.cards} card(s)`)
    .join('\n');

  const embed = new EmbedBuilder()
    .setColor(0xffd700)
    .setTitle('<a:hj_redstar:1363127624318320861> Card Pack Shop')
    .setDescription('Buy packs with your shells! <:2_shell:1436124721413357770>')
    .addFields(
      {
        name: '<:1_flower:1436124715797315687> Available Packs',
        value: packList,
        inline: false
      },
      {
        name: '<a:hj_redstar:1363127624318320861> Your Balance',
        value: `${user.coins} coins`,
        inline: false
      },
      {
        name: '<a:5blu_bubbles:1436124726010318870> How to Buy',
        value: 'Use `/shop buy` and select the pack you want!',
        inline: false
      }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleBuy(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  
  const userId = interaction.user.id;
  const packId = interaction.options.getString('pack', true);

  const pack = PACKS.find(p => p.id === packId);
  if (!pack) {
    await interaction.editReply({ content: '<:DSwhiteno:1416237223979782306> Invalid pack!' });
    return;
  }

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!user) {
    await interaction.editReply({ content: '<:DSwhiteno:1416237223979782306> Please use `/start` first to create your account!' });
    return;
  }

  if (user.coins < pack.cost) {
    await interaction.editReply({ 
      content: `<:DSwhiteno:1416237223979782306> You need ${pack.cost} coins but only have ${user.coins}!\nUse \`/daily\`, \`/weekly\`, or \`/surf\` to earn more coins.` 
    });
    return;
  }

  const { data: allCards } = await supabase
    .from('cards')
    .select('*');

  if (!allCards || allCards.length === 0) {
    await interaction.editReply({ 
      content: '<:DSwhiteno:1416237223979782306> No cards available yet! Ask an admin to add cards.' 
    });
    return;
  }

  // Deduct coins
  const newBalance = user.coins - pack.cost;
  await supabase
    .from('users')
    .update({ coins: newBalance })
    .eq('user_id', userId);

  // Give cards - filter based on pack type
  let availableCards = allCards;
  
  if ((pack as any).rarity === 5) {
    // Legendary pack - only legendary cards
    availableCards = allCards.filter((card: any) => card.rarity === 5);
    if (availableCards.length === 0) {
      await supabase.from('users').update({ coins: user.coins }).eq('user_id', userId);
      await interaction.editReply({ content: '<:DSwhiteno:1416237223979782306> Not enough legendary cards available!' });
      return;
    }
  } else if ((pack as any).groupPack) {
    // Group or idol-specific pack
    const groupOrIdol = interaction.options.getString('group_or_idol');
    if (!groupOrIdol) {
      await supabase.from('users').update({ coins: user.coins }).eq('user_id', userId);
      await interaction.editReply({ content: '<:DSwhiteno:1416237223979782306> Please specify a group or idol name!' });
      return;
    }
    availableCards = allCards.filter((card: any) => 
      card.name.toLowerCase().includes(groupOrIdol.toLowerCase()) || 
      card.group.toLowerCase().includes(groupOrIdol.toLowerCase())
    );
    if (availableCards.length === 0) {
      await supabase.from('users').update({ coins: user.coins }).eq('user_id', userId);
      await interaction.editReply({ content: `<:DSwhiteno:1416237223979782306> No cards found for "${groupOrIdol}"!` });
      return;
    }
    
    // Check if group/idol has too many legendary cards
    const legendaryCount = availableCards.filter((card: any) => card.rarity === 5).length;
    const legendaryPercentage = (legendaryCount / availableCards.length) * 100;
    
    if (legendaryPercentage >= 50) {
      await supabase.from('users').update({ coins: user.coins }).eq('user_id', userId);
      await interaction.editReply({ 
        content: `<:DSwhiteno:1416237223979782306> "${groupOrIdol}" has too many legendary cards! Use the **Legendary Treasure** pack instead to collect these cards.` 
      });
      return;
    }
  }

  const cardsList = [];
  for (let i = 0; i < pack.cards; i++) {
    const randomCard = availableCards[Math.floor(Math.random() * availableCards.length)];
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
    .map((card: any) => `• **${card.name}** (${card.group}) • ${card.era || 'N/A'} • \`${card.cardcode}\``)
    .join('\n');

  let attachment = null;
  try {
    const imageUrls = cardsList
      .map((card: any) => card.image_url)
      .filter((url: string) => url);

    if (imageUrls.length > 0) {
      const columns = pack.cards === 10 ? 5 : undefined;
      const mergedImageBuffer = await mergeCardImages(imageUrls, columns);
      attachment = new AttachmentBuilder(mergedImageBuffer, { name: 'pack_cards.png' });
    }
  } catch (error) {
    console.error('Error merging images:', error);
  }

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle(`<a:hj_redstar:1363127624318320861> ${pack.name} Purchased!`)
    .setDescription(`You bought the ${pack.name} for ${pack.cost} coins!`)
    .addFields(
      {
        name: '<a:5blu_bubbles:1436124726010318870> Cards Received',
        value: cardsInfo || 'No cards',
        inline: false
      },
      {
        name: '<:2_shell:1436124721413357770> New Balance',
        value: `${newBalance} coins`,
        inline: true
      }
    )
    .setTimestamp();

  if (attachment) {
    embed.setImage('attachment://pack_cards.png');
    await interaction.editReply({ embeds: [embed], files: [attachment] });
  } else {
    await interaction.editReply({ embeds: [embed] });
  }
}
