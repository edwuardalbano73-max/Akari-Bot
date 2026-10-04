const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    PermissionsBitField
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
const BOT_API_KEY = process.env.BOT_API_KEY;

// Si se configura, la web administra este servidor.
// Si no, usa el primer servidor del bot.
const PANEL_GUILD_ID = process.env.PANEL_GUILD_ID;

const DATA_FILE =
    path.join(__dirname, "akari-data.json");

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
        console.log(
            "⚠️ Error leyendo akari-data.json."
        );
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

        goodbye: {
            enabled: false,
            channel: null,
            message:
                "🌸 **{member}** ha salido de **{guild}**."
        },

        invites: {
            enabled: true,
            channel: null
        },

        auto: {
            enabled: false,
            responses: []
        },

        logs: {
            enabled: false,
            channel: null
        },

        security: {
            antiLink: false,
            antiSpam: false,
            spamLimit: 5
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
            },

            daily: {
                amount: 500,
                time: 24 * 60 * 60 * 1000
            },

            bj: {
                time: 2 * 60 * 1000,
                winChance: 45
            }
        },

        shop: []
    };
}

function getGuildConfig(guildId) {
    if (!data.guilds[guildId]) {
        data.guilds[guildId] =
            defaultGuildConfig();

        saveData();
    }

    const config = data.guilds[guildId];

    // Compatibilidad con configuraciones antiguas
    if (!config.goodbye) {
        config.goodbye =
            defaultGuildConfig().goodbye;
    }

    if (!config.auto) {
        config.auto =
            defaultGuildConfig().auto;
    }

    if (!config.logs) {
        config.logs =
            defaultGuildConfig().logs;
    }

    if (!config.security) {
        config.security =
            defaultGuildConfig().security;
    }

    if (!config.shop) {
        config.shop = [];
    }

    if (!config.economy.daily) {
        config.economy.daily =
            defaultGuildConfig().economy.daily;
    }

    if (!config.economy.bj) {
        config.economy.bj =
            defaultGuildConfig().economy.bj;
    }

    return config;
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
            inventory: [],
            warnings: 0,

            cooldowns: {
                work: 0,
                slut: 0,
                crime: 0,
                rob: 0,
                daily: 0,
                bj: 0
            }
        };
    }

    const user =
        data.users[guildId][userId];

    if (!user.inventory) user.inventory = [];
    if (!user.warnings) user.warnings = 0;
    if (!user.cooldowns) user.cooldowns = {};

    return user;
}

// =====================================================
// ⏱️ TIEMPO
// =====================================================

function formatTime(ms) {
    if (ms <= 0) return "Ahora";

    let seconds =
        Math.ceil(ms / 1000);

    const days =
        Math.floor(seconds / 86400);

    seconds %= 86400;

    const hours =
        Math.floor(seconds / 3600);

    seconds %= 3600;

    const minutes =
        Math.floor(seconds / 60);

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

function parseDuration(value) {
    if (
        typeof value !== "string" ||
        !value.trim()
    ) {
        return null;
    }

    const match =
        value
            .trim()
            .toLowerCase()
            .match(
                /^(\d+(?:\.\d+)?)\s*(s|m|h|d)$/
            );

    if (!match) return null;

    const number =
        Number(match[1]);

    const units = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000
    };

    return Math.max(
        1000,
        Math.round(
            number * units[match[2]]
        )
    );
}

// =====================================================
// 💰 UTILIDADES
// =====================================================

function randomMoney(min, max) {
    return Math.floor(
        Math.random() *
        (max - min + 1)
    ) + min;
}

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

function errorEmbed(text) {
    return akariEmbed(
        "Error ❌",
        text
    );
}

function successEmbed(title, text) {
    return akariEmbed(
        title,
        text
    );
}

// =====================================================
// 📋 LOGS
// =====================================================

async function sendLog(guild, title, description) {
    try {
        const config =
            getGuildConfig(guild.id);

        if (!config.logs.enabled) return;
        if (!config.logs.channel) return;

        const channel =
            guild.channels.cache.get(
                config.logs.channel
            );

        if (!channel) return;

        await channel.send({
            embeds: [
                akariEmbed(
                    title,
                    description
                )
            ]
        });

    } catch (error) {
        console.log(
            "❌ Error enviando log:",
            error.message
        );
    }
}

// =====================================================
// 🌸 BIENVENIDAS
// =====================================================

