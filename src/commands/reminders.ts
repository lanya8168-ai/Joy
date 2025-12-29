import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { supabase } from '../database/supabase.js';

export const data = new SlashCommandBuilder()
  .setName('reminders')
  .setDescription('Manage your command reminders');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  
  const userId = interaction.user.id;
  const { data: user } = await supabase.from('users').select('reminder_settings').eq('user_id', userId).single();
  
  if (!user) return interaction.editReply('Please use `/start` first!');

  const settings = user.reminder_settings || {};
  const commands = ['drop', 'daily', 'weekly', 'surf'];

  const getEmbed = () => {
    const description = commands.map(cmd => {
      const isEnabled = settings[cmd] !== false;
      return `${isEnabled ? '✅' : '❌'} **/${cmd}**`;
    }).join('\n');

    return new EmbedBuilder()
      .setTitle('⏰ Reminder Settings')
      .setDescription('Click the buttons below to toggle reminders for specific commands:\n\n' + description)
      .setColor(0x00d4ff);
  };

  const getButtons = () => {
    const rows = [];
    let currentRow = new ActionRowBuilder<ButtonBuilder>();
    
    commands.forEach((cmd, index) => {
      const isEnabled = settings[cmd] !== false;
      currentRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`remind_toggle_${cmd}`)
          .setLabel(`/${cmd}`)
          .setStyle(isEnabled ? ButtonStyle.Success : ButtonStyle.Danger)
      );
      
      if ((index + 1) % 5 === 0 || index === commands.length - 1) {
        rows.push(currentRow);
        currentRow = new ActionRowBuilder<ButtonBuilder>();
      }
    });
    
    return rows;
  };

  const response = await interaction.editReply({
    embeds: [getEmbed()],
    components: getButtons()
  });

  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 60000
  });

  collector.on('collect', async i => {
    if (i.user.id !== userId) return i.reply({ content: 'Not for you!', ephemeral: true });
    
    const cmd = i.customId.replace('remind_toggle_', '');
    const currentSettings = settings as Record<string, boolean>;
    currentSettings[cmd] = currentSettings[cmd] === false; // Toggle
    
    await supabase.from('users').update({ reminder_settings: currentSettings }).eq('user_id', userId);
    
    await i.update({
      embeds: [getEmbed()],
      components: getButtons()
    });
  });
}
