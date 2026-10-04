const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} = require("discord.js");

const express = require("express");
const fs = require("fs");
const path = require("path");

// =====================================================
// 🌸 AKARI BOT
// =====================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildInvites
    ],
    partials: [
        Partials.GuildMember,
        Partials.Channel,
        Partials.Message
    ]
});

const PREFIX = "M";
const PORT = process.env.PORT || 3000;
const TOKEN = process.env.DISCORD_TOKEN;

// 🔐 Clave para conectar Akari Web con Akari Bot
const BOT_API_KEY = process.env.BOT_API_KEY;

const DATA_FILE = path.join(__dirname, "akari-data.json");

// =====================================================
// 💾 DATOS
// =====================================================

let data = {
    guilds: {},
    users: {}
};

if (fs.existsSync(DATA_FILE)) {
    try {
        data = JSON.parse(
            fs.readFileSync(DATA_FILE, "utf8")
        );
    } catch {
        console.log("⚠️ Error leyendo akari-data.json.");
    }
}

if (!data.guilds) data.guilds = {};
if (!data.users) data.users = {};

function saveData() {
    fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(data, null, 2)
    );
}

// =====================================================
// ⚙️ CONFIGURACIÓN
// =====================================================

function defaultGuildConfig() {
    return {
        welcome: {
            enabled: true,
            channel: null,
            message:
                "🌸 ¡Bienvenido/a {member} a **{guild}**! 💗\n" +
                "✨ Ahora somos **{memberCount}** miembros."
        },

        invites: {
            enabled: true,
            channel: null
        },

        economy: {
            work: {
                time: 30 * 60 * 1000,
                min: 300,
                max: 500
            },

            slut: {
                time: 60 * 60 * 1000,
                min: 300,
                max: 1000,
                winChance: 20
            },

            crime: {
                time: 2 * 60 * 60 * 1000,
                min: 300,
                max: 1000,
                winChance: 20
            },

            rob: {
                time: 30 * 60 * 1000,
                winChance: 30
            }
        }
    };
}

function getGuildConfig(guildId) {
    if (!data.guilds[guildId]) {
        data.guilds[guildId] =
            defaultGuildConfig();

        saveData();
    }

    return data.guilds[guildId];
}

// =====================================================
// 👤 USUARIOS
// =====================================================

function getUser(userId, guildId) {
    if (!data.users[guildId]) {
        data.users[guildId] = {};
    }

    if (!data.users[guildId][userId]) {
        data.users[guildId][userId] = {
            money: 0,

            cooldowns: {
                work: 0,
                slut: 0,
                crime: 0,
                rob: 0,
                daily: 0
            }
        };
    }

    return data.users[guildId][userId];
}

// =====================================================
// ⏱️ TIEMPO
// =====================================================

function formatTime(ms) {
    if (ms <= 0) return "Ahora";

    let seconds = Math.ceil(ms / 1000);

    const days = Math.floor(seconds / 86400);
    seconds %= 86400;

    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;

    const minutes = Math.floor(seconds / 60);
    seconds %= 60;

    const parts = [];

    if (days) parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);

    if (seconds && parts.length < 3) {
        parts.push(`${seconds}s`);
    }

    return parts.join(" ");
}

// =====================================================
// 💰 DINERO ALEATORIO
// =====================================================

function randomMoney(min, max) {
    return Math.floor(
        Math.random() * (max - min + 1)
    ) + min;
}

// =====================================================
// 🌸 EMBED AKARI
// =====================================================

function akariEmbed(title, description) {
    return new EmbedBuilder()
        .setColor("#ff9dcc")
        .setTitle(`🌸 ${title}`)
        .setDescription(description)
        .setFooter({
            text: "Akari Bot 🌸"
        })
        .setTimestamp();
}

// =====================================================
// 🌸 BIENVENIDAS
// =====================================================

