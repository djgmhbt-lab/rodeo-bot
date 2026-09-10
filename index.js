const { Client, GatewayIntentBits, Collection, REST, Routes, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

// Importação e inicialização do Google Generative AI
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
    ],
});

client.commands = new Collection();
const commands = [];

// ==================== MAPEAMENTO DE IDS DA MECÂNICA RODEO ====================
const CATEGORIA_TICKETS_ID = '1547441588911738900'; // Categoria exata de tickets
const CARGO_MEMBROS_ID = '1547427424852115459';     // Cargo de Membros com acesso aos tickets
const CARGO_VERIFICADO_ID = '1547434977447125032';  // Cargo recebido após verificação
const CANAL_BOAS_VINDAS_ID = '1547427100602925087'; // Canal de boas-vindas

// Cargos da staff/atendimento da oficina
const CARGOS_ATENDIMENTO = ['Gerente', 'Mecânico Chefe', 'Mecânico'];
// =========================================================================

// Carregando comandos da pasta commands
const commandsDir = path.join(__dirname, 'commands');
if (fs.existsSync(commandsDir)) {
    const commandFiles = fs.readdirSync(commandsDir).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsDir, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            commands.push(command.data.toJSON());
        }
    }
}

client.once('ready', async () => {
    console.log(`Mecânica Rodeo Bot online e logado como ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands },
        );
        console.log('Comandos de barra (/) registrados com sucesso!');
    } catch (error) {
        console.error(error);
    }
});

// SISTEMA DE BOAS-VINDAS
client.on('guildMemberAdd', async member => {
    try {
        const canal = member.guild.channels.cache.get(CANAL_BOAS_VINDAS_ID);
        if (!canal) return;

        const embedWelcome = new EmbedBuilder()
            .setTitle('🚗 Novo Cidadão na Área!')
            .setDescription(`Olá ${member}, seja muito bem-vindo(a) à **Mecânica Rodeo**!\n\nEstamos localizados no **Grajaú, ao lado do Prédio da OAB**. Passe em nosso canal de verificação para liberar o seu acesso completo à cidade e à oficina!`)
            .setColor('#ff9900')
            .setTimestamp();

        await canal.send({ embeds: [embedWelcome] });
    } catch (err) {
        console.error('Erro no sistema de boas-vindas:', err);
    }
});

// SISTEMA DE MENSAGENS E IA (EXCLUSIVO DENTRO DOS TICKETS)
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // Verifica se a mensagem foi enviada dentro de um canal de ticket da categoria correta
    if (message.channel.parentId !== CATEGORIA_TICKETS_ID) return;

    await message.channel.sendTyping();

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `Você é o Assistente Virtual Oficial da "Mecânica Rodeo", uma oficina mecânica de Roleplay situada no Grajaú, ao lado do Prédio da OAB. 
        Você está conversando com um cliente/membro dentro de um canal de atendimento (ticket).
        Mantenha um tom profissional, prestativo, automotivo e amigável. Sempre reforce nossa localização se necessário.
        
        Mensagem do usuário: ${message.content}`;

        const result = await model.generateContent(prompt);
        await message.reply(result.response.text());
    } catch (error) {
        console.error("Erro na IA do ticket:", error);
    }
});

// SISTEMA DE INTERAÇÕES (VERIFICAÇÃO, MODAIS, TICKETS)
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Ocorreu um erro ao executar este comando!', ephemeral: true }).catch(() => {});
        }
    }
    else if (interaction.isButton()) {
        if (interaction.customId === 'fechar_ticket') {
            await interaction.reply({ content: '🔒 **Atendimento encerrado!** O canal será apagado em 5 segundos...', ephemeral: false });
            setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
        }
    }
    else if (interaction.isStringSelectMenu()) {
        const valor = interaction.values[0];
        const guild = interaction.guild;
        const member = interaction.member;

        // A. Menu de Verificação -> Abre Modal
        if (interaction.customId === 'verificar_tipo') {
            const modal = new ModalBuilder()
                .setCustomId(`modal_${valor}`)
                .setTitle(valor === 'cliente' ? 'Cadastro de Cliente' : 'Cadastro de Funcionário');

            const nomeInput = new TextInputBuilder()
                .setCustomId('nome_input')
                .setLabel('Nome (Ex: Nome_Sobrenome)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(nomeInput));
            return await interaction.showModal(modal);
        }

        // B. Menu de Tickets -> Cria Canal Privado na Categoria Correta
        if (interaction.customId === 'menu_tickets') {
            try {
                const nomesServicos = {
                    revisao: 'revisao',
                    orcamento: 'orcamento',
                    atendimento: 'atendimento',
                    contratos: 'contratos'
                };
                
                const servicoNome = nomesServicos[valor] || 'atendimento';
                const nomeCanal = `oficina-${servicoNome}-${member.user.username}`.toLowerCase().replace(/[^a-z0-9-_]/g, '');
                
                const permissionOverwrites = [
                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                    { id: CARGO_MEMBROS_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
                ];

                CARGOS_ATENDIMENTO.forEach(cargoNome => {
                    const cargoObj = guild.roles.cache.find(r => r.name === cargoNome);
                    if (cargoObj) {
                        permissionOverwrites.push({
                            id: cargoObj.id,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                        });
                    }
                });

                const novoCanal = await guild.channels.create({
                    name: nomeCanal,
                    type: ChannelType.GuildText,
                    parent: CATEGORIA_TICKETS_ID,
                    permissionOverwrites: permissionOverwrites
                });

                const embedTicket = new EmbedBuilder()
                    .setTitle(`🔧 Atendimento Mecânica Rodeo - ${valor.toUpperCase()}`)
                    .setColor('#ff9900')
                    .addFields(
                        { name: 'Cliente', value: `${member} (ID: ${member.id})`, inline: false },
                        { name: 'Serviço Solicitado', value: valor.toUpperCase(), inline: true },
                        { name: 'Status', value: 'Aguardando mecânico / IA', inline: true }
                    )
                    .setTimestamp();

                const rowBotoes = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('fechar_ticket').setLabel('Encerrar Atendimento').setStyle(ButtonStyle.Danger)
                );

                await interaction.reply({ content: `✅ Canal de atendimento criado: ${novoCanal}`, ephemeral: true });
                await novoCanal.send({ content: `Olá ${member}, nossa equipe ou assistente virtual já vai te atender na oficina **Mecânica Rodeo**, situada no **Grajaú, ao lado do Prédio da OAB**!`, embeds: [embedTicket], components: [rowBotoes] });

            } catch (err) {
                console.error(err);
                await interaction.reply({ content: 'Erro ao criar o canal de atendimento.', ephemeral: true });
            }
        }
    }
    else if (interaction.isModalSubmit()) {
        if (interaction.customId === 'modal_cliente' || interaction.customId === 'modal_funcionario') {
            const nome = interaction.fields.getTextInputValue('nome_input');
            if (!nome.includes('_')) {
                return interaction.reply({ content: '❌ Erro: O nome deve conter obrigatoriamente um "_" (Ex: Nome_Exemplo).', ephemeral: true });
            }

            try {
                await interaction.member.roles.add(CARGO_VERIFICADO_ID);
                await interaction.member.setNickname(nome);
            } catch (e) {
                console.error("Erro ao aplicar cargo ou apelido:", e);
            }

            return await interaction.reply({ content: `✅ Verificação concluída, **${nome}**! Cargo liberado com sucesso. Seja bem-vindo à Mecânica Rodeo!`, ephemeral: true });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);