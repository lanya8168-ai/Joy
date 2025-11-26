import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { formatCooldown } from '../utils/cooldowns.js';
import { mergeCardImages } from '../utils/imageUtils.js';
import { AttachmentBuilder } from 'discord.js';

const BOOSTER_COOLDOWN_HOURS = 6;
const BOOSTER_USER_ID = '1403958587843149937';
const BOOSTER_ROLE_ID = '1442680565479510077';

export const data = new SlashCommandBuilder()
  .setName('booster')
  .setDescription('Exclusive booster reward! (6 hour cooldown)');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const userId = interaction.user.id;

  // Check if user is booster
  const member = interaction.member as any;
  if (userId !== BOOSTER_USER_ID && !member?.roles?.cache?.has(BOOSTER_ROLE_ID)) {
    await interaction.editReply({ 
      content: '<:IMG_9904:1443371148543791218> This command is only available to boosters!' 
    });
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

  // Check cooldown (skip for special user)
  if (userId !== BOOSTER_USER_ID && user.last_booster && new Date(user.last_booster).getTime() > Date.now() - BOOSTER_COOLDOWN_HOURS * 60 * 60 * 1000) {
    const cooldownMs = new Date(user.last_booster).getTime() + (BOOSTER_COOLDOWN_HOURS * 60 * 60 * 1000) - Date.now();
    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('⏰ Booster Reward On Cooldown')
      .setDescription(`Come back in **${formatCooldown(cooldownMs)}**`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Give 10,000 coins
  const newBalance = user.coins + 10000;
  await supabase.from('users').update({ coins: newBalance, last_booster: new Date().toISOString() }).eq('user_id', userId);

  // Get all cards
  const { data: allCards } = await supabase.from('cards').select('*');

  if (!allCards || allCards.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0xffd700)
      .setTitle('<a:5surfboard:1433597347031683114> Booster Reward Claimed!')
      .setDescription(`<:2_shell:1436124721413357770> You received **10,000 coins**!\n\n*No cards available yet.*`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Give 15 random cards
  const selectedCards = [];
  for (let i = 0; i < 15; i++) {
    const randomCard = allCards[Math.floor(Math.random() * allCards.length)];
    selectedCards.push(randomCard);

    const { data: existingItem } = await supabase
      .from('inventory')
      .select('*')
      .eq('user_id', userId)
      .eq('card_id', randomCard.card_id)
      .single();

    if (existingItem) {
      await supabase.from('inventory').update({ quantity: existingItem.quantity + 1 }).eq('id', existingItem.id);
    } else {
      await supabase.from('inventory').insert({ user_id: userId, card_id: randomCard.card_id, quantity: 1 });
    }
  }

  const cardsInfo = selectedCards
    .map((card: any) => `• **${card.name}** (${card.group}) • ${card.era || 'N/A'} • \`${card.cardcode}\``)
    .join('\n');

  let attachment = null;
  try {
    const imageUrls = selectedCards.filter((card: any) => card.image_url).map((card: any) => card.image_url);
    if (imageUrls.length > 0) {
      const mergedImageBuffer = await mergeCardImages(imageUrls, 5);
      attachment = new AttachmentBuilder(mergedImageBuffer, { name: 'booster_cards.png' });
    }
  } catch (error) {
    console.error('Error merging images:', error);
  }

  const embed = new EmbedBuilder()
    .setColor(0xffd700)
    .setTitle('<a:5blu_bubbles:1436124726010318870> Booster Reward Claimed!')
    .setDescription(`<:fullstar:1387609456824680528> You received **10,000 coins** and **15 cards**!`)
    .addFields(
      {
        name: '<:1_flower:1436124715797315687> Cards Received',
        value: cardsInfo,
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
    embed.setImage('attachment://booster_cards.png');
    await interaction.editReply({ embeds: [embed], files: [attachment] });
  } else {
    await interaction.editReply({ embeds: [embed] });
  }
}
