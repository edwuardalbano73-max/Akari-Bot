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
// =============================
// AKARI BOT - CONFIGURACIÓN
// =============================
const PREFIX = "M!";
const PINK = 0xFF9DCC;
if (!process.env.DISCORD_TOKEN) {
  throw new Error("Falta la variable DISCORD_TOKEN.");
}
if (!process.env.DATABASE_URL) {
  throw new Error("Falta la variable DATABASE_URL de PostgreSQL.");
}
// PostgreSQL de Render requiere SSL/TLS
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});
const embed = (title, description) =>
  new EmbedBuilder()
    .setColor(PINK)
    .setTitle(`🌸 ${title}`)
    .setDescription(description)
    .setFooter({ text: "Akari Bot • Comunidad" })
    .setTimestamp();
const money = n => Number(n).toLocaleString("es-ES") + " monedas";
const errorMessage = (channel, message) =>
  channel.send({ embeds: [embed("Ups", `❌ ${message}`)] });
const isAdmin = member =>
  member.permissions.has(PermissionFlagsBits.Administrator) ||
  member.permissions.has(PermissionFlagsBits.ManageGuild);
const isModerator = member =>
  member.permissions.has(PermissionFlagsBits.Administrator) ||
  member.permissions.has(PermissionFlagsBits.ModerateMembers);
