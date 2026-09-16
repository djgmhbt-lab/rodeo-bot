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
const { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource, 
    AudioPlayerStatus 
} = require('@discordjs/voice');
const play = require('play-dl');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildVoiceStates
    ]
});

const GUILD_ID = process.env.GUILD_ID;
const CLIENT_ID = process.env.CLIENT_ID;
const TICKET_CATEGORY_ID = '1547601598694297651'; // Categoria de tickets
const WELCOME_CHANNEL_ID = '1547427100602925087'; // Canal de Boas-Vindas
const MUSIC_COMMAND_CHANNEL_ID = '1548001056762626271'; // Canal exclusivo para comandos de música
const VOICE_24H_CHANNEL_ID = '1548003127846903828'; // Canal de voz fixo 24h
const ROLE_CIDADAO_ID = '1547434977447125032'; // ID do cargo de Cidadão
const GIF_URL = 'https://media.discordapp.net/attachments/1534238274074317030/1547627243826716813/Adobe_Express_-_e23176d43d4545d0ab83078d199f1245.gif?ex=6aa41bb0&is=6aa2ca30&hm=57d2f0c603bb718d1ada78e24b96dbb588e14ec6196b285a63580d4b76df241a&=&width=512&height=512';

// Variáveis do sistema de música
let musicQueue = [];
let audioPlayer = createAudioPlayer();
let currentConnection = null;
let baseVoiceChannelId = VOICE_24H_CHANNEL_ID;

// Armazenamento do Sistema de Ponto (Ativos e Histórico Semanal)
const activePoints = new Map(); // userId -> timestamp de início
const weeklyReports = [];       // Lista de registros da semana

client.once('ready', async () => {
    console.log(`Bot online como ${client.user.tag}! Mecânica Rodeo operando com som automotivo e sistema de ponto.`);

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
                        { name: 'Tickets / Atendimento', value: 'tickets' },
                        { name: 'Painel de Ponto', value: 'ponto' }
                    )),

        new SlashCommandBuilder()
            .setName('play')
            .setDescription('Toca uma música do YouTube')
            .addStringOption(option =>
                option.setName('termo')
                    .setDescription('Nome ou link da música')
                    .setRequired(true)),

        new SlashCommandBuilder()
            .setName('skip')
            .setDescription('Pula para a próxima música da fila'),

        new SlashCommandBuilder()
            .setName('stop')
            .setDescription('Para a música e retorna o bot para o canal 24h')
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        console.log('Atualizando comandos de barra...');
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands },
        );
        console.log('Comandos registrados com sucesso!');
    } catch (error) {
        console.error('Erro ao registrar comandos:', error);
    }

    // Aguarda o cache carregar e conecta no canal 24h
    setTimeout(() => {
        connectToBaseVoiceChannel();
    }, 3000);

    // Inicializa o agendamento automático (Verifica a cada minuto)
    setInterval(() => {
        verificarRotinasAutomaticas();
    }, 60000);
});

// Funções de Tempo e Automações (23h59 e Domingo às 06h00)
function verificarRotinasAutomaticas() {
    const agora = new Date();
    const hora = agora.getHours();
    const minuto = agora.getMinutes();
    const diaSemana = agora.getDay(); // 0 = Domingo, 1 = Segunda, etc.

    // 1. Fechamento automático de pontos todos os dias às 23:59
    if (hora === 23 && minuto === 59) {
        if (activePoints.size > 0) {
            const tempoFechamento = Date.now();
            for (const [userId, startTime] of activePoints.entries()) {
                const duracaoMs = tempoFechamento - startTime;
                weeklyReports.push({ userId, startTime, endTime: tempoFechamento, duracaoMs });
            }
            activePoints.clear();
            console.log('[SISTEMA DE PONTO] Todos os pontos abertos foram encerrados automaticamente às 23:59.');
        }
    }

    // 2. Relatório automático todo Domingo às 06:00 da manhã
    if (diaSemana === 0 && hora === 6 && minuto === 0) {
        gerarRelatorioSemanalAutomatico();
    }
}

