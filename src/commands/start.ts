import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';

export const data = new SlashCommandBuilder()
  .setName('start')
  .setDescription('Start your magical journey!');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const userId = interaction.user.id;

  const { data: existing } = await supabase.from('users').select('*').eq('user_id', userId).maybeSingle();
  if (existing) {
    return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xff69b4).setTitle('Welcome Back!').setDescription(`You already have **${existing.coins} coins**!`)] });
  }

  const { error } = await supabase.from('users').insert([{ user_id: userId, coins: 100 }]);
  if (error) return interaction.editReply('🧚 Error starting your journey.');

  const embed = new EmbedBuilder()
    .setColor(0xff69b4)
    .setTitle('🌸 Welcome to the Fairy Garden!')
    .setDescription('Your magical journey begins now! 🧚')
    .addFields({ name: '🧚 Coins', value: '100' });

  await interaction.editReply({ embeds: [embed] });
}
