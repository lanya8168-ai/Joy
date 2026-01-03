import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { mergeCardImages } from '../utils/imageUtils.js';
import { getRandomRarity } from '../utils/cards.js';

const PACKS = [
  { id: '1', name: 'Magic Seeds', cost: 500, cards: 1 },
  { id: '2', name: 'Glow Spores', cost: 1000, cards: 2 },
  { id: '3', name: 'Fairy Dust', cost: 3000, cards: 5 },
  { id: '4', name: 'Garden Bloom', cost: 5000, cards: 10 },
  { id: '5', name: 'Ancient Grove', cost: 35000, cards: 3, rarity: 5 },
  { id: '6', name: 'Forest Spirit (5 cards)', cost: 8000, cards: 5, groupPack: true },
  { id: '7', name: 'Fairy Kingdom (10 cards)', cost: 15000, cards: 10, groupPack: true }
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
            { name: 'Magic Seeds - 500 coins (1 card)', value: '1' },
            { name: 'Glow Spores - 1000 coins (2 cards)', value: '2' },
            { name: 'Fairy Dust - 3000 coins (5 cards)', value: '3' },
            { name: 'Garden Bloom - 5000 coins (10 cards)', value: '4' },
            { name: 'Ancient Grove - 35000 coins (3 legendary)', value: '5' },
            { name: 'Forest Spirit - 8000 coins (5 cards)', value: '6' },
            { name: 'Fairy Kingdom - 15000 coins (10 cards)', value: '7' }
          ))
      .addStringOption(option =>
        option.setName('group_or_idol')
        .setDescription('Group or idol name for Forest Spirit/Fairy Kingdom')
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
    await interaction.reply({ content: '<:IMG_9904:1443371148543791218> Please use `/start` first to create your account!', ephemeral: true });
    return;
  }

  const packList = PACKS
    .map(pack => `**${pack.name}** - ${pack.cost} coins → ${pack.cards} card(s)`)
    .join('\n');

  const embed = new EmbedBuilder()
    .setColor(0xffd700)
    .setTitle('<:cottage:1457128646274973766> Card Pack Shop')
    .setDescription('Buy packs for your garden! <:fairy2:1457128704282071196>')
    .addFields(
      {
        name: '📜 Available Packs',
        value: packList,
        inline: false
      },
      {
        name: '<:fairy2:1457128704282071196> Your Balance',
        value: `${user.coins} coins`,
        inline: false
      },
      {
        name: '✨ How to Buy',
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
    await interaction.editReply({ content: '<:IMG_9904:1443371148543791218> Invalid pack!' });
    return;
  }

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!user) {
    await interaction.editReply({ content: '<:IMG_9904:1443371148543791218> Please use `/start` first to create your account!' });
    return;
  }

  if (user.coins < pack.cost) {
    await interaction.editReply({ 
      content: `<:IMG_9904:1443371148543791218> You need ${pack.cost} coins but only have ${user.coins}!\nUse \`/daily\`, \`/weekly\`, or \`/surf\` to earn more coins.` 
    });
    return;
  }

  const { data: allCards } = await supabase
    .from('cards')
    .select('*')
    .eq('droppable', true);

  if (!allCards || allCards.length === 0) {
    await interaction.editReply({ 
      content: '<:IMG_9904:1443371148543791218> No cards available yet! Ask an admin to add cards.' 
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
  const cardsList = [];
  for (let i = 0; i < pack.cards; i++) {
    let selectedCard;

    // Check for event/birthday or limited cards (8%)
    if (Math.random() < 0.08) {
      let specialQuery = supabase.from('cards').select('*').eq('droppable', true).or('event_type.not.is.null,is_limited.eq.true');
      
      const { data: specialCards } = await specialQuery;
      if (specialCards && specialCards.length > 0) {
        let filteredSpecials = specialCards;
        const groupOrIdol = interaction.options.getString('group_or_idol');
        
        if ((pack as any).groupPack && groupOrIdol) {
          const search = groupOrIdol.toLowerCase();
          filteredSpecials = specialCards.filter((c: any) => 
            c.name.toLowerCase().includes(search) || 
            c.group.toLowerCase().includes(search)
          );
        }
        
        if (filteredSpecials.length > 0) {
          selectedCard = filteredSpecials[Math.floor(Math.random() * filteredSpecials.length)];
        }
      }
    }

    if (!selectedCard) {
      if ((pack as any).rarity === 5) {
        const legendaryCards = allCards.filter((card: any) => card.rarity === 5);
        selectedCard = legendaryCards[Math.floor(Math.random() * legendaryCards.length)];
      } else {
        const rarity = getRandomRarity();
        // Priority filter for Group Packs
        let possibleCards = allCards.filter((c: any) => c.rarity === rarity && !c.event_type); // Removed is_limited check to allow limited cards as regular drops too
        
        const groupOrIdol = interaction.options.getString('group_or_idol');
        if ((pack as any).groupPack && groupOrIdol) {
          const search = groupOrIdol.toLowerCase();
          const filtered = allCards.filter((c: any) => 
            (c.name.toLowerCase().includes(search) || c.group.toLowerCase().includes(search)) &&
            !c.event_type
          );
          
          if (filtered.length > 0) {
            // Filter by rarity within the found set
            const rarityMatch = filtered.filter((c: any) => c.rarity === rarity);
            if (rarityMatch.length > 0) {
              selectedCard = rarityMatch[Math.floor(Math.random() * rarityMatch.length)];
            } else {
              // If rarity doesn't exist for that idol, pick any card for that idol
              selectedCard = filtered[Math.floor(Math.random() * filtered.length)];
            }
          }
        }

        if (!selectedCard) {
          if (possibleCards.length > 0) {
            selectedCard = possibleCards[Math.floor(Math.random() * possibleCards.length)];
          } else {
            // Fallback to any card in this rarity if specific pack filters returned nothing
            let fallback = allCards.filter((c: any) => c.rarity === rarity && !c.event_type);
            if (fallback.length === 0) fallback = allCards.filter(c => !c.event_type);
            selectedCard = fallback[Math.floor(Math.random() * fallback.length)];
          }
        }
      }
    }

    cardsList.push(selectedCard);

    const { data: existingItem } = await supabase
      .from('inventory')
      .select('*')
      .eq('user_id', userId)
      .eq('card_id', selectedCard.card_id)
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
          card_id: selectedCard.card_id,
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
    .setTitle(`✨ ${pack.name} Purchased!`)
    .setDescription(`You bought the ${pack.name} for ${pack.cost} coins!`)
    .addFields(
      {
        name: '🎴 Cards Received',
        value: cardsInfo || 'No cards',
        inline: false
      },
      {
        name: '<:fairy2:1457128704282071196> New Balance',
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
