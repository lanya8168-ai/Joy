import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';

export const data = new SlashCommandBuilder()
  .setName('start')
  .setDescription('Start your magical journey!');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const userId = interaction.user.id;

  // Use maybeSingle() and check if data exists
  const { data: existing, error: fetchError } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError) {
    console.error('Error fetching user:', fetchError);
    return interaction.editReply('🧚 Error checking your account status.');
  }

  if (existing) {
    const embed = new EmbedBuilder()
      .setColor(0xff69b4)
      .setTitle('Welcome Back!')
      .setDescription(`You already have an account with **${existing.coins} coins**!`)
      .addFields(
        { name: 'Total Cards', value: 'Use `/inventory` to view' },
        { name: 'Coins', value: `${existing.coins}` }
      );
    return interaction.editReply({ embeds: [embed] });
  }

  const { error: insertError } = await supabase
    .from('users')
    .insert([{ user_id: userId, coins: 100 }]);

  if (insertError) {
    console.error('Error creating user:', insertError);
    return interaction.editReply('🧚 Error starting your journey. Please try again!');
  }

  const embed = new EmbedBuilder()
    .setColor(0xff69b4)
    .setTitle('🌸 Welcome to the Fairy Garden!')
    .setDescription('Your magical journey begins now! 🧚')
    .addFields({ name: '🧚 Starting Coins', value: '100' });

  await interaction.editReply({ embeds: [embed] });
}
