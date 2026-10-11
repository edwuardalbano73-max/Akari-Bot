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

const STAFF_ROLE_ID = "1555318924365799546";

const TOKEN = process.env.DISCORD_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;

console.log("🌸 AKARI: index.js se está ejecutando...");

if (!TOKEN) {
  console.error("❌ Falta DISCORD_TOKEN.");
  process.exit(1);
}

if (!DATABASE_URL) {
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
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
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
    Partials.GuildMember,
    Partials.User
  ]
});

// ======================================================
// PLANTILLA DE BIENVENIDA
// ======================================================

const DEFAULT_WELCOME_TEMPLATE = `
╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
       🌸・𝘼𝙠𝙖𝙧𝙞 𝘾𝙤𝙢𝙢𝙪𝙣𝙞𝙩𝙮
          👋・BIENVENIDO/A
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

🌸 ¡Bienvenido/a, {usuario}!

Nos alegra mucho tenerte con nosotros. 💗
Esperamos que disfrutes de tu estancia y puedas conocer a muchas personas dentro de nuestra comunidad.

✨・Aquí podrás:
> 💬 Conocer nuevos amigos.
> 🎮 Disfrutar de diferentes actividades.
> 🌸 Participar en nuestra comunidad.
> 🎉 Formar parte de nuestros eventos.

📌 Antes de comenzar
Te recomendamos leer las reglas y conocer los diferentes canales del servidor para saber cómo funciona nuestra comunidad.

💗 ¡Disfruta de tu estancia en Akari Community!

👥・Ahora somos **{miembros}** miembros.
`;

// ======================================================
// FUNCIONES
// ======================================================

function createEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(PINK)
    .setTitle(title)
    .setDescription(description)
    .setFooter({
      text: "🌸 Akari Community • Akari Bot"
    })
    .setTimestamp();
}

function decorate(text) {
  return `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
        🌸・𝘼𝙠𝙖𝙧𝙞 𝘾𝙤𝙢𝙢𝙪𝙣𝙞𝙩𝙮
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

${text}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💗 Akari Bot • ¡Gracias por usarme!`;
}

function isAdmin(member) {
  return member.permissions.has(PermissionFlagsBits.Administrator);
}

function isStaff(member) {
  return (
    isAdmin(member) ||
    member.roles.cache.has(STAFF_ROLE_ID)
  );
}

function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatCoins(amount) {
  return `${Number(amount || 0).toLocaleString("es-ES")} 💰`;
}

async function ensureUser(guildId, userId) {
  await pool.query(
    `
    INSERT INTO users (guild_id, user_id, coins, daily, work)
    VALUES ($1, $2, 0, NULL, NULL)
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

async function getSetting(guildId) {
  const result = await pool.query(
    `
    SELECT *
    FROM settings
    WHERE guild_id = $1
    `,
    [guildId]
  );

  return result.rows[0];
}

async function saveSetting(guildId, welcomeChannel, welcomeMessage) {
  await pool.query(
    `
    INSERT INTO settings (guild_id, welcome_channel, welcome_message)
    VALUES ($1, $2, $3)
    ON CONFLICT (guild_id)
    DO UPDATE SET
      welcome_channel = EXCLUDED.welcome_channel,
      welcome_message = EXCLUDED.welcome_message
    `,
    [guildId, welcomeChannel, welcomeMessage]
  );
}

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
      daily TIMESTAMP,
      work TIMESTAMP,
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
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

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
      created_at TIMESTAMP DEFAULT NOW()
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
        type: 0
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
    const settings = await getSetting(member.guild.id);

    if (!settings || !settings.welcome_channel) return;

    const channel = member.guild.channels.cache.get(
      settings.welcome_channel
    );

    if (!channel) return;

    let template =
      settings.welcome_message || DEFAULT_WELCOME_TEMPLATE;

    template = template
      .replaceAll("{usuario}", `<@${member.id}>`)
      .replaceAll("{nombre}", member.user.username)
      .replaceAll(
        "{miembros}",
        member.guild.memberCount.toLocaleString("es-ES")
      );

    const embed = createEmbed(
      "🌸・𝘼𝙠𝙖𝙧𝙞 𝘾𝙤𝙢𝙢𝙪𝙣𝙞𝙩𝙮",
      template
    );

    await channel.send({
      content: `<@${member.id}>`,
      embeds: [embed]
    });

  } catch (error) {
    console.error("❌ Error en bienvenida:", error);
  }
});

// ======================================================
// AYUDA PÚBLICA
// ======================================================

function createHelpMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("help_menu")
      .setPlaceholder("🌸 Selecciona una categoría")
      .addOptions([
        {
          label: "💰 Economía",
          description: "Comandos de economía y monedas.",
          value: "economy"
        },
        {
          label: "🎮 Diversión",
          description: "Juegos y comandos divertidos.",
          value: "fun"
        },
        {
          label: "💗 Social",
          description: "Comandos para interactuar.",
          value: "social"
        },
        {
          label: "📚 Información",
          description: "Información del servidor y usuarios.",
          value: "info"
        },
        {
          label: "🛠️ Utilidades",
          description: "Herramientas útiles.",
          value: "utilities"
        }
      ])
  );
}

function helpEmbed(category) {
  if (category === "economy") {
    return createEmbed(
      "💰・ECONOMÍA",
      `💗 Comandos disponibles:

> \`M!balance\` — Ver tu dinero.
> \`M!daily\` — Reclamar recompensa diaria.
> \`M!work\` — Trabajar y ganar monedas.
> \`M!beg\` — Pedir unas monedas.
> \`M!pay @usuario cantidad\` — Transferir monedas.
> \`M!leaderboard\` — Ver los más ricos.
> \`M!rich\` — Ver quién tiene más dinero.
> \`M!shop\` — Ver la tienda.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌸 ¡Administra tus monedas y diviértete!`
    );
  }

  if (category === "fun") {
    return createEmbed(
      "🎮・DIVERSIÓN",
      `💗 Comandos disponibles:

> \`M!coin\` — Lanzar una moneda.
> \`M!dice\` — Lanzar un dado.
> \`M!guess\` — Adivinar un número.
> \`M!8ball\` — Pregúntale a la bola mágica.
> \`M!rps\` — Piedra, papel o tijera.
> \`M!random\` — Número aleatorio.
> \`M!choose\` — Elegir entre opciones.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✨ ¡La diversión nunca termina en Akari!`
    );
  }

  if (category === "social") {
    return createEmbed(
      "💗・SOCIAL",
      `🌸 Comandos disponibles:

> \`M!profile\` — Ver tu perfil.
> \`M!perfil @usuario\` — Ver un perfil.
> \`M!avatar @usuario\` — Ver un avatar.
> \`M!hug @usuario\` — Dar un abrazo.
> \`M!highfive @usuario\` — Chocar los cinco.
> \`M!wave @usuario\` — Saludar.
> \`M!friend @usuario\` — Enviar una amistad.
> \`M!rep @usuario\` — Dar reputación.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💗 ¡Interactúa con la comunidad!`
    );
  }

  if (category === "info") {
    return createEmbed(
      "📚・INFORMACIÓN",
      `🌸 Comandos disponibles:

> \`M!serverinfo\` — Información del servidor.
> \`M!userinfo @usuario\` — Información de usuario.
> \`M!roleinfo @rol\` — Información de un rol.
> \`M!channelinfo\` — Información del canal.
> \`M!botinfo\` — Información de Akari.
> \`M!ping\` — Ver la latencia.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✨ Conoce mejor tu comunidad.`
    );
  }

  return createEmbed(
    "🛠️・UTILIDADES",
    `💗 Comandos disponibles:

> \`M!calc operación\` — Calculadora básica.
> \`M!poll pregunta\` — Crear una encuesta.
> \`M!serverinfo\` — Información del servidor.
> \`M!channelinfo\` — Información del canal.
> \`M!avatar\` — Ver un avatar.
> \`M!ping\` — Comprobar el bot.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌸 Herramientas rápidas para Akari Community.`
  );
}