const mention = user => `<@${user.id}>`;
async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS akari_users (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      balance BIGINT NOT NULL DEFAULT 100,
      last_work BIGINT NOT NULL DEFAULT 0,
      last_daily BIGINT NOT NULL DEFAULT 0,
      PRIMARY KEY (guild_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS akari_settings (
      guild_id TEXT PRIMARY KEY,
      welcome_channel TEXT
    );
    CREATE TABLE IF NOT EXISTS akari_tickets (
      channel_id TEXT PRIMARY KEY,
      guild_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open'
    );
    CREATE TABLE IF NOT EXISTS akari_warnings (
      id BIGSERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS akari_reputation (
      guild_id TEXT NOT NULL,
      giver_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      given_at BIGINT NOT NULL,
      PRIMARY KEY (guild_id, giver_id)
    );
  `);
  console.log("🌸 Base de datos de Akari preparada.");
}
async function getAccount(guildId, userId) {
  await pool.query(
    `INSERT INTO akari_users (guild_id, user_id)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [guildId, userId]
  );
  const result = await pool.query(
    `SELECT * FROM akari_users
     WHERE guild_id = $1 AND user_id = $2`,
    [guildId, userId]
  );
  return result.rows[0];
}
async function changeBalance(guildId, userId, amount) {
  await getAccount(guildId, userId);
  await pool.query(
    `UPDATE akari_users
     SET balance = balance + $3
     WHERE guild_id = $1 AND user_id = $2`,
    [guildId, userId, amount]
  );
}
function parseDuration(input) {
  const match = /^(\d+)(s|m|h|d)$/i.exec(input || "");
  if (!match) return null;
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multiplier = {
    s: 1000,
    m: 60000,
    h: 3600000,
    d: 86400000
  }[unit];
  const result = value * multiplier;
  if (result < 1000 || result > 28 * 86400000) return null;
  return result;
}
function parseAmount(input) {
  if (!/^\d+$/.test(input || "")) return null;
  const amount = Number(input);
  if (!Number.isSafeInteger(amount) || amount <= 0) return null;
  return amount;
}
// =============================
// INICIO
// =============================
client.once("ready", () => {
  console.log(`🌸 ${client.user.tag} está conectado.`);
  client.user.setPresence({
    activities: [{ name: "Akari Community 🌸" }],
    status: "online"
  });
});
// =============================
// BIENVENIDAS
// =============================
client.on("guildMemberAdd", async member => {
  try {
    const result = await pool.query(
      "SELECT welcome_channel FROM akari_settings WHERE guild_id = $1",
      [member.guild.id]
    );
    const channelId = result.rows[0]?.welcome_channel;
    if (!channelId) return;
    const channel = await member.guild.channels
      .fetch(channelId)
      .catch(() => null);
    if (channel?.isTextBased()) {
      await channel.send({
        embeds: [
          embed(
            "¡Una nueva personita!",
            `🌸 ¡Bienvenido/a ${mention(member.user)} a **${member.guild.name}**!\n\n¡Esperamos que disfrutes de Akari Community! 💗`
          )
        ]
      });
    }
  } catch (error) {
    console.error("Error en bienvenida:", error);
  }
});
// =============================
// COMANDOS DE MENSAJE
// =============================
client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot) return;
  if (!message.content
    .toLowerCase()
    .startsWith(PREFIX.toLowerCase())) return;
  const input = message.content.slice(PREFIX.length).trim();
  if (!input) return;
  const args = input.split(/\s+/);
  const command = args.shift().toLowerCase();
  const target = message.mentions.members.first();
  const guildId = message.guild.id;
  const userId = message.author.id;
  try {
    // =============================
    // AYUDA PÚBLICA
    // =============================
    if (command === "help" || command === "ayuda") {
      return message.channel.send({
        embeds: [
          embed(
            "Comandos de Akari",
            "**💰 Economía**\n" +
            "`M!balance` · `M!daily` · `M!work` · `M!pay` · `M!shop`\n\n" +
            "**🎮 Minijuegos**\n" +
            "`M!coin cara 50` · `M!dice 4 50` · `M!guess`\n\n" +
            "**💗 Social**\n" +
            "`M!profile` · `M!hug @usuario` · `M!friend @usuario` · `M!rep @usuario`\n\n" +
            "**🌸 General**\n" +
            "`M!help` · `M!ping`\n\n" +
            "Los comandos de moderación y administración son privados."
          )
        ]
      });
    }
    if (command === "ping") {
      return message.reply(
        `🏓 ¡Pong! Latencia: ${client.ws.ping} ms.`
      );
    }
    // =============================
    // ECONOMÍA
    // =============================
    if (
      command === "balance" ||
      command === "bal" ||
      command === "dinero"
    ) {
      const member = target?.user || message.author;
      const account = await getAccount(
        guildId,
        member.id
      );
      return message.channel.send({
        embeds: [
          embed(
            "Cartera 💰",
            `${mention(member)} tiene **${money(account.balance)}**.`
          )
        ]
      });
    }
    if (command === "daily") {
      const account = await getAccount(
        guildId,
        userId
      );
      const now = Date.now();
      const cooldown = 24 * 60 * 60 * 1000;
      const remaining =
        cooldown - (now - Number(account.last_daily));
      if (remaining > 0) {
        const hours = Math.ceil(
          remaining / 3600000
        );
        return errorMessage(
          message.channel,
          `Ya reclamaste tu recompensa. Vuelve en aproximadamente ${hours} h.`
        );
      }
      const reward = 300;
      const result = await pool.query(
        `UPDATE akari_users
         SET balance = balance + $3,
             last_daily = $4
         WHERE guild_id = $1
         AND user_id = $2
         AND last_daily = $5`,
        [
          guildId,
          userId,
          reward,
          now,
          account.last_daily
        ]
      );
      if (!result.rowCount) {
        return errorMessage(
          message.channel,
          "Tu cuenta cambió al mismo tiempo. Inténtalo de nuevo."
        );
      }
      return message.channel.send({
        embeds: [
          embed(
            "Recompensa diaria",
            `🎁 Recibiste **${money(reward)}**.`
          )
        ]
      });
    }
    if (
      command === "work" ||
      command === "trabajar"
    ) {
      const account = await getAccount(
        guildId,
        userId
      );
      const now = Date.now();
      const cooldown = 30 * 1000;
      const remaining =
        cooldown - (now - Number(account.last_work));
      if (remaining > 0) {
        return errorMessage(
          message.channel,
          `Estás descansando. Espera ${Math.ceil(remaining / 1000)} segundos.`
        );
      }
      const reward =
        Math.floor(Math.random() * 201) + 100;
      const result = await pool.query(
        `UPDATE akari_users
         SET balance = balance + $3,
             last_work = $4
         WHERE guild_id = $1
         AND user_id = $2
         AND last_work = $5`,
        [
          guildId,
          userId,
          reward,
          now,
          account.last_work
        ]
      );
      if (!result.rowCount) {
        return errorMessage(
          message.channel,
          "Inténtalo otra vez en un momento."
        );
      }
      return message.channel.send({
        embeds: [
          embed(
            "¡Buen trabajo!",
            `💼 Ganaste **${money(reward)}**.`
          )
        ]
      });
    }
    if (
      command === "pay" ||
      command === "pagar"
    ) {
      if (!target) {
        return errorMessage(
          message.channel,
          "Menciona a quien quieras pagar."
        );
      }
      if (
        target.id === userId ||
        target.user.bot
      ) {
        return errorMessage(
          message.channel,
          "No puedes pagarle a esa cuenta."
        );
      }
      const amount = parseAmount(args[1]);
      if (!amount) {
        return errorMessage(
          message.channel,
          "Uso: `M!pay @usuario cantidad`."
        );
      }
      const sender = await getAccount(
        guildId,
        userId
      );
      await getAccount(
        guildId,
        target.id
      );
      const result = await pool.query(
        `UPDATE akari_users
         SET balance = balance - $3
         WHERE guild_id = $1
         AND user_id = $2
         AND balance >= $3`,
        [
          guildId,
          userId,
          amount
        ]
      );
      if (!result.rowCount) {
        return errorMessage(
          message.channel,
          "No tienes suficientes monedas."
        );
      }
      await changeBalance(
        guildId,
        target.id,
        amount
      );
      return message.channel.send({
        embeds: [
          embed(
            "Transferencia",
            `💸 ${mention(message.author)} pagó **${money(amount)}** a ${mention(target.user)}.`
          )
        ]
      });
    }
    if (
      command === "shop" ||
      command === "tienda"
    ) {
      return message.channel.send({
        embeds: [
          embed(
            "Tienda de Akari",
            "🌸 **Rosa mágica** — 500 monedas\n" +
            "💎 **Cristal lunar** — 1.000 monedas\n" +
            "⭐ **Estrella dorada** — 2.500 monedas\n\n" +
            "La tienda muestra los artículos disponibles; las compras se añadirán en una siguiente versión."
          )
        ]
      });
    }
    // =============================
    // MINIJUEGOS
    // =============================
    if (
      command === "coin" ||
      command === "moneda"
    ) {
      const side = (args[0] || "").toLowerCase();
      const amount = parseAmount(args[1]);
      if (
        !["cara", "cruz"].includes(side) ||
        !amount
      ) {
        return errorMessage(
          message.channel,
          "Uso: `M!coin cara 50` o `M!coin cruz 50`."
        );
      }
      const account = await getAccount(
        guildId,
        userId
      );
      if (
        Number(account.balance) < amount
      ) {
        return errorMessage(
          message.channel,
          "No tienes suficientes monedas."
        );
      }
      const resultSide =
        Math.random() < 0.5
          ? "cara"
          : "cruz";
      const won = side === resultSide;
      const delta = won
        ? amount
        : -amount;
      await changeBalance(
        guildId,
        userId,
        delta
      );
      return message.channel.send({
        embeds: [
          embed(
            "Lanzamiento de moneda",
            `🪙 Salió **${resultSide}**.\n` +
            (delta > 0
              ? `¡Ganaste ${money(amount)}!`
              : `Perdiste ${money(amount)}.`)
          )
        ]
      });
    }
    if (
      command === "dice" ||
      command === "dados"
    ) {
      const guess = Number(args[0]);
      const amount = parseAmount(args[1]);
      if (
        !Number.isInteger(guess) ||
        guess < 1 ||
        guess > 6 ||
        !amount
      ) {
        return errorMessage(
          message.channel,
          "Uso: `M!dice 4 50` (elige un número del 1 al 6)."
        );
      }
      const account = await getAccount(
        guildId,
        userId
      );
      if (
        Number(account.balance) < amount
      ) {
        return errorMessage(
          message.channel,
          "No tienes suficientes monedas."
        );
      }
      const rolled =
        Math.floor(Math.random() * 6) + 1;
      const delta =
        guess === rolled
          ? amount * 4
          : -amount;
      await changeBalance(
        guildId,
        userId,
        delta
      );
      return message.channel.send({
        embeds: [
          embed(
            "Dados 🎲",
            `Elegiste **${guess}** y salió **${rolled}**.\n` +
            (delta > 0
              ? `¡Ganaste ${money(delta)}!`
              : `Perdiste ${money(amount)}.`)
          )
        ]
      });
    }
    if (
      command === "guess" ||
      command === "adivina"
    ) {
      const number =
        Math.floor(Math.random() * 5) + 1;
      return message.channel.send({
        embeds: [
          embed(
            "Adivinanza",
            `🌸 Piensa un número del 1 al 5 y escribe cuál crees que salió: **${number}**.\n¡Esta ronda es gratis!`
          )
        ]
      });
    }
    // =============================
    // SOCIAL
    // =============================
    if (
      command === "profile" ||
      command === "perfil"
    ) {
      const member =
        target?.user || message.author;
      const account = await getAccount(
        guildId,
        member.id
      );
      return message.channel.send({
        embeds: [
          embed(
            `Perfil de ${member.username}`,
            `👤 Usuario: ${mention(member)}\n` +
            `💰 Saldo: **${money(account.balance)}**\n` +
            `🌸 Servidor: **${message.guild.name}**`
          ).setThumbnail(
            member.displayAvatarURL()
          )
        ]
      });
    }
    if (
      command === "hug" ||
      command === "abrazo"
    ) {
      if (
        !target ||
        target.id === userId
      ) {
        return errorMessage(
          message.channel,
          "Menciona a otra persona para enviarle un abrazo."
        );
      }
      return message.channel.send({
        embeds: [
          embed(
            "Abrazo virtual 💗",
            `🤗 ${mention(message.author)} le manda un abrazo a ${mention(target.user)}.`
          )
        ]
      });
    }
    if (
      command === "friend" ||
      command === "amistad"
    ) {
      if (
        !target ||
        target.id === userId
      ) {
        return errorMessage(
          message.channel,
          "Menciona a otra persona."
        );
      }
      return message.channel.send({
        embeds: [
          embed(
            "Amistad 🌸",
            `💞 ${mention(message.author)} y ${mention(target.user)} son amistades de Akari.`
          )
        ]
      });
    }
    if (command === "rep") {
      if (
        !target ||
        target.id === userId ||
        target.user.bot
      ) {
        return errorMessage(
          message.channel,
          "Menciona a otra persona, no a ti mismo."
        );
      }
      const now = Date.now();
      const last = await pool.query(
        `SELECT given_at
         FROM akari_reputation
         WHERE guild_id = $1
         AND giver_id = $2`,
        [
          guildId,
          userId
        ]
      );
      if (
        last.rows.length &&
        now - Number(last.rows[0].given_at) < 86400000
      ) {
        return errorMessage(
          message.channel,
          "Puedes dar reputación una vez cada 24 horas."
        );
      }
      await pool.query(
        `INSERT INTO akari_reputation
         (guild_id, giver_id, target_id, given_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (guild_id, giver_id)
         DO UPDATE SET
         target_id = $3,
         given_at = $4`,
        [
          guildId,
          userId,
          target.id,
          now
        ]
      );
      return message.channel.send({
        embeds: [
          embed(
            "Reputación",
            `⭐ ${mention(message.author)} le dio reputación a ${mention(target.user)}.`
          )
        ]
      });
    }
    // =============================
    // ADMINISTRACIÓN PRIVADA
    // =============================
    if (command === "admin") {
      if (!isAdmin(message.member)) {
        return errorMessage(
          message.channel,
          "No tienes permiso para ver este panel."
        );
      }
      return message.channel.send({
        embeds: [
          embed(
            "Panel de administración",
            "**🛡️ Moderación**\n" +
            "`M!warn @usuario razón`\n" +
            "`M!warnings @usuario`\n" +
            "`M!timeout @usuario 10m razón`\n" +
            "`M!untimeout @usuario`\n" +
            "`M!kick @usuario razón`\n" +
            "`M!ban @usuario razón`\n" +
            "`M!clear 10`\n\n" +
            "**⚙️ Configuración**\n" +
            "`M!setwelcome #canal`\n\n" +
            "**🎫 Tickets**\n" +
            "`M!ticketpanel`\n\n" +
            "Requiere permisos adecuados de Discord."
          )
        ]
      });
    }
    if (command === "setwelcome") {
      if (!isAdmin(message.member)) {
        return errorMessage(
          message.channel,
          "Necesitas permiso de Administrador o Gestionar servidor."
        );
      }
      const channel =
        message.mentions.channels.first();
      if (
        !channel ||
        !channel.isTextBased()
      ) {
        return errorMessage(
          message.channel,
          "Uso: `M!setwelcome #canal`."
        );
      }
      await pool.query(
        `INSERT INTO akari_settings
         (guild_id, welcome_channel)
         VALUES ($1, $2)
         ON CONFLICT (guild_id)
         DO UPDATE SET
         welcome_channel = $2`,
        [
          guildId,
          channel.id
        ]
      );
      return message.channel.send({
        embeds: [
          embed(
            "Bienvenidas configuradas",
            `🌸 Las bienvenidas se enviarán en ${channel}.`
          )
        ]
      });
    }
    // =============================
    // MODERACIÓN
    // =============================
    if (
      [
        "warn",
        "warnings",
        "timeout",
        "untimeout",
        "kick",
        "ban",
        "clear"
      ].includes(command)
    ) {
      if (!isModerator(message.member)) {
        return errorMessage(
          message.channel,
          "No tienes permiso para usar este comando."
        );
      }
      if (command === "clear") {
        const count = Number(args[0]);
        if (
          !Number.isInteger(count) ||
          count < 1 ||
          count > 100
        ) {
          return errorMessage(
            message.channel,
            "Uso: `M!clear 10` (máximo 100)."
          );
        }
        if (
          !message.guild.members.me.permissions.has(
            PermissionFlagsBits.ManageMessages
          )
        ) {
          return errorMessage(
            message.channel,
            "Necesito el permiso Gestionar mensajes."
          );
        }
        const deleted =
          await message.channel.bulkDelete(
            count,
            true
          );
        const reply =
          await message.channel.send(
            `🧹 Se eliminaron ${deleted.size} mensajes recientes.`
          );
        setTimeout(
          () => reply.delete().catch(() => {}),
          5000
        );
        return;
      }
      if (!target) {
        return errorMessage(
          message.channel,
          `Menciona al usuario. Ejemplo: \`M!${command} @usuario razón\`.`
        );
      }
      if (
        target.id === userId ||
        target.id === client.user.id
      ) {
        return errorMessage(
          message.channel,
          "No puedes aplicar esa acción a esa cuenta."
        );
      }
      if (
        target.roles.highest.position >=
          message.member.roles.highest.position &&
        message.guild.ownerId !== userId
      ) {
        return errorMessage(
          message.channel,
          "Tu rol debe estar por encima del rol del usuario."
        );
      }
      const reason =
        args.slice(1).join(" ") ||
        "Sin motivo especificado";
      if (command === "warn") {
        await pool.query(
          `INSERT INTO akari_warnings
           (guild_id, user_id, moderator_id, reason)
           VALUES ($1, $2, $3, $4)`,
          [
            guildId,
            target.id,
            userId,
            reason
          ]
        );
        return message.channel.send({
          embeds: [
            embed(
              "Aviso registrado",
              `⚠️ ${mention(target.user)} recibió un aviso.\nMotivo: ${reason}`
            )
          ]
        });
      }
      if (command === "warnings") {
        const result = await pool.query(
          `SELECT reason, moderator_id, created_at
           FROM akari_warnings
           WHERE guild_id = $1
           AND user_id = $2
           ORDER BY created_at DESC
           LIMIT 10`,
          [
            guildId,
            target.id
          ]
        );
        const lines =
          result.rows.map(
            (row, i) =>
              `**${i + 1}.** ${row.reason} — <@${row.moderator_id}>`
          );
        return message.channel.send({
          embeds: [
            embed(
              "Avisos",
              lines.join("\n") ||
              "Este usuario no tiene avisos registrados."
            )
          ]
        });
      }
      if (command === "timeout") {
        const duration =
          parseDuration(args[1]);
        if (!duration) {
          return errorMessage(
            message.channel,
            "Uso: `M!timeout @usuario 10m razón`. Máximo 28 días."
          );
        }
        if (!target.moderatable) {
          return errorMessage(
            message.channel,
            "No puedo silenciar a ese usuario. Revisa mis permisos y la jerarquía de roles."
          );
        }
        await target.timeout(
          duration,
          reason
        );
        return message.channel.send({
          embeds: [
            embed(
              "Timeout aplicado",
              `${mention(target.user)} recibió un timeout.\nMotivo: ${reason}`
            )
          ]
        });
      }
      if (command === "untimeout") {
        if (!target.moderatable) {
          return errorMessage(
            message.channel,
            "No puedo quitarle el timeout a ese usuario."
          );
        }
        await target.timeout(
          null,
          "Timeout retirado por moderación"
        );
        return message.channel.send({
          embeds: [
            embed(
              "Timeout retirado",
              `Se retiró el timeout de ${mention(target.user)}.`
            )
          ]
        });
      }
      if (command === "kick") {
        if (!target.kickable) {
          return errorMessage(
            message.channel,
            "No puedo expulsar a ese usuario. Revisa los permisos y los roles."
          );
        }
        await target.kick(reason);
        return message.channel.send({
          embeds: [
            embed(
              "Usuario expulsado",
              `${target.user.tag} fue expulsado.\nMotivo: ${reason}`
            )
          ]
        });
      }
      if (command === "ban") {
        if (!target.bannable) {
          return errorMessage(
            message.channel,
            "No puedo banear a ese usuario. Revisa los permisos y los roles."
          );
        }
        await target.ban({ reason });
        return message.channel.send({
          embeds: [
            embed(
              "Usuario baneado",
              `${target.user.tag} fue baneado.\nMotivo: ${reason}`
            )
          ]
        });
      }
    }
    // =============================
    // TICKETS
    // =============================
    if (command === "ticketpanel") {
      if (!isAdmin(message.member)) {
        return errorMessage(
          message.channel,
          "Necesitas permiso de Administrador o Gestionar servidor."
        );
      }
      const menu =
        new StringSelectMenuBuilder()
          .setCustomId(
            "akari_ticket_category"
          )
          .setPlaceholder(
            "🌸 Selecciona el tipo de ticket"
          )
          .addOptions(
            {
              label: "Soporte",
              value: "Soporte",
              emoji: "🛠️"
            },
            {
              label: "Reporte",
              value: "Reporte",
              emoji: "🚨"
            },
            {
              label: "Duda",
              value: "Duda",
              emoji: "❔"
            },
            {
              label: "Allys/Affys/Socio",
              value: "Allys/Affys/Socio",
              emoji: "🤝"
            },
            {
              label: "Postulación",
              value: "Postulacion",
              emoji: "📝"
            },
            {
              label: "Otro",
              value: "Otro",
              emoji: "🌸"
            }
          );
      return message.channel.send({
        embeds: [
          embed(
            "Centro de tickets",
            "💗 ¿En qué podemos ayudarte?\n\nSelecciona una categoría en el menú. Se creará un canal privado para ti."
          )
        ],
        components: [
          new ActionRowBuilder()
            .addComponents(menu)
        ]
      });
    }
    // Comando desconocido:
    // no llenar el chat de respuestas.
  } catch (error) {
    console.error(
      `Error en comando ${command}:`,
      error
    );
    return errorMessage(
      message.channel,
      "Ocurrió un error. Revisa los permisos y los registros de Render."
    );
  }
});
// =============================
// INTERACCIONES DE TICKETS
// =============================
client.on("interactionCreate", async interaction => {
  try {
    if (!interaction.inGuild()) return;
    if (
      interaction.isStringSelectMenu() &&
      interaction.customId ===
        "akari_ticket_category"
    ) {
      await interaction.deferReply({
        ephemeral: true
      });
      const guild = interaction.guild;
      const user = interaction.user;
      const category =
        interaction.values[0];
      const existing =
        await pool.query(
          `SELECT channel_id
           FROM akari_tickets
           WHERE guild_id = $1
           AND owner_id = $2
           AND status = 'open'`,
          [
            guild.id,
            user.id
          ]
        );
      if (existing.rows.length) {
        const oldChannel =
          await guild.channels
            .fetch(
              existing.rows[0].channel_id
            )
            .catch(() => null);
        if (oldChannel) {
          return interaction.editReply(
            `Ya tienes un ticket abierto: ${oldChannel}`
          );
        }
        await pool.query(
          `UPDATE akari_tickets
           SET status = 'closed'
           WHERE channel_id = $1`,
          [
            existing.rows[0].channel_id
          ]
        );
      }
      const safeName =
        user.username
          .toLowerCase()
          .replace(
            /[^a-z0-9-]/g,
            ""
          )
          .slice(0, 15) ||
        "usuario";
      const channel =
        await guild.channels.create({
          name: `ticket-${safeName}`,
          type: ChannelType.GuildText,
          topic:
            `Ticket de ${user.tag} | Categoría: ${category}`,
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              deny: [
                PermissionFlagsBits.ViewChannel
              ]
            },
            {
              id: user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles
              ]
            },
            {
              id: client.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageChannels
              ]
            }
          ]
        });
      await pool.query(
        `INSERT INTO akari_tickets
         (channel_id, guild_id, owner_id, status)
         VALUES ($1, $2, $3, 'open')`,
        [
          channel.id,
          guild.id,
          user.id
        ]
      );
      const closeButton =
        new ButtonBuilder()
          .setCustomId(
            "akari_ticket_close"
          )
          .setLabel(
            "Cerrar ticket"
          )
          .setEmoji("🔒")
          .setStyle(
            ButtonStyle.Danger
          );
      await channel.send({
        content: `${user}`,
        embeds: [
          embed(
            `Ticket: ${category}`,
            `¡Hola ${mention(user)}! 🌸\nExplica tu consulta con detalle y el equipo podrá ayudarte.\n\nCuando termines, pulsa el botón para cerrar el ticket.`
          )
        ],
        components: [
          new ActionRowBuilder()
            .addComponents(
              closeButton
            )
        ]
      });
      return interaction.editReply(
        `🌸 Tu ticket está listo: ${channel}`
      );
    }
    if (
      interaction.isButton() &&
      interaction.customId ===
        "akari_ticket_close"
    ) {
      const result =
        await pool.query(
          `SELECT owner_id, status
           FROM akari_tickets
           WHERE channel_id = $1`,
          [
            interaction.channelId
          ]
        );
      const ticket =
        result.rows[0];
      if (
        !ticket ||
        ticket.status !== "open"
      ) {
        return interaction.reply({
          content:
            "Este ticket ya está cerrado o no está registrado.",
          ephemeral: true
        });
      }
      const allowed =
        ticket.owner_id ===
          interaction.user.id ||
        isAdmin(interaction.member);
      if (!allowed) {
        return interaction.reply({
          content:
            "Solo quien abrió el ticket o un administrador puede cerrarlo.",
          ephemeral: true
        });
      }
      await interaction.reply(
        "🔒 Ticket cerrado. El canal se eliminará en unos segundos."
      );
      await pool.query(
        `UPDATE akari_tickets
         SET status = 'closed'
         WHERE channel_id = $1`,
        [
          interaction.channelId
        ]
      );
      setTimeout(() => {
        interaction.channel
          ?.delete("Ticket cerrado")
          .catch(console.error);
      }, 5000);
    }
  } catch (error) {
    console.error(
      "Error en interacción:",
      error
    );
    if (
      interaction.isRepliable() &&
      !interaction.replied &&
      !interaction.deferred
    ) {
      await interaction.reply({
        content:
          "Hubo un error al procesar la interacción. Revisa los permisos del bot.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});
// =============================
// ERRORES Y CONEXIÓN
// =============================
process.on(
  "unhandledRejection",
  error => {
    console.error(
      "Promesa no controlada:",
      error
    );
  }
);
async function start() {
  try {
    console.log("🌸 Conectando con PostgreSQL...");
    await pool.query("SELECT 1");
    console.log("✅ PostgreSQL conectado correctamente.");
    await initDatabase();
    await client.login(
      process.env.DISCORD_TOKEN
    );
  } catch (error) {
    console.error(
      "No se pudo iniciar Akari Bot:",
      error
    );
    process.exit(1);
  }
}
start();
