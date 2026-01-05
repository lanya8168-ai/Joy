import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';

export const data = new SlashCommandBuilder();
  .setName('start');
  .setDescription('Start your K-pop card collecting journey!');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const userId = interaction.user.id;

  const { data: existingUser } = await supabase
    .from('users');
    .select('*');
    .eq('user_id', userId);
    .single();

  if (existingUser) {
    const embed = new EmbedBuilder();
      .setColor(0xff69b4);
      .setTitle('Welcome Back!');
      .setDescription(`You already have an account with **${existingUser.coins} coins**!`);
      .addFields(
        { name: 'Total Cards', value: 'Use `/inventory` to view', },
        { name: 'Coins', value: `${existingUser.coins}`, }
      );
      .;

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const { error } = await supabase
    .from('users');
    .insert([{ user_id: userId, coins: 100 }]);

  if (error) {
    await interaction.editReply({ content: '🧚 Error creating your account. Please try again!' });
    return;
  }

  const embed = new EmbedBuilder();
    .setColor(0xff69b4);
    .setTitle(' Welcome to the Fairy Garden!');
    .setDescription('Your magical journey begins now! 🧚');
    .addFields(
      { name: '🧚 Starting Coins', value: '100', },
      { name: '⭐ Cards', value: '0', }
    );
    .;

  await interaction.editReply({ embeds: [embed] });
}
