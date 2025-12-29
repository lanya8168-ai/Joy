
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, TextChannel } from 'discord.js';
import { supabase } from '../database/supabase.js';

export const data = new SlashCommandBuilder()
  .setName('game')
  .setDescription('Play a K-pop guessing game')
  .addSubcommand(subcommand =>
    subcommand
      .setName('idol')
      .setDescription('Guess the idol from an image'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('group')
      .setDescription('Guess the group from an image'));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const subcommand = interaction.options.getSubcommand();
  
  // Get a random card
  const { data: cards } = await supabase.from('cards').select('*');
  if (!cards || cards.length === 0) {
    return interaction.editReply('No cards found in database!');
  }
  
  const randomCard = cards[Math.floor(Math.random() * cards.length)];
  const isIdolMode = subcommand === 'idol';
  const targetName = isIdolMode ? randomCard.name : randomCard.group;
  
  const embed = new EmbedBuilder()
    .setTitle(`Guess the ${isIdolMode ? 'Idol' : 'Group'}!`)
    .setDescription(`Type the name of the ${isIdolMode ? 'idol' : 'group'} below. You have 30 seconds!`)
    .setImage(randomCard.image_url)
    .setColor(0xff69b4);
    
  await interaction.editReply({ embeds: [embed] });
  
  const filter = (m: any) => m.author.id === interaction.user.id;
  const channel = interaction.channel;
  if (!channel || !(channel instanceof TextChannel)) return;

  const collector = channel.createMessageCollector({ filter, time: 30000 });
  
  collector.on('collect', async (m: any) => {
    if (m.content.toLowerCase() === targetName.toLowerCase()) {
      await m.reply(`✅ Correct! It's **${randomCard.name}** from **${randomCard.group}**!`);
      collector.stop('correct');
    }
  });
  
  collector.on('end', (collected: any, reason: string) => {
    if (reason !== 'correct') {
      interaction.followUp(`⏰ Time's up! The answer was **${randomCard.name}** (${randomCard.group}).`);
    }
  });
}
