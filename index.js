const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits
} = require("discord.js");

const { Pool } = require("pg");
const http = require("http");

// =========================
// CONFIGURACIÓN
// =========================

const PREFIX = "M!";
const PINK = 0xFF9DCC;
const PORT = process.env.PORT || 10000;

console.log("🌸 AKARI: index.js se está ejecutando...");

// =========================
// SERVIDOR HTTP PARA RENDER
// =========================

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8"
  });

  res.end("Akari Bot está funcionando 🌸");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Servidor HTTP escuchando en el puerto ${PORT}`);
});

// =========================
// VARIABLES DE ENTORNO
// =========================

if (!process.env.DISCORD_TOKEN) {
  console.error("❌ Falta DISCORD_TOKEN en las variables de entorno.");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("❌ Falta DATABASE_URL en las variables de entorno.");
  process.exit(1);
}

console.log("🌸 AKARI: variables de entorno encontradas.");

// =========================
// POSTGRESQL
// =========================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  ssl: {
    rejectUnauthorized: false
  },

  connectionTimeoutMillis: 10000,

  max: 5
});

pool.on("error", (error) => {
  console.error("❌ Error de PostgreSQL:", error.message);
});

// =========================
// DISCORD CLIENT
// =========================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],

  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.User
  ]
});

// =========================
// BASE DE DATOS
// =========================

async function initDatabase() {
  console.log("🌸 Creando/verificando tablas...");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      coins BIGINT DEFAULT 0,
      daily BIGINT DEFAULT 0,
      work BIGINT DEFAULT 0,
      PRIMARY KEY (guild_id, user_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      guild_id TEXT PRIMARY KEY,
      welcome_channel TEXT,
      welcome_message TEXT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tickets (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      category TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS warnings (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      reason TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reputation (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      reputation INTEGER DEFAULT 0,
      PRIMARY KEY (guild_id, user_id)
    );
  `);

  console.log("✅ Tablas verificadas correctamente.");
}

// =========================
// FUNCIONES DE USUARIO
// =========================

async function ensureUser(guildId, userId) {
  await pool.query(
    `
    INSERT INTO users (guild_id, user_id)
    VALUES ($1, $2)
    ON CONFLICT (guild_id, user_id)
    DO NOTHING
    `,
    [guildId, userId]
  );
}

async function getUser(guildId, userId) {
  await ensureUser(guildId, userId);

  const result = await pool.query(
    `
    SELECT *
    FROM users
    WHERE guild_id = $1
    AND user_id = $2
    `,
    [guildId, userId]
  );

  return result.rows[0];
}

// =========================
// BOT LISTO
// =========================

client.once("ready", () => {
  console.log("=================================");
  console.log("🌸 Akari Bot conectado.");
  console.log(`🤖 Usuario: ${client.user.tag}`);
  console.log(`🏠 Servidores: ${client.guilds.cache.size}`);
  console.log("=================================");

  client.user.setPresence({
    activities: [
      {
        name: "Akari Community 🌸"
      }
    ],
    status: "online"
  });
});

// =========================
// BIENVENIDAS
// =========================

client.on("guildMemberAdd", async (member) => {
  try {
    const result = await pool.query(
      `
      SELECT welcome_channel, welcome_message
      FROM settings
      WHERE guild_id = $1
      `,
      [member.guild.id]
    );

    if (!result.rows.length) return;

    const settings = result.rows[0];

    if (!settings.welcome_channel) return;

    const channel = member.guild.channels.cache.get(
      settings.welcome_channel
    );

    if (!channel) return;

    const message =
      settings.welcome_message ||
      `🌸 ¡Bienvenido/a ${member} a **${member.guild.name}**!`;

    await channel.send(
      message
        .replace("{user}", `${member}`)
        .replace("{username}", member.user.username)
        .replace("{server}", member.guild.name)
    );
  } catch (error) {
    console.error("❌ Error en bienvenida:", error);
  }
});

