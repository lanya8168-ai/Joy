import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { DEV_USER_ID } from '../utils/constants.js';

export const data = new SlashCommandBuilder()
  .setName('lockdown')
  .setDescription('Toggle lockdown mode (Dev only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;

  // Only dev user can execute this
  if (userId !== DEV_USER_ID) {
    await interaction.reply({ 
      content: '🧚 Only the dev user can execute this command!',
      ephemeral: true
    });
    return;
  }

  // Access global lockdown state
  const globalState = (global as any).botState = (global as any).botState || {};
  globalState.lockdownMode = !globalState.lockdownMode;

  const embed = new EmbedBuilder()
    .setColor(globalState.lockdownMode ? 0xff0000 : 0x00ff00)
    .setTitle(globalState.lockdownMode ? '🔒 LOCKDOWN ENABLED' : '🔓 Lockdown Disabled')
    .setDescription(globalState.lockdownMode 
      ? 'All commands are now **LOCKED**. Only the dev user can execute commands.'
      : 'All commands are now **UNLOCKED**. Everyone can use commands.')
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: false });
}
