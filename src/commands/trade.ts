import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { supabase } from '../database/supabase.js';

export const data = new SlashCommandBuilder()
  .setName('trade')
  .setDescription('Trade cards with another user')
  .addUserOption(option => option.setName('user').setDescription('The user to trade with').setRequired(true))
  .addStringOption(option => option.setName('card_id').setDescription('The code of the card you want to give').setRequired(true))
  .addStringOption(option => option.setName('receive_card_id').setDescription('The code of the card you want to receive').setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
  const targetUser = interaction.options.getUser('user');
  const cardIdToGive = interaction.options.getString('card_id');
  const cardIdToReceive = interaction.options.getString('receive_card_id');

  if (!targetUser || targetUser.bot || targetUser.id === interaction.user.id) {
    return interaction.reply({ content: 'Invalid user for trading.', ephemeral: true });
  }

  await interaction.deferReply();

  // 1. Verify ownership of card to give
  const { data: ownCard } = await supabase
    .from('inventory')
    .select('id, cards!inner(*)')
    .eq('user_id', interaction.user.id)
    .eq('card_code', cardIdToGive)
    .single();

  if (!ownCard) return interaction.editReply(`You do not own a card with code \`${cardIdToGive}\`.`);

  // 2. Verify target ownership of card to receive
  const { data: targetCard } = await supabase
    .from('inventory')
    .select('id, cards!inner(*)')
    .eq('user_id', targetUser.id)
    .eq('card_code', cardIdToReceive)
    .single();

  if (!targetCard) return interaction.editReply(`${targetUser.username} does not own a card with code \`${cardIdToReceive}\`.`);

  const ownCardData = ownCard.cards as any;
  const targetCardData = targetCard.cards as any;

  const embed = new EmbedBuilder()
    .setTitle('🤝 Trade Proposal')
    .setDescription(`<@${interaction.user.id}> wants to trade with <@${targetUser.id}>`)
    .addFields(
      { name: 'Giving', value: `**${ownCardData.name}** (${ownCardData.group})\nCode: \`${cardIdToGive}\``, inline: true },
      { name: 'Receiving', value: `**${targetCardData.name}** (${targetCardData.group})\nCode: \`${cardIdToReceive}\``, inline: true }
    )
    .setColor(0x00AE86)
    .setFooter({ text: 'Target user must click Accept to complete the trade.' });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('accept_trade').setLabel('Accept').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('decline_trade').setLabel('Decline').setStyle(ButtonStyle.Danger)
  );

  const response = await interaction.editReply({ embeds: [embed], components: [row] });

  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 60000
  });

  collector.on('collect', async (i) => {
    if (i.user.id !== targetUser.id) {
      return i.reply({ content: 'This trade offer is not for you!', ephemeral: true });
    }

    if (i.customId === 'decline_trade') {
      await i.update({ content: '❌ Trade declined.', embeds: [], components: [] });
      return collector.stop();
    }

    if (i.customId === 'accept_trade') {
      await i.deferUpdate();

      // Atomic trade using RPC
      const { error } = await supabase.rpc('execute_trade', {
        p_user1: interaction.user.id,
        p_user2: targetUser.id,
        p_inv1_id: ownCard.id,
        p_inv2_id: targetCard.id
      });

      if (error) {
        console.error('Trade error:', error);
        return i.editReply({ content: '❌ Trade failed. One of the cards might have been moved.', embeds: [], components: [] });
      }

      await i.editReply({ content: '✅ Trade successful!', embeds: [embed.setTitle('✅ Trade Completed')], components: [] });
      collector.stop();
    }
  });

  collector.on('end', (_, reason) => {
    if (reason === 'time') {
      interaction.editReply({ content: '⏰ Trade offer expired.', components: [] });
    }
  });
}