// =========================
// COMANDOS
// =========================

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content
    .slice(PREFIX.length)
    .trim()
    .split(/\s+/);

  const command = args.shift()?.toLowerCase();

  if (!command) return;

  try {
    await ensureUser(
      message.guild.id,
      message.author.id
    );

    // =========================
    // HELP
    // =========================

    if (command === "help" || command === "ayuda") {
      const embed = new EmbedBuilder()
        .setColor(PINK)
        .setTitle("🌸 Akari Bot")
        .setDescription(
          "Bienvenido/a a **Akari Bot** 🌸\n\n" +
          "Estos son algunos de mis comandos."
        )
        .addFields(
          {
            name: "💰 Economía",
            value:
              "`M!balance` `M!daily` `M!work` `M!pay` `M!shop`"
          },
          {
            name: "🎮 Diversión",
            value:
              "`M!coin` `M!dice` `M!guess`"
          },
          {
            name: "💗 Social",
            value:
              "`M!profile` `M!hug` `M!friend` `M!rep`"
          },
          {
            name: "🛠️ Utilidades",
            value: "`M!ping`"
          }
        )
        .setFooter({
          text: "Akari Community 🌸"
        });

      return message.reply({
        embeds: [embed]
      });
    }

    // =========================
    // PING
    // =========================

    if (command === "ping") {
      return message.reply(
        `🏓 Pong!\nLatencia: **${client.ws.ping}ms**`
      );
    }

    // =========================
    // BALANCE
    // =========================

    if (
      command === "balance" ||
      command === "bal" ||
      command === "coins"
    ) {
      const user = await getUser(
        message.guild.id,
        message.author.id
      );

      const embed = new EmbedBuilder()
        .setColor(PINK)
        .setTitle("💰 Tu balance")
        .setDescription(
          `${message.author}, tienes **${user.coins} monedas** 🌸`
        );

      return message.reply({
        embeds: [embed]
      });
    }

    // =========================
    // DAILY
    // =========================

    if (command === "daily") {
      const user = await getUser(
        message.guild.id,
        message.author.id
      );

      const now = Date.now();

      if (
        user.daily &&
        now - Number(user.daily) < 86400000
      ) {
        const remaining =
          86400000 - (now - Number(user.daily));

        const hours = Math.floor(
          remaining / 3600000
        );

        const minutes = Math.floor(
          (remaining % 3600000) / 60000
        );

        return message.reply(
          `⏰ Ya reclamaste tu recompensa diaria.\n` +
          `Vuelve en **${hours}h ${minutes}m**.`
        );
      }

      const reward =
        Math.floor(Math.random() * 201) + 300;

      await pool.query(
        `
        UPDATE users
        SET coins = coins + $1,
            daily = $2
        WHERE guild_id = $3
        AND user_id = $4
        `,
        [
          reward,
          now,
          message.guild.id,
          message.author.id
        ]
      );

      return message.reply(
        `🌸 Has recibido **${reward} monedas** de recompensa diaria.`
      );
    }

    // =========================
    // WORK
    // =========================

    if (command === "work") {
      const user = await getUser(
        message.guild.id,
        message.author.id
      );

      const now = Date.now();

      if (
        user.work &&
        now - Number(user.work) < 30000
      ) {
        const remaining =
          30000 - (now - Number(user.work));

        return message.reply(
          `⏰ Debes esperar **${Math.ceil(
            remaining / 1000
          )} segundos**.`
        );
      }

      const reward =
        Math.floor(Math.random() * 201) + 100;

      await pool.query(
        `
        UPDATE users
        SET coins = coins + $1,
            work = $2
        WHERE guild_id = $3
        AND user_id = $4
        `,
        [
          reward,
          now,
          message.guild.id,
          message.author.id
        ]
      );

      return message.reply(
        `💼 Trabajaste y ganaste **${reward} monedas**.`
      );
    }

    // =========================
    // PAY
    // =========================

    if (command === "pay") {
      const target =
        message.mentions.users.first();

      const amount = Number(args[1]);

      if (!target) {
        return message.reply(
          "❌ Menciona a la persona a la que quieres pagar."
        );
      }

      if (
        !amount ||
        amount <= 0 ||
        !Number.isInteger(amount)
      ) {
        return message.reply(
          "❌ Especifica una cantidad válida."
        );
      }

      if (target.id === message.author.id) {
        return message.reply(
          "❌ No puedes pagarte a ti mismo."
        );
      }

      const sender = await getUser(
        message.guild.id,
        message.author.id
      );

      await ensureUser(
        message.guild.id,
        target.id
      );

      if (Number(sender.coins) < amount) {
        return message.reply(
          "❌ No tienes suficientes monedas."
        );
      }

      await pool.query(
        `
        UPDATE users
        SET coins = coins - $1
        WHERE guild_id = $2
        AND user_id = $3
        `,
        [
          amount,
          message.guild.id,
          message.author.id
        ]
      );

      await pool.query(
        `
        UPDATE users
        SET coins = coins + $1
        WHERE guild_id = $2
        AND user_id = $3
        `,
        [
          amount,
          message.guild.id,
          target.id
        ]
      );

      return message.reply(
        `💸 Has enviado **${amount} monedas** a ${target}.`
      );
    }

    // =========================
    // SHOP
    // =========================

    if (
      command === "shop" ||
      command === "tienda"
    ) {
      const embed = new EmbedBuilder()
        .setColor(PINK)
        .setTitle("🛍️ Tienda de Akari")
        .setDescription(
          "🌸 Próximamente habrá más objetos."
        );

      return message.reply({
        embeds: [embed]
      });
    }

    // =========================
    // COIN
    // =========================

    if (
      command === "coin" ||
      command === "flip"
    ) {
      const choice =
        args[0]?.toLowerCase();

      if (
        !["cara", "cruz"].includes(choice)
      ) {
        return message.reply(
          "❌ Usa `M!coin cara` o `M!coin cruz`."
        );
      }

      const resultSide =
        Math.random() < 0.5
          ? "cara"
          : "cruz";

      const won =
        choice === resultSide;

      if (won) {
        await pool.query(
          `
          UPDATE users
          SET coins = coins + 100
          WHERE guild_id = $1
          AND user_id = $2
          `,
          [
            message.guild.id,
            message.author.id
          ]
        );
      }

      return message.reply(
        `🪙 Salió **${resultSide}**.\n` +
        (
          won
            ? "🎉 ¡Ganaste **100 monedas**!"
            : "😔 Perdiste."
        )
      );
    }

    // =========================
    // DICE
    // =========================

    if (
      command === "dice" ||
      command === "dado"
    ) {
      const result =
        Math.floor(Math.random() * 6) + 1;

      return message.reply(
        `🎲 El dado cayó en **${result}**.`
      );
    }

    // =========================
    // GUESS
    // =========================

    if (command === "guess") {
      const number = Number(args[0]);

      if (
        !Number.isInteger(number) ||
        number < 1 ||
        number > 10
      ) {
        return message.reply(
          "❌ Elige un número del 1 al 10."
        );
      }

      const correct =
        Math.floor(Math.random() * 10) + 1;

      if (number === correct) {
        await pool.query(
          `
          UPDATE users
          SET coins = coins + 250
          WHERE guild_id = $1
          AND user_id = $2
          `,
          [
            message.guild.id,
            message.author.id
          ]
        );

        return message.reply(
          `🎯 ¡Acertaste! Era **${correct}**.\n` +
          `💰 Ganaste **250 monedas**.`
        );
      }

      return message.reply(
        `❌ No era ese número. Era **${correct}**.`
      );
    }

    // =========================
    // PROFILE
    // =========================

    if (
      command === "profile" ||
      command === "perfil"
    ) {
      const target =
        message.mentions.users.first() ||
        message.author;

      const user = await getUser(
        message.guild.id,
        target.id
      );

      const repResult = await pool.query(
        `
        SELECT reputation
        FROM reputation
        WHERE guild_id = $1
        AND user_id = $2
        `,
        [
          message.guild.id,
          target.id
        ]
      );

      const rep =
        repResult.rows[0]?.reputation || 0;

      const embed = new EmbedBuilder()
        .setColor(PINK)
        .setTitle(
          `🌸 Perfil de ${target.username}`
        )
        .setThumbnail(
          target.displayAvatarURL()
        )
        .addFields(
          {
            name: "💰 Monedas",
            value: `${user.coins}`,
            inline: true
          },
          {
            name: "⭐ Reputación",
            value: `${rep}`,
            inline: true
          }
        );

      return message.reply({
        embeds: [embed]
      });
    }

    // =========================
    // HUG
    // =========================

    if (command === "hug") {
      const target =
        message.mentions.users.first();

      if (!target) {
        return message.reply(
          "❌ Menciona a alguien."
        );
      }

      return message.reply(
        `🤗 ${message.author} le dio un abrazo a ${target}.`
      );
    }

    // =========================
    // FRIEND
    // =========================

    if (command === "friend") {
      const target =
        message.mentions.users.first();

      if (!target) {
        return message.reply(
          "❌ Menciona a alguien."
        );
      }

      return message.reply(
        `💗 ${message.author} y ${target} ahora son amigos.`
      );
    }

    // =========================
    // REP
    // =========================

    if (command === "rep") {
      const target =
        message.mentions.users.first();

      if (!target) {
        return message.reply(
          "❌ Menciona a alguien."
        );
      }

      if (
        target.id === message.author.id
      ) {
        return message.reply(
          "❌ No puedes darte reputación a ti mismo."
        );
      }

      await pool.query(
        `
        INSERT INTO reputation
          (guild_id, user_id, reputation)
        VALUES ($1, $2, 1)
        ON CONFLICT (guild_id, user_id)
        DO UPDATE SET reputation =
          reputation.reputation + 1
        `,
        [
          message.guild.id,
          target.id
        ]
      );

      return message.reply(
        `⭐ ${target} recibió **+1 reputación** de ${message.author}.`
      );
    }

    // =========================
    // SETWELCOME
    // =========================

    if (command === "setwelcome") {
      if (
        !message.member.permissions.has(
          PermissionFlagsBits.ManageGuild
        )
      ) {
        return message.reply(
          "❌ Necesitas el permiso **Gestionar servidor**."
        );
      }

      const channel =
        message.mentions.channels.first();

      if (!channel) {
        return message.reply(
          "❌ Menciona el canal de bienvenida."
        );
      }

      await pool.query(
        `
        INSERT INTO settings
          (guild_id, welcome_channel)
        VALUES ($1, $2)
        ON CONFLICT (guild_id)
        DO UPDATE SET welcome_channel = $2
        `,
        [
          message.guild.id,
          channel.id
        ]
      );

      return message.reply(
        `🌸 Canal de bienvenida establecido en ${channel}.`
      );
    }

    // =========================
    // WARN
    // =========================

    if (command === "warn") {
      if (
        !message.member.permissions.has(
          PermissionFlagsBits.ModerateMembers
        )
      ) {
        return message.reply(
          "❌ No tienes permisos."
        );
      }

      const target =
        message.mentions.members.first();

      if (!target) {
        return message.reply(
          "❌ Menciona al usuario."
        );
      }

      const reason =
        args.slice(1).join(" ") ||
        "Sin razón especificada";

      await pool.query(
        `
        INSERT INTO warnings
          (guild_id, user_id, moderator_id, reason)
        VALUES ($1, $2, $3, $4)
        `,
        [
          message.guild.id,
          target.id,
          message.author.id,
          reason
        ]
      );

      return message.reply(
        `⚠️ ${target} recibió una advertencia.\n` +
        `Razón: **${reason}**`
      );
    }

    // =========================
    // WARNINGS
    // =========================

    if (
      command === "warnings" ||
      command === "warns"
    ) {
      const target =
        message.mentions.users.first() ||
        message.author;

      const result = await pool.query(
        `
        SELECT reason, created_at
        FROM warnings
        WHERE guild_id = $1
        AND user_id = $2
        ORDER BY created_at DESC
        `,
        [
          message.guild.id,
          target.id
        ]
      );

      if (!result.rows.length) {
        return message.reply(
          `✅ ${target} no tiene advertencias.`
        );
      }

      const text = result.rows
        .slice(0, 10)
        .map(
          (warning, index) =>
            `**${index + 1}.** ${warning.reason}`
        )
        .join("\n");

      return message.reply(
        `⚠️ Advertencias de ${target}:\n\n${text}`
      );
    }

    // =========================
    // TIMEOUT
    // =========================

    if (command === "timeout") {
      if (
        !message.member.permissions.has(
          PermissionFlagsBits.ModerateMembers
        )
      ) {
        return message.reply(
          "❌ No tienes permisos."
        );
      }

      const target =
        message.mentions.members.first();

      const minutes =
        Number(args[1]) || 10;

      if (!target) {
        return message.reply(
          "❌ Menciona al usuario."
        );
      }

      if (!target.moderatable) {
        return message.reply(
          "❌ No puedo aplicar timeout a ese usuario."
        );
      }

      await target.timeout(
        minutes * 60 * 1000,
        "Moderación de Akari Bot"
      );

      return message.reply(
        `🔇 ${target} ha recibido timeout durante **${minutes} minutos**.`
      );
    }

    // =========================
    // UNTIMEOUT
    // =========================

    if (command === "untimeout") {
      if (
        !message.member.permissions.has(
          PermissionFlagsBits.ModerateMembers
        )
      ) {
        return message.reply(
          "❌ No tienes permisos."
        );
      }

      const target =
        message.mentions.members.first();

      if (!target) {
        return message.reply(
          "❌ Menciona al usuario."
        );
      }

      await target.timeout(null);

      return message.reply(
        `🔊 Se quitó el timeout a ${target}.`
      );
    }

    // =========================
    // KICK
    // =========================

    if (command === "kick") {
      if (
        !message.member.permissions.has(
          PermissionFlagsBits.KickMembers
        )
      ) {
        return message.reply(
          "❌ No tienes permisos."
        );
      }

      const target =
        message.mentions.members.first();

      if (!target) {
        return message.reply(
          "❌ Menciona al usuario."
        );
      }

      if (!target.kickable) {
        return message.reply(
          "❌ No puedo expulsar a ese usuario."
        );
      }

      await target.kick(
        "Expulsado mediante Akari Bot"
      );

      return message.reply(
        `👢 ${target.user.tag} fue expulsado.`
      );
    }

    // =========================
    // BAN
    // =========================

    if (command === "ban") {
      if (
        !message.member.permissions.has(
          PermissionFlagsBits.BanMembers
        )
      ) {
        return message.reply(
          "❌ No tienes permisos."
        );
      }

      const target =
        message.mentions.members.first();

      if (!target) {
        return message.reply(
          "❌ Menciona al usuario."
        );
      }

      if (!target.bannable) {
        return message.reply(
          "❌ No puedo banear a ese usuario."
        );
      }

      await target.ban({
        reason: "Baneado mediante Akari Bot"
      });

      return message.reply(
        `🔨 ${target.user.tag} fue baneado.`
      );
    }

    // =========================
    // CLEAR
    // =========================

    if (command === "clear") {
      if (
        !message.member.permissions.has(
          PermissionFlagsBits.ManageMessages
        )
      ) {
        return message.reply(
          "❌ No tienes permisos."
        );
      }

      const amount = Number(args[0]);

      if (
        !amount ||
        amount < 1 ||
        amount > 100
      ) {
        return message.reply(
          "❌ Usa una cantidad entre 1 y 100."
        );
      }

      await message.channel.bulkDelete(
        amount,
        true
      );

      const msg =
        await message.channel.send(
          `🧹 Se eliminaron **${amount} mensajes**.`
        );

      setTimeout(() => {
        msg.delete().catch(() => {});
      }, 3000);

      return;
    }

  } catch (error) {
    console.error(
      "❌ Error ejecutando comando:",
      error
    );

    await message.reply(
      "❌ Ocurrió un error al ejecutar el comando."
    ).catch(() => {});
  }
});