// ======================================================
// ADMIN
// ======================================================

function createAdminMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("admin_menu")
      .setPlaceholder("🌸 Selecciona una sección")
      .addOptions([
        {
          label: "🛡️ Moderación",
          description: "Herramientas de moderación.",
          value: "moderation"
        },
        {
          label: "🎫 Tickets",
          description: "Configuración de tickets.",
          value: "tickets"
        },
        {
          label: "⚙️ Configuración",
          description: "Configuración del servidor.",
          value: "config"
        },
        {
          label: "💰 Economía",
          description: "Administración de economía.",
          value: "economy"
        },
        {
          label: "📊 Información",
          description: "Información administrativa.",
          value: "info"
        },
        {
          label: "👋 Bienvenidas",
          description: "Configurar mensajes de bienvenida.",
          value: "welcome"
        }
      ])
  );
}

// ======================================================
// TICKETS
// ======================================================

function createTicketMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("ticket_category")
      .setPlaceholder("🎫 Selecciona una categoría")
      .addOptions([
        {
          label: "Soporte",
          description: "Necesito ayuda.",
          emoji: "🛠️",
          value: "soporte"
        },
        {
          label: "Reporte",
          description: "Reportar un usuario o situación.",
          emoji: "🚨",
          value: "reporte"
        },
        {
          label: "Duda",
          description: "Tengo una pregunta.",
          emoji: "❓",
          value: "duda"
        },
        {
          label: "Allys/Affys/Socio",
          description: "Solicitar colaboración.",
          emoji: "🤝",
          value: "alianzas"
        },
        {
          label: "Postulación",
          description: "Enviar una postulación.",
          emoji: "📝",
          value: "postulacion"
        },
        {
          label: "Otro",
          description: "Otra solicitud.",
          emoji: "📌",
          value: "otro"
        }
      ])
  );
}

function ticketCategoryName(value) {
  const names = {
    soporte: "🛠️ Soporte",
    reporte: "🚨 Reporte",
    duda: "❓ Duda",
    alianzas: "🤝 Allys/Affys/Socio",
    postulacion: "📝 Postulación",
    otro: "📌 Otro"
  };

  return names[value] || "📌 Otro";
}