client.on("guildMemberAdd", async member => {
    try {
        const config =
            getGuildConfig(member.guild.id);

        if (!config.welcome.enabled) return;
        if (!config.welcome.channel) return;

        const channel =
            member.guild.channels.cache.get(
                config.welcome.channel
            );

        if (!channel) return;

        let message =
            config.welcome.message
                .replace(
                    /{member}/g,
                    `<@${member.id}>`
                )
                .replace(
                    /{guild}/g,
                    member.guild.name
                )
                .replace(
                    /{memberCount}/g,
                    member.guild.memberCount
                );

        const embed = new EmbedBuilder()
            .setColor("#ff9dcc")
            .setTitle("🌸 ¡Nueva bienvenida!")
            .setDescription(message)
            .setThumbnail(
                member.user.displayAvatarURL({
                    dynamic: true
                })
            )
            .setFooter({
                text: "Akari Bot 🌸"
            })
            .setTimestamp();

        await channel.send({
            embeds: [embed]
        });

    } catch (error) {
        console.log(
            "❌ Error en bienvenida:",
            error
        );
    }
});

// =====================================================
// 💌 INVITES
// =====================================================

const inviteCache = new Map();

client.once("ready", async () => {
    console.log(
        `🌸 ${client.user.tag} está conectado correctamente.`
    );

    client.user.setPresence({
        activities: [
            {
                name: "Akari Bot 🌸"
            }
        ],
        status: "online"
    });

    for (const guild of client.guilds.cache.values()) {
        try {
            const invites =
                await guild.invites.fetch();

            inviteCache.set(
                guild.id,
                new Map(
                    invites.map(invite => [
                        invite.code,
                        invite.uses
                    ])
                )
            );

        } catch (error) {
            console.log(
                `⚠️ No se pudieron cargar invites de ${guild.name}.`
            );
        }
    }
});

// =====================================================
// 💌 DETECTAR INVITE
// =====================================================

client.on("guildMemberAdd", async member => {
    try {
        const config =
            getGuildConfig(member.guild.id);

        if (!config.invites.enabled) return;

        const oldInvites =
            inviteCache.get(member.guild.id);

        const newInvites =
            await member.guild.invites.fetch();

        const usedInvite =
            newInvites.find(invite => {
                const oldUses =
                    oldInvites?.get(invite.code) || 0;

                return invite.uses > oldUses;
            });

        inviteCache.set(
            member.guild.id,
            new Map(
                newInvites.map(invite => [
                    invite.code,
                    invite.uses
                ])
            )
        );

        if (!usedInvite) return;
        if (!config.invites.channel) return;

        const channel =
            member.guild.channels.cache.get(
                config.invites.channel
            );

        if (!channel) return;

        const inviter =
            usedInvite.inviter;

        const embed = new EmbedBuilder()
            .setColor("#ff9dcc")
            .setTitle("💌 Nueva invitación")
            .setDescription(
                `🌸 **${member.user.tag}** entró al servidor.\n\n` +
                `💗 Invitado por: ${
                    inviter
                        ? `<@${inviter.id}>`
                        : "Desconocido"
                }\n\n` +
                `🔗 Invitaciones usadas: **${
                    usedInvite.uses
                }**`
            )
            .setThumbnail(
                member.user.displayAvatarURL({
                    dynamic: true
                })
            )
            .setFooter({
                text: "Akari Bot 🌸"
            })
            .setTimestamp();

        await channel.send({
            embeds: [embed]
        });

    } catch (error) {
        console.log(
            "❌ Error detectando invite:",
            error
        );
    }
});

// =====================================================
// 💰 WORK
// =====================================================

