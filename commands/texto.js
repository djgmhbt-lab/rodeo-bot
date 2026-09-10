const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('texto')
        .setDescription('Envia uma mensagem personalizada através do bot em um canal.')
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('Canal onde a mensagem será enviada')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('mensagem')
                .setDescription('O texto que o bot vai enviar')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const canal = interaction.options.getChannel('canal');
        const texto = interaction.options.getString('mensagem');

        try {
            await canal.send({ content: texto });
            await interaction.reply({ content: `✅ Mensagem enviada com sucesso no canal ${canal}!`, ephemeral: true });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: '❌ Erro ao enviar a mensagem neste canal.', ephemeral: true });
        }
    },
};