async function sendTicketPanel(channel) {
  const embed = createEmbed(
    "🎫・TICKETS",
    `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
       🌸・𝘼𝙠𝙖𝙧𝙞 𝘾𝙤𝙢𝙢𝙪𝙣𝙞𝙩𝙮
          🎫・TICKETS
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

💗 ¿Necesitas ayuda?

Bienvenido al centro de tickets de Akari Community.
Desde aquí podrás contactar directamente con nuestro equipo de staff para resolver cualquier problema, realizar reportes, enviar solicitudes o aclarar tus dudas.

📂 ¿Qué puedes hacer?

🛠️・Solicitar ayuda con algún problema.
🚨・Reportar usuarios o situaciones.
❓・Resolver cualquier duda.
🤝・Solicitar Allys, Affys o Socios.
📝・Enviar una postulación.
📌・Realizar cualquier otra solicitud.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 Antes de abrir un ticket

> ✦ Selecciona la categoría que corresponda.
> ✦ Explica claramente el motivo de tu ticket.
> ✦ Proporciona pruebas cuando sean necesarias.
> ✦ Evita abrir tickets repetidos o innecesarios.
> ✦ Respeta al equipo encargado de atenderte.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌸 Nuestro equipo revisará tu solicitud lo antes posible.

💗 Gracias por formar parte de Akari Community.

👇 Selecciona una categoría
para abrir tu ticket.`
  );

  await channel.send({
    embeds: [embed],
    components: [createTicketMenu()]
  });
}

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

    await ensureUser(
      message.guild.id,
      message.author.id
    );

    // ==================================================
    // HELP
    // ==================================================

    if (["help", "ayuda"].includes(command)) {
      const embed = createEmbed(
        "🌸・𝘼𝙠𝙖𝙧𝙞 𝘾𝙤𝙢𝙢𝙪𝙣𝙞𝙩𝙮",
        `💗 ¡Hola, ${message.author}!

Bienvenido/a al centro de ayuda de Akari Bot.

Aquí encontrarás todos los comandos disponibles para usuarios.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📚 Selecciona una categoría en el menú de abajo.

💰 Economía
🎮 Diversión
💗 Social
📚 Información
🛠️ Utilidades

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌸 Los comandos administrativos y de moderación
se encuentran protegidos dentro de \`M!admin\`.`
      );

      return message.reply({
        embeds: [embed],
        components: [createHelpMenu()]
      });
    }

    // ==================================================
    // PING
    // ==================================================

    if (command === "ping") {
      const embed = createEmbed(
        "🏓・PONG",
        `🌸 ¡Akari está funcionando correctamente!

📡 Latencia:
\`${client.ws.ping}ms\`

💗 Estado: **Online**
🌐 Servidor: **Activo**`
      );

      return message.reply({
        embeds: [embed]
      });
    }

    // ==================================================
    // ADMIN
    // ==================================================

    if (command === "admin") {
      if (!isAdmin(message.member)) {
        return message.reply({
          embeds: [
            createEmbed(
              "🔒・ACCESO DENEGADO",
              `💗 Este panel está reservado exclusivamente para administradores.

🌸 Si necesitas ayuda con alguna función del servidor, utiliza \`M!help\`.`
            )
          ]
        });
      }

      const embed = createEmbed(
        "⚙️・PANEL DE ADMINISTRACIÓN",
        `🌸 Bienvenido al panel administrativo de Akari Community.

Desde este menú puedes administrar las diferentes funciones del bot.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🛡️ Moderación
🎫 Tickets
⚙️ Configuración
💰 Economía
📊 Información
👋 Bienvenidas

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔐 Algunas funciones requieren permisos adicionales.

👇 Selecciona una sección para continuar.`
      );

      return message.reply({
        embeds: [embed],
        components: [createAdminMenu()]
      });
    }

    // ==================================================
    // TICKET PANEL
    // ==================================================

    if (command === "ticketpanel") {
      if (!isAdmin(message.member)) {
        return message.reply({
          embeds: [
            createEmbed(
              "🔒・SIN PERMISOS",
              "💗 Solo los administradores pueden enviar el panel de tickets."
            )
          ]
        });
      }

      await sendTicketPanel(message.channel);

      return message.reply({
        embeds: [
          createEmbed(
            "✅・PANEL ENVIADO",
            "🌸 El panel de tickets fue enviado correctamente."
          )
        ]
      });
    }

    // ==================================================
    // SET WELCOME
    // ==================================================

    if (command === "setwelcome") {
      if (!isAdmin(message.member)) {
        return message.reply({
          embeds: [
            createEmbed(
              "🔒・SIN PERMISOS",
              "💗 Solo los administradores pueden configurar las bienvenidas."
            )
          ]
        });
      }

      const channel =
        message.mentions.channels.first();

      if (!channel) {
        return message.reply({
          embeds: [
            createEmbed(
              "👋・BIENVENIDAS",
              `Uso correcto:

\`${PREFIX}setwelcome #canal\`

🌸 Ejemplo:
\`${PREFIX}setwelcome #bienvenidas\``
            )
          ]
        });
      }

      await saveSetting(
        message.guild.id,
        channel.id,
        DEFAULT_WELCOME_TEMPLATE
      );

      return message.reply({
        embeds: [
          createEmbed(
            "✅・BIENVENIDAS CONFIGURADAS",
            `🌸 El canal de bienvenida ahora es ${channel}.

💗 La plantilla predeterminada de Akari Community ha sido activada.

Cada nuevo miembro recibirá un mensaje decorado de bienvenida.`
          )
        ]
      });
    }

    // ==================================================
    // ECONOMÍA
    // ==================================================

    if (["balance", "bal", "coins"].includes(command)) {
      const target =
        message.mentions.users.first() ||
        message.author;

      const user = await getUser(
        message.guild.id,
        target.id
      );

      return message.reply({
        embeds: [
          createEmbed(
            "💰・BILLETERA",
            `🌸 Información económica de ${target}

💰 Monedas:
**${formatCoins(user.coins)}**

✨ ¡Sigue participando en Akari Community para conseguir más!`
          )
        ]
      });
    }

    if (command === "daily") {
      const user = await getUser(
        message.guild.id,
        message.author.id
      );

      const now = new Date();

      if (user.daily) {
        const last = new Date(user.daily);
        const difference = now - last;
        const cooldown = 24 * 60 * 60 * 1000;

        if (difference < cooldown) {
          const remaining =
            cooldown - difference;

          const hours = Math.floor(
            remaining / 3600000
          );

          const minutes = Math.floor(
            (remaining % 3600000) / 60000
          );

          return message.reply({
            embeds: [
              createEmbed(
                "⏳・DAILY",
                `💗 Ya reclamaste tu recompensa diaria.

🌸 Podrás volver a reclamarla en aproximadamente:

**${hours}h ${minutes}m**

✨ ¡Vuelve más tarde!`
              )
            ]
          });
        }
      }

      const reward = randomNumber(150, 300);

      await pool.query(
        `
        UPDATE users
        SET coins = coins + $1,
            daily = NOW()
        WHERE guild_id = $2 AND user_id = $3
        `,
        [
          reward,
          message.guild.id,
          message.author.id
        ]
      );

      return message.reply({
        embeds: [
          createEmbed(
            "🎁・RECOMPENSA DIARIA",
            `🌸 ¡Recompensa recibida!

💰 Has ganado **${reward} monedas**.

✨ Vuelve mañana para reclamar otra recompensa.`
          )
        ]
      });
    }

    if (command === "work") {
      const user = await getUser(
        message.guild.id,
        message.author.id
      );

      const now = new Date();

      if (user.work) {
        const last = new Date(user.work);
        const difference = now - last;
        const cooldown = 30 * 1000;

        if (difference < cooldown) {
          const seconds = Math.ceil(
            (cooldown - difference) / 1000
          );

          return message.reply({
            embeds: [
              createEmbed(
                "⏳・TRABAJO",
                `💗 Ya estás trabajando.

🌸 Espera **${seconds} segundos** antes de volver a trabajar.`
              )
            ]
          });
        }
      }

      const reward = randomNumber(100, 300);

      await pool.query(
        `
        UPDATE users
        SET coins = coins + $1,
            work = NOW()
        WHERE guild_id = $2 AND user_id = $3
        `,
        [
          reward,
          message.guild.id,
          message.author.id
        ]
      );

      return message.reply({
        embeds: [
          createEmbed(
            "💼・TRABAJO COMPLETADO",
            `🌸 ¡Buen trabajo, ${message.author}!

💰 Has ganado **${reward} monedas**.

✨ ¡Sigue trabajando para aumentar tu fortuna!`
          )
        ]
      });
    }

    if (command === "beg") {
      const reward = randomNumber(10, 80);

      await pool.query(
        `
        UPDATE users
        SET coins = coins + $1
        WHERE guild_id = $2 AND user_id = $3
        `,
        [
          reward,
          message.guild.id,
          message.author.id
        ]
      );

      return message.reply({
        embeds: [
          createEmbed(
            "🥺・AYUDA",
            `🌸 ${message.author} pidió unas monedas...

💰 Recibiste **${reward} monedas**.

✨ ¡Quizás tengas más suerte la próxima vez!`
          )
        ]
      });
    }

    if (["pay", "give"].includes(command)) {
      const target =
        message.mentions.users.first();

      const amount =
        parseInt(args[0]?.replace(/,/g, ""));

      if (!target || target.bot) {
        return message.reply({
          embeds: [
            createEmbed(
              "💰・TRANSFERENCIA",
              `Uso:

\`${PREFIX}pay @usuario cantidad\`

🌸 Ejemplo:
\`${PREFIX}pay @Usuario 500\``
            )
          ]
        });
      }

      if (!amount || amount <= 0) {
        return message.reply({
          embeds: [
            createEmbed(
              "❌・CANTIDAD INVÁLIDA",
              "💗 Debes introducir una cantidad válida."
            )
          ]
        });
      }

      const sender = await getUser(
        message.guild.id,
        message.author.id
      );

      if (Number(sender.coins) < amount) {
        return message.reply({
          embeds: [
            createEmbed(
              "💸・DINERO INSUFICIENTE",
              `No tienes suficientes monedas.

💰 Tu saldo:
**${formatCoins(sender.coins)}**`
            )
          ]
        });
      }

      await ensureUser(
        message.guild.id,
        target.id
      );

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

      return message.reply({
        embeds: [
          createEmbed(
            "💸・TRANSFERENCIA COMPLETADA",
            `🌸 Transferencia realizada correctamente.

👤 Remitente:
${message.author}

👤 Destinatario:
${target}

💰 Cantidad:
**${formatCoins(amount)}**

💗 ¡Transacción completada!`
          )
        ]
      });
    }

    if (["leaderboard", "top", "rich"].includes(command)) {
      const result = await pool.query(
        `
        SELECT user_id, coins
        FROM users
        WHERE guild_id = $1
        ORDER BY coins DESC
        LIMIT 10
        `,
        [message.guild.id]
      );

      let description =
        "🌸 Los usuarios con mayor cantidad de monedas:\n\n";

      if (result.rows.length === 0) {
        description +=
          "Todavía no hay datos suficientes.";
      } else {
        result.rows.forEach((row, index) => {
          const medals = [
            "🥇",
            "🥈",
            "🥉"
          ];

          const medal =
            medals[index] ||
            `**${index + 1}.**`;

          description += `${medal} <@${row.user_id}> — **${formatCoins(row.coins)}**\n`;
        });
      }

      return message.reply({
        embeds: [
          createEmbed(
            "🏆・TOP ECONOMÍA",
            description
          )
        ]
      });
    }

    if (["shop", "tienda"].includes(command)) {
      return message.reply({
        embeds: [
          createEmbed(
            "🛍️・TIENDA",
            `🌸 Bienvenido/a a la tienda de Akari.

💗 Próximamente podrás utilizar tus monedas para conseguir diferentes recompensas.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✨ La tienda se irá ampliando con nuevas opciones.`
          )
        ]
      });
    }

    // ==================================================
    // DIVERSIÓN
    // ==================================================

    if (["coin", "flip"].includes(command)) {
      const result =
        Math.random() < 0.5
          ? "🪙 Cara"
          : "🪙 Cruz";

      return message.reply({
        embeds: [
          createEmbed(
            "🪙・MONEDA",
            `🌸 ${message.author} lanzó una moneda.

Resultado:

# ${result}

✨ ¡Inténtalo otra vez si quieres!`
          )
        ]
      });
    }

    if (["dice", "dado"].includes(command)) {
      const result = randomNumber(1, 6);

      return message.reply({
        embeds: [
          createEmbed(
            "🎲・DADO",
            `🌸 ${message.author} lanzó un dado.

Resultado:

# 🎲 ${result}

💗 ¡Buena suerte!`
          )
        ]
      });
    }

    if (command === "guess") {
      const number = randomNumber(1, 10);
      const guess = parseInt(args[0]);

      if (!guess || guess < 1 || guess > 10) {
        return message.reply({
          embeds: [
            createEmbed(
              "🎯・ADIVINA EL NÚMERO",
              `🌸 Debes elegir un número entre **1 y 10**.

Ejemplo:
\`${PREFIX}guess 7\``
            )
          ]
        });
      }

      if (guess === number) {
        return message.reply({
          embeds: [
            createEmbed(
              "🎉・¡ACERTASTE!",
              `💗 ¡Increíble, ${message.author}!

El número era **${number}**.

🌸 ¡Has acertado!`
            )
          ]
        });
      }

      return message.reply({
        embeds: [
          createEmbed(
            "❌・NO ESTA VEZ",
            `🌸 Tu número: **${guess}**

🎯 El número correcto era:
**${number}**

💗 ¡Inténtalo nuevamente!`
          )
        ]
      });
    }

    if (command === "8ball") {
      if (!args.length) {
        return message.reply({
          embeds: [
            createEmbed(
              "🔮・8BALL",
              `🌸 Hazme una pregunta.

Ejemplo:
\`${PREFIX}8ball ¿Hoy será un buen día?\``
            )
          ]
        });
      }

      const answers = [
        "✨ Definitivamente sí.",
        "🌸 Parece que sí.",
        "💗 Probablemente.",
        "🤔 No estoy seguro/a.",
        "🌙 Puede que no.",
        "❌ Probablemente no.",
        "💫 Las estrellas dicen que sí.",
        "🌸 Inténtalo más tarde."
      ];

      const answer =
        answers[randomNumber(0, answers.length - 1)];

      return message.reply({
        embeds: [
          createEmbed(
            "🔮・8BALL",
            `💭 Pregunta:

**${args.join(" ")}**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌸 Respuesta:

**${answer}**`
          )
        ]
      });
    }

    if (command === "rps") {
      const choices = [
        "piedra",
        "papel",
        "tijera"
      ];

      const userChoice =
        args[0]?.toLowerCase();

      if (!choices.includes(userChoice)) {
        return message.reply({
          embeds: [
            createEmbed(
              "✊・PIEDRA PAPEL TIJERA",
              `🌸 Elige una opción:

\`${PREFIX}rps piedra\`
\`${PREFIX}rps papel\`
\`${PREFIX}rps tijera\``
            )
          ]
        });
      }

      const botChoice =
        choices[randomNumber(0, 2)];

      let result;

      if (userChoice === botChoice) {
        result = "🤝 ¡Empate!";
      } else if (
        (userChoice === "piedra" &&
          botChoice === "tijera") ||
        (userChoice === "papel" &&
          botChoice === "piedra") ||
        (userChoice === "tijera" &&
          botChoice === "papel")
      ) {
        result = "🎉 ¡Ganaste!";
      } else {
        result = "🌸 ¡Ganó Akari!";
      }

      return message.reply({
        embeds: [
          createEmbed(
            "✊・PIEDRA PAPEL TIJERA",
            `👤 Tu elección:
**${userChoice}**

🤖 Elección de Akari:
**${botChoice}**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${result}`
          )
        ]
      });
    }

    if (command === "random") {
      const max =
        parseInt(args[0]) || 100;

      if (max < 1) {
        return message.reply({
          embeds: [
            createEmbed(
              "🎲・ALEATORIO",
              "💗 El número máximo debe ser mayor que 0."
            )
          ]
        });
      }

      const result =
        randomNumber(1, max);

      return message.reply({
        embeds: [
          createEmbed(
            "🎲・NÚMERO ALEATORIO",
            `🌸 Número generado entre **1 y ${max}**:

# ${result}`
          )
        ]
      });
    }

    if (command === "choose") {
      if (args.length < 2) {
        return message.reply({
          embeds: [
            createEmbed(
              "🎯・ELIGE",
              `🌸 Dame al menos dos opciones.

Ejemplo:
\`${PREFIX}choose pizza hamburguesa\``
            )
          ]
        });
      }

      const choice =
        args[randomNumber(0, args.length - 1)];

      return message.reply({
        embeds: [
          createEmbed(
            "🎯・ELECCIÓN",
            `🌸 Akari ha elegido:

# ${choice}

💗 ¡Decisión tomada!`
          )
        ]
      });
    }

    // ==================================================
    // SOCIAL
    // ==================================================

    if (["profile", "perfil"].includes(command)) {
      const target =
        message.mentions.users.first() ||
        message.author;

      const member =
        await message.guild.members
          .fetch(target.id)
          .catch(() => null);

      const user =
        await getUser(
          message.guild.id,
          target.id
        );

      const reputationResult =
        await pool.query(
          `
          SELECT reputation
          FROM reputation
          WHERE guild_id = $1 AND user_id = $2
          `,
          [
            message.guild.id,
            target.id
          ]
        );

      const reputation =
        reputationResult.rows[0]?.reputation || 0;

      const embed = createEmbed(
        "💗・PERFIL",
        `🌸 Información de ${target}

👤 Usuario:
${target}

🏷️ Nombre:
**${member?.displayName || target.username}**

💰 Monedas:
**${formatCoins(user.coins)}**

⭐ Reputación:
**${reputation}**

📅 Cuenta creada:
<t:${Math.floor(
  target.createdTimestamp / 1000
)}:D>`
      );

      embed.setThumbnail(
        target.displayAvatarURL({
          size: 256
        })
      );

      return message.reply({
        embeds: [embed]
      });
    }

    if (command === "avatar") {
      const target =
        message.mentions.users.first() ||
        message.author;

      const embed = createEmbed(
        "🖼️・AVATAR",
        `🌸 Avatar de ${target}

💗 Haz clic en el enlace de abajo para abrir la imagen.

[🔗 Abrir avatar](${target.displayAvatarURL({
          size: 1024,
          extension: "png"
        })})`
      );

      embed.setImage(
        target.displayAvatarURL({
          size: 1024
        })
      );

      return message.reply({
        embeds: [embed]
      });
    }

    if (command === "hug") {
      const target =
        message.mentions.users.first();

      if (!target) {
        return message.reply({
          embeds: [
            createEmbed(
              "🤗・ABRAZO",
              `🌸 Menciona a alguien.

Ejemplo:
\`${PREFIX}hug @usuario\``
            )
          ]
        });
      }

      return message.reply({
        embeds: [
          createEmbed(
            "🤗・ABRAZO",
            `💗 ${message.author} le dio un abrazo amistoso a ${target}.

🌸 ¡Qué bonito gesto!`
          )
        ]
      });
    }

    if (command === "highfive") {
      const target =
        message.mentions.users.first();

      if (!target) {
        return message.reply({
          embeds: [
            createEmbed(
              "✋・HIGH FIVE",
              `🌸 Menciona a alguien.

Ejemplo:
\`${PREFIX}highfive @usuario\``
            )
          ]
        });
      }

      return message.reply({
        embeds: [
          createEmbed(
            "✋・HIGH FIVE",
            `✨ ${message.author} y ${target} chocaron los cinco.

💗 ¡Buen equipo!`
          )
        ]
      });
    }

    if (command === "wave") {
      const target =
        message.mentions.users.first();

      if (!target) {
        return message.reply({
          embeds: [
            createEmbed(
              "👋・SALUDO",
              `🌸 Menciona a alguien.

Ejemplo:
\`${PREFIX}wave @usuario\``
            )
          ]
        });
      }

      return message.reply({
        embeds: [
          createEmbed(
            "👋・SALUDO",
            `🌸 ${message.author} saludó a ${target}.

💗 ¡Hola!`
          )
        ]
      });
    }

    if (command === "friend") {
      const target =
        message.mentions.users.first();

      if (!target) {
        return message.reply({
          embeds: [
            createEmbed(
              "🤝・AMISTAD",
              `🌸 Menciona a alguien.

Ejemplo:
\`${PREFIX}friend @usuario\``
            )
          ]
        });
      }

      return message.reply({
        embeds: [
          createEmbed(
            "🤝・AMISTAD",
            `💗 ${message.author} envió una solicitud de amistad amistosa a ${target}.

🌸 ¡Que empiece una nueva amistad!`
          )
        ]
      });
    }

    if (command === "rep") {
      const target =
        message.mentions.users.first();

      if (!target || target.bot) {
        return message.reply({
          embeds: [
            createEmbed(
              "⭐・REPUTACIÓN",
              `🌸 Menciona a un usuario válido.

Ejemplo:
\`${PREFIX}rep @usuario\``
            )
          ]
        });
      }

      if (target.id === message.author.id) {
        return message.reply({
          embeds: [
            createEmbed(
              "❌・REPUTACIÓN",
              "💗 No puedes darte reputación a ti mismo/a."
            )
          ]
        });
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

      return message.reply({
        embeds: [
          createEmbed(
            "⭐・REPUTACIÓN",
            `🌸 ${message.author} le dio reputación a ${target}.

💗 ¡Gracias por reconocer a otro miembro de la comunidad!`
          )
        ]
      });
    }

    // ==================================================
    // INFORMACIÓN
    // ==================================================

    if (command === "serverinfo") {
      const guild = message.guild;

      const embed = createEmbed(
        "📚・INFORMACIÓN DEL SERVIDOR",
        `🌸 **${guild.name}**

👑 Propietario:
<@${guild.ownerId}>

👥 Miembros:
**${guild.memberCount}**

💬 Canales:
**${guild.channels.cache.size}**

🎭 Roles:
**${guild.roles.cache.size}**

🆔 ID:
\`${guild.id}\`

📅 Creado:
<t:${Math.floor(
  guild.createdTimestamp / 1000
)}:D>`
      );

      if (guild.iconURL()) {
        embed.setThumbnail(
          guild.iconURL({
            size: 256
          })
        );
      }

      return message.reply({
        embeds: [embed]
      });
    }

    if (command === "userinfo") {
      const target =
        message.mentions.users.first() ||
        message.author;

      const member =
        await message.guild.members
          .fetch(target.id)
          .catch(() => null);

      const roles =
        member?.roles.cache
          .filter(role => role.id !== message.guild.id)
          .map(role => role.toString())
          .slice(0, 10)
          .join(" ") ||
        "Ninguno";

      return message.reply({
        embeds: [
          createEmbed(
            "👤・INFORMACIÓN DE USUARIO",
            `🌸 Información de ${target}

👤 Usuario:
**${target.username}**

🏷️ Nombre:
**${member?.displayName || target.username}**

🆔 ID:
\`${target.id}\`

📅 Cuenta creada:
<t:${Math.floor(
  target.createdTimestamp / 1000
)}:D>

📥 Entró al servidor:
${
  member?.joinedTimestamp
    ? `<t:${Math.floor(
        member.joinedTimestamp / 1000
      )}:D>`
    : "No disponible"
}

🎭 Roles:
${roles}`
          )
        ]
      });
    }

    if (command === "roleinfo") {
      const role =
        message.mentions.roles.first();

      if (!role) {
        return message.reply({
          embeds: [
            createEmbed(
              "🎭・INFORMACIÓN DE ROL",
              `🌸 Menciona un rol.

Ejemplo:
\`${PREFIX}roleinfo @Staff\``
            )
          ]
        });
      }

      return message.reply({
        embeds: [
          createEmbed(
            "🎭・INFORMACIÓN DE ROL",
            `🌸 Información del rol:

🏷️ Nombre:
**${role.name}**

🆔 ID:
\`${role.id}\`

👥 Miembros:
**${role.members.size}**

📌 Posición:
**${role.position}**

🔐 Administrador:
**${role.permissions.has(
              PermissionFlagsBits.Administrator
            ) ? "Sí" : "No"}**`
          )
        ]
      });
    }

    if (command === "channelinfo") {
      const channel = message.channel;

      return message.reply({
        embeds: [
          createEmbed(
            "💬・INFORMACIÓN DEL CANAL",
            `🌸 Información del canal actual:

📌 Nombre:
**#${channel.name}**

🆔 ID:
\`${channel.id}\`

📂 Tipo:
**${channel.type}**

📅 Creado:
<t:${Math.floor(
  channel.createdTimestamp / 1000
)}:D>`
          )
        ]
      });
    }

    if (command === "botinfo") {
      return message.reply({
        embeds: [
          createEmbed(
            "🤖・AKARI BOT",
            `🌸 Información de Akari Bot

🤖 Nombre:
**${client.user.username}**

🏠 Servidores:
**${client.guilds.cache.size}**

👥 Usuarios aproximados:
**${client.guilds.cache.reduce(
              (total, guild) =>
                total + guild.memberCount,
              0
            )}**

📡 Latencia:
**${client.ws.ping}ms**

⚙️ Prefijo:
\`${PREFIX}\`

💗 Creado para:
**Akari Community**`
          )
        ]
      });
    }

    // ==================================================
    // UTILIDADES
    // ==================================================

    if (command === "calc") {
      const expression = args.join(" ");

      if (!expression) {
        return message.reply({
          embeds: [
            createEmbed(
              "🧮・CALCULADORA",
              `🌸 Escribe una operación.

Ejemplo:
\`${PREFIX}calc 25 + 15 * 2\``
            )
          ]
        });
      }

      if (!/^[0-9+\-*/().\s]+$/.test(expression)) {
        return message.reply({
          embeds: [
            createEmbed(
              "❌・OPERACIÓN INVÁLIDA",
              "💗 Solo se permiten números y operaciones matemáticas básicas."
            )
          ]
        });
      }

      try {
        const result = Function(
          `"use strict"; return (${expression})`
        )();

        if (!Number.isFinite(result)) {
          throw new Error("Resultado inválido");
        }

        return message.reply({
          embeds: [
            createEmbed(
              "🧮・CALCULADORA",
              `🌸 Operación:

\`${expression}\`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💗 Resultado:

# ${result}`
            )
          ]
        });
      } catch {
        return message.reply({
          embeds: [
            createEmbed(
              "❌・ERROR",
              "💗 No pude calcular esa operación."
            )
          ]
        });
      }
    }

    if (command === "poll") {
      if (!args.length) {
        return message.reply({
          embeds: [
            createEmbed(
              "📊・ENCUESTA",
              `🌸 Escribe la pregunta.

Ejemplo:
\`${PREFIX}poll ¿Les gusta Akari Community?\``
            )
          ]
        });
      }

      const poll = await message.channel.send({
        embeds: [
          createEmbed(
            "📊・ENCUESTA",
            `🌸 **${args.join(" ")}**

👍 Sí
👎 No

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💗 ¡Vota usando las reacciones!`
          )
        ]
      });

      await poll.react("👍");
      await poll.react("👎");

      return;
    }

    // ==================================================
    // MODERACIÓN — SOLO STAFF
    // NO APARECE EN M!HELP
    // ==================================================

    if (
      [
        "warn",
        "warnings",
        "warns",
        "timeout",
        "untimeout",
        "kick",
        "ban",
        "clear"
      ].includes(command)
    ) {
      if (!isStaff(message.member)) {
        return message.reply({
          embeds: [
            createEmbed(
              "🔒・ACCESO DENEGADO",
              "🛡️ Este comando está reservado para el equipo de moderación."
            )
          ]
        });
      }

      // WARN
      if (command === "warn") {
        const target =
          message.mentions.users.first();

        if (!target) {
          return message.reply({
            embeds: [
              createEmbed(
                "🛡️・WARN",
                `Uso:

\`${PREFIX}warn @usuario razón\``
              )
            ]
          });
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

        return message.reply({
          embeds: [
            createEmbed(
              "⚠️・ADVERTENCIA",
              `🌸 Se ha registrado una advertencia.

👤 Usuario:
${target}

🛡️ Moderador:
${message.author}

📝 Razón:
**${reason}**`
            )
          ]
        });
      }

      // WARNINGS
      if (
        command === "warnings" ||
        command === "warns"
      ) {
        const target =
          message.mentions.users.first() ||
          message.author;

        const result = await pool.query(
          `
          SELECT reason, moderator_id, created_at
          FROM warnings
          WHERE guild_id = $1
          AND user_id = $2
          ORDER BY created_at DESC
          LIMIT 10
          `,
          [
            message.guild.id,
            target.id
          ]
        );

        let text =
          `🌸 Advertencias de ${target}\n\n`;

        if (!result.rows.length) {
          text +=
            "💗 Este usuario no tiene advertencias.";
        } else {
          result.rows.forEach(
            (warning, index) => {
              text +=
                `⚠️ **${index + 1}.** ${warning.reason}\n` +
                `🛡️ Moderador: <@${warning.moderator_id}>\n\n`;
            }
          );
        }

        return message.reply({
          embeds: [
            createEmbed(
              "⚠️・ADVERTENCIAS",
              text
            )
          ]
        });
      }

      // TIMEOUT
      if (command === "timeout") {
        const target =
          message.mentions.members.first();

        const minutes =
          parseInt(args[1]) || 10;

        if (!target) {
          return message.reply({
            embeds: [
              createEmbed(
                "⏱️・TIMEOUT",
                `Uso:

\`${PREFIX}timeout @usuario minutos\``
              )
            ]
          });
        }

        if (
          !target.moderatable ||
          target.id === message.author.id
        ) {
          return message.reply({
            embeds: [
              createEmbed(
                "❌・NO SE PUEDE",
                "💗 No puedo aplicar timeout a ese usuario."
              )
            ]
          });
        }

        await target.timeout(
          minutes * 60 * 1000,
          `Moderado por ${message.author.tag}`
        );

        return message.reply({
          embeds: [
            createEmbed(
              "⏱️・TIMEOUT APLICADO",
              `🌸 Usuario:
${target}

⏳ Duración:
**${minutes} minutos}**

🛡️ Moderador:
${message.author}`
            )
          ]
        });
      }

      // UNTIMEOUT
      if (command === "untimeout") {
        const target =
          message.mentions.members.first();

        if (!target) {
          return message.reply({
            embeds: [
              createEmbed(
                "⏱️・QUITAR TIMEOUT",
                `Uso:

\`${PREFIX}untimeout @usuario\``
              )
            ]
          });
        }

        await target.timeout(null);

        return message.reply({
          embeds: [
            createEmbed(
              "✅・TIMEOUT RETIRADO",
              `🌸 Se retiró el timeout de ${target}.

💗 La restricción ha sido eliminada.`
            )
          ]
        });
      }

      // KICK
      if (command === "kick") {
        const target =
          message.mentions.members.first();

        if (!target) {
          return message.reply({
            embeds: [
              createEmbed(
                "👢・KICK",
                `Uso:

\`${PREFIX}kick @usuario razón\``
              )
            ]
          });
        }

        if (!target.kickable) {
          return message.reply({
            embeds: [
              createEmbed(
                "❌・NO SE PUEDE",
                "💗 No puedo expulsar a ese usuario."
              )
            ]
          });
        }

        const reason =
          args.slice(1).join(" ") ||
          "Sin razón especificada";

        await target.kick(reason);

        return message.reply({
          embeds: [
            createEmbed(
              "👢・USUARIO EXPULSADO",
              `🌸 Usuario:
**${target.user.username}**

📝 Razón:
**${reason}**

🛡️ Moderador:
${message.author}`
            )
          ]
        });
      }

      // BAN
      if (command === "ban") {
        const target =
          message.mentions.members.first();

        if (!target) {
          return message.reply({
            embeds: [
              createEmbed(
                "🔨・BAN",
                `Uso:

\`${PREFIX}ban @usuario razón\``
              )
            ]
          });
        }

        if (!target.bannable) {
          return message.reply({
            embeds: [
              createEmbed(
                "❌・NO SE PUEDE",
                "💗 No puedo bloquear a ese usuario."
              )
            ]
          });
        }

        const reason =
          args.slice(1).join(" ") ||
          "Sin razón especificada";

        await target.ban({
          reason
        });

        return message.reply({
          embeds: [
            createEmbed(
              "🔨・USUARIO BLOQUEADO",
              `🌸 Usuario:
**${target.user.username}**

📝 Razón:
**${reason}**

🛡️ Moderador:
${message.author}`
            )
          ]
        });
      }

      // CLEAR
      if (command === "clear") {
        const amount =
          parseInt(args[0]) || 10;

        if (
          amount < 1 ||
          amount > 100
        ) {
          return message.reply({
            embeds: [
              createEmbed(
                "❌・CANTIDAD INVÁLIDA",
                "💗 Puedes eliminar entre 1 y 100 mensajes."
              )
            ]
          });
        }

        const deleted =
          await message.channel.bulkDelete(
            amount,
            true
          );

        const response =
          await message.channel.send({
            embeds: [
              createEmbed(
                "🧹・LIMPIEZA COMPLETADA",
                `🌸 Se eliminaron **${deleted.size} mensajes**.

🛡️ Moderador:
${message.author}`
              )
            ]
          });

        setTimeout(() => {
          response.delete().catch(() => {});
        }, 5000);

        return;
      }
    }

  } catch (error) {
    console.error("❌ Error en messageCreate:", error);

    try {
      await message.reply({
        embeds: [
          createEmbed(
            "❌・ERROR",
            "💗 Ocurrió un error al ejecutar el comando. Revisa los logs de Render."
          )
        ]
      });
    } catch {}
  }
});