async function workCommand(message, config, user) {
    const now = Date.now();
    const settings = config.economy.work;

    if (user.cooldowns.work > now) {
        return message.reply({
            embeds: [
                akariEmbed(
                    "Work ⏳",
                    `Ya trabajaste recientemente.\n\n` +
                    `Podrás volver a usar **Mwork** en **${formatTime(
                        user.cooldowns.work - now
                    )}**.`
                )
            ]
        });
    }

    const amount =
        randomMoney(
            settings.min,
            settings.max
        );

    user.money += amount;
    user.cooldowns.work =
        now + settings.time;

    saveData();

    return message.reply({
        embeds: [
            akariEmbed(
                "¡Trabajo completado! 🌷",
                `✨ Trabajaste y ganaste **${amount} monedas**.\n\n` +
                `💰 Dinero actual: **${user.money}**`
            )
        ]
    });
}

// =====================================================
// 🎀 SLUT / COMANDO DE RIESGO
// =====================================================

async function slutCommand(message, config, user) {
    const now = Date.now();
    const settings = config.economy.slut;

    if (user.cooldowns.slut > now) {
        return message.reply({
            embeds: [
                akariEmbed(
                    "Slut ⏳",
                    `Debes esperar **${formatTime(
                        user.cooldowns.slut - now
                    )}**.`
                )
            ]
        });
    }

    const amount =
        randomMoney(
            settings.min,
            settings.max
        );

    const won =
        Math.random() * 100 <
        settings.winChance;

    user.cooldowns.slut =
        now + settings.time;

    if (won) {
        user.money += amount;

        saveData();

        return message.reply({
            embeds: [
                akariEmbed(
                    "¡Ganaste! 🎀",
                    `✨ La apuesta salió bien.\n\n` +
                    `💰 Ganaste **${amount} monedas**.\n` +
                    `📊 Probabilidad: **${settings.winChance}%**\n\n` +
                    `💳 Dinero actual: **${user.money}**`
                )
            ]
        });

    } else {
        const loss =
            Math.min(
                amount,
                user.money
            );

        user.money -= loss;

        saveData();

        return message.reply({
            embeds: [
                akariEmbed(
                    "Perdiste 💔",
                    `🌸 Esta vez no tuviste suerte.\n\n` +
                    `💸 Perdiste **${loss} monedas**.\n` +
                    `📊 Probabilidad: **${settings.winChance}%**\n\n` +
                    `💳 Dinero actual: **${user.money}**`
                )
            ]
        });
    }
}

// =====================================================
// 🔪 CRIME
// =====================================================

async function crimeCommand(message, config, user) {
    const now = Date.now();
    const settings = config.economy.crime;

    if (user.cooldowns.crime > now) {
        return message.reply({
            embeds: [
                akariEmbed(
                    "Crime ⏳",
                    `Debes esperar **${formatTime(
                        user.cooldowns.crime - now
                    )}**.`
                )
            ]
        });
    }

    const amount =
        randomMoney(
            settings.min,
            settings.max
        );

    const won =
        Math.random() * 100 <
        settings.winChance;

    user.cooldowns.crime =
        now + settings.time;

    if (won) {
        user.money += amount;

        saveData();

        return message.reply({
            embeds: [
                akariEmbed(
                    "¡Crime exitoso! 🔪",
                    `✨ La operación salió bien.\n\n` +
                    `💰 Ganaste **${amount} monedas**.\n` +
                    `📊 Probabilidad: **${settings.winChance}%**\n\n` +
                    `💳 Dinero actual: **${user.money}**`
                )
            ]
        });

    } else {
        const loss =
            Math.min(
                amount,
                user.money
            );

        user.money -= loss;

        saveData();

        return message.reply({
            embeds: [
                akariEmbed(
                    "Crime fallido 💔",
                    `La operación no salió bien.\n\n` +
                    `💸 Perdiste **${loss} monedas**.\n` +
                    `📊 Probabilidad: **${settings.winChance}%**\n\n` +
                    `💳 Dinero actual: **${user.money}**`
                )
            ]
        });
    }
}

// =====================================================
// 🥷 ROB
// =====================================================