// =========================
// INTERACCIONES
// =========================

client.on("interactionCreate", async (interaction) => {
  try {
    // =========================
    // MENÚ DE TICKETS
    // =========================

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "ticket_menu"
    ) {
      const category =
        interaction.values[0];

      const names = {
        soporte: "Soporte",
        reporte: "Reporte",
        duda: "Duda",
        alianza: "Allys-Affys-Socio",
        postulacion: "Postulación",
        otro: "Otro"
      };

      const categoryName =
        names[category] || "Otro";

      const existing = await pool.query(
        `
        SELECT channel_id
        FROM tickets
        WHERE guild_id = $1
        AND user_id = $2
        `,
        [
          interaction.guild.id,
          interaction.user.id
        ]
      );

      for (const row of existing.rows) {
        const existingChannel =
          interaction.guild.channels.cache.get(
            row.channel_id
          );

        if (existingChannel) {
          return interaction.reply({
            content:
              `❌ Ya tienes un ticket abierto: ${existingChannel}`,
            ephemeral: true
          });
        }
      }

      const channel =
        await interaction.guild.channels.create({
          name:
            `ticket-${interaction.user.username}`
              .toLowerCase()
              .replace(/[^a-z0-9]/g, "-")
              .slice(0, 20),

          type: ChannelType.GuildText,

          permissionOverwrites: [
            {
              id:
                interaction.guild.roles.everyone.id,
              deny: [
                PermissionFlagsBits.ViewChannel
              ]
            },
            {
              id: interaction.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory
              ]
            }
          ]
        });

      await pool.query(
        `
        INSERT INTO tickets
          (guild_id, user_id, channel_id, category)
        VALUES ($1, $2, $3, $4)
        `,
        [
          interaction.guild.id,
          interaction.user.id,
          channel.id,
          categoryName
        ]
      );

      const embed = new EmbedBuilder()
        .setColor(PINK)
        .setTitle(
          `🌸 Ticket — ${categoryName}`
        )
        .setDescription(
          `Hola ${interaction.user} 🌸\n\n` +
          `Tu ticket ha sido creado correctamente.\n` +
          `Un miembro del equipo te atenderá pronto.\n\n` +
          `**Categoría:** ${categoryName}`
        );

      const closeButton =
        new ButtonBuilder()
          .setCustomId("close_ticket")
          .setLabel("Cerrar ticket")
          .setEmoji("🔒")
          .setStyle(ButtonStyle.Danger);

      const row =
        new ActionRowBuilder()
          .addComponents(closeButton);

      await channel.send({
        content: `${interaction.user}`,
        embeds: [embed],
        components: [row]
      });

      return interaction.reply({
        content:
          `🌸 Ticket creado correctamente: ${channel}`,
        ephemeral: true
      });
    }

    // =========================
    // CERRAR TICKET
    // =========================

    if (
      interaction.isButton() &&
      interaction.customId === "close_ticket"
    ) {
      const result = await pool.query(
        `
        SELECT *
        FROM tickets
        WHERE channel_id = $1
        `,
        [interaction.channel.id]
      );

      if (!result.rows.length) {
        return interaction.reply({
          content:
            "❌ Este canal no es un ticket.",
          ephemeral: true
        });
      }

      await interaction.reply(
        "🔒 Cerrando ticket..."
      );

      await pool.query(
        `
        DELETE FROM tickets
        WHERE channel_id = $1
        `,
        [interaction.channel.id]
      );

      setTimeout(() => {
        interaction.channel
          .delete()
          .catch(() => {});
      }, 1500);
    }

  } catch (error) {
    console.error(
      "❌ Error en interacción:",
      error
    );

    if (!interaction.replied) {
      await interaction.reply({
        content: "❌ Ocurrió un error.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

// =========================
// PANEL DE TICKETS
// =========================

async function sendTicketPanel(channel) {
  const embed = new EmbedBuilder()
    .setColor(PINK)
    .setTitle("🌸 Centro de Tickets")
    .setDescription(
      "Selecciona abajo el motivo de tu ticket.\n\n" +
      "🛠️ Soporte\n" +
      "🚨 Reporte\n" +
      "❓ Duda\n" +
      "🤝 Allys-Affys-Socio\n" +
      "📝 Postulación\n" +
      "📌 Otro"
    )
    .setFooter({
      text: "Akari Community 🌸"
    });

  const menu =
    new StringSelectMenuBuilder()
      .setCustomId("ticket_menu")
      .setPlaceholder(
        "Selecciona una categoría"
      )
      .addOptions(
        {
          label: "Soporte",
          value: "soporte",
          emoji: "🛠️"
        },
        {
          label: "Reporte",
          value: "reporte",
          emoji: "🚨"
        },
        {
          label: "Duda",
          value: "duda",
          emoji: "❓"
        },
        {
          label: "Allys-Affys-Socio",
          value: "alianza",
          emoji: "🤝"
        },
        {
          label: "Postulación",
          value: "postulacion",
          emoji: "📝"
        },
        {
          label: "Otro",
          value: "otro",
          emoji: "📌"
        }
      );

  const row =
    new ActionRowBuilder()
      .addComponents(menu);

  await channel.send({
    embeds: [embed],
    components: [row]
  });
}

// =========================
// INICIAR BOT
// =========================

async function start() {
  try {
    console.log(
      "🌸 AKARI: entrando en start()..."
    );

    console.log(
      "🌸 Conectando con PostgreSQL..."
    );

    await pool.query("SELECT 1");

    console.log(
      "✅ PostgreSQL conectado correctamente."
    );

    await initDatabase();

    console.log(
      "🌸 Conectando con Discord..."
    );

    await client.login(
      process.env.DISCORD_TOKEN
    );

    console.log(
      "✅ Login de Discord realizado."
    );

  } catch (error) {
    console.error(
      "❌ NO SE PUDO INICIAR AKARI BOT:"
    );

    console.error(error);

    process.exit(1);
  }
}

// =========================
// START
// =========================

console.log(
  "🌸 AKARI: llamando a start()..."
);

start();
