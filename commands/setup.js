const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Envia os painéis oficiais da Mecânica Rodeo (Verificação, Tickets ou Ponto).')
        .addStringOption(option =>
            option.setName('painel')
                .setDescription('Escolha qual painel deseja enviar')
                .setRequired(true)
                .addChoices(
                    { name: 'Verificação', value: 'verificacao' },
                    { name: 'Tickets / Atendimento', value: 'tickets' },
                    { name: 'Controle de Ponto', value: 'ponto' }
                ))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const tipo = interaction.options.getString('painel');

        // Responde a interação de forma privada primeiro para evitar "Unknown Interaction"
        await interaction.reply({ content: '⏳ Gerando e enviando o painel...', ephemeral: true });

        if (tipo === 'verificacao') {
            const embedVerif = new EmbedBuilder()
                .setTitle('🔧 Verificação - Mecânica Rodeo')
                .setDescription('Seja bem-vindo(a) à **Mecânica Rodeo**, localizada no **Grajaú (ao lado do Prédio da OAB)**!\n\nSelecione abaixo o seu tipo de cadastro para realizar a verificação e liberar seu acesso ao servidor:')
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
            return await interaction.editReply({ content: '✅ Painel de Verificação enviado com sucesso!' });
        }

        if (tipo === 'tickets') {
            const embedTicket = new EmbedBuilder()
                .setTitle('🎫 Atendimento e Serviços - Mecânica Rodeo')
                .setDescription('Precisa de algum serviço na nossa oficina no **Grajaú (ao lado do Prédio da OAB)**?\n\nSelecione abaixo a opção desejada para abrir o seu atendimento:')
                .setColor('#0099ff')
                .setTimestamp();

            const rowTicket = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('menu_tickets')
                    .setPlaceholder('Selecione o serviço desejado...')
                    .addOptions([
                        {
                            label: 'Marcar Revisão',
                            description: 'Agende uma revisão completa para o seu veículo',
                            value: 'revisao',
                            emoji: '🛠️'
                        },
                        {
                            label: 'Solicitar Orçamento',
                            description: 'Peça valores para reparos, peças ou customização',
                            value: 'orcamento',
                            emoji: '📋'
                        },
                        {
                            label: 'Atendimento',
                            description: 'Fale diretamente com nossa equipe de plantão',
                            value: 'atendimento',
                            emoji: '💬'
                        },
                        {
                            label: 'Contratos',
                            description: 'Assuntos relacionados a parcerias e contratos',
                            value: 'contratos',
                            emoji: '📄'
                        }
                    ])
            );

            await interaction.channel.send({ embeds: [embedTicket], components: [rowTicket] });
            return await interaction.editReply({ content: '✅ Painel de Tickets enviado com sucesso!' });
        }

        if (tipo === 'ponto') {
            const embedPonto = new EmbedBuilder()
                .setTitle('⏱️ Mecânica Rodeo - Controle de Ponto')
                .setDescription('Clique no botão abaixo para **Iniciar** o seu expediente ou **Fechar** o seu ponto e computar as suas horas trabalhadas na oficina.')
                .setColor(0x1ABC9C)
                .setTimestamp();

            const rowPonto = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('btn_iniciar_ponto')
                    .setLabel('Iniciar Ponto')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🟢'),
                new ButtonBuilder()
                    .setCustomId('btn_fechar_ponto')
                    .setLabel('Fechar Ponto')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔴')
            );

            await interaction.channel.send({ embeds: [embedPonto], components: [rowPonto] });
            return await interaction.editReply({ content: '✅ Painel de Ponto enviado com sucesso!' });
        }
    },
};