async function robCommand(message, config, user) {
    const now = Date.now();
    const settings = config.economy.rob;

    if (user.cooldowns.rob > now) {
        return message.reply({
            embeds: [
                akariEmbed(
                    "Rob ⏳",
                    `Debes esperar **${formatTime(
                        user.cooldowns.rob - now
                    )}**.`
                )
            ]
        });
    }

    user.cooldowns.rob =
        now + settings.time;

    const won =
        Math.random() * 100 <
        settings.winChance;

    if (!won) {
        saveData();

        return message.reply({
            embeds: [
                akariEmbed(
                    "Rob fallido 💔",
                    `No pudiste conseguir dinero esta vez.\n\n` +
                    `📊 Probabilidad de éxito: **${settings.winChance}%**`
                )
            ]
        });
    }

    const amount =
        randomMoney(100, 500);

    user.money += amount;

    saveData();

    return message.reply({
        embeds: [
            akariEmbed(
                "¡Rob exitoso! 🥷",
                `✨ Conseguías **${amount} monedas**.\n\n` +
                `📊 Probabilidad de éxito: **${settings.winChance}%**\n\n` +
                `💳 Dinero actual: **${user.money}**`
            )
        ]
    });
}

// =====================================================
// 💳 BALANCE
// =====================================================

async function balanceCommand(message, user) {
    return message.reply({
        embeds: [
            akariEmbed(
                "Tu balance 💰",
                `👤 Usuario: ${message.author}\n\n` +
                `💳 Dinero: **${user.money} monedas**`
            )
        ]
    });
}

// =====================================================
// 🎁 DAILY
// =====================================================

async function dailyCommand(message, user) {
    const now = Date.now();

    if (!user.cooldowns.daily) {
        user.cooldowns.daily = 0;
    }

    if (user.cooldowns.daily > now) {
        return message.reply({
            embeds: [
                akariEmbed(
                    "Daily ⏳",
                    `Ya reclamaste tu recompensa.\n\n` +
                    `Podrás volver en **${formatTime(
                        user.cooldowns.daily - now
                    )}**.`
                )
            ]
        });
    }

    const amount = 500;

    user.money += amount;

    user.cooldowns.daily =
        now + 24 * 60 * 60 * 1000;

    saveData();

    return message.reply({
        embeds: [
            akariEmbed(
                "Recompensa diaria 🌸",
                `🎁 Recibiste **${amount} monedas**.\n\n` +
                `💳 Dinero actual: **${user.money}**`
            )
        ]
    });
}

// =====================================================
// 🌸 MHELP
// =====================================================

function createHelpMenu() {
    return new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("akari_help")
                .setPlaceholder(
                    "🌸 Selecciona una categoría"
                )
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel("Economía")
                        .setDescription(
                            "Comandos de economía"
                        )
                        .setEmoji("💰")
                        .setValue("economia"),

                    new StringSelectMenuOptionBuilder()
                        .setLabel("Información")
                        .setDescription(
                            "Información de Akari Bot"
                        )
                        .setEmoji("🌸")
                        .setValue("informacion"),

                    new StringSelectMenuOptionBuilder()
                        .setLabel("Utilidades")
                        .setDescription(
                            "Comandos útiles"
                        )
                        .setEmoji("🛠️")
                        .setValue("utilidades")
                )
        );
}

function helpMainEmbed() {
    return akariEmbed(
        "Akari Bot — Ayuda 🌸",
        "Bienvenido/a al centro de ayuda de **Akari Bot**.\n\n" +
        "Selecciona una categoría en el menú para ver sus comandos.\n\n" +
        "💰 **Economía**\n" +
        "🌸 **Información**\n" +
        "🛠️ **Utilidades**"
    );
}

