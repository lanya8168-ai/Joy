import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { supabase } from '../database/supabase.js';

export const data = new SlashCommandBuilder()
  .setName('shop')
  .setDescription('Browse the card pack shop');

export async function execute(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!user) {
    await interaction.reply({ content: '❌ Please use `/start` first to create your account!', ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0xffd700)
    .setTitle('🛒 Card Pack Shop')
    .setDescription('Purchase card packs to expand your collection!')
    .addFields(
      { 
        name: '🎴 Standard Pack', 
        value: '**Cost:** 50 coins\n**Contains:** 1 random card\n**Command:** `/drop`',
        inline: false
      },
      { 
        name: '💰 Your Balance', 
        value: `${user.coins} coins`,
        inline: false
      },
      {
        name: '💡 Tip',
        value: 'Earn coins with `/daily`, `/weekly`, and `/surf`!',
        inline: false
      }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
