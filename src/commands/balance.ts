
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';

export const data = new SlashCommandBuilder()
  .setName('balance')
  .setDescription('Check your coin balance')
  .addUserOption(option =>
    option.setName('user')
      .setDescription('User to check balance for (default: yourself)')
      .setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  
  const targetUser = interaction.options.getUser('user') || interaction.user;
  const userId = targetUser.id;

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!user) {
    await interaction.editReply({ 
      content: targetUser.id === interaction.user.id 
        ? '🧚 Please use `/start` first to create your account!' 
        : '🧚 This user has not started their journey yet!' 
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0xffd700)
    .setTitle(`${targetUser.username}'s Balance`)
    .setDescription(`🧚 **${user.coins}** coins`)
    .setThumbnail(targetUser.displayAvatarURL())
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
