import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { supabase } from '../database/supabase.js';

export const data = new SlashCommandBuilder()
  .setName('trade')
  .setDescription('Trade cards with another user')
  .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
  .addStringOption(o => o.setName('card_id').setDescription('Card code to GIVE').setRequired(true))
  .addStringOption(o => o.setName('receive_card_id').setDescription('Card code to RECEIVE').setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
  const target = interaction.options.getUser('user', true);
  const giveCode = interaction.options.getString('card_id', true).toUpperCase();
  const receiveCode = interaction.options.getString('receive_card_id', true).toUpperCase();

  if (target.bot || target.id === interaction.user.id) return interaction.reply({ content: 'Invalid user.', ephemeral: true });

  await interaction.deferReply();

  const { data: ownCard } = await supabase.from('inventory').select('id, cards!inner(*)').eq('user_id', interaction.user.id).eq('cards.cardcode', giveCode).maybeSingle();
  if (!ownCard) return interaction.editReply(`You don't own \`${giveCode}\`.`);

  const { data: targetCard } = await supabase.from('inventory').select('id, cards!inner(*)').eq('user_id', target.id).eq('cards.cardcode', receiveCode).maybeSingle();
  if (!targetCard) return interaction.editReply(`${target.username} doesn't own \`${receiveCode}\`.`);

  const embed = new EmbedBuilder()
    .setTitle('🤝 Trade Proposal')
    .setDescription(`<@${interaction.user.id}> ↔️ <@${target.id}>`)
    .addFields(
      { name: 'Giving', value: `**${(ownCard.cards as any).name}**\n\`${giveCode}\`` },
      { name: 'Receiving', value: `**${(targetCard.cards as any).name}**\n\`${receiveCode}\`` }
    )
    .setColor(0xff69b4);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('accept_trade').setLabel('Accept').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('decline_trade').setLabel('Decline').setStyle(ButtonStyle.Danger)
  );

  const res = await interaction.editReply({ embeds: [embed], components: [row] });
  const collector = res.createMessageComponentCollector({ time: 60000 });

  collector.on('collect', async i => {
    if (i.user.id !== target.id) return i.reply({ content: 'Not for you!', ephemeral: true });
    if (i.customId === 'decline_trade') return i.update({ content: '❌ Trade declined.', embeds: [], components: [] });

    await i.deferUpdate();
    const { error } = await supabase.rpc('execute_trade', { p_user1: interaction.user.id, p_user2: target.id, p_inv1_id: ownCard.id, p_inv2_id: targetCard.id });
    if (error) return i.editReply({ content: '❌ Trade failed.', embeds: [], components: [] });
    await i.editReply({ content: '✅ Trade successful!', embeds: [embed.setTitle('✅ Trade Completed')], components: [] });
  });
}
