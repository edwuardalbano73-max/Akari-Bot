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

// ======================================================
// CONFIGURACIÓN
// ======================================================

const PREFIX = "M!";
const PINK = 0xFF9DCC;
const PORT = process.env.PORT || 10000;

// ID DEL ROL QUE PUEDE ATENDER / RECLAMAR / CERRAR TICKETS
const STAFF_ROLE_ID = "1555318924365799546";

// ======================================================
// INICIO
// ======================================================

console.log("🌸 AKARI: index.js se está ejecutando...");

if (!process.env.DISCORD_TOKEN) {
  console.error("❌ Falta DISCORD_TOKEN.");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("❌ Falta DATABASE_URL.");
  process.exit(1);
}

console.log("🌸 AKARI: variables de entorno encontradas.");

// ======================================================
// SERVIDOR HTTP PARA RENDER
// ======================================================

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8"
  });

  res.end("🌸 Akari Bot está funcionando correctamente.");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Servidor HTTP escuchando en el puerto ${PORT}.`);
});

// ======================================================
// POSTGRESQL
// ======================================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 10000,
  max: 5
});

pool.on("error", (error) => {
  console.error("❌ Error inesperado de PostgreSQL:", error);
});

// ======================================================
// DISCORD
// ======================================================

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
    Partials.GuildMember
  ]
});

// ======================================================
// BASE DE DATOS
// ======================================================

async function createTables() {
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
      claimed_by TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Para bases de datos creadas con una versión anterior
  await pool.query(`
    ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS claimed_by TEXT;
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
      reputation BIGINT DEFAULT 0,
      PRIMARY KEY (guild_id, user_id)
    );
  `);

  console.log("✅ Tablas verificadas correctamente.");
}

// ======================================================
// USUARIOS
// ======================================================

async function ensureUser(guildId, userId) {
  await pool.query(
    `
    INSERT INTO users (guild_id, user_id)
    VALUES ($1, $2)
    ON CONFLICT (guild_id, user_id) DO NOTHING
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
    WHERE guild_id = $1 AND user_id = $2
    `,
    [guildId, userId]
  );

  return result.rows[0];
}

// ======================================================
// FUNCIONES DE PERMISOS
// ======================================================

function isAdmin(member) {
  return member.permissions.has(PermissionFlagsBits.Administrator);
}

function isStaff(member) {
  return (
    isAdmin(member) ||
    member.roles.cache.has(STAFF_ROLE_ID)
  );
}

// ======================================================
// READY
// ======================================================

client.once("clientReady", () => {
  console.log("=================================");
  console.log("🌸 Akari Bot conectado.");
  console.log(`🤖 Usuario: ${client.user.tag}`);
  console.log(`🏠 Servidores: ${client.guilds.cache.size}`);
  console.log("=================================");

  client.user.setPresence({
    activities: [
      {
        name: "Akari Community 🌸",
        type: 3
      }
    ],
    status: "online"
  });
});

// ======================================================
// BIENVENIDAS
// ======================================================

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

    if (result.rows.length === 0) return;

    const settings = result.rows[0];

    if (!settings.welcome_channel) return;

    const channel = member.guild.channels.cache.get(
      settings.welcome_channel
    );

    if (!channel) return;

    let welcomeText =
      settings.welcome_message ||
      `🌸 ¡Bienvenido/a, {usuario}!`;

    welcomeText = welcomeText
      .replace(/{usuario}/g, `<@${member.id}>`)
      .replace(/{nombre}/g, member.user.username)
      .replace(/{miembros}/g, member.guild.memberCount);

    const embed = new EmbedBuilder()
      .setColor(PINK)
      .setTitle("🌸・𝘼𝙠𝙖𝙧𝙞 𝘾𝙤𝙢𝙢𝙪𝙣𝙞𝙩𝙮")
      .setDescription(welcomeText)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setFooter({
        text: "💗 Gracias por formar parte de Akari Community"
      })
      .setTimestamp();

    await channel.send({
      content: `<@${member.id}>`,
      embeds: [embed]
    });

  } catch (error) {
    console.error("❌ Error en bienvenida:", error);
  }
});

// ======================================================
// MENSAJES
// ======================================================

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content
      .slice(PREFIX.length)
      .trim()
      .split(/\s+/);

    const command = args.shift()?.toLowerCase();

    if (!command) return;

    // ==================================================
    // HELP
    // ==================================================

    if (command === "help" || command === "ayuda") {
      const embed = new EmbedBuilder()
        .setColor(PINK)
        .setTitle("🌸・Akari Bot")
        .setDescription(
          "Bienvenido/a al centro de ayuda de **Akari Community**.\n\n" +
          "💰 **Economía**\n" +
          "`M!balance` `M!daily` `M!work` `M!pay` `M!shop`\n\n" +
          "🎮 **Diversión**\n" +
          "`M!coin` `M!flip` `M!dice` `M!guess`\n\n" +
          "💗 **Social**\n" +
          "`M!profile` `M!hug` `M!friend` `M!rep`\n\n" +
          "📊 **Información**\n" +
          "`M!ping`\n\n" +
          "🌸 Usa `M!admin` si eres administrador."
        )
        .setFooter({
          text: "Akari Community 🌸"
        });

      return message.reply({
        embeds: [embed]
      });
    }

    // ==================================================
    // PING
    // ==================================================

    if (command === "ping") {
      return message.reply(
        `🏓 Pong! **${client.ws.ping}ms**`
      );
    }

    // ==================================================
    // ADMIN
    // ==================================================

    if (command === "admin") {
      if (!isAdmin(message.member)) {
        return message.reply(
          "❌ No tienes permiso para utilizar este comando."
        );
      }

      const embed = new EmbedBuilder()
        .setColor(PINK)
        .setTitle("🛡️・Panel de Administración")
        .setDescription(
          "Bienvenido al panel administrativo de **Akari Community**.\n\n" +
          "Selecciona una categoría en el menú para consultar sus opciones."
        )
        .setFooter({
          text: "Akari Bot 🌸"
        });

      const menu = new StringSelectMenuBuilder()
        .setCustomId("admin_menu")
        .setPlaceholder("Selecciona una categoría...")
        .addOptions(
          {
            label: "Moderación",
            description: "Herramientas de moderación",
            value: "moderacion",
            emoji: "🛡️"
          },
          {
            label: "Tickets",
            description: "Administración de tickets",
            value: "tickets",
            emoji: "🎫"
          },
          {
            label: "Configuración",
            description: "Configura el servidor",
            value: "configuracion",
            emoji: "⚙️"
          },
          {
            label: "Economía",
            description: "Opciones de economía",
            value: "economia",
            emoji: "💰"
          },
          {
            label: "Información",
            description: "Información del servidor",
            value: "informacion",
            emoji: "📊"
          },
          {
            label: "Bienvenidas",
            description: "Configura las bienvenidas",
            value: "bienvenidas",
            emoji: "👋"
          }
        );

      const row = new ActionRowBuilder().addComponents(menu);

      return message.reply({
        embeds: [embed],
        components: [row]
      });
    }

    // ==================================================
    // TICKET PANEL
    // ==================================================

    if (command === "ticketpanel") {
      if (!isAdmin(message.member)) {
        return message.reply(
          "❌ No tienes permiso para utilizar este comando."
        );
      }

      await sendTicketPanel(message.channel);

      return message.reply(
        "✅ Panel de tickets enviado correctamente."
      );
    }

    // ==================================================
    // SETWELCOME
    // ==================================================

    if (command === "setwelcome") {
      if (!isAdmin(message.member)) {
        return message.reply(
          "❌ No tienes permiso para utilizar este comando."
        );
      }

      const channel =
        message.mentions.channels.first();

      if (!channel) {
        return message.reply(
          "❌ Uso correcto: `M!setwelcome #canal`"
        );
      }

      await pool.query(
        `
        INSERT INTO settings (guild_id, welcome_channel)
        VALUES ($1, $2)
        ON CONFLICT (guild_id)
        DO UPDATE SET welcome_channel = EXCLUDED.welcome_channel
        `,
        [message.guild.id, channel.id]
      );

      return message.reply(
        `✅ Canal de bienvenida configurado en ${channel}.`
      );
    }

    // ==================================================
    // ECONOMÍA
    // ==================================================

    if (
      command === "balance" ||
      command === "bal" ||
      command === "coins"
    ) {
      const user = await getUser(
        message.guild.id,
        message.author.id
      );

      return message.reply(
        `💰 **${message.author.username}** tiene **${user.coins}** monedas.`
      );
    }

    if (command === "daily") {
      const user = await getUser(
        message.guild.id,
        message.author.id
      );

      const now = Date.now();
      const cooldown = 24 * 60 * 60 * 1000;

      if (user.daily && now - Number(user.daily) < cooldown) {
        const remaining =
          cooldown - (now - Number(user.daily));

        const hours = Math.ceil(
          remaining / (60 * 60 * 1000)
        );

        return message.reply(
          `⏳ Ya reclamaste tu recompensa diaria. Vuelve en aproximadamente **${hours}h**.`
        );
      }

      const amount = 500;

      await pool.query(
        `
        UPDATE users
        SET coins = coins + $1,
            daily = $2
        WHERE guild_id = $3 AND user_id = $4
        `,
        [
          amount,
          now,
          message.guild.id,
          message.author.id
        ]
      );

      return message.reply(
        `💰 Has recibido **${amount} monedas** por tu recompensa diaria.`
      );
    }

    if (command === "work") {
      const user = await getUser(
        message.guild.id,
        message.author.id
      );

      const now = Date.now();
      const cooldown = 30 * 1000;

      if (user.work && now - Number(user.work) < cooldown) {
        const seconds = Math.ceil(
          (cooldown - (now - Number(user.work))) / 1000
        );

        return message.reply(
          `⏳ Espera **${seconds}s** antes de volver a trabajar.`
        );
      }

      const amount =
        Math.floor(Math.random() * 201) + 100;

      await pool.query(
        `
        UPDATE users
        SET coins = coins + $1,
            work = $2
        WHERE guild_id = $3 AND user_id = $4
        `,
        [
          amount,
          now,
          message.guild.id,
          message.author.id
        ]
      );

      return message.reply(
        `💼 Has trabajado y ganado **${amount} monedas**.`
      );
    }

    if (command === "pay") {
      const target =
        message.mentions.users.first();

      const amount = parseInt(args[1]);

      if (!target || !amount || amount <= 0) {
        return message.reply(
          "❌ Uso correcto: `M!pay @usuario cantidad`"
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

      await getUser(
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
        WHERE guild_id = $2 AND user_id = $3
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
        WHERE guild_id = $2 AND user_id = $3
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

    if (
      command === "shop" ||
      command === "tienda"
    ) {
      const embed = new EmbedBuilder()
        .setColor(PINK)
        .setTitle("🛍️・Tienda")
        .setDescription(
          "🌸 La tienda de Akari estará disponible próximamente."
        );

      return message.reply({
        embeds: [embed]
      });
    }

    // ==================================================
    // DIVERSIÓN
    // ==================================================

    if (
      command === "coin" ||
      command === "flip"
    ) {
      const result =
        Math.random() < 0.5
          ? "🪙 Cara"
          : "🪙 Cruz";

      return message.reply(
        `🪙 **Resultado:** ${result}`
      );
    }

    if (
      command === "dice" ||
      command === "dado"
    ) {
      const result =
        Math.floor(Math.random() * 6) + 1;

      return message.reply(
        `🎲 Has sacado un **${result}**.`
      );
    }

    if (command === "guess") {
      const number =
        Math.floor(Math.random() * 5) + 1;

      const guess = parseInt(args[0]);

      if (!guess || guess < 1 || guess > 5) {
        return message.reply(
          "❌ Adivina un número del **1 al 5**. Ejemplo: `M!guess 3`"
        );
      }

      if (guess === number) {
        return message.reply(
          `🎉 ¡Correcto! El número era **${number}**.`
        );
      }

      return message.reply(
        `❌ Incorrecto. El número era **${number}**.`
      );
    }

    // ==================================================
    // SOCIAL
    // ==================================================

    if (
      command === "profile" ||
      command === "perfil"
    ) {
      const user =
        message.mentions.users.first() ||
        message.author;

      const data = await getUser(
        message.guild.id,
        user.id
      );

      const rep = await pool.query(
        `
        SELECT reputation
        FROM reputation
        WHERE guild_id = $1 AND user_id = $2
        `,
        [
          message.guild.id,
          user.id
        ]
      );

      const reputation =
        rep.rows[0]?.reputation || 0;

      const embed = new EmbedBuilder()
        .setColor(PINK)
        .setTitle(`🌸 Perfil de ${user.username}`)
        .setThumbnail(
          user.displayAvatarURL({
            dynamic: true
          })
        )
        .addFields(
          {
            name: "💰 Monedas",
            value: `${data.coins}`,
            inline: true
          },
          {
            name: "⭐ Reputación",
            value: `${reputation}`,
            inline: true
          }
        );

      return message.reply({
        embeds: [embed]
      });
    }

    if (command === "hug") {
      const target =
        message.mentions.users.first();

      if (!target) {
        return message.reply(
          "🤗 Menciona a alguien para darle un abrazo."
        );
      }

      return message.reply(
        `🤗 ${message.author} le dio un abrazo a ${target}.`
      );
    }

    if (command === "friend") {
      const target =
        message.mentions.users.first();

      if (!target) {
        return message.reply(
          "💗 Menciona a alguien."
        );
      }

      return message.reply(
        `💗 ${message.author} quiere ser amigo/a de ${target}.`
      );
    }

    if (command === "rep") {
      const target =
        message.mentions.users.first();

      if (!target) {
        return message.reply(
          "❌ Menciona a la persona a la que quieres dar reputación."
        );
      }

      if (target.id === message.author.id) {
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
        `⭐ ${target} ha recibido **+1 reputación**.`
      );
    }

    // ==================================================
    // MODERACIÓN
    // ==================================================

    if (command === "warn") {
      if (!isStaff(message.member)) {
        return message.reply(
          "❌ No tienes permiso para usar este comando."
        );
      }

      const target =
        message.mentions.members.first();

      if (!target) {
        return message.reply(
          "❌ Menciona al usuario que quieres advertir."
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
        `⚠️ ${target} recibió una advertencia.\n📝 Razón: **${reason}**`
      );
    }

    if (
      command === "warnings" ||
      command === "warns"
    ) {
      if (!isStaff(message.member)) {
        return message.reply(
          "❌ No tienes permiso."
        );
      }

      const target =
        message.mentions.users.first();

      if (!target) {
        return message.reply(
          "❌ Menciona a un usuario."
        );
      }

      const result = await pool.query(
        `
        SELECT *
        FROM warnings
        WHERE guild_id = $1 AND user_id = $2
        ORDER BY created_at DESC
        `,
        [
          message.guild.id,
          target.id
        ]
      );

      if (result.rows.length === 0) {
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

      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(PINK)
            .setTitle(`⚠️ Advertencias de ${target.username}`)
            .setDescription(text)
        ]
      });
    }

    if (command === "timeout") {
      if (!isStaff(message.member)) {
        return message.reply(
          "❌ No tienes permiso."
        );
      }

      const target =
        message.mentions.members.first();

      const minutes =
        parseInt(args[1]) || 10;

      if (!target) {
        return message.reply(
          "❌ Uso: `M!timeout @usuario minutos`"
        );
      }

      try {
        await target.timeout(
          minutes * 60 * 1000,
          "Moderación de Akari Bot"
        );

        return message.reply(
          `🔇 ${target} ha recibido timeout durante **${minutes} minutos**.`
        );
      } catch {
        return message.reply(
          "❌ No pude aplicar el timeout."
        );
      }
    }

    if (command === "untimeout") {
      if (!isStaff(message.member)) {
        return message.reply(
          "❌ No tienes permiso."
        );
      }

      const target =
        message.mentions.members.first();

      if (!target) {
        return message.reply(
          "❌ Menciona a un usuario."
        );
      }

      try {
        await target.timeout(null);

        return message.reply(
          `🔊 Se quitó el timeout a ${target}.`
        );
      } catch {
        return message.reply(
          "❌ No pude quitar el timeout."
        );
      }
    }

    if (command === "kick") {
      if (!isStaff(message.member)) {
        return message.reply(
          "❌ No tienes permiso."
        );
      }

      const target =
        message.mentions.members.first();

      if (!target) {
        return message.reply(
          "❌ Menciona a un usuario."
        );
      }

      try {
        await target.kick(
          "Expulsado por Akari Bot"
        );

        return message.reply(
          `👢 ${target.user.tag} fue expulsado.`
        );
      } catch {
        return message.reply(
          "❌ No pude expulsar a ese usuario."
        );
      }
    }

    if (command === "ban") {
      if (!isStaff(message.member)) {
        return message.reply(
          "❌ No tienes permiso."
        );
      }

      const target =
        message.mentions.members.first();

      if (!target) {
        return message.reply(
          "❌ Menciona a un usuario."
        );
      }

      try {
        await target.ban({
          reason: "Baneado por Akari Bot"
        });

        return message.reply(
          `🔨 ${target.user.tag} fue baneado.`
        );
      } catch {
        return message.reply(
          "❌ No pude banear a ese usuario."
        );
      }
    }

    if (command === "clear") {
      if (!isStaff(message.member)) {
        return message.reply(
          "❌ No tienes permiso."
        );
      }

      const amount =
        parseInt(args[0]);

      if (!amount || amount < 1 || amount > 100) {
        return message.reply(
          "❌ Indica una cantidad entre 1 y 100."
        );
      }

      try {
        await message.channel.bulkDelete(
          amount,
          true
        );

        return message.channel.send(
          `🧹 Se eliminaron **${amount} mensajes**.`
        );
      } catch {
        return message.reply(
          "❌ No pude eliminar los mensajes."
        );
      }
    }

  } catch (error) {
    console.error("❌ Error en messageCreate:", error);
  }
});