client.on(
    "guildMemberAdd",
    async member => {

        try {
            const config =
                getGuildConfig(
                    member.guild.id
                );

            if (
                config.welcome.enabled &&
                config.welcome.channel
            ) {
                const channel =
                    member.guild.channels.cache.get(
                        config.welcome.channel
                    );

                if (channel) {
                    const text =
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

                    await channel.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff9dcc")
                                .setTitle(
                                    "🌸 ¡Nueva bienvenida!"
                                )
                                .setDescription(
                                    text
                                )
                                .setThumbnail(
                                    member.user.displayAvatarURL({
                                        dynamic: true
                                    })
                                )
                                .setFooter({
                                    text:
                                        "Akari Bot 🌸"
                                })
                                .setTimestamp()
                        ]
                    });
                }
            }

        } catch (error) {
            console.log(
                "❌ Error en bienvenida:",
                error.message
            );
        }
    }
);

// =====================================================
// 👋 DESPEDIDAS
// =====================================================

client.on(
    "guildMemberRemove",
    async member => {

        try {
            const config =
                getGuildConfig(
                    member.guild.id
                );

            if (
                !config.goodbye.enabled ||
                !config.goodbye.channel
            ) {
                return;
            }

            const channel =
                member.guild.channels.cache.get(
                    config.goodbye.channel
                );

            if (!channel) return;

            const text =
                config.goodbye.message
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

            await channel.send({
                embeds: [
                    akariEmbed(
                        "👋 Hasta pronto",
                        text
                    )
                ]
            });

        } catch {}
    }
);

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

    for (
        const guild
        of client.guilds.cache.values()
    ) {
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
        } catch {
            console.log(
                `⚠️ No se pudieron cargar invites de ${guild.name}.`
            );
        }
    }
});