// ======================================================
// INTERACCIONES
// ======================================================

client.on("interactionCreate", async (interaction) => {
  try {

    // ==================================================
    // HELP MENU
    // ==================================================

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "help_menu"
    ) {
      const embed = helpEmbed(
        interaction.values[0]
      );

      return interaction.update({
        embeds: [embed],
        components: [createHelpMenu()]
      });
    }

    // ==================================================
    // ADMIN MENU
    // ==================================================

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "admin_menu"
    ) {
      if (!isAdmin(interaction.member)) {
        return interaction.reply({
          ephemeral: true,
          embeds: [
            createEmbed(
              "🔒・SIN PERMISOS",
              "💗 Solo los administradores pueden utilizar este panel."
            )
          ]
        });
      }

      const selected =
        interaction.values[0];

      if (selected === "moderation") {
        return interaction.update({
          embeds: [
            createEmbed(
              "🛡️・MODERACIÓN",
              `Herramientas disponibles:

> \`${PREFIX}warn @usuario razón\`
> \`${PREFIX}warnings @usuario\`
> \`${PREFIX}timeout @usuario minutos\`
> \`${PREFIX}untimeout @usuario\`
> \`${PREFIX}kick @usuario razón\`
> \`${PREFIX}ban @usuario razón\`
> \`${PREFIX}clear cantidad\`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔐 Todos estos comandos están protegidos para staff.`
            )
          ],
          components: [createAdminMenu()]
        });
      }

      if (selected === "tickets") {
        return interaction.update({
          embeds: [
            createEmbed(
              "🎫・TICKETS",
              `🌸 Administración de tickets.

📌 Para enviar el panel:

\`${PREFIX}ticketpanel\`

💗 El sistema incluye:

> 🛠️ Soporte
> 🚨 Reporte
> ❓ Duda
> 🤝 Allys/Affys/Socio
> 📝 Postulación
> 📌 Otro

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✨ Los tickets se crean automáticamente de forma privada.`
            )
          ],
          components: [createAdminMenu()]
        });
      }

      if (selected === "config") {
        const settings =
          await getSetting(
            interaction.guild.id
          );

        return interaction.update({
          embeds: [
            createEmbed(
              "⚙️・CONFIGURACIÓN",
              `🌸 Configuración actual:

👋 Canal de bienvenida:
${
  settings?.welcome_channel
    ? `<#${settings.welcome_channel}>`
    : "No configurado"
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 Comandos:

\`${PREFIX}setwelcome #canal\`

💗 Configura las funciones de Akari desde aquí.`
            )
          ],
          components: [createAdminMenu()]
        });
      }

      if (selected === "economy") {
        return interaction.update({
          embeds: [
            createEmbed(
              "💰・ECONOMÍA ADMIN",
              `🌸 Sistema económico de Akari.

💗 Comandos públicos:

> \`${PREFIX}balance\`
> \`${PREFIX}daily\`
> \`${PREFIX}work\`
> \`${PREFIX}beg\`
> \`${PREFIX}pay\`
> \`${PREFIX}leaderboard\`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✨ La economía funciona mediante PostgreSQL.`
            )
          ],
          components: [createAdminMenu()]
        });
      }

      if (selected === "info") {
        return interaction.update({
          embeds: [
            createEmbed(
              "📊・INFORMACIÓN ADMINISTRATIVA",
              `🌸 Información del bot:

🤖 Bot:
**${client.user.tag}**

🏠 Servidores:
**${client.guilds.cache.size}**

📡 Ping:
**${client.ws.ping}ms**

🗄️ Base de datos:
**PostgreSQL**

🌐 Puerto:
**${PORT}**`
            )
          ],
          components: [createAdminMenu()]
        });
      }

      if (selected === "welcome") {
        const settings =
          await getSetting(
            interaction.guild.id
          );

        return interaction.update({
          embeds: [
            createEmbed(
              "👋・BIENVENIDAS",
              `🌸 Sistema de bienvenida de Akari Community.

📌 Canal configurado:
${
  settings?.welcome_channel
    ? `<#${settings.welcome_channel}>`
    : "❌ No configurado"
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💗 Para configurar:

\`${PREFIX}setwelcome #canal\`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✨ La plantilla incluye:

> 🌸 Bienvenida personalizada
> 👤 Mención del usuario
> 👥 Cantidad de miembros
> 💬 Información de la comunidad
> 🎮 Actividades
> 📌 Recomendaciones`
            )
          ],
          components: [createAdminMenu()]
        });
      }
    }

    // ==================================================
    // CREAR TICKET
    // ==================================================

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "ticket_category"
    ) {
      const guild = interaction.guild;
      const user = interaction.user;

      const existing =
        await pool.query(
          `
          SELECT *
          FROM tickets
          WHERE guild_id = $1
          AND user_id = $2
          `,
          [
            guild.id,
            user.id
          ]
        );

      if (existing.rows.length) {
        const oldChannel =
          guild.channels.cache.get(
            existing.rows[0].channel_id
          );

        if (oldChannel) {
          return interaction.reply({
            ephemeral: true,
            embeds: [
              createEmbed(
                "🎫・TICKET EXISTENTE",
                `💗 Ya tienes un ticket abierto.

📂 Puedes acceder aquí:
${oldChannel}`
              )
            ]
          });
        }

        await pool.query(
          `
          DELETE FROM tickets
          WHERE id = $1
          `,
          [existing.rows[0].id]
        );
      }

      const category =
        ticketCategoryName(
          interaction.values[0]
        );

      const channel =
        await guild.channels.create({
          name: `ticket-${user.username}`
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "-")
            .slice(0, 90),
          type: ChannelType.GuildText,
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
                PermissionFlagsBits.ReadMessageHistory
              ]
            },
            {
              id: STAFF_ROLE_ID,
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
        `
        INSERT INTO tickets
        (guild_id, user_id, channel_id, category)
        VALUES ($1, $2, $3, $4)
        `,
        [
          guild.id,
          user.id,
          channel.id,
          category
        ]
      );

      const embed = createEmbed(
        "🎫・TICKET ABIERTO",
        `🌸・𝘼𝙠𝙖𝙧𝙞 𝘾𝙤𝙢𝙢𝙪𝙣𝙞𝙩𝙮

🎫・TICKET ABIERTO

¡Bienvenido/a a tu ticket! 💗

Tu solicitud ha sido creada correctamente.

📂 Categoría
**${category}**

📝 Describe con detalle el motivo de tu ticket para que nuestro equipo pueda ayudarte de la mejor manera posible.

━━━━━━━━━━━━━━━━━━━━

📌・RECUERDA

✦ Sé claro con tu solicitud.
✦ Mantén el respeto en todo momento.
✦ Si tienes pruebas, envíalas aquí.
✦ No hagas menciones innecesarias al staff.
✦ Ten paciencia mientras atendemos tu solicitud.

🌸 Un miembro de nuestro equipo te atenderá lo antes posible.

🔒 Cuando tu solicitud haya sido solucionada, utiliza el botón de abajo para cerrar el ticket.

💗 Gracias por contactar con Akari Community.`
      );

      const buttons =
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("ticket_claim")
            .setLabel("Reclamar ticket")
            .setEmoji("🎫")
            .setStyle(ButtonStyle.Primary),

          new ButtonBuilder()
            .setCustomId("ticket_close")
            .setLabel("Cerrar ticket")
            .setEmoji("🔒")
            .setStyle(ButtonStyle.Danger)
        );

      await channel.send({
        content:
          `<@${user.id}> <@&${STAFF_ROLE_ID}>`,
        embeds: [embed],
        components: [buttons]
      });

      return interaction.reply({
        ephemeral: true,
        embeds: [
          createEmbed(
            "🎫・TICKET CREADO",
            `🌸 Tu ticket ha sido creado correctamente.

📂 Categoría:
**${category}**

💗 Puedes acceder aquí:
${channel}`
          )
        ]
      });
    }

    // ==================================================
    // RECLAMAR TICKET
    // ==================================================

    if (
      interaction.isButton() &&
      interaction.customId === "ticket_claim"
    ) {
      if (!isStaff(interaction.member)) {
        return interaction.reply({
          ephemeral: true,
          embeds: [
            createEmbed(
              "🔒・SIN PERMISOS",
              "💗 Solo el staff puede reclamar tickets."
            )
          ]
        });
      }

      const result =
        await pool.query(
          `
          SELECT *
          FROM tickets
          WHERE channel_id = $1
          `,
          [interaction.channel.id]
        );

      if (!result.rows.length) {
        return interaction.reply({
          ephemeral: true,
          embeds: [
            createEmbed(
              "❌・ERROR",
              "💗 Este canal no está registrado como ticket."
            )
          ]
        });
      }

      const ticket =
        result.rows[0];

      if (ticket.claimed_by) {
        return interaction.reply({
          ephemeral: true,
          embeds: [
            createEmbed(
              "🎫・TICKET RECLAMADO",
              `💗 Este ticket ya fue reclamado por <@${ticket.claimed_by}>.`
            )
          ]
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

      const embed =
        EmbedBuilder.from(
          interaction.message.embeds[0]
        );

      embed.addFields({
        name: "🎫 Ticket reclamado",
        value: `Este ticket está siendo atendido por ${interaction.user}.`,
        inline: false
      });

      return interaction.update({
        embeds: [embed]
      });
    }

    // ==================================================
    // CERRAR TICKET
    // ==================================================

    if (
      interaction.isButton() &&
      interaction.customId === "ticket_close"
    ) {
      if (!isStaff(interaction.member)) {
        return interaction.reply({
          ephemeral: true,
          embeds: [
            createEmbed(
              "🔒・SIN PERMISOS",
              "💗 Solo el staff puede cerrar tickets."
            )
          ]
        });
      }

      await interaction.reply({
        embeds: [
          createEmbed(
            "🔒・CERRANDO TICKET",
            `🌸 Este ticket será cerrado en unos segundos.

💗 Gracias por contactar con Akari Community.`
          )
        ]
      });

      await pool.query(
        `
        DELETE FROM tickets
        WHERE channel_id = $1
        `,
        [interaction.channel.id]
      );

      setTimeout(() => {
        interaction.channel.delete().catch(() => {});
      }, 5000);
    }

  } catch (error) {
    console.error(
      "❌ Error en interactionCreate:",
      error
    );

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        ephemeral: true,
        embeds: [
          createEmbed(
            "❌・ERROR",
            "💗 Ocurrió un error procesando esta interacción."
          )
        ]
      }).catch(() => {});
    }
  }
});

// ======================================================
// INICIO
// ======================================================

async function start() {
  console.log("🌸 AKARI: entrando en start()...");

  try {
    console.log("🌸 Conectando con PostgreSQL...");

    await pool.query("SELECT 1");

    console.log(
      "✅ PostgreSQL conectado correctamente."
    );

    await createTables();

    console.log("🌸 Conectando con Discord...");

    await client.login(TOKEN);

    console.log(
      "✅ Login de Discord realizado."
    );

  } catch (error) {
    console.error(
      "❌ ERROR AL INICIAR AKARI:",
      error
    );

    process.exit(1);
  }
}

console.log("🌸 AKARI: llamando a start()...");

start();