// ======================================================
// INTERACCIONES
// ======================================================

client.on("interactionCreate", async (interaction) => {
  try {

    // ==================================================
    // MENÚ ADMIN
    // ==================================================

    if (interaction.isStringSelectMenu()) {

      if (interaction.customId === "admin_menu") {

        if (!isAdmin(interaction.member)) {
          return interaction.reply({
            content: "❌ No tienes permiso.",
            ephemeral: true
          });
        }

        const selected =
          interaction.values[0];

        // MODERACIÓN
        if (selected === "moderacion") {
          const embed = new EmbedBuilder()
            .setColor(PINK)
            .setTitle("🛡️・Moderación")
            .setDescription(
              "`M!warn @usuario razón`\n" +
              "`M!warnings @usuario`\n" +
              "`M!timeout @usuario minutos`\n" +
              "`M!untimeout @usuario`\n" +
              "`M!kick @usuario`\n" +
              "`M!ban @usuario`\n" +
              "`M!clear cantidad`"
            );

          return interaction.reply({
            embeds: [embed],
            ephemeral: true
          });
        }

        // TICKETS
        if (selected === "tickets") {
          const embed = new EmbedBuilder()
            .setColor(PINK)
            .setTitle("🎫・Tickets")
            .setDescription(
              "`M!ticketpanel`\n\n" +
              "🎫 Envía el panel público de tickets.\n\n" +
              `🛡️ Rol de atención: <@&${STAFF_ROLE_ID}>\n\n` +
              "El staff puede reclamar y cerrar tickets."
            );

          return interaction.reply({
            embeds: [embed],
            ephemeral: true
          });
        }

        // CONFIGURACIÓN
        if (selected === "configuracion") {
          const embed = new EmbedBuilder()
            .setColor(PINK)
            .setTitle("⚙️・Configuración")
            .setDescription(
              "`M!setwelcome #canal`\n\n" +
              "Configura el canal donde aparecerán las bienvenidas."
            );

          return interaction.reply({
            embeds: [embed],
            ephemeral: true
          });
        }

        // ECONOMÍA
        if (selected === "economia") {
          const embed = new EmbedBuilder()
            .setColor(PINK)
            .setTitle("💰・Economía")
            .setDescription(
              "La economía de Akari permite a los usuarios conseguir monedas mediante:\n\n" +
              "💼 `M!work`\n" +
              "🎁 `M!daily`\n" +
              "💸 `M!pay`\n" +
              "🛍️ `M!shop`"
            );

          return interaction.reply({
            embeds: [embed],
            ephemeral: true
          });
        }

        // INFORMACIÓN
        if (selected === "informacion") {
          const embed = new EmbedBuilder()
            .setColor(PINK)
            .setTitle("📊・Información")
            .setDescription(
              `🏠 **Servidor:** ${interaction.guild.name}\n` +
              `👥 **Miembros:** ${interaction.guild.memberCount}\n` +
              `🤖 **Bot:** ${client.user.tag}\n` +
              `📡 **Ping:** ${client.ws.ping}ms`
            );

          return interaction.reply({
            embeds: [embed],
            ephemeral: true
          });
        }

        // BIENVENIDAS
        if (selected === "bienvenidas") {
          const result = await pool.query(
            `
            SELECT welcome_channel
            FROM settings
            WHERE guild_id = $1
            `,
            [interaction.guild.id]
          );

          const channelId =
            result.rows[0]?.welcome_channel;

          const channelText =
            channelId
              ? `<#${channelId}>`
              : "❌ No configurado";

          const embed = new EmbedBuilder()
            .setColor(PINK)
            .setTitle("👋・Bienvenidas")
            .setDescription(
              "Configura el sistema de bienvenida de Akari Community.\n\n" +
              `📢 **Canal actual:** ${channelText}\n\n` +
              "Para configurar el canal usa:\n" +
              "`M!setwelcome #canal`\n\n" +
              "✨ Cuando entre un nuevo miembro, Akari enviará automáticamente un Embed de bienvenida."
            );

          return interaction.reply({
            embeds: [embed],
            ephemeral: true
          });
        }
      }

      // ==================================================
      // MENÚ DE TICKETS
      // ==================================================

      if (interaction.customId === "ticket_menu") {

        const category =
          interaction.values[0];

        const categoryNames = {
          soporte: "🛠️ Soporte",
          reporte: "🚨 Reporte",
          duda: "❓ Duda",
          alianza: "🤝 Allys/Affys/Socio",
          postulacion: "📝 Postulación",
          otro: "📌 Otro"
        };

        const categoryName =
          categoryNames[category] || category;

        // Evitar múltiples tickets del mismo usuario
        const existing = await pool.query(
          `
          SELECT channel_id
          FROM tickets
          WHERE guild_id = $1 AND user_id = $2
          `,
          [
            interaction.guild.id,
            interaction.user.id
          ]
        );

        if (existing.rows.length > 0) {
          const existingChannel =
            interaction.guild.channels.cache.get(
              existing.rows[0].channel_id
            );

          if (existingChannel) {
            return interaction.reply({
              content:
                `❌ Ya tienes un ticket abierto: ${existingChannel}`,
              ephemeral: true
            });
          }

          await pool.query(
            `
            DELETE FROM tickets
            WHERE guild_id = $1 AND user_id = $2
            `,
            [
              interaction.guild.id,
              interaction.user.id
            ]
          );
        }

        const channel =
          await interaction.guild.channels.create({
            name:
              `ticket-${interaction.user.username}`
                .toLowerCase()
                .replace(/[^a-z0-9-]/g, "")
                .slice(0, 80),

            type: ChannelType.GuildText,

            permissionOverwrites: [
              {
                id: interaction.guild.roles.everyone.id,
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
              },
              {
                id: STAFF_ROLE_ID,
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
            category
          ]
        );

        const embed = new EmbedBuilder()
          .setColor(PINK)
          .setTitle(
            "🌸・𝘼𝙠𝙖𝙧𝙞 𝘾𝙤𝙢𝙢𝙪𝙣𝙞𝙩𝙮"
          )
          .setDescription(
            "🎫 **TICKET ABIERTO**\n\n" +

            "¡Bienvenido/a a tu ticket! 💗\n\n" +

            "Tu solicitud ha sido creada correctamente.\n\n" +

            `📂 **Categoría:**\n${categoryName}\n\n` +

            "📝 Describe con detalle el motivo de tu ticket para que nuestro equipo pueda ayudarte de la mejor manera posible.\n\n" +

            "━━━━━━━━━━━━━━━━━━━━\n\n" +

            "📌 **RECUERDA**\n\n" +

            "✦ Sé claro con tu solicitud.\n" +
            "✦ Mantén el respeto en todo momento.\n" +
            "✦ Si tienes pruebas, envíalas aquí.\n" +
            "✦ No hagas menciones innecesarias al staff.\n" +
            "✦ Ten paciencia mientras atendemos tu solicitud.\n\n" +

            "🌸 Un miembro de nuestro equipo te atenderá lo antes posible.\n\n" +

            "🔒 Cuando tu solicitud haya sido solucionada, utiliza el botón de abajo para cerrar el ticket.\n\n" +

            "💗 Gracias por contactar con Akari Community."
          )
          .setFooter({
            text: "Akari Community 🌸"
          })
          .setTimestamp();

        const buttons =
          new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId("claim_ticket")
                .setLabel("Reclamar ticket")
                .setEmoji("🎫")
                .setStyle(ButtonStyle.Primary),

              new ButtonBuilder()
                .setCustomId("close_ticket")
                .setLabel("Cerrar ticket")
                .setEmoji("🔒")
                .setStyle(ButtonStyle.Danger)
            );

        await channel.send({
          content:
            `<@${interaction.user.id}>\n<@&${STAFF_ROLE_ID}>`,
          embeds: [embed],
          components: [buttons]
        });

        return interaction.reply({
          content:
            `✅ Tu ticket ha sido creado: ${channel}`,
          ephemeral: true
        });
      }
    }

    // ==================================================
    // RECLAMAR TICKET
    // ==================================================

    if (
      interaction.isButton() &&
      interaction.customId === "claim_ticket"
    ) {

      if (!isStaff(interaction.member)) {
        return interaction.reply({
          content:
            "❌ Solo el staff puede reclamar tickets.",
          ephemeral: true
        });
      }

      const result = await pool.query(
        `
        SELECT *
        FROM tickets
        WHERE channel_id = $1
        `,
        [interaction.channel.id]
      );

      if (result.rows.length === 0) {
        return interaction.reply({
          content:
            "❌ Este canal no está registrado como ticket.",
          ephemeral: true
        });
      }

      const ticket = result.rows[0];

      if (ticket.claimed_by) {
        return interaction.reply({
          content:
            `❌ Este ticket ya fue reclamado por <@${ticket.claimed_by}>.`,
          ephemeral: true
        });
      }

      await pool.query(
        `
        UPDATE tickets
        SET claimed_by = $1
        WHERE channel_id = $2
        `,
        [
          interaction.user.id,
          interaction.channel.id
        ]
      );

      const messages =
        await interaction.channel.messages.fetch({
          limit: 20
        });

      const botMessage =
        messages.find(
          (msg) =>
            msg.author.id === client.user.id &&
            msg.embeds.length > 0
        );

      if (botMessage) {
        const oldEmbed =
          botMessage.embeds[0];

        const newEmbed =
          EmbedBuilder.from(oldEmbed)
            .setColor(PINK)
            .addFields({
              name: "🎫 Ticket reclamado",
              value:
                `<@${interaction.user.id}> está atendiendo este ticket.`,
              inline: false
            });

        await botMessage.edit({
          embeds: [newEmbed]
        });
      }

      return interaction.reply({
        content:
          `🎫 ${interaction.user} ha reclamado este ticket.`,
        allowedMentions: {
          users: [interaction.user.id]
        }
      });
    }

    // ==================================================
    // CERRAR TICKET
    // ==================================================

    if (
      interaction.isButton() &&
      interaction.customId === "close_ticket"
    ) {

      if (!isStaff(interaction.member)) {
        return interaction.reply({
          content:
            "❌ Solo el staff puede cerrar tickets.",
          ephemeral: true
        });
      }

      const result = await pool.query(
        `
        SELECT *
        FROM tickets
        WHERE channel_id = $1
        `,
        [interaction.channel.id]
      );

      if (result.rows.length === 0) {
        return interaction.reply({
          content:
            "❌ Este canal no está registrado como ticket.",
          ephemeral: true
        });
      }

      await interaction.reply(
        "🔒 Este ticket se cerrará en **5 segundos**..."
      );

      setTimeout(async () => {
        try {
          await pool.query(
            `
            DELETE FROM tickets
            WHERE channel_id = $1
            `,
            [interaction.channel.id]
          );

          await interaction.channel.delete(
            "Ticket cerrado por el staff"
          );

        } catch (error) {
          console.error(
            "❌ Error cerrando ticket:",
            error
          );
        }
      }, 5000);
    }

  } catch (error) {
    console.error(
      "❌ Error en interactionCreate:",
      error
    );

    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({
          content:
            "❌ Ocurrió un error procesando esta acción.",
          ephemeral: true
        });
      } catch {}
    }
  }
});