async function gerarRelatorioSemanalAutomatico() {
    try {
        const guild = client.guilds.cache.get(GUILD_ID);
        if (!guild) return;

        // Procura um canal adequado para enviar o relatório (ex: canal de comandos ou texto geral)
        const channel = guild.channels.cache.get(MUSIC_COMMAND_CHANNEL_ID) || guild.systemChannel;
        if (!channel) return;

        if (weeklyReports.length === 0) {
            await channel.send('📊 **Relatório Semanal de Pontos:** Nenhum ponto foi registrado nesta semana.');
            return;
        }

        // Agrupa os tempos por usuário
        const resumoUsuarios = {};
        for (const registro of weeklyReports) {
            if (!resumoUsuarios[registro.userId]) {
                resumoUsuarios[registro.userId] = 0;
            }
            resumoUsuarios[registro.userId] += registro.duracaoMs;
        }

        let descricao = '📊 **Relatório Semanal de Horas Trabalhadas (Mecânica Rodeo)**\n\n';
        for (const [userId, totalMs] of Object.entries(resumoUsuarios)) {
            const segundos = Math.floor(totalMs / 1000);
            const horas = Math.floor(segundos / 3600);
            const minutos = Math.floor((segundos % 3600) / 60);
            const segsRestantes = segundos % 60;

            descricao += `• <@${userId}>: **${horas}h ${minutos}m ${segsRestantes}s** trabalhadas.\n`;
        }

        const embedRelatorio = new EmbedBuilder()
            .setTitle('📈 Fechamento de Ponto Semanal')
            .setDescription(descricao)
            .setColor(0x2ECC71)
            .setTimestamp();

        await channel.send({ embeds: [embedRelatorio] });

        // Limpa o relatório da semana após enviar
        weeklyReports.length = 0;
    } catch (error) {
        console.error('Erro ao gerar relatório semanal automático:', error);
    }
}

async function connectToBaseVoiceChannel() {
    try {
        const guild = client.guilds.cache.get(GUILD_ID);
        if (!guild) return;

        const channel = await guild.channels.fetch(baseVoiceChannelId).catch(() => null);
        if (!channel) return;

        currentConnection = joinVoiceChannel({
            channelId: channel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
        });

        currentConnection.subscribe(audioPlayer);
        console.log(`Bot conectado com sucesso ao canal de voz 24h: ${channel.name}`);
    } catch (error) {
        console.error('Erro ao conectar no canal de voz 24h:', error);
    }
}

audioPlayer.on(AudioPlayerStatus.Idle, async () => {
    if (musicQueue.length > 0) {
        const nextSong = musicQueue.shift();
        playSong(nextSong);
    } else {
        setTimeout(() => {
            if (musicQueue.length === 0) {
                connectToBaseVoiceChannel();
            }
        }, 3000);
    }
});

async function playSong(songInfo) {
    try {
        const stream = await play.stream(songInfo.url);
        const resource = createAudioResource(stream.stream, { inputType: stream.type });
        audioPlayer.play(resource);
    } catch (error) {
        console.error('Erro ao reproduzir áudio:', error);
    }
}

