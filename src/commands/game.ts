
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
      const authorId = String(m.author.id).trim();
      const interactionUserId = String(interaction.user.id).trim();
      const isAuthor = authorId === interactionUserId;
      const isNotBot = !m.author.bot;
      
      console.log(`[FILTER DEBUG] Channel: ${m.channel.id} | Msg from ${m.author.tag} (${authorId}) | Target User: ${interactionUserId} | isAuthor: ${isAuthor} | isNotBot: ${isNotBot} | Content: "${m.content}"`);
      
      return isAuthor && isNotBot;
    } catch (err) {
      console.error('[FILTER ERROR]', err);
      return false;
    }
  };
  
  // Use client-level message event as a fallback
  const messageHandler = async (m: any) => {
    if (String(m.channel.id) !== String(interaction.channelId) || String(m.author.id) !== String(interaction.user.id) || m.author.bot) return;
    console.log(`[CLIENT DEBUG] Received message in game channel: "${m.content}"`);
    
    // Manual trigger if collector fails
    if (collector && !collector.ended) {
      const guess = m.content.trim().toLowerCase();
      const answer = targetName.trim().toLowerCase();
      const answerWords = answer.split(/\s+/).filter(word => word.length > 2);
      
      const isCorrect = guess === answer || 
                       (guess.length > 2 && answer.includes(guess)) ||
                       (answer.length > 2 && guess.includes(answer)) ||
                       answerWords.some(word => guess.includes(word));

      if (isCorrect) {
        console.log(`[CLIENT DEBUG] Manual match success for "${guess}"`);
        collector.emit('collect', m);
      }
    }
  };
  interaction.client.on('messageCreate', messageHandler);

  // Ensure we are using the correct channel object
  const channel = interaction.channel;
  if (!channel || !('createMessageCollector' in channel)) {
    console.error(`[GAME ERROR] Channel ${channel?.id} does not support collectors`);
    interaction.client.off('messageCreate', messageHandler);
    return;
  }

  console.log(`[GAME DEBUG] Starting game in channel ${channel.id} for user ${interaction.user.id}. Target: ${targetName}`);

  const collector = (channel as any).createMessageCollector({ filter, time: 30000 });
  
  collector.on('collect', async (m: any) => {
    const guess = m.content.trim().toLowerCase();
    const answer = targetName.trim().toLowerCase();
    
    console.log(`[GAME DEBUG] COLLECTED: "${m.content}" from ${m.author.tag} (${m.author.id}) in ${m.channel.id}`);
    
    // Improved matching logic:
    const answerWords = answer.split(/\s+/).filter(word => word.length > 2);
    
    const isCorrect = guess === answer || 
                     (guess.length > 2 && answer.includes(guess)) ||
                     (answer.length > 2 && guess.includes(answer)) ||
                     answerWords.some(word => guess.includes(word));

    console.log(`[GAME DEBUG] Match Result for "${guess}" against "${answer}": ${isCorrect}`);

    if (isCorrect) {
      // Cleanup client listener
      interaction.client.off('messageCreate', messageHandler);
      
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
    // Cleanup client listener
    interaction.client.off('messageCreate', messageHandler);
    
    if (reason !== 'correct') {
      interaction.followUp(`⏰ Time's up! The answer was **${targetName}**.`);
    }
  });
}
