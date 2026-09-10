const { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    ChannelType, 
    PermissionsBitField 
} = require('discord.js');
const { GoogleGenAI } = require('@google/genai');

// Inicialização da IA do Google Gemini (usando a chave das variáveis de ambiente)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ]
});

// Configuração dos IDs do Servidor e Cargos
const GUILD_ID = process.env.GUILD_ID;
const CLIENT_ID = process.env.CLIENT_ID;
const TICKET_CATEGORY_ID = '1547601598694297651'; // Categoria configurada para os tickets

client.once('ready', async () => {
    console.log(`Bot online como ${client.user.tag}! Mecânica Rodeo operando.`);

    // Registro automático dos Comandos Slash
    const commands = [
        new SlashCommandBuilder()
            .setName('texto')
            .setDescription('Envia uma mensagem personalizada em um canal')
            .addChannelOption(option => 
                option.setName('canal')
                    .setDescription('Canal onde a mensagem será enviada')
                    .setRequired(true))
            .addStringOption(option => 
                option.setName('mensagem')
                    .setDescription('O conteúdo da mensagem')
                    .setRequired(true)),
        
        new SlashCommandBuilder()
            .setName('setup')
            .setDescription('Envia os painéis oficiais da Mecânica Rodeo')
            .addStringOption(option =>
                option.setName('painel')
                    .setDescription('Escolha o painel')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Verificação', value: 'verificacao' },
                        { name: 'Tickets / Atendimento', value: 'tickets' }
                    ))
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        console.log('Atualizando comandos de barra (Slash Commands)...');
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands },
        );
        console.log('Comandos registrados com sucesso!');
    } catch (error) {
        console.error('Erro ao registrar comandos:', error);
    }
});

