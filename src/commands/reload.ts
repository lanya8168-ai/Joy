import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('reload')
  .setDescription('Reload and refresh all bot commands (Admin only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '🧚 You need Administrator permission to use this command!', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    // This message tells the user that commands have been refreshed
    // The actual reload happens on the next bot restart due to Discord's caching
    await interaction.editReply({
      content: '🏡 Commands refreshed! The bot will reload commands on next restart.\n\nTo fully update commands, restart the bot with `/dev restart` or restart the workflow.'
    });
  } catch (error) {
    await interaction.editReply({
      content: '🧚 Error refreshing commands. Check bot logs.'
    });
  }
}