client.on(
    "guildMemberAdd",
    async member => {

        try {
            const config =
                getGuildConfig(
                    member.guild.id
                );

            if (!config.invites.enabled) return;

            const oldInvites =
                inviteCache.get(
                    member.guild.id
                );

            const newInvites =
                await member.guild.invites.fetch();

            const usedInvite =
                newInvites.find(invite => {

                    const oldUses =
                        oldInvites?.get(
                            invite.code
                        ) || 0;

                    return (
                        invite.uses >
                        oldUses
                    );
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

            await channel.send({
                embeds: [
                    akariEmbed(
                        "💌 Nueva invitación",
                        `🌸 **${member.user.tag}** entró al servidor.\n\n` +
                        `💗 Invitado por: ${
                            usedInvite.inviter
                                ? `<@${usedInvite.inviter.id}>`
                                : "Desconocido"
                        }\n\n` +
                        `🔗 Usos: **${usedInvite.uses}**`
                    )
                ]
            });

        } catch {}
    }
);

// =====================================================
// 💰 WORK
// =====================================================

async function workCommand(
    message,
    config,
    user
) {
    const now = Date.now();
    const settings =
        config.economy.work;

    if (
        user.cooldowns.work >
        now
    ) {
        return message.reply({
            embeds: [
                errorEmbed(
                    `Podrás volver a usar **Mwork** en **${formatTime(
                        user.cooldowns.work -
                        now
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
            successEmbed(
                "¡Trabajo completado! 🌷",
                `✨ Ganaste **${amount} monedas**.\n\n` +
                `💰 Balance: **${user.money}**`
            )
        ]
    });
}

// =====================================================
// 🎲 SLUT / AZAR
// =====================================================

async function slutCommand(
    message,
    config,
    user
) {
    const now = Date.now();
    const settings =
        config.economy.slut;

    if (
        user.cooldowns.slut >
        now
    ) {
        return message.reply({
            embeds: [
                errorEmbed(
                    `Debes esperar **${formatTime(
                        user.cooldowns.slut -
                        now
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
    } else {
        user.money -= Math.min(
            amount,
            user.money
        );
    }

    saveData();

    return message.reply({
        embeds: [
            akariEmbed(
                won
                    ? "¡Ganaste! 🎀"
                    : "Perdiste 💔",
                won
                    ? `✨ Ganaste **${amount} monedas**.\n\n` +
                      `📊 Probabilidad: **${settings.winChance}%**\n` +
                      `💰 Balance: **${user.money}**`
                    : `💸 Perdiste **${Math.min(
                          amount,
                          user.money + amount
                      )} monedas**.\n\n` +
                      `📊 Probabilidad: **${settings.winChance}%**\n` +
                      `💰 Balance: **${user.money}**`
            )
        ]
    });
}

// =====================================================
// 🔪 CRIME
// =====================================================

async function crimeCommand(
    message,
    config,
    user
) {
    const now = Date.now();
    const settings =
        config.economy.crime;

    if (
        user.cooldowns.crime >
        now
    ) {
        return message.reply({
            embeds: [
                errorEmbed(
                    `Debes esperar **${formatTime(
                        user.cooldowns.crime -
                        now
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
    } else {
        user.money -= Math.min(
            amount,
            user.money
        );
    }

    saveData();

    return message.reply({
        embeds: [
            akariEmbed(
                won
                    ? "¡Éxito! 🔪"
                    : "Falló 💔",
                won
                    ? `💰 Ganaste **${amount} monedas**.\n\n` +
                      `📊 Probabilidad: **${settings.winChance}%**\n` +
                      `💳 Balance: **${user.money}**`
                    : `💸 Perdiste dinero.\n\n` +
                      `📊 Probabilidad: **${settings.winChance}%**\n` +
                      `💳 Balance: **${user.money}**`
            )
        ]
    });
}

// =====================================================
// 🥷 ROB
// =====================================================

async function robCommand(
    message,
    config,
    user
) {
    const now = Date.now();
    const settings =
        config.economy.rob;

    if (
        user.cooldowns.rob >
        now
    ) {
        return message.reply({
            embeds: [
                errorEmbed(
                    `Debes esperar **${formatTime(
                        user.cooldowns.rob -
                        now
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
                    `No conseguiste dinero.\n\n` +
                    `📊 Éxito: **${settings.winChance}%**`
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
                `✨ Conseguíste **${amount} monedas**.\n\n` +
                `📊 Éxito: **${settings.winChance}%**\n` +
                `💰 Balance: **${user.money}**`
            )
        ]
    });
}

// =====================================================
// 🎁 DAILY
// =====================================================

async function dailyCommand(
    message,
    config,
    user
) {
    const now = Date.now();
    const settings =
        config.economy.daily;

    if (
        user.cooldowns.daily >
        now
    ) {
        return message.reply({
            embeds: [
                errorEmbed(
                    `Podrás reclamarlo en **${formatTime(
                        user.cooldowns.daily -
                        now
                    )}**.`
                )
            ]
        });
    }

    user.money += settings.amount;

    user.cooldowns.daily =
        now + settings.time;

    saveData();

    return message.reply({
        embeds: [
            successEmbed(
                "Recompensa diaria 🌸",
                `🎁 Recibiste **${settings.amount} monedas**.\n\n` +
                `💰 Balance: **${user.money}**`
            )
        ]
    });
}

// =====================================================
// 💳 BALANCE
// =====================================================

async function balanceCommand(
    message,
    user
) {
    return message.reply({
        embeds: [
            akariEmbed(
                "Tu balance 💰",
                `👤 ${message.author}\n\n` +
                `💳 **${user.money} monedas**`
            )
        ]
    });
}

// =====================================================
// 💰 DEPÓSITO / RETIRO
// =====================================================

async function depCommand(
    message,
    user,
    amountText
) {
    // El dinero ya es saldo disponible.
    // Se mantiene el comando como consulta
    // para compatibilidad con el sistema.

    if (
        !amountText ||
        amountText.toLowerCase() === "all"
    ) {
        return message.reply({
            embeds: [
                akariEmbed(
                    "Depósito 💰",
                    `Tu dinero disponible es **${user.money} monedas**.`
                )
            ]
        });
    }

    const amount =
        Number(amountText);

    if (
        !Number.isInteger(amount) ||
        amount <= 0
    ) {
        return message.reply({
            embeds: [
                errorEmbed(
                    "Indica una cantidad válida."
                )
            ]
        });
    }

    return message.reply({
        embeds: [
            akariEmbed(
                "Depósito 💰",
                `Tienes **${user.money} monedas** disponibles.\n\n` +
                `La economía de Akari utiliza directamente este saldo.`
            )
        ]
    });
}

async function withCommand(
    message,
    user,
    amountText
) {
    if (
        !amountText ||
        amountText.toLowerCase() === "all"
    ) {
        return message.reply({
            embeds: [
                akariEmbed(
                    "Retiro 💰",
                    `Tu saldo actual es **${user.money} monedas**.`
                )
            ]
        });
    }

    return message.reply({
        embeds: [
            akariEmbed(
                "Retiro 💰",
                `Tu saldo actual es **${user.money} monedas**.`
            )
        ]
    });
}

// =====================================================
// 🎰 BJ — JUEGO VIRTUAL
// =====================================================

async function bjCommand(
    message,
    config,
    user,
    amountText
) {
    const now = Date.now();
    const settings =
        config.economy.bj;

    if (
        user.cooldowns.bj >
        now
    ) {
        return message.reply({
            embeds: [
                errorEmbed(
                    `Debes esperar **${formatTime(
                        user.cooldowns.bj -
                        now
                    )}**.`
                )
            ]
        });
    }

    let amount;

    if (
        amountText &&
        amountText.toLowerCase() === "all"
    ) {
        amount = user.money;
    } else {
        amount =
            Number(amountText);
    }

    if (
        !Number.isInteger(amount) ||
        amount <= 0
    ) {
        return message.reply({
            embeds: [
                errorEmbed(
                    "Usa `Mbj <cantidad>` o `Mbj all`."
                )
            ]
        });
    }

    if (amount > user.money) {
        return message.reply({
            embeds: [
                errorEmbed(
                    "No tienes suficientes monedas."
                )
            ]
        });
    }

    user.cooldowns.bj =
        now + settings.time;

    const won =
        Math.random() * 100 <
        settings.winChance;

    if (won) {
        user.money += amount;
    } else {
        user.money -= amount;
    }

    saveData();

    return message.reply({
        embeds: [
            akariEmbed(
                won
                    ? "🎴 Ganaste"
                    : "🎴 Perdiste",
                won
                    ? `Ganaste **${amount} monedas**.\n\n` +
                      `💰 Balance: **${user.money}**`
                    : `Perdiste **${amount} monedas**.\n\n` +
                      `💰 Balance: **${user.money}**`
            )
        ]
    });
}

// =====================================================
// 🛒 SHOP
// =====================================================

async function shopCommand(
    message,
    config
) {
    if (!config.shop.length) {
        return message.reply({
            embeds: [
                akariEmbed(
                    "Shop 🛒",
                    "La tienda está vacía."
                )
            ]
        });
    }

    const text =
        config.shop
            .map(item =>
                `**${item.name}** — 💰 ${item.price}\n${item.description || "Sin descripción."}`
            )
            .join("\n\n");

    return message.reply({
        embeds: [
            akariEmbed(
                "Shop 🛒",
                text
            )
        ]
    });
}

async function buyCommand(
    message,
    config,
    user,
    itemName
) {
    if (!itemName) {
        return message.reply({
            embeds: [
                errorEmbed(
                    "Indica el nombre del producto."
                )
            ]
        });
    }

    const item =
        config.shop.find(
            product =>
                product.name.toLowerCase() ===
                itemName.toLowerCase()
        );

    if (!item) {
        return message.reply({
            embeds: [
                errorEmbed(
                    "Ese producto no existe."
                )
            ]
        });
    }

    if (user.money < item.price) {
        return message.reply({
            embeds: [
                errorEmbed(
                    "No tienes suficientes monedas."
                )
            ]
        });
    }

    user.money -= item.price;

    user.inventory.push({
        name: item.name,
        purchasedAt: Date.now()
    });

    saveData();

    return message.reply({
        embeds: [
            successEmbed(
                "Compra realizada 🛒",
                `Compraste **${item.name}** por **${item.price} monedas**.\n\n` +
                `💰 Balance: **${user.money}**`
            )
        ]
    });
}

// =====================================================
// 🛡️ MODERACIÓN
// =====================================================

function isModerator(member) {
    return member.permissions.has(
        PermissionsBitField.Flags.ManageGuild
    );
}

async function requireModerator(
    message
) {
    if (
        !isModerator(
            message.member
        )
    ) {
        await message.reply({
            embeds: [
                errorEmbed(
                    "Necesitas permisos de administración para usar este comando."
                )
            ]
        });

        return false;
    }

    return true;
}

// BAN
async function banCommand(
    message,
    member,
    reason
) {
    if (!await requireModerator(message))
        return;

    if (!member) {
        return message.reply({
            embeds: [
                errorEmbed(
                    "Menciona a un usuario."
                )
            ]
        });
    }

    if (
        !member.bannable
    ) {
        return message.reply({
            embeds: [
                errorEmbed(
                    "No puedo expulsar a ese usuario."
                )
            ]
        });
    }

    await member.ban({
        reason:
            reason ||
            "Sin razón especificada"
    });

    await sendLog(
        message.guild,
        "🔨 Usuario baneado",
        `${member.user.tag} fue baneado.\n\n` +
        `👮 Moderador: ${message.author}\n` +
        `📝 Razón: ${reason || "Sin razón"}`
    );

    return message.reply({
        embeds: [
            successEmbed(
                "Usuario baneado 🔨",
                `👤 ${member.user.tag}\n` +
                `📝 Razón: **${reason || "Sin razón"}**`
            )
        ]
    });
}

// KICK
async function kickCommand(
    message,
    member,
    reason
) {
    if (!await requireModerator(message))
        return;

    if (!member) {
        return message.reply({
            embeds: [
                errorEmbed(
                    "Menciona a un usuario."
                )
            ]
        });
    }

    if (!member.kickable) {
        return message.reply({
            embeds: [
                errorEmbed(
                    "No puedo expulsar a ese usuario."
                )
            ]
        });
    }

    await member.kick(
        reason ||
        "Sin razón especificada"
    );

    await sendLog(
        message.guild,
        "👢 Usuario expulsado",
        `${member.user.tag} fue expulsado.\n\n` +
        `👮 Moderador: ${message.author}\n` +
        `📝 Razón: ${reason || "Sin razón"}`
    );

    return message.reply({
        embeds: [
            successEmbed(
                "Usuario expulsado 👢",
                `👤 ${member.user.tag}\n` +
                `📝 Razón: **${reason || "Sin razón"}**`
            )
        ]
    });
}

// WARN
async function warnCommand(
    message,
    member,
    reason
) {
    if (!await requireModerator(message))
        return;

    if (!member) {
        return message.reply({
            embeds: [
                errorEmbed(
                    "Menciona a un usuario."
                )
            ]
        });
    }

    const user =
        getUser(
            member.id,
            message.guild.id
        );

    user.warnings++;

    saveData();

    await sendLog(
        message.guild,
        "⚠️ Warn",
        `${member.user.tag} recibió un warn.\n\n` +
        `👮 Moderador: ${message.author}\n` +
        `📝 Razón: ${reason || "Sin razón"}\n` +
        `⚠️ Total: ${user.warnings}`
    );

    return message.reply({
        embeds: [
            successEmbed(
                "Warn aplicado ⚠️",
                `👤 ${member.user.tag}\n` +
                `📝 Razón: **${reason || "Sin razón"}**\n` +
                `⚠️ Warns: **${user.warnings}**`
            )
        ]
    });
}

// CLEARWARN
async function clearwarnCommand(
    message,
    member
) {
    if (!await requireModerator(message))
        return;

    if (!member) {
        return message.reply({
            embeds: [
                errorEmbed(
                    "Menciona a un usuario."
                )
            ]
        });
    }

    const user =
        getUser(
            member.id,
            message.guild.id
        );

    user.warnings = 0;

    saveData();

    return message.reply({
        embeds: [
            successEmbed(
                "Warns eliminados 🌸",
                `Se eliminaron los warns de **${member.user.tag}**.`
            )
        ]
    });
}

// MUTE
async function muteCommand(
    message,
    member,
    durationText,
    reason
) {
    if (!await requireModerator(message))
        return;

    if (!member) {
        return message.reply({
            embeds: [
                errorEmbed(
                    "Menciona a un usuario."
                )
            ]
        });
    }

    const duration =
        parseDuration(
            durationText ||
            "10m"
        );

    if (!duration) {
        return message.reply({
            embeds: [
                errorEmbed(
                    "Usa un tiempo como `10m`, `1h` o `30s`."
                )
            ]
        });
    }

    if (!member.moderatable) {
        return message.reply({
            embeds: [
                errorEmbed(
                    "No puedo moderar a ese usuario."
                )
            ]
        });
    }

    await member.timeout(
        duration,
        reason ||
        "Sin razón"
    );

    return message.reply({
        embeds: [
            successEmbed(
                "Usuario muteado 🔇",
                `👤 ${member.user.tag}\n` +
                `⏱️ Duración: **${formatTime(duration)}**\n` +
                `📝 Razón: **${reason || "Sin razón"}**`
            )
        ]
    });
}

// UNMUTE
async function unmuteCommand(
    message,
    member
) {
    if (!await requireModerator(message))
        return;

    if (!member) {
        return message.reply({
            embeds: [
                errorEmbed(
                    "Menciona a un usuario."
                )
            ]
        });
    }

    await member.timeout(
        null,
        "Unmute"
    );

    return message.reply({
        embeds: [
            successEmbed(
                "Usuario desmuteado 🔊",
                `${member.user.tag} ya puede hablar nuevamente.`
            )
        ]
    });
}

// PURGE
async function purgeCommand(
    message,
    amount
) {
    if (!await requireModerator(message))
        return;

    const number =
        Number(amount);

    if (
        !Number.isInteger(number) ||
        number < 1 ||
        number > 100
    ) {
        return message.reply({
            embeds: [
                errorEmbed(
                    "Indica un número entre 1 y 100."
                )
            ]
        });
    }

    await message.channel.bulkDelete(
        number,
        true
    );

    const msg =
        await message.channel.send({
            embeds: [
                successEmbed(
                    "Mensajes eliminados 🧹",
                    `Se eliminaron **${number} mensajes**.`
                )
            ]
        });

    setTimeout(
        () => msg.delete().catch(() => {}),
        3000
    );
}

// LOCK
async function lockCommand(
    message
) {
    if (!await requireModerator(message))
        return;

    await message.channel.permissionOverwrites.edit(
        message.guild.roles.everyone,
        {
            SendMessages: false
        }
    );

    return message.reply({
        embeds: [
            successEmbed(
                "Canal bloqueado 🔒",
                "El canal ha sido bloqueado."
            )
        ]
    });
}

// UNLOCK
async function unlockCommand(
    message
) {
    if (!await requireModerator(message))
        return;

    await message.channel.permissionOverwrites.edit(
        message.guild.roles.everyone,
        {
            SendMessages: null
        }
    );

    return message.reply({
        embeds: [
            successEmbed(
                "Canal desbloqueado 🔓",
                "El canal ha sido desbloqueado."
            )
        ]
    });
}

// SLOWMODE
async function slowmodeCommand(
    message,
    seconds
) {
    if (!await requireModerator(message))
        return;

    const value =
        Number(seconds);

    if (
        !Number.isInteger(value) ||
        value < 0 ||
        value > 21600
    ) {
        return message.reply({
            embeds: [
                errorEmbed(
                    "Indica segundos entre 0 y 21600."
                )
            ]
        });
    }

    await message.channel.setRateLimitPerUser(
        value
    );

    return message.reply({
        embeds: [
            successEmbed(
                "Slowmode ⚙️",
                value === 0
                    ? "Slowmode desactivado."
                    : `Slowmode establecido en **${value}s**.`
            )
        ]
    });
}

// =====================================================
// 🌸 HELP
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
                            "Dinero, juegos y tienda"
                        )
                        .setEmoji("💰")
                        .setValue("economia"),

                    new StringSelectMenuOptionBuilder()
                        .setLabel("Información")
                        .setDescription(
                            "Información del bot"
                        )
                        .setEmoji("🌸")
                        .setValue("informacion"),

                    new StringSelectMenuOptionBuilder()
                        .setLabel("Moderación")
                        .setDescription(
                            "Herramientas de moderación"
                        )
                        .setEmoji("🛡️")
                        .setValue("moderacion"),

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

function helpEmbed(category) {

    if (category === "economia") {
        return akariEmbed(
            "Economía 💰",
            "**Mwork** — Trabaja.\n" +
            "**Mslut** — Juego de azar.\n" +
            "**Mcrime** — Juego de riesgo.\n" +
            "**Mrob** — Intenta conseguir monedas.\n" +
            "**Mbalance** — Mira tu balance.\n" +
            "**Mdaily** — Recompensa diaria.\n" +
            "**Mdep** — Consulta tu saldo.\n" +
            "**Mwith** — Consulta tu saldo.\n" +
            "**Mbj** — Juego virtual.\n" +
            "**Mshop** — Abre la tienda.\n" +
            "**Mbuy <producto>** — Compra un producto."
        );
    }

    if (category === "moderacion") {
        return akariEmbed(
            "Moderación 🛡️",
            "**Madmin** — Panel administrativo.\n\n" +
            "**Mban** — Banea.\n" +
            "**Munban** — Próximamente.\n" +
            "**Mkick** — Expulsa.\n" +
            "**Mwarn** — Advierte.\n" +
            "**Mclearwarn** — Elimina warns.\n" +
            "**Mmute** — Silencia.\n" +
            "**Munmute** — Quita silencio.\n" +
            "**Mpurge** — Borra mensajes.\n" +
            "**Mlock** — Bloquea canal.\n" +
            "**Munlock** — Desbloquea canal.\n" +
            "**Mslowmode** — Configura slowmode."
        );
    }

    if (category === "utilidades") {
        return akariEmbed(
            "Utilidades 🛠️",
            "**Mping** — Latencia.\n" +
            "**Mavatar** — Avatar.\n" +
            "**Mserver** — Información del servidor."
        );
    }

    return akariEmbed(
        "Información 🌸",
        "**Mhelp** — Abre esta ayuda.\n" +
        "**Mbot** — Información de Akari Bot.\n" +
        "**Mserver** — Información del servidor."
    );
}

function adminEmbed() {
    return akariEmbed(
        "Akari Admin 🛡️",
        "**Mban @usuario [razón]**\n" +
        "**Mkick @usuario [razón]**\n" +
        "**Mwarn @usuario [razón]**\n" +
        "**Mclearwarn @usuario**\n" +
        "**Mmute @usuario 10m [razón]**\n" +
        "**Munmute @usuario**\n" +
        "**Mpurge 10**\n" +
        "**Mlock**\n" +
        "**Munlock**\n" +
        "**Mslowmode 5**"
    );
}

// =====================================================
// 🎮 SELECT MENU
// =====================================================

client.on(
    "interactionCreate",
    async interaction => {

        if (
            !interaction.isStringSelectMenu()
        ) {
            return;
        }

        if (
            interaction.customId !==
            "akari_help"
        ) {
            return;
        }

        await interaction.update({
            embeds: [
                helpEmbed(
                    interaction.values[0]
                )
            ],
            components: [
                createHelpMenu()
            ]
        });
    }
);

// =====================================================
// 💬 COMANDOS
// =====================================================

client.on(
    "messageCreate",
    async message => {

        if (message.author.bot) return;
        if (!message.guild) return;

        // Auto-respuestas
        const config =
            getGuildConfig(
                message.guild.id
            );

        if (
            config.auto.enabled &&
            Array.isArray(
                config.auto.responses
            )
        ) {
            const found =
                config.auto.responses.find(
                    item =>
                        item.trigger &&
                        message.content
                            .toLowerCase()
                            .includes(
                                item.trigger
                                    .toLowerCase()
                            )
                );

            if (found?.response) {
                await message.channel.send(
                    found.response
                );
            }
        }

        // Anti-link
        if (
            config.security.antiLink &&
            /https?:\/\/\S+/i.test(
                message.content
            ) &&
            !message.member.permissions.has(
                PermissionsBitField.Flags.ManageMessages
            )
        ) {
            await message.delete().catch(() => {});

            await message.channel.send({
                embeds: [
                    errorEmbed(
                        `${message.author}, los enlaces no están permitidos aquí.`
                    )
                ]
            });

            return;
        }

        if (
            !message.content.startsWith(
                PREFIX
            )
        ) {
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

        const user =
            getUser(
                message.author.id,
                message.guild.id
            );

        // HELP
        if (command === "help") {
            return message.reply({
                embeds: [
                    helpEmbed()
                ],
                components: [
                    createHelpMenu()
                ]
            });
        }

        // ADMIN
        if (command === "admin") {
            if (
                !await requireModerator(
                    message
                )
            ) return;

            return message.reply({
                embeds: [
                    adminEmbed()
                ]
            });
        }

        // ECONOMÍA
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
                config,
                user
            );
        }

        if (command === "dep") {
            return depCommand(
                message,
                user,
                args[0]
            );
        }

        if (command === "with") {
            return withCommand(
                message,
                user,
                args[0]
            );
        }

        if (command === "bj") {
            return bjCommand(
                message,
                config,
                user,
                args[0]
            );
        }

        if (command === "shop") {
            return shopCommand(
                message,
                config
            );
        }

        if (command === "buy") {
            return buyCommand(
                message,
                config,
                user,
                args.join(" ")
            );
        }

        // MODERACIÓN
        if (command === "ban") {
            return banCommand(
                message,
                message.mentions.members.first(),
                args.slice(1).join(" ")
            );
        }

        if (command === "kick") {
            return kickCommand(
                message,
                message.mentions.members.first(),
                args.slice(1).join(" ")
            );
        }

        if (command === "warn") {
            return warnCommand(
                message,
                message.mentions.members.first(),
                args.slice(1).join(" ")
            );
        }

        if (command === "clearwarn") {
            return clearwarnCommand(
                message,
                message.mentions.members.first()
            );
        }

        if (command === "mute") {
            return muteCommand(
                message,
                message.mentions.members.first(),
                args[1],
                args.slice(2).join(" ")
            );
        }

        if (command === "unmute") {
            return unmuteCommand(
                message,
                message.mentions.members.first()
            );
        }

        if (command === "purge") {
            return purgeCommand(
                message,
                args[0]
            );
        }

        if (command === "lock") {
            return lockCommand(message);
        }

        if (command === "unlock") {
            return unlockCommand(message);
        }

        if (command === "slowmode") {
            return slowmodeCommand(
                message,
                args[0]
            );
        }

        // INFORMACIÓN
        if (command === "bot") {
            return message.reply({
                embeds: [
                    akariEmbed(
                        "Akari Bot 🌸",
                        `🤖 Bot: **${client.user.username}**\n` +
                        `🌸 Servidores: **${client.guilds.cache.size}**`
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
                        `🏓 **${client.ws.ping}ms**`
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
    }
);

// =====================================================
// 🌐 API WEB
// =====================================================

const app = express();

app.use(express.json());

function checkApiKey(req, res, next) {

    if (!BOT_API_KEY) {
        return res.status(500).json({
            success: false,
            message:
                "BOT_API_KEY no está configurada."
        });
    }

    const auth =
        req.headers.authorization || "";

    const received =
        auth.startsWith("Bearer ")
            ? auth.slice(7)
            : "";

    if (
        !received ||
        received !== BOT_API_KEY
    ) {
        return res.status(401).json({
            success: false,
            message: "No autorizado."
        });
    }

    next();
}

function getPanelGuild() {

    if (PANEL_GUILD_ID) {
        return (
            client.guilds.cache.get(
                PANEL_GUILD_ID
            ) || null
        );
    }

    return (
        client.guilds.cache.first() ||
        null
    );
}

// GET CONFIG
app.get(
    "/api/config",
    checkApiKey,
    (req, res) => {

        const guild =
            getPanelGuild();

        if (!guild) {
            return res.status(404).json({
                success: false,
                message:
                    "No se encontró el servidor del panel."
            });
        }

        const config =
            getGuildConfig(
                guild.id
            );

        res.json({
            success: true,

            guild: {
                id: guild.id,
                name: guild.name
            },

            welcome:
                config.welcome,

            goodbye:
                config.goodbye,

            invites:
                config.invites,

            auto:
                config.auto,

            logs:
                config.logs,

            security:
                config.security,

            economy:
                config.economy,

            shop:
                config.shop
        });
    }
);

// POST CONFIG
app.post(
    "/api/config",
    checkApiKey,
    (req, res) => {

        const guild =
            getPanelGuild();

        if (!guild) {
            return res.status(404).json({
                success: false,
                message:
                    "No se encontró el servidor del panel."
            });
        }

        const config =
            getGuildConfig(
                guild.id
            );

        const incoming =
            req.body;

        if (incoming.economy) {
            updateEconomy(
                config,
                incoming.economy
            );
        }

        if (incoming.welcome) {
            config.welcome =
                {
                    ...config.welcome,
                    ...incoming.welcome
                };
        }

        if (incoming.goodbye) {
            config.goodbye =
                {
                    ...config.goodbye,
                    ...incoming.goodbye
                };
        }

        if (incoming.invites) {
            config.invites =
                {
                    ...config.invites,
                    ...incoming.invites
                };
        }

        if (incoming.auto) {
            config.auto =
                {
                    ...config.auto,
                    ...incoming.auto
                };
        }

        if (incoming.logs) {
            config.logs =
                {
                    ...config.logs,
                    ...incoming.logs
                };
        }

        if (incoming.security) {
            config.security =
                {
                    ...config.security,
                    ...incoming.security
                };
        }

        if (Array.isArray(incoming.shop)) {
            config.shop =
                incoming.shop;
        }

        saveData();

        res.json({
            success: true,
            message:
                "Configuración guardada correctamente."
        });
    }
);

function updateEconomy(
    config,
    incoming
) {
    const economy =
        config.economy;

    const sections = [
        "work",
        "slut",
        "crime",
        "rob",
        "daily",
        "bj"
    ];

    for (
        const section
        of sections
    ) {
        if (!incoming[section])
            continue;

        const target =
            economy[section];

        const source =
            incoming[section];

        if (
            typeof source.time ===
            "string"
        ) {
            const parsed =
                parseDuration(
                    source.time
                );

            if (parsed !== null) {
                target.time =
                    parsed;
            }
        }

        for (
            const key
            of [
                "min",
                "max",
                "amount",
                "winChance"
            ]
        ) {
            if (
                source[key] !==
                undefined
            ) {
                const value =
                    Number(
                        source[key]
                    );

                if (
                    Number.isFinite(
                        value
                    )
                ) {
                    target[key] =
                        Math.max(
                            0,
                            value
                        );
                }
            }
        }

        if (
            target.winChance !==
            undefined
        ) {
            target.winChance =
                Math.min(
                    100,
                    target.winChance
                );
        }

        if (
            target.min !==
            undefined &&
            target.max !==
            undefined
        ) {
            target.max =
                Math.max(
                    target.min,
                    target.max
                );
        }
    }
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
// 🚀 SERVIDOR
// =====================================================

app.listen(
    PORT,
    () => {
        console.log(
            `🌐 Servidor HTTP activo en el puerto ${PORT}`
        );
    }
);

// =====================================================
// 🚀 LOGIN DISCORD
// =====================================================

if (!TOKEN) {
    console.error(
        "❌ Falta DISCORD_TOKEN en Render."
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