function helpCategoryEmbed(category) {
    if (category === "economia") {
        return akariEmbed(
            "Economía 💰",
            "**Mwork**\n" +
            "Trabaja y gana monedas.\n\n" +

            "**Mslut**\n" +
            "Comando de riesgo con probabilidad de ganar o perder dinero.\n\n" +

            "**Mcrime**\n" +
            "Intenta conseguir dinero mediante un comando de riesgo.\n\n" +

            "**Mrob**\n" +
            "Intenta conseguir monedas mediante un robo.\n\n" +

            "**Mbalance**\n" +
            "Muestra tu dinero.\n\n" +

            "**Mdaily**\n" +
            "Reclama tu recompensa diaria."
        );
    }

    if (category === "informacion") {
        return akariEmbed(
            "Información 🌸",
            "**Mhelp**\n" +
            "Abre el menú de ayuda.\n\n" +

            "**Mbot**\n" +
            "Muestra información del bot.\n\n" +

            "**Mserver**\n" +
            "Muestra información del servidor."
        );
    }

    if (category === "utilidades") {
        return akariEmbed(
            "Utilidades 🛠️",
            "**Mavatar**\n" +
            "Muestra tu avatar.\n\n" +

            "**Mping**\n" +
            "Muestra la latencia del bot."
        );
    }

    return helpMainEmbed();
}

// =====================================================
// 🎮 INTERACCIONES
// =====================================================

client.on("interactionCreate", async interaction => {
    if (!interaction.isStringSelectMenu()) return;

    if (interaction.customId !== "akari_help") {
        return;
    }

    const category =
        interaction.values[0];

    await interaction.update({
        embeds: [
            helpCategoryEmbed(category)
        ],
        components: [
            createHelpMenu()
        ]
    });
});

// =====================================================
// 💬 MENSAJES / COMANDOS
// =====================================================

client.on("messageCreate", async message => {
    if (message.author.bot) return;
    if (!message.guild) return;

    if (!message.content.startsWith(PREFIX)) {
        return;
    }

    const args =
        message.content
            .slice(PREFIX.length)
            .trim()
            .split(/\s+/);

    const command =
        args.shift()?.toLowerCase();

    if (!command) return;

    const config =
        getGuildConfig(
            message.guild.id
        );

    const user =
        getUser(
            message.author.id,
            message.guild.id
        );

    if (command === "help") {
        return message.reply({
            embeds: [
                helpMainEmbed()
            ],
            components: [
                createHelpMenu()
            ]
        });
    }

    if (command === "work") {
        return workCommand(
            message,
            config,
            user
        );
    }

    if (command === "slut") {
        return slutCommand(
            message,
            config,
            user
        );
    }

    if (command === "crime") {
        return crimeCommand(
            message,
            config,
            user
        );
    }

    if (command === "rob") {
        return robCommand(
            message,
            config,
            user
        );
    }

    if (
        command === "balance" ||
        command === "bal"
    ) {
        return balanceCommand(
            message,
            user
        );
    }

    if (command === "daily") {
        return dailyCommand(
            message,
            user
        );
    }

    if (command === "bot") {
        return message.reply({
            embeds: [
                akariEmbed(
                    "Akari Bot 🌸",
                    `🤖 Bot: **${client.user.username}**\n` +
                    `🌸 Servidores: **${client.guilds.cache.size}**\n` +
                    `👥 Usuarios: **${client.users.cache.size}**`
                )
            ]
        });
    }

    if (command === "server") {
        return message.reply({
            embeds: [
                akariEmbed(
                    "Información del servidor 🌸",
                    `🌸 Servidor: **${message.guild.name}**\n` +
                    `👥 Miembros: **${message.guild.memberCount}**`
                )
            ]
        });
    }

    if (command === "ping") {
        return message.reply({
            embeds: [
                akariEmbed(
                    "Pong! 🌸",
                    `🏓 Latencia: **${client.ws.ping}ms**`
                )
            ]
        });
    }

    if (command === "avatar") {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor("#ff9dcc")
                    .setTitle("🌸 Avatar")
                    .setImage(
                        message.author.displayAvatarURL({
                            size: 1024,
                            extension: "png"
                        })
                    )
            ]
        });
    }
});

// =====================================================
// 🌐 API PARA AKARI WEB
// =====================================================

const app = express();

app.use(express.json());

// -----------------------------------------------------
// 🔐 Comprobar API KEY
// -----------------------------------------------------

