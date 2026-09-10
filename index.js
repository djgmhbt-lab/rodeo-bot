const { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ChannelType, 
    PermissionsBitField 
} = require('discord.js');
const { GoogleGenAI } = require('@google/genai');

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

const GUILD_ID = process.env.GUILD_ID;
const CLIENT_ID = process.env.CLIENT_ID;
const TICKET_CATEGORY_ID = '1547601598694297651'; // Categoria configurada para os tickets

client.once('ready', async () => {
    console.log(`Bot online como ${client.user.tag}! Mecânica Rodeo operando.`);

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
                    .setDescription('Bem-vindo à Mecânica Rodeo!\n\nClique no botão abaixo para preencher seus dados (Nome e ID) e liberar o seu acesso e alteração automática de apelido no servidor.')
                    .setColor(0xF1C40F);

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('btn_abrir_verificacao')
                        .setLabel('Fazer Verificação')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('✔️')
                );

                await interaction.reply({ content: 'Painel de verificação enviado!', ephemeral: true });
                await interaction.channel.send({ embeds: [embedVerif], components: [row] });
            } 
            
            else if (painelType === 'tickets') {
                const embedTicket = new EmbedBuilder()
                    .setTitle('🛠️ Mecânica Rodeo - Central de Atendimento')
                    .setDescription('Bem-vindo ao sistema de atendimento da Mecânica Rodeo!\n\nSelecione uma das opções abaixo no menu suspenso para abrir o seu atendimento privado.')
                    .setColor(0x3498DB);

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('select_ticket')
                    .setPlaceholder('Selecione o tipo de atendimento...')
                    .addOptions([
                        {
                            label: 'Marcar Revisão',
                            description: 'Agende uma revisão completa para o seu veículo.',
                            value: 'revisao',
                            emoji: '🚗'
                        },
                        {
                            label: 'Solicitar Orçamento',
                            description: 'Peça um orçamento de conserto ou peças.',
                            value: 'orcamento',
                            emoji: '💰'
                        },
                        {
                            label: 'Atendimento Geral',
                            description: 'Tire dúvidas ou fale com nossa equipe.',
                            value: 'atendimento',
                            emoji: '📞'
                        },
                        {
                            label: 'Contratos e Parcerias',
                            description: 'Assuntos relacionados a parcerias e contratos.',
                            value: 'contratos',
                            emoji: '📄'
                        }
                    ]);

                const row = new ActionRowBuilder().addComponents(selectMenu);

                await interaction.reply({ content: 'Painel de tickets enviado!', ephemeral: true });
                await interaction.channel.send({ embeds: [embedTicket], components: [row] });
            }
        }
    }

    // 2. Abertura do Formulário (Modal) de Verificação por Botão
    if (interaction.isButton() && interaction.customId === 'btn_abrir_verificacao') {
        const modal = new ModalBuilder()
            .setCustomId('modal_verificacao')
            .setTitle('Formulário de Verificação');

        const nomeInput = new TextInputBuilder()
            .setCustomId('input_nome')
            .setLabel('Nome (RG / Personagem)')
            .setPlaceholder('Ex: Augusto Canabarro')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const idInput = new TextInputBuilder()
            .setCustomId('input_id')
            .setLabel('ID na Cidade')
            .setPlaceholder('Ex: 1234')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(nomeInput),
            new ActionRowBuilder().addComponents(idInput)
        );

        await interaction.showModal(modal);
    }

    // 3. Tratamento do Menu Suspenso de Tickets
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_ticket') {
        const tipo = interaction.values[0];
        const guild = interaction.guild;
        const member = interaction.member;

        await interaction.deferReply({ ephemeral: true });

        try {
            const ticketChannel = await guild.channels.create({
                name: `ticket-${tipo}-${member.user.username}`,
                type: ChannelType.GuildText,
                parent: TICKET_CATEGORY_ID,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionsBitField.Flags.ViewChannel],
                    },
                    {
                        id: member.id,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages,
                            PermissionsBitField.Flags.ReadMessageHistory
                        ],
                    },
                    {
                        id: client.user.id,
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

    // 4. Recebimento dos dados do Modal de Verificação (Alteração de Apelido)
    if (interaction.isModalSubmit() && interaction.customId === 'modal_verificacao') {
        const nome = interaction.fields.getTextInputValue('input_nome');
        const idCidade = interaction.fields.getTextInputValue('input_id');
        const member = interaction.member;

        // Formata o apelido novo (Ex: "Augusto | 1234")
        const novoApelido = `${nome} | ${idCidade}`;

        try {
            await member.setNickname(novoApelido);
            await interaction.reply({ 
                content: `✅ Verificação concluída com sucesso! Seu apelido foi alterado para **${novoApelido}** e seu acesso foi liberado.`, 
                ephemeral: true 
            });
        } catch (error) {
            console.error('Erro ao alterar apelido:', error);
            await interaction.reply({ 
                content: `⚠️ Seus dados foram salvos, mas não consegui alterar seu apelido automaticamente (provavelmente meu cargo está abaixo do seu na hierarquia do Discord).`, 
                ephemeral: true 
            });
        }
    }

    // 5. Botão para fechar o ticket
    if (interaction.isButton() && interaction.customId === 'close_ticket') {
        await interaction.reply({ content: '🔒 Este canal será fechado em 5 segundos...' });
        setTimeout(async () => {
            try {
                await interaction.channel.delete();
            } catch (e) {
                console.error('Erro ao deletar canal de ticket:', e);
            }
        }, 5000);
    }
});

// Sistema de IA (Google Gemini) respondendo a menções
client.on('messageCreate', async message => {
    if (message.author.bot) return;

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
