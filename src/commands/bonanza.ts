import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';
import { formatCooldown } from '../utils/cooldowns.js';
import { mergeCardImages } from '../utils/imageUtils.js';
import { DEV_USER_ID, BOOSTER_ROLE_ID } from '../utils/constants.js';

const BONANZA_COOLDOWN_HOURS = 6;

export const data = new SlashCommandBuilder()
  .setName('bonanza')
  .setDescription('Exclusive booster mega reward! (6 hour cooldown)');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const userId = interaction.user.id;

  // Check if user is booster or dev
  const member = interaction.member as any;
  if (userId !== DEV_USER_ID && !member?.roles?.cache?.has(BOOSTER_ROLE_ID)) {
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

  // Check cooldown (skip for dev user)
  if (userId !== DEV_USER_ID && user.last_bonanza && new Date(user.last_bonanza).getTime() > Date.now() - BONANZA_COOLDOWN_HOURS * 60 * 60 * 1000) {
    const cooldownMs = new Date(user.last_bonanza).getTime() + (BONANZA_COOLDOWN_HOURS * 60 * 60 * 1000) - Date.now();
    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('⏰ Bonanza On Cooldown')
      .setDescription(`Come back in **${formatCooldown(cooldownMs)}**`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Give 25,000 coins
  const newBalance = user.coins + 25000;
  await supabase.from('users').update({ coins: newBalance, last_bonanza: new Date().toISOString() }).eq('user_id', userId);

  // Get legendary cards only
  const { data: legendaryCards } = await supabase.from('cards').select('*').eq('rarity', 5);

  if (!legendaryCards || legendaryCards.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0xffd700)
      .setTitle('<a:5octo:1435458063740960778> Bonanza Claimed!')
      .setDescription(`<:fullstar:1387609456824680528> You received **25,000 coins**!\n\n*No legendary cards available yet.*`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Give 20 legendary cards
  const selectedCards = [];
  for (let i = 0; i < 20; i++) {
    const randomCard = legendaryCards[Math.floor(Math.random() * legendaryCards.length)];
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

  let attachment = null;
  try {
    const imageUrls = selectedCards.filter((card: any) => card.image_url).map((card: any) => card.image_url);
    if (imageUrls.length > 0) {
      const mergedImageBuffer = await mergeCardImages(imageUrls, 5);
      attachment = new AttachmentBuilder(mergedImageBuffer, { name: 'bonanza_cards.png' });
    }
  } catch (error) {
    console.error('Error merging images:', error);
  }

  const embed = new EmbedBuilder()
    .setColor(0xffcc00)
    .setTitle('<a:5octo:1435458063740960778> Bonanza Claimed!')
    .setDescription(`<:fullstar:1387609456824680528> You received **25,000 coins** and **20 legendary cards**!`)
    .addFields(
      {
        name: '<:2_shell:1436124721413357770> New Balance',
        value: `${newBalance} coins`,
        inline: true
      }
    )
    .setTimestamp();

  if (attachment) {
    embed.setImage('attachment://bonanza_cards.png');
    await interaction.editReply({ embeds: [embed], files: [attachment] });
  } else {
    await interaction.editReply({ embeds: [embed] });
  }
}