client.on('guildMemberAdd', async member => {
    try {
        const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
        if (!channel) return;

        const embedWelcome = new EmbedBuilder()
            .setTitle('🤠 Novo Cidadão na Área - Mecânica Rodeo')
            .setDescription(`Seja muito bem-vindo(a) ao QG da **Mecânica Rodeo** (localizada no Grajaú, ao lado do Prédio da OAB), ${member}!\n\nAcesse nosso canal de verificação para registrar seu nome e ID na cidade, e abra um atendimento caso precise de algo. Aproveite a estadia!`)
            .setColor(0xE67E22)
            .setImage(GIF_URL);

        await channel.send({ content: `Fala ${member}, seja bem-vindo!`, embeds: [embedWelcome] });
    } catch (error) {
        console.error('Erro ao enviar mensagem de boas-vindas:', error);
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        const musicCommands = ['play', 'skip', 'stop'];
        if (musicCommands.includes(commandName) && interaction.channelId !== MUSIC_COMMAND_CHANNEL_ID) {
            return interaction.reply({ 
                content: `❌ Os comandos de música só podem ser utilizados no canal dedicado (<#${MUSIC_COMMAND_CHANNEL_ID}>)!`, 
                ephemeral: true 
            });
        }

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
                    .setColor(0xF1C40F)
                    .setImage(GIF_URL);

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
                    .setColor(0x3498DB)
                    .setImage(GIF_URL);

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

            else if (painelType === 'ponto') {
                const embedPonto = new EmbedBuilder()
                    .setTitle('⏱️ Mecânica Rodeo - Controle de Ponto')
                    .setDescription('Clique no botão abaixo para **Iniciar** o seu expediente ou **Fechar** o seu ponto e computar as suas horas trabalhadas.')
                    .setColor(0x1ABC9C)
                    .setImage(GIF_URL);

                const row = new ActionRowBuilder().addComponents(
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

                await interaction.reply({ content: 'Painel de ponto enviado!', ephemeral: true });
                await interaction.channel.send({ embeds: [embedPonto], components: [row] });
            }
        }

        else if (commandName === 'play') {
            const voiceChannel = interaction.member.voice.channel;
            if (!voiceChannel) {
                return interaction.reply({ content: '❌ Você precisa estar em um canal de voz para pedir música!', ephemeral: true });
            }

            const termo = interaction.options.getString('termo');
            await interaction.deferReply();

            try {
                let searchResults = await play.search(termo, { limit: 1 });
                if (!searchResults || searchResults.length === 0) {
                    return interaction.editReply('❌ Nenhuma música encontrada com esse termo.');
                }

                const song = searchResults[0];

                currentConnection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: interaction.guild.id,
                    adapterCreator: interaction.guild.voiceAdapterCreator,
                });
                currentConnection.subscribe(audioPlayer);

                if (audioPlayer.state.status === AudioPlayerStatus.Playing) {
                    musicQueue.push(song);
                    await interaction.editReply(`🎵 **Adicionado à fila:** \`${song.title}\``);
                } else {
                    playSong(song);
                    await interaction.editReply(`🎶 **Tocando agora:** \`${song.title}\``);
                }
            } catch (error) {
                console.error('Erro no comando play:', error);
                await interaction.editReply('❌ Ocorreu um erro ao tentar reproduzir a música.');
            }
        }

        else if (commandName === 'skip') {
            if (musicQueue.length > 0) {
                const nextSong = musicQueue.shift();
                playSong(nextSong);
                await interaction.reply({ content: '⏭️ Música pulada com sucesso!' });
            } else {
                audioPlayer.stop();
                connectToBaseVoiceChannel();
                await interaction.reply({ content: '⏹️ Fila vazia. O bot retornou ao canal 24h.' });
            }
        }

        else if (commandName === 'stop') {
            musicQueue = [];
            audioPlayer.stop();
            connectToBaseVoiceChannel();
            await interaction.reply({ content: '🛑 Música parada e bot retornado ao canal 24h base!' });
        }
    }

    // Interações do Sistema de Ponto (Botões)
    if (interaction.isButton()) {
        const userId = interaction.user.id;

        if (interaction.customId === 'btn_iniciar_ponto') {
            if (activePoints.has(userId)) {
                return interaction.reply({ content: '⚠️ Você já está com um ponto aberto! Feche-o antes de iniciar outro.', ephemeral: true });
            }

            activePoints.set(userId, Date.now());
            return interaction.reply({ content: '🟢 **Ponto iniciado com sucesso!** Bom expediente na Mecânica Rodeo.', ephemeral: true });
        }

        else if (interaction.customId === 'btn_fechar_ponto') {
            if (!activePoints.has(userId)) {
                return interaction.reply({ content: '❌ Você não possui nenhum ponto aberto no momento.', ephemeral: true });
            }

            const startTime = activePoints.get(userId);
            const endTime = Date.now();
            const duracaoMs = endTime - startTime;

            // Salva no relatório semanal
            weeklyReports.push({ userId, startTime, endTime, duracaoMs });
            activePoints.delete(userId);

            // Calcula horas, minutos e segundos
            const segundosTotal = Math.floor(duracaoMs / 1000);
            const horas = Math.floor(segundosTotal / 3600);
            const minutos = Math.floor((segundosTotal % 3600) / 60);
            const segundos = segundosTotal % 60;

            return interaction.reply({ 
                content: `🔴 **Ponto fechado com sucesso!**\n⏱️ Tempo em expediente: **${horas} hora(s), ${minutos} minuto(s) e ${segundos} segundo(s)**.`, 
                ephemeral: true 
            });
        }
    }

    if (interaction.isButton() && interaction.customId === 'btn_abrir_verificacao') {
        const modal = new ModalBuilder()
            .setCustomId('modal_verificacao')
            .setTitle('Formulário de Verificação');

        const nomeInput = new TextInputBuilder()
            .setCustomId('input_nome')
            .setLabel('Nome (RG / Personagem)')
            .setPlaceholder('Ex: Gatusso_Silva')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const idInput = new TextInputBuilder()
            .setCustomId('input_id')
            .setLabel('ID na Cidade (Nacional RP)')
            .setPlaceholder('Ex: 1234')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(nomeInput),
            new ActionRowBuilder().addComponents(idInput)
        );

        await interaction.showModal(modal);
    }

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

    if (interaction.isModalSubmit() && interaction.customId === 'modal_verificacao') {
        const nome = interaction.fields.getTextInputValue('input_nome').trim();
        const idCidade = interaction.fields.getTextInputValue('input_id').trim();
        const member = interaction.member;

        if (!nome.includes('_')) {
            return interaction.reply({ 
                content: `❌ **Verificação negada!** O seu nome no formato RP deve conter obrigatoriamente o underline (\`_\`), seguindo o padrão da cidade (Ex: \`Gatusso_Silva\`). Tente novamente.`, 
                ephemeral: true 
            });
        }

        const novoApelido = `${nome} | ${idCidade}`;

        try {
            await member.setNickname(novoApelido);
            await member.roles.add(ROLE_CIDADAO_ID);

            await interaction.reply({ 
                content: `✅ Verificação concluída com sucesso! Seu apelido foi alterado para **${novoApelido}**, o cargo de Cidadão foi atribuído e seu acesso foi liberado.`, 
                ephemeral: true 
            });
        } catch (error) {
            console.error('Erro ao processar verificação:', error);
            await interaction.reply({ 
                content: `⚠️ Seus dados passaram na validação, mas ocorreu um erro ao aplicar o cargo ou alterar o apelido (Lembre-se que o bot não pode alterar o apelido do Dono do Servidor).`, 
                ephemeral: true 
            });
        }
    }

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

client.login(process.env.DISCORD_TOKEN);