function checkApiKey(req, res, next) {
    if (!BOT_API_KEY) {
        return res.status(500).json({
            success: false,
            message: "BOT_API_KEY no está configurada."
        });
    }

    const auth =
        req.headers.authorization || "";

    const receivedKey =
        auth.startsWith("Bearer ")
            ? auth.slice(7)
            : "";

    if (
        !receivedKey ||
        receivedKey !== BOT_API_KEY
    ) {
        return res.status(401).json({
            success: false,
            message: "No autorizado."
        });
    }

    next();
}

// -----------------------------------------------------
// 🌸 Obtener servidor para la web
// -----------------------------------------------------

function getWebGuild() {
    const guild =
        client.guilds.cache.first();

    if (!guild) return null;

    return guild;
}

// -----------------------------------------------------
// 📥 GET /api/config
// -----------------------------------------------------

app.get(
    "/api/config",
    checkApiKey,
    (req, res) => {

        const guild =
            getWebGuild();

        if (!guild) {
            return res.status(404).json({
                success: false,
                message:
                    "Akari Bot todavía no está en ningún servidor."
            });
        }

        const config =
            getGuildConfig(guild.id);

        res.json({
            success: true,

            guild: {
                id: guild.id,
                name: guild.name
            },

            economy: {
                work: {
                    time: config.economy.work.time,
                    min: config.economy.work.min,
                    max: config.economy.work.max
                },

                slut: {
                    time: config.economy.slut.time,
                    min: config.economy.slut.min,
                    max: config.economy.slut.max,
                    winChance:
                        config.economy.slut.winChance
                },

                crime: {
                    time: config.economy.crime.time,
                    min: config.economy.crime.min,
                    max: config.economy.crime.max,
                    winChance:
                        config.economy.crime.winChance
                },

                rob: {
                    time: config.economy.rob.time,
                    winChance:
                        config.economy.rob.winChance
                }
            }
        });
    }
);

// -----------------------------------------------------
// 📤 POST /api/config
// -----------------------------------------------------

