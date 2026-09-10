const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Envia os painéis oficiais da oficina (Verificação ou Tickets).')
        .addStringOption(option =>
            option.setName('painel')
                .setDescription('Escolha qual painel deseja enviar')
                .setRequired(true)
                .addChoices(
                    { name: 'Verificação', value: 'verificacao' },
                    { name: 'Tickets / Atendimento', value: 'tickets' }
                ))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const tipo = interaction.options.getString('painel');

        if (tipo === 'verificacao') {
            const embedVerif = new EmbedBuilder()
                .setTitle('🔧 Verificação - Oficina Mecânica')
                .setDescription('Seja bem-vindo(a) à nossa oficina no **Grajaú (ao lado do Prédio da OAB)**!\n\nSelecione abaixo o seu tipo de cadastro para realizar a verificação e liberar seu acesso ao servidor:')
                .setColor('#ff9900')
                .setTimestamp();

            const rowVerif = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('verificar_tipo')
                    .setPlaceholder('Clique aqui para escolher seu cadastro...')
                    .addOptions([
                        {
                            label: 'Cliente',
                            description: 'Cadastre-se como cliente para solicitar reparos e orçamentos',
                            value: 'cliente',
                            emoji: '🚗'
                        },
                        {
                            label: 'Funcionário / Mecânico',
                            description: 'Cadastre-se como membro da equipe da oficina',
                            value: 'funcionario',
                            emoji: '🔧'
                        }
                    ])
            );

            await interaction.channel.send({ embeds: [embedVerif], components: [rowVerif] });
            return await interaction.reply({ content: '✅ Painel de Verificação enviado com sucesso!', ephemeral: true });
        }

        if (tipo === 'tickets') {
            const embedTicket = new EmbedBuilder()
                .setTitle('🎫 Atendimento e Orçamentos - Oficina')
                .setDescription('Precisa de um orçamento, reparo de motor, pintura ou personalização no seu veículo?\n\nAbra um atendimento selecionando o serviço desejado no menu abaixo:')
                .setColor('#0099ff')
                .setTimestamp();

            const rowTicket = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('menu_tickets')
                    .setPlaceholder('Selecione o tipo de atendimento...')
                    .addOptions([
                        {
                            label: 'Orçamento de Peças / Reparos',
                            description: 'Solicitar valores para conserto ou customização',
                            value: 'orcamento',
                            emoji: '📋'
                        },
                        {
                            label: 'Atendimento Geral / Dúvidas',
                            description: 'Falar com a equipe da oficina',
                            value: 'geral',
                            emoji: '💬'
                        }
                    ])
            );

            await interaction.channel.send({ embeds: [embedTicket], components: [rowTicket] });
            return await interaction.reply({ content: '✅ Painel de Tickets enviado com sucesso!', ephemeral: true });
        }
    },
};