// Manipulação de Comandos e Interações (Botões e Menus)
client.on('interactionCreate', async interaction => {
    // 1. Tratamento de Comandos Slash
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'texto') {
            const channel = interaction.options.getChannel('canal');
            const messageContent = interaction.options.getString('mensagem');

            try {
                await channel.send(messageContent);
                await interaction.reply({ content: `✅ Mensagem enviada com sucesso no canal ${channel}!`, ephemeral: true });
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: '❌ Ocorreu um erro ao tentar enviar a mensagem neste canal.', ephemeral: true });
            }
        } 
        
        else if (commandName === 'setup') {
            const painelType = interaction.options.getString('painel');

            if (painelType === 'verificacao') {
                const embedVerif = new EmbedBuilder()
                    .setTitle('🔧 Mecânica Rodeo - Verificação')
                    .setDescription('Clique no botão abaixo para se verificar e liberar o acesso completo à oficina.')
                    .setColor(0xF1C40F);

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('btn_verificar')
                        .setLabel('Verificar-se')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('✔️')
                );

                await interaction.reply({ content: 'Painel de verificação enviado!', ephemeral: true });
                await interaction.channel.send({ embeds: [embedVerif], components: [row] });
            } 
            
            else if (painelType === 'tickets') {
                const embedTicket = new EmbedBuilder()
                    .setTitle('🛠️ Mecânica Rodeo - Central de Atendimento')
                    .setDescription('Precisa de um orçamento, marcar uma revisão ou falar com a diretoria? Clique em uma das opções abaixo para abrir o seu atendimento privado.')
                    .setColor(0x3498DB);

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('ticket_revisao')
                        .setLabel('Marcar Revisão')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('🚗'),
                    new ButtonBuilder()
                        .setCustomId('ticket_orcamento')
                        .setLabel('Solicitar Orçamento')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('💰'),
                    new ButtonBuilder()
                        .setCustomId('ticket_atendimento')
                        .setLabel('Atendimento Geral')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('📞'),
                    new ButtonBuilder()
                        .setCustomId('ticket_contratos')
                        .setLabel('Contratos')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('📄')
                );

                await interaction.reply({ content: 'Painel de tickets enviado!', ephemeral: true });
                await interaction.channel.send({ embeds: [embedTicket], components: [row] });
            }
        }
    }

    // 2. Tratamento de Botões (Interações)
    if (interaction.isButton()) {
        // Ação do Botão de Verificação
        if (interaction.customId === 'btn_verificar') {
            await interaction.reply({ content: '✅ Você foi verificado com sucesso na Mecânica Rodeo!', ephemeral: true });
        }

        // Ações de Abertura de Ticket (Criando canal dentro da categoria específica)
        if (interaction.customId.startsWith('ticket_')) {
            const tipo = interaction.customId.replace('ticket_', '');
            const guild = interaction.guild;
            const member = interaction.member;

            await interaction.deferReply({ ephemeral: true });

            try {
                // Cria o canal de ticket dentro da categoria configurada
                const ticketChannel = await guild.channels.create({
                    name: `ticket-${tipo}-${member.user.username}`,
                    type: ChannelType.GuildText,
                    parent: TICKET_CATEGORY_ID,
                    permissionOverwrites: [
                        {
                            id: guild.id, // Oculto para @everyone
                            deny: [PermissionsBitField.Flags.ViewChannel],
                        },
                        {
                            id: member.id, // Visível para quem abriu o ticket
                            allow: [
                                PermissionsBitField.Flags.ViewChannel,
                                PermissionsBitField.Flags.SendMessages,
                                PermissionsBitField.Flags.ReadMessageHistory
                            ],
                        },
                        {
                            id: client.user.id, // Visível para o Bot
                            allow: [
                                PermissionsBitField.Flags.ViewChannel,
                                PermissionsBitField.Flags.SendMessages,
                                PermissionsBitField.Flags.ManageChannels
                            ],
                        }
                    ]
                });

                const embedWelcome = new EmbedBuilder()
                    .setTitle(`Atendimento: ${tipo.toUpperCase()}`)
                    .setDescription(`Olá ${member}, bem-vindo ao seu atendimento na Mecânica Rodeo. A nossa equipe ou os membros autorizados já vão te atender por aqui!\n\nPara fechar este atendimento a qualquer momento, clique no botão abaixo.`)
                    .setColor(0xE67E22);

                const closeRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('Fechar Atendimento')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒')
                );

                await ticketChannel.send({ content: `${member}`, embeds: [embedWelcome], components: [closeRow] });
                await interaction.editReply({ content: `✅ Seu ticket foi aberto com sucesso em ${ticketChannel}!` });

            } catch (error) {
                console.error('Erro ao criar canal de ticket:', error);
                await interaction.editReply({ content: '❌ Ocorreu um erro ao tentar criar o seu ticket. Verifique as permissões do bot.' });
            }
        }

        // Botão para fechar o ticket
        if (interaction.customId === 'close_ticket') {
            await interaction.reply({ content: '🔒 Este canal será fechado em 5 segundos...' });
            setTimeout(async () => {
                try {
                    await interaction.channel.delete();
                } catch (e) {
                    console.error('Erro ao deletar canal de ticket:', e);
                }
            }, 5000);
        }
    }
});

// Sistema de IA (Google Gemini) respondendo a menções
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // Se o bot for mencionado, ele usa o Gemini para responder com o contexto da oficina
    if (message.mentions.has(client.user)) {
        try {
            await message.channel.sendTyping();
            
            const prompt = message.content.replace(`<@!${client.user.id}>`, '').replace(`<@${client.user.id}>`, '').trim();
            
            if (!prompt) {
                return message.reply('Opa! Como posso ajudar na Mecânica Rodeo?');
            }

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    systemInstruction: "Você é o assistente virtual da Mecânica Rodeo, uma oficina de roleplay localizada no Grajaú, ao lado do Prédio da OAB. Seja prestativo, profissional e ajude os clientes e membros da oficina com suas dúvidas."
                }
            });

            await message.reply(response.text);
        } catch (error) {
            console.error('Erro ao falar com o Gemini:', error);
            await message.reply('Desculpe, tive um probleminha técnico ao processar sua resposta.');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