app.post(
    "/api/config",
    checkApiKey,
    (req, res) => {

        const guild =
            getWebGuild();

        if (!guild) {
            return res.status(404).json({
                success: false,
                message:
                    "Akari Bot todavía no está en ningún servidor."
            });
        }

        const config =
            getGuildConfig(guild.id);

        const incoming =
            req.body?.economy;

        if (!incoming) {
            return res.status(400).json({
                success: false,
                message:
                    "No se recibió la configuración de economía."
            });
        }

        // -------------------------------------------------
        // 💼 WORK
        // -------------------------------------------------

        if (incoming.work) {

            if (
                typeof incoming.work.time === "string" &&
                incoming.work.time.trim()
            ) {
                const parsed =
                    parseDuration(
                        incoming.work.time
                    );

                if (parsed !== null) {
                    config.economy.work.time =
                        parsed;
                }
            }

            if (
                Number.isFinite(
                    Number(incoming.work.min)
                )
            ) {
                config.economy.work.min =
                    Math.max(
                        0,
                        Number(incoming.work.min)
                    );
            }

            if (
                Number.isFinite(
                    Number(incoming.work.max)
                )
            ) {
                config.economy.work.max =
                    Math.max(
                        config.economy.work.min,
                        Number(incoming.work.max)
                    );
            }
        }

        // -------------------------------------------------
        // 🎲 SLUT
        // -------------------------------------------------

        if (incoming.slut) {

            if (
                typeof incoming.slut.time === "string" &&
                incoming.slut.time.trim()
            ) {
                const parsed =
                    parseDuration(
                        incoming.slut.time
                    );

                if (parsed !== null) {
                    config.economy.slut.time =
                        parsed;
                }
            }

            if (
                Number.isFinite(
                    Number(incoming.slut.min)
                )
            ) {
                config.economy.slut.min =
                    Math.max(
                        0,
                        Number(incoming.slut.min)
                    );
            }

            if (
                Number.isFinite(
                    Number(incoming.slut.max)
                )
            ) {
                config.economy.slut.max =
                    Math.max(
                        config.economy.slut.min,
                        Number(incoming.slut.max)
                    );
            }

            if (
                Number.isFinite(
                    Number(incoming.slut.winChance)
                )
            ) {
                config.economy.slut.winChance =
                    Math.min(
                        100,
                        Math.max(
                            0,
                            Number(
                                incoming.slut.winChance
                            )
                        )
                    );
            }
        }

        // -------------------------------------------------
        // 🔪 CRIME
        // -------------------------------------------------

        if (incoming.crime) {

            if (
                typeof incoming.crime.time === "string" &&
                incoming.crime.time.trim()
            ) {
                const parsed =
                    parseDuration(
                        incoming.crime.time
                    );

                if (parsed !== null) {
                    config.economy.crime.time =
                        parsed;
                }
            }

            if (
                Number.isFinite(
                    Number(incoming.crime.min)
                )
            ) {
                config.economy.crime.min =
                    Math.max(
                        0,
                        Number(incoming.crime.min)
                    );
            }

            if (
                Number.isFinite(
                    Number(incoming.crime.max)
                )
            ) {
                config.economy.crime.max =
                    Math.max(
                        config.economy.crime.min,
                        Number(incoming.crime.max)
                    );
            }

            if (
                Number.isFinite(
                    Number(incoming.crime.winChance)
                )
            ) {
                config.economy.crime.winChance =
                    Math.min(
                        100,
                        Math.max(
                            0,
                            Number(
                                incoming.crime.winChance
                            )
                        )
                    );
            }
        }

        // -------------------------------------------------
        // 🥷 ROB
        // -------------------------------------------------

        if (incoming.rob) {

            if (
                typeof incoming.rob.time === "string" &&
                incoming.rob.time.trim()
            ) {
                const parsed =
                    parseDuration(
                        incoming.rob.time
                    );

                if (parsed !== null) {
                    config.economy.rob.time =
                        parsed;
                }
            }

            if (
                Number.isFinite(
                    Number(incoming.rob.winChance)
                )
            ) {
                config.economy.rob.winChance =
                    Math.min(
                        100,
                        Math.max(
                            0,
                            Number(
                                incoming.rob.winChance
                            )
                        )
                    );
            }
        }

        saveData();

        return res.json({
            success: true,
            message:
                "Configuración guardada correctamente."
        });
    }
);

// =====================================================
// ⏱️ CONVERTIR TIEMPOS
// =====================================================

function parseDuration(value) {

    if (
        typeof value !== "string" ||
        !value.trim()
    ) {
        return null;
    }

    const text =
        value.trim().toLowerCase();

    const match =
        text.match(
            /^(\d+(?:\.\d+)?)\s*(s|m|h|d)$/
        );

    if (!match) {
        return null;
    }

    const number =
        Number(match[1]);

    const unit =
        match[2];

    if (!Number.isFinite(number)) {
        return null;
    }

    const multipliers = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000
    };

    return Math.max(
        1000,
        Math.round(
            number * multipliers[unit]
        )
    );
}

// =====================================================
// 🌐 RUTA PRINCIPAL
// =====================================================

app.get("/", (req, res) => {
    res.send(
        "🌸 Akari Bot está funcionando correctamente."
    );
});

// =====================================================
// 🚀 SERVIDOR HTTP
// =====================================================

app.listen(PORT, () => {
    console.log(
        `🌐 Servidor HTTP activo en el puerto ${PORT}`
    );
});

// =====================================================
// 🚀 LOGIN DISCORD
// =====================================================

if (!TOKEN) {

    console.error(
        "❌ Falta la variable DISCORD_TOKEN en Render."
    );

} else {

    client.login(TOKEN)
        .catch(error => {

            console.error(
                "❌ Error iniciando sesión:",
                error
            );

        });
}
