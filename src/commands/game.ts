
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
  const isIdolMode = subcommand === 'idol';
  const type = isIdolMode ? 'idol' : 'group';
  
  // Get a random question from quiz_questions table
  const { data: questions } = await supabase
    .from('quiz_questions')
    .select('*')
    .eq('type', type);

  if (!questions || questions.length === 0) {
    // Fallback to random card if no custom questions exist
    const { data: cards } = await supabase.from('cards').select('*');
    if (!cards || cards.length === 0) {
      return interaction.editReply('No cards or quiz questions found!');
    }
    
    const randomCard = cards[Math.floor(Math.random() * cards.length)];
    const targetName = isIdolMode ? randomCard.name : randomCard.group;
    const reward = 50;

    await startGame(interaction, randomCard.image_url, targetName, reward, isIdolMode);
    return;
  }
  
  const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
  await startGame(interaction, randomQuestion.image_url, randomQuestion.answer, randomQuestion.reward_coins, isIdolMode);
}

async function startGame(interaction: ChatInputCommandInteraction, imageUrl: string, targetName: string, reward: number, isIdolMode: boolean) {
  const embed = new EmbedBuilder()
    .setTitle(`Guess the ${isIdolMode ? 'Idol' : 'Group'}!`)
    .setDescription(`Type the name of the ${isIdolMode ? 'idol' : 'group'} below. You have 30 seconds!`)
    .setImage(imageUrl)
    .setColor(0xff69b4);
    
  await interaction.editReply({ embeds: [embed] });
  
  const filter = (m: any) => m.author.id === interaction.user.id;
  const channel = interaction.channel;
  if (!channel || !(channel instanceof TextChannel)) return;

  const collector = channel.createMessageCollector({ filter, time: 30000 });
  
  collector.on('collect', async (m: any) => {
    const guess = m.content.trim().toLowerCase();
    const answer = targetName.trim().toLowerCase();
    
    // Improved matching: exact, includes, closely related, or group/idol name matching
    const isCorrect = guess === answer || 
                     guess.includes(answer) || 
                     (answer.length > 3 && answer.includes(guess)) ||
                     (answer.split(' ').some(part => part.length > 2 && guess.includes(part.toLowerCase()))) ||
                     (guess.length > 2 && answer.includes(guess));

    if (isCorrect) {
      // Stop collector first to prevent double reward
      collector.stop('correct');
      
      // Add reward
      const { data: user } = await supabase.from('users').select('coins').eq('user_id', interaction.user.id).single();
      if (user) {
        await supabase.from('users').update({ coins: (user.coins || 0) + (reward || 0) }).eq('user_id', interaction.user.id);
      }
      
      await m.reply(`✅ Correct! It's **${targetName}**! You earned <:2_shell:1436124721413357770> **${reward}** coins!`);
    }
  });
  
  collector.on('end', (collected: any, reason: string) => {
    if (reason !== 'correct') {
      interaction.followUp(`⏰ Time's up! The answer was **${targetName}**.`);
    }
  });
}