// ======================================================
// PANEL DE TICKETS
// ======================================================

async function sendTicketPanel(channel) {

  const embed = new EmbedBuilder()
    .setColor(PINK)
    .setTitle(
      "🌸・𝘼𝙠𝙖𝙧𝙞 𝘾𝙤𝙢𝙢𝙪𝙣𝙞𝙩𝙮"
    )
    .setDescription(
      "🎫 **CENTRO DE TICKETS**\n\n" +

      "¡Bienvenido al centro de tickets de **Akari Community**! 💗\n\n" +

      "Si necesitas ayuda, quieres realizar un reporte, tienes alguna duda o deseas contactar con nuestro equipo, puedes abrir un ticket seleccionando la categoría correspondiente en el menú.\n\n" +

      "📂 **¿Qué puedes hacer?**\n\n" +

      "🛠️・Solicitar ayuda con algún problema.\n" +
      "🚨・Reportar usuarios o situaciones.\n" +
      "❓・Resolver cualquier duda.\n" +
      "🤝・Solicitar Allys, Affys o Socios.\n" +
      "📝・Enviar una postulación.\n" +
      "📌・Realizar cualquier otra solicitud.\n\n" +

      "━━━━━━━━━━━━━━━━━━━━\n\n" +

      "📌 **Antes de abrir un ticket**\n\n" +

      "> ✦ Selecciona la categoría que corresponda.\n" +
      "> ✦ Explica claramente el motivo de tu ticket.\n" +
      "> ✦ Proporciona pruebas cuando sean necesarias.\n" +
      "> ✦ Evita abrir tickets repetidos o innecesarios.\n" +
      "> ✦ Respeta al equipo encargado de atenderte.\n\n" +

      "━━━━━━━━━━━━━━━━━━━━\n\n" +

      "🌸 Nuestro equipo revisará tu solicitud lo antes posible.\n\n" +

      "💗 Gracias por formar parte de **Akari Community**.\n\n" +

      "👇 **Selecciona una categoría del menú para abrir tu ticket.**"
    )
    .setFooter({
      text: "Akari Community • Sistema de Tickets 🌸"
    });

  const menu =
    new StringSelectMenuBuilder()
      .setCustomId("ticket_menu")
      .setPlaceholder(
        "🎫 Selecciona una categoría..."
      )
      .addOptions(
        {
          label: "Soporte",
          description: "Necesitas ayuda con algo",
          value: "soporte",
          emoji: "🛠️"
        },
        {
          label: "Reporte",
          description: "Reporta un usuario o problema",
          value: "reporte",
          emoji: "🚨"
        },
        {
          label: "Duda",
          description: "Resuelve una pregunta",
          value: "duda",
          emoji: "❓"
        },
        {
          label: "Allys/Affys/Socio",
          description: "Solicitudes de colaboración",
          value: "alianza",
          emoji: "🤝"
        },
        {
          label: "Postulación",
          description: "Postúlate para el staff",
          value: "postulacion",
          emoji: "📝"
        },
        {
          label: "Otro",
          description: "Otra solicitud",
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

// ======================================================
// START
// ======================================================

async function start() {
  try {

    console.log("🌸 AKARI: entrando en start()...");
    console.log("🌸 Conectando con PostgreSQL...");

    await pool.query("SELECT 1");

    console.log("✅ PostgreSQL conectado correctamente.");

    await createTables();

    console.log("🌸 Conectando con Discord...");

    await client.login(
      process.env.DISCORD_TOKEN
    );

    console.log("✅ Login de Discord realizado.");

  } catch (error) {

    console.error(
      "❌ Error iniciando Akari:",
      error
    );

    process.exit(1);
  }
}

start();
