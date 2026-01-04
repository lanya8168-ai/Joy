
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
    // Determine target name based on subcommand
    const targetName = isIdolMode ? randomCard.name : randomCard.group;
    const reward = 50;

    await startGame(interaction, randomCard.image_url, targetName, reward, isIdolMode);
    return;
  }
  
  const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
  // Use the answer directly from the custom question
  await startGame(interaction, randomQuestion.image_url, randomQuestion.answer, randomQuestion.reward_coins, isIdolMode);
}

async function startGame(interaction: ChatInputCommandInteraction, imageUrl: string, targetName: string, reward: number, isIdolMode: boolean) {
  const embed = new EmbedBuilder()
    .setTitle(`Guess the ${isIdolMode ? 'Idol' : 'Group'}!`)
    .setDescription(`Type the name of the ${isIdolMode ? 'idol' : 'group'} below. You have 30 seconds!`)
    .setImage(imageUrl)
    .setColor(0xff69b4);
    
  await interaction.editReply({ embeds: [embed] });
  
  // Improved filter to be more explicit and log results
  const filter = (m: any) => {
    try {
      // Allow any message in the channel that is NOT from a bot
      const isNotBot = !m.author.bot;
      const content = m.content.trim().toLowerCase();
      const answer = targetName.trim().toLowerCase();
      
      // Simple word match check inside filter
      const isCorrectMatch = content === answer || 
                            (content.length > 2 && answer.includes(content)) ||
                            (answer.length > 2 && content.includes(answer));
      
      console.log(`[FILTER DEBUG] Msg from ${m.author.tag} | Content: "${m.content}" | Match: ${isCorrectMatch}`);
      
      return isNotBot; // Let the collector handle the logic, but allow all non-bot messages
    } catch (err) {
      console.error('[FILTER ERROR]', err);
      return false;
    }
  };
  
  // Ensure we are using the correct channel object
  const channel = interaction.channel;
  if (!channel || !('createMessageCollector' in channel)) {
    console.error(`[GAME ERROR] Channel ${channel?.id} does not support collectors`);
    return;
  }

  console.log(`[GAME DEBUG] Starting game in channel ${channel.id}. Target: ${targetName}`);

  const collector = (channel as any).createMessageCollector({ filter, time: 30000 });
  
  collector.on('collect', async (m: any) => {
    const guess = m.content.trim().toLowerCase();
    const answer = targetName.trim().toLowerCase();
    
    // Fuzzy matching logic
    const answerWords = answer.split(/\s+/).filter(word => word.length > 2);
    
    const isCorrect = guess === answer || 
                     (guess.length > 2 && answer.includes(guess)) ||
                     (answer.length > 2 && guess.includes(answer)) ||
                     answerWords.some(word => guess.includes(word));

    if (isCorrect) {
      collector.stop('correct');
      
      // Add reward
      const { data: user } = await supabase.from('users').select('coins').eq('user_id', m.author.id).single();
      if (user) {
        await supabase.from('users').update({ coins: (user.coins || 0) + (reward || 0) }).eq('user_id', m.author.id);
      }
      
      await m.reply(`✅ Correct! It's **${targetName}**! You earned 🧚 **${reward}** coins!`);
    }
  });
  
  collector.on('end', (collected: any, reason: string) => {
    if (reason !== 'correct') {
      interaction.followUp(`⏰ Time's up! The answer was **${targetName}**.`);
    }
  });
}
