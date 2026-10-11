const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder
} = require("discord.js");

const { Pool } = require("pg");
const http = require("http");

// ======================================================
// CONFIGURACIÓN
// ======================================================

const TOKEN = process.env.DISCORD_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;
const PORT = process.env.PORT || 10000;

const PREFIX = "M!";
const COLOR = 0xff9dcc;
const STAFF_ROLE_ID = "1555318924365799546";

if (!TOKEN) {
  throw new Error("Falta DISCORD_TOKEN.");
}

if (!DATABASE_URL) {
  throw new Error("Falta DATABASE_URL de PostgreSQL.");
}

// ======================================================
// SERVIDOR HTTP PARA RENDER
// ======================================================

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8"
  });

  res.end("Akari Bot está funcionando 🌸");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Servidor HTTP activo en el puerto ${PORT}`);
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
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration
  ],
  partials: [
    Partials.Channel,
    Partials.Message
  ]
});

// ======================================================
// VARIABLES
// ======================================================

const spamTracker = new Map();
const blackjackGames = new Map();
const cooldowns = new Map();
const xpCooldowns = new Map();
const hangmanGames = new Map();
const triviaGames = new Map();
const memoryGames = new Map();
const tttGames = new Map();

// ======================================================
// DATOS ANIME
// ======================================================

const animeCharacters = [
  {
    name: "Naruto Uzumaki",
    anime: "Naruto",
    fact: "Es el protagonista de Naruto.",
    image: "https://placehold.co/600x900/png?text=Naruto+Uzumaki"
  },
  {
    name: "Monkey D. Luffy",
    anime: "One Piece",
    fact: "Es el capitán de los Sombrero de Paja.",
    image: "https://placehold.co/600x900/png?text=Monkey+D.+Luffy"
  },
  {
    name: "Son Goku",
    anime: "Dragon Ball",
    fact: "Es uno de los personajes principales de Dragon Ball.",
    image: "https://placehold.co/600x900/png?text=Son+Goku"
  },
  {
    name: "Tanjiro Kamado",
    anime: "Demon Slayer",
    fact: "Es el protagonista de Demon Slayer.",
    image: "https://placehold.co/600x900/png?text=Tanjiro+Kamado"
  },
  {
    name: "Satoru Gojo",
    anime: "Jujutsu Kaisen",
    fact: "Es uno de los hechiceros más importantes de Jujutsu Kaisen.",
    image: "https://placehold.co/600x900/png?text=Satoru+Gojo"
  },
  {
    name: "Izuku Midoriya",
    anime: "My Hero Academia",
    fact: "Es conocido como Deku.",
    image: "https://placehold.co/600x900/png?text=Izuku+Midoriya"
  },
  {
    name: "Eren Yeager",
    anime: "Attack on Titan",
    fact: "Es uno de los personajes principales de Attack on Titan.",
    image: "https://placehold.co/600x900/png?text=Eren+Yeager"
  },
  {
    name: "Anya Forger",
    anime: "Spy x Family",
    fact: "Anya tiene la capacidad de leer pensamientos.",
    image: "https://placehold.co/600x900/png?text=Anya+Forger"
  },
  {
    name: "Nezuko Kamado",
    anime: "Demon Slayer",
    fact: "Es la hermana menor de Tanjiro.",
    image: "https://placehold.co/600x900/png?text=Nezuko+Kamado"
  },
  {
    name: "Kakashi Hatake",
    anime: "Naruto",
    fact: "Fue el líder del Equipo 7.",
    image: "https://placehold.co/600x900/png?text=Kakashi+Hatake"
  }
];

const animeQuotes = [
  "Nunca abandones tus objetivos.",
  "La verdadera fuerza también nace de proteger a los demás.",
  "Cada aventura comienza con una decisión.",
  "Incluso los días difíciles pueden convertirse en buenos recuerdos.",
  "Seguir adelante también es una forma de valentía."
];

const animeFacts = [
  "One Piece comenzó su publicación en 1997.",
  "Naruto está dividido en Naruto y Naruto Shippuden.",
  "Dragon Ball fue creado por Akira Toriyama.",
  "Demon Slayer está basado en el manga de Koyoharu Gotouge.",
  "My Hero Academia está ambientado en un mundo donde muchas personas poseen habilidades especiales.",
  "Spy x Family combina comedia, acción y vida familiar."
];

const animeQuizQuestions = [
  {
    question: "¿Cómo se llama el protagonista de One Piece?",
    answers: ["luffy", "monkey d luffy", "monkey d. luffy"],
    correct: "Monkey D. Luffy"
  },
  {
    question: "¿Cómo se llama el protagonista de Naruto?",
    answers: ["naruto", "naruto uzumaki"],
    correct: "Naruto Uzumaki"
  },
  {
    question: "¿Cómo se llama la hermana de Tanjiro?",
    answers: ["nezuko", "nezuko kamado"],
    correct: "Nezuko Kamado"
  },
  {
    question: "¿Cómo se llama el protagonista de Dragon Ball?",
    answers: ["goku", "son goku"],
    correct: "Son Goku"
  }
];

// ======================================================
// FUNCIONES
// ======================================================

function embed(title, description) {
  return new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

function random(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function formatCoins(amount) {
  return `${Number(amount).toLocaleString("es-ES")} 💰`;
}

function isAdmin(member) {
  return member &&
    member.permissions.has(PermissionsBitField.Flags.Administrator);
}

function isStaff(member) {
  return isAdmin(member) ||
    member.roles.cache.has(STAFF_ROLE_ID);
}

function parseAmount(value) {
  if (!value) return null;

  const cleaned = String(value)
    .replace(/,/g, "")
    .replace(/\./g, "");

  const amount = Number(cleaned);

  if (!Number.isFinite(amount)) return null;
  if (amount <= 0) return null;
  if (!Number.isInteger(amount)) return null;

  return amount;
}

function cooldown(userId, command, ms) {
  const key = `${userId}:${command}`;
  const now = Date.now();

  if (cooldowns.has(key)) {
    const remaining = cooldowns.get(key) - now;

    if (remaining > 0) {
      return Math.ceil(remaining / 1000);
    }
  }

  cooldowns.set(key, now + ms);

  setTimeout(() => {
    cooldowns.delete(key);
  }, ms + 1000);

  return 0;
}

function xpForLevel(level) {
  return level * 100;
}

function calculateLevel(xp) {
  return Math.floor(Number(xp) / 100) + 1;
}

function normalizeText(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

async function ensureUser(guildId, userId) {
  await pool.query(
    `
    INSERT INTO users
    (guild_id, user_id, coins, bank, daily, work, bonus, xp, level)
    VALUES ($1, $2, 0, 0, 0, 0, 0, 0, 1)
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

async function addCoins(guildId, userId, amount) {
  await ensureUser(guildId, userId);

  await pool.query(
    `
    UPDATE users
    SET coins = coins + $1
    WHERE guild_id = $2 AND user_id = $3
    `,
    [amount, guildId, userId]
  );
}

async function addWarning(guildId, userId, moderatorId, reason) {
  await pool.query(
    `
    INSERT INTO warnings
    (guild_id, user_id, moderator_id, reason)
    VALUES ($1, $2, $3, $4)
    `,
    [guildId, userId, moderatorId, reason]
  );

  const result = await pool.query(
    `
    SELECT COUNT(*)::int AS total
    FROM warnings
    WHERE guild_id = $1 AND user_id = $2
    `,
    [guildId, userId]
  );

  return result.rows[0].total;
}

async function ensureSettings(guildId) {
  await pool.query(
    `
    INSERT INTO settings
    (guild_id, antispam_enabled, logs_enabled)
    VALUES ($1, TRUE, TRUE)
    ON CONFLICT (guild_id) DO NOTHING
    `,
    [guildId]
  );
}

async function isAntiSpamEnabled(guildId) {
  await ensureSettings(guildId);

  const result = await pool.query(
    `
    SELECT antispam_enabled
    FROM settings
    WHERE guild_id = $1
    `,
    [guildId]
  );

  return result.rows[0]?.antispam_enabled !== false;
}

async function getLogsChannel(guild) {
  await ensureSettings(guild.id);

  const result = await pool.query(
    `
    SELECT logs_channel, logs_enabled
    FROM settings
    WHERE guild_id = $1
    `,
    [guild.id]
  );

  if (!result.rows[0]?.logs_enabled) return null;
  if (!result.rows[0]?.logs_channel) return null;

  return guild.channels.cache.get(result.rows[0].logs_channel) || null;
}

async function sendLog(guild, title, description) {
  try {
    const channel = await getLogsChannel(guild);

    if (!channel) return;

    await channel.send({
      embeds: [
        embed(title, description)
      ]
    });
  } catch (error) {
    console.error("Error enviando log:", error);
  }
}

async function addXP(message) {
  if (!message.guild) return;
  if (message.author.bot) return;
  if (message.content.startsWith(PREFIX)) return;

  const key = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();

  if (
    xpCooldowns.has(key) &&
    xpCooldowns.get(key) > now
  ) {
    return;
  }

  xpCooldowns.set(key, now + 45000);

  setTimeout(() => {
    xpCooldowns.delete(key);
  }, 47000);

  await ensureUser(
    message.guild.id,
    message.author.id
  );

  const user = await getUser(
    message.guild.id,
    message.author.id
  );

  const oldLevel = Number(user.level) || 1;
  const gained = Math.floor(Math.random() * 6) + 5;
  const newXP = Number(user.xp) + gained;
  const newLevel = calculateLevel(newXP);

  await pool.query(
    `
    UPDATE users
    SET xp = $1,
        level = $2
    WHERE guild_id = $3 AND user_id = $4
    `,
    [
      newXP,
      newLevel,
      message.guild.id,
      message.author.id
    ]
  );

  if (newLevel > oldLevel) {
    const result = await pool.query(
      `
      SELECT levels_channel
      FROM settings
      WHERE guild_id = $1
      `,
      [message.guild.id]
    );

    const channelId = result.rows[0]?.levels_channel;

    if (channelId) {
      const channel =
        message.guild.channels.cache.get(channelId);

      if (channel) {
        const levelText = `
╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
       🌸・𝘼𝙠𝙖𝙧𝙞 𝘾𝙤𝙢𝙢𝙪𝙣𝙞𝙩𝙮
          ⭐・NUEVO NIVEL
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

🎉 ¡Felicidades, ${message.author}!

Tu actividad en la comunidad ha dado sus frutos. 💗

⭐・Nivel alcanzado
**Nivel ${newLevel}**

✨・Experiencia
**${newXP} XP**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌸 Sigue participando, conversando y formando parte de la comunidad para continuar subiendo de nivel.

🏆 ¿Hasta qué nivel podrás llegar?

💗 Gracias por formar parte de **Akari Community**.
`;

        await channel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(COLOR)
              .setDescription(levelText)
              .setTimestamp()
          ]
        });
      }
    }
  }
}

// ======================================================
// TABLAS
// ======================================================

async function createTables() {
  console.log("🌸 Creando/verificando tablas...");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      coins BIGINT DEFAULT 0,
      bank BIGINT DEFAULT 0,
      daily BIGINT DEFAULT 0,
      work BIGINT DEFAULT 0,
      bonus BIGINT DEFAULT 0,
      xp BIGINT DEFAULT 0,
      level INTEGER DEFAULT 1,
      PRIMARY KEY (guild_id, user_id)
    );
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS bank BIGINT DEFAULT 0;
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS bonus BIGINT DEFAULT 0;
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS xp BIGINT DEFAULT 0;
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      guild_id TEXT PRIMARY KEY,
      welcome_channel TEXT,
      welcome_message TEXT,
      levels_channel TEXT,
      suggestions_channel TEXT,
      confessions_channel TEXT,
      antispam_enabled BOOLEAN DEFAULT TRUE,
      logs_channel TEXT,
      logs_enabled BOOLEAN DEFAULT TRUE
    );
  `);

  await pool.query(`
    ALTER TABLE settings
    ADD COLUMN IF NOT EXISTS levels_channel TEXT;
  `);

  await pool.query(`
    ALTER TABLE settings
    ADD COLUMN IF NOT EXISTS suggestions_channel TEXT;
  `);

  await pool.query(`
    ALTER TABLE settings
    ADD COLUMN IF NOT EXISTS confessions_channel TEXT;
  `);

  await pool.query(`
    ALTER TABLE settings
    ADD COLUMN IF NOT EXISTS antispam_enabled BOOLEAN DEFAULT TRUE;
  `);

  await pool.query(`
    ALTER TABLE settings
    ADD COLUMN IF NOT EXISTS logs_channel TEXT;
  `);

  await pool.query(`
    ALTER TABLE settings
    ADD COLUMN IF NOT EXISTS logs_enabled BOOLEAN DEFAULT TRUE;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tickets (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      category TEXT NOT NULL,
      claimed_by TEXT,
      priority TEXT DEFAULT 'media',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS claimed_by TEXT;
  `);

  await pool.query(`
    ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'media';
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS shop_items (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      type TEXT NOT NULL,
      target_id TEXT,
      message TEXT,
      price BIGINT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS suggestions (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      message_id TEXT,
      content TEXT NOT NULL,
      upvotes INTEGER DEFAULT 0,
      downvotes INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS suggestion_votes (
      suggestion_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      vote INTEGER NOT NULL,
      PRIMARY KEY (suggestion_id, user_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS confessions (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      message_id TEXT,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    INSERT INTO settings
    (guild_id, antispam_enabled, logs_enabled)
    SELECT guild_id, TRUE, TRUE
    FROM (
      SELECT DISTINCT guild_id
      FROM users
    ) x
    ON CONFLICT (guild_id) DO NOTHING;
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

client.on("guildMemberAdd", async member => {
  try {
    await ensureSettings(member.guild.id);

    const result = await pool.query(
      `
      SELECT welcome_channel
      FROM settings
      WHERE guild_id = $1
      `,
      [member.guild.id]
    );

    if (!result.rows[0]?.welcome_channel) return;

    const channel = member.guild.channels.cache.get(
      result.rows[0].welcome_channel
    );

    if (!channel) return;

    const text = `
╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
       🌸・𝘼𝙠𝙖𝙧𝙞 𝘾𝙤𝙢𝙢𝙪𝙣𝙞𝙩𝙮
          👋・BIENVENIDO/A
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

🌸 ¡Bienvenido/a, ${member}!

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

👥・Ahora somos **${member.guild.memberCount}** miembros.
`;

    await channel.send({
      content: `${member}`,
      embeds: [
        embed("🌸・𝘼𝙠𝙖𝙧𝙞 𝘾𝙤𝙢𝙢𝙪𝙣𝙞𝙩𝙮", text)
      ]
    });

    await sendLog(
      member.guild,
      "👋・Miembro entró",
      `${member.user.tag} entró al servidor.`
    );
  } catch (error) {
    console.error("Error en bienvenida:", error);
  }
});

client.on("guildMemberRemove", async member => {
  await sendLog(
    member.guild,
    "📤・Miembro salió",
    `**${member.user.tag}** salió del servidor.`
  );
});

// ======================================================
// ANTISPAM
// ======================================================

async function antiSpam(message) {
  if (!message.guild) return false;
  if (message.author.bot) return false;

  if (!(await isAntiSpamEnabled(message.guild.id))) {
    return false;
  }

  const member = message.member;

  if (!member) return false;

  if (
    member.permissions.has(
      PermissionsBitField.Flags.Administrator
    ) ||
    member.roles.cache.has(STAFF_ROLE_ID)
  ) {
    return false;
  }

  const key = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();

  let data = spamTracker.get(key);

  if (!data || now - data.lastMessage > 7000) {
    data = {
      count: 0,
      lastMessage: now
    };
  }

  data.count++;
  data.lastMessage = now;

  spamTracker.set(key, data);

  if (data.count < 5) return false;

  spamTracker.delete(key);

  try {
    const totalWarnings = await addWarning(
      message.guild.id,
      message.author.id,
      client.user.id,
      "Anti-spam: 5 mensajes seguidos"
    );

    await message.channel.send({
      embeds: [
        embed(
          "⚠️・Anti-Spam",
          `${message.author}, has recibido **1 warn** por enviar 5 mensajes seguidos.\n\n📊 Warns actuales: **${totalWarnings}/3**`
        )
      ]
    }).then(msg => {
      setTimeout(() => msg.delete().catch(() => {}), 5000);
    });

    await sendLog(
      message.guild,
      "⚠️・Anti-Spam",
      `${message.author} recibió un warn automático.\n\nRazón: 5 mensajes seguidos.\nWarns: ${totalWarnings}/3`
    );

    if (totalWarnings >= 3) {
      try {
        await member.timeout(
          60 * 60 * 1000,
          "Anti-spam: 3 warnings"
        );

        await message.channel.send({
          embeds: [
            embed(
              "🔇・Mute automático",
              `${message.author} ha alcanzado **3 warns** y recibió un **mute de 1 hora** por acumulación de advertencias.`
            )
          ]
        }).then(msg => {
          setTimeout(() => msg.delete().catch(() => {}), 6000);
        });
      } catch (error) {
        console.error("No se pudo aplicar el mute:", error);
      }
    }

    return true;
  } catch (error) {
    console.error("Error Anti-Spam:", error);
    return false;
  }
}

// ======================================================
// MENSAJES
// ======================================================

client.on("messageCreate", async message => {
  try {
    if (!message.guild) return;
    if (message.author.bot) return;

    await addXP(message);

    const spammed = await antiSpam(message);

    if (spammed) return;

    if (!message.content.startsWith(PREFIX)) return;

    const raw = message.content
      .slice(PREFIX.length)
      .replace(/^[ \t\r\n]*/, "");

    const match = raw.match(/^(\S+)([\s\S]*)$/);

    if (!match) return;

    const command = match[1].toLowerCase();
    const rawArguments = match[2] || "";
    const args = rawArguments
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    await ensureUser(
      message.guild.id,
      message.author.id
    );

    // ==================================================
    // PING
    // ==================================================

    if (command === "ping") {
      return message.reply({
        embeds: [
          embed(
            "🏓・PONG",
            `💗 Latencia: **${client.ws.ping}ms**`
          )
        ]
      });
    }

    // ==================================================
    // HELP
    // ==================================================

    if (command === "help" || command === "ayuda") {
      const menu = new StringSelectMenuBuilder()
        .setCustomId("help_menu")
        .setPlaceholder("🌸 Selecciona una categoría")
        .addOptions([
          {
            label: "Economía",
            description: "Dinero, banco, tienda y economía",
            value: "economy",
            emoji: "💰"
          },
          {
            label: "Diversión",
            description: "Juegos y comandos divertidos",
            value: "fun",
            emoji: "🎮"
          },
          {
            label: "Social",
            description: "Comandos sociales",
            value: "social",
            emoji: "💗"
          },
          {
            label: "Información",
            description: "Información del servidor y usuarios",
            value: "info",
            emoji: "📚"
          },
          {
            label: "Utilidades",
            description: "Herramientas útiles",
            value: "utils",
            emoji: "🛠️"
          },
          {
            label: "Anime",
            description: "Comandos de anime y otaku",
            value: "anime",
            emoji: "🌸"
          },
          {
            label: "Niveles",
            description: "XP y niveles",
            value: "levels",
            emoji: "⭐"
          }
        ]);

      return message.reply({
        embeds: [
          embed(
            "🌸・𝘼𝙠𝙖𝙧𝙞 𝘾𝙤𝙢𝙢𝙖𝙣𝙙𝙨",
            `
╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
        🌸・𝘼𝙠𝙖𝙧𝙞 𝘾𝙤𝙢𝙢𝙪𝙣𝙞𝙩𝙮
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

💗 Bienvenido/a al centro de comandos de Akari.

Selecciona una categoría en el menú de abajo para ver los comandos disponibles.

🌸・Prefijo: \`${PREFIX}\`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 Economía
🎮 Diversión
💗 Social
📚 Información
🛠️ Utilidades
🌸 Anime
⭐ Niveles
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`
          )
        ],
        components: [
          new ActionRowBuilder().addComponents(menu)
        ]
      });
    }

    // ==================================================
    // SAY
    // ==================================================

    if (command === "say") {
      if (!isAdmin(message.member)) {
        return message.reply("❌ Solo administradores.");
      }

      const text = rawArguments.replace(/^[ \t]+/, "");

      if (!text) {
        return message.reply(
          `❌ Usa: \`${PREFIX}say mensaje\``
        );
      }

      await message.delete().catch(() => {});

      return message.channel.send({
        content: text,
        allowedMentions: {
          parse: []
        }
      });
    }

    // ==================================================
    // EMBED
    // ==================================================

    if (command === "embed") {
      if (!isAdmin(message.member)) {
        return message.reply("❌ Solo administradores.");
      }

      const embedArgs = rawArguments.trim();

      const colorMatch =
        embedArgs.match(/^#?([0-9a-fA-F]{6})\s+([\s\S]+)$/);

      if (!colorMatch) {
        return message.reply(
          `❌ Usa: \`${PREFIX}embed #92383F mensaje\``
        );
      }

      const color = parseInt(colorMatch[1], 16);
      const text = colorMatch[2];

      await message.delete().catch(() => {});

      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(color)
            .setDescription(text)
            .setTimestamp()
        ]
      });
    }

    // ==================================================
    // ANTISPAM ADMIN
    // ==================================================

    if (command === "antispam") {
      if (!isAdmin(message.member)) {
        return message.reply("❌ Solo administradores.");
      }

      const option = args[0]?.toLowerCase();

      if (!["on", "off", "status"].includes(option)) {
        return message.reply(
          `❌ Usa: \`${PREFIX}antispam on\`, \`${PREFIX}antispam off\` o \`${PREFIX}antispam status\``
        );
      }

      await ensureSettings(message.guild.id);

      if (option === "status") {
        const result = await pool.query(
          `
          SELECT antispam_enabled
          FROM settings
          WHERE guild_id = $1
          `,
          [message.guild.id]
        );

        return message.reply({
          embeds: [
            embed(
              "🛡️・Anti-Spam",
              `Estado: **${result.rows[0]?.antispam_enabled ? "Activado 🟢" : "Desactivado 🔴"}**`
            )
          ]
        });
      }

      const enabled = option === "on";

      await pool.query(
        `
        UPDATE settings
        SET antispam_enabled = $1
        WHERE guild_id = $2
        `,
        [enabled, message.guild.id]
      );

      return message.reply({
        embeds: [
          embed(
            "🛡️・Anti-Spam",
            `El Anti-Spam ha sido **${enabled ? "activado 🟢" : "desactivado 🔴"}**.`
          )
        ]
      });
    }

    // ==================================================
    // NIVELES
    // ==================================================

    if (["rank", "level"].includes(command)) {
      const target =
        message.mentions.users.first() ||
        message.author;

      const user = await getUser(
        message.guild.id,
        target.id
      );

      const xp = Number(user.xp);
      const level = calculateLevel(xp);
      const current = xp % 100;
      const next = 100 - current;

      return message.reply({
        embeds: [
          embed(
            "⭐・Nivel",
            `
👤 Usuario: ${target}

⭐ Nivel: **${level}**
✨ XP: **${xp}**

📊 Progreso:
**${current}/100 XP**

🌸 Faltan **${next} XP** para el siguiente nivel.
`
          ).setThumbnail(
            target.displayAvatarURL({ dynamic: true })
          )
        ]
      });
    }

    if (command === "levels") {
      const result = await pool.query(
        `
        SELECT user_id, xp, level
        FROM users
        WHERE guild_id = $1
        ORDER BY xp DESC
        LIMIT 10
        `,
        [message.guild.id]
      );

      let text = "";

      result.rows.forEach((row, index) => {
        text += `**${index + 1}.** <@${row.user_id}> — Nivel **${row.level}** · **${row.xp} XP**\n`;
      });

      return message.reply({
        embeds: [
          embed(
            "🏆・Ranking de niveles",
            text || "Todavía no hay datos."
          )
        ]
      });
    }

    // ==================================================
    // ECONOMÍA
    // ==================================================

    if (["balance", "bal", "coins"].includes(command)) {
      const user = await getUser(
        message.guild.id,
        message.author.id
      );

      return message.reply({
        embeds: [
          embed(
            "💰・Tu economía",
            `
👤 Usuario: ${message.author}

💵 Efectivo: **${formatCoins(user.coins)}**
🏦 Banco: **${formatCoins(user.bank)}**

💎 Total: **${formatCoins(
              Number(user.coins) + Number(user.bank)
            )}**
`
          )
        ]
      });
    }

    if (["bank", "banco", "economy", "stats"].includes(command)) {
      const user = await getUser(
        message.guild.id,
        message.author.id
      );

      return message.reply({
        embeds: [
          embed(
            "🏦・Estadísticas económicas",
            `
💵 Efectivo: **${formatCoins(user.coins)}**
🏦 Banco: **${formatCoins(user.bank)}**
💎 Patrimonio total: **${formatCoins(
              Number(user.coins) + Number(user.bank)
            )}**

📅 Daily: ${user.daily
              ? `<t:${Math.floor(Number(user.daily) / 1000)}:R>`
              : "Disponible"}

💼 Work: ${user.work
              ? `<t:${Math.floor(Number(user.work) / 1000)}:R>`
              : "Disponible"}
`
          )
        ]
      });
    }

    if (command === "daily") {
      const remaining = cooldown(
        message.author.id,
        "daily",
        24 * 60 * 60 * 1000
      );

      if (remaining) {
        return message.reply({
          embeds: [
            embed(
              "⏰・Daily",
              `Ya recogiste tu recompensa.\n\nVuelve <t:${Math.floor((Date.now() + remaining * 1000) / 1000)}:R>.`
            )
          ]
        });
      }

      const amount = Math.floor(Math.random() * 201) + 300;

      await addCoins(
        message.guild.id,
        message.author.id,
        amount
      );

      await pool.query(
        `
        UPDATE users
        SET daily = $1
        WHERE guild_id = $2 AND user_id = $3
        `,
        [
          Date.now(),
          message.guild.id,
          message.author.id
        ]
      );

      return message.reply({
        embeds: [
          embed(
            "🎁・Recompensa diaria",
            `
🌸 Has recibido **${formatCoins(amount)}**.

💗 ¡Vuelve mañana para reclamar otra recompensa!
`
          )
        ]
      });
    }

    if (command === "work") {
      const remaining = cooldown(
        message.author.id,
        "work",
        30 * 60 * 1000
      );

      if (remaining) {
        return message.reply({
          embeds: [
            embed(
              "⏰・Trabajo",
              `Ya trabajaste recientemente.\n\nVuelve <t:${Math.floor((Date.now() + remaining * 1000) / 1000)}:R>.`
            )
          ]
        });
      }

      const amount = Math.floor(Math.random() * 201) + 100;

      await addCoins(
        message.guild.id,
        message.author.id,
        amount
      );

      return message.reply({
        embeds: [
          embed(
            "💼・Trabajo completado",
            `✨ Has trabajado y recibido **${formatCoins(amount)}**.`
          )
        ]
      });
    }

    if (command === "beg") {
      const remaining = cooldown(
        message.author.id,
        "beg",
        60 * 1000
      );

      if (remaining) {
        return message.reply({
          embeds: [
            embed(
              "⏰・Espera",
              `Puedes volver a pedir monedas <t:${Math.floor((Date.now() + remaining * 1000) / 1000)}:R>.`
            )
          ]
        });
      }

      const amount = Math.floor(Math.random() * 101) + 20;

      await addCoins(
        message.guild.id,
        message.author.id,
        amount
      );

      return message.reply({
        embeds: [
          embed(
            "🙏・Beg",
            `Alguien decidió ayudarte y recibiste **${formatCoins(amount)}**.`
          )
        ]
      });
    }

    if (["deposit", "dep"].includes(command)) {
      const amount = parseAmount(args[0]);

      if (!amount) {
        return message.reply("❌ Usa: `M!deposit cantidad`");
      }

      const user = await getUser(
        message.guild.id,
        message.author.id
      );

      if (Number(user.coins) < amount) {
        return message.reply("❌ No tienes suficiente dinero en efectivo.");
      }

      await pool.query(
        `
        UPDATE users
        SET coins = coins - $1,
            bank = bank + $1
        WHERE guild_id = $2 AND user_id = $3
        `,
        [amount, message.guild.id, message.author.id]
      );

      return message.reply({
        embeds: [
          embed(
            "🏦・Depósito",
            `Has depositado **${formatCoins(amount)}** en el banco.`
          )
        ]
      });
    }

    if (["depositall", "depall"].includes(command)) {
      const user = await getUser(
        message.guild.id,
        message.author.id
      );

      const amount = Number(user.coins);

      if (amount <= 0) {
        return message.reply("❌ No tienes dinero en efectivo para depositar.");
      }

      await pool.query(
        `
        UPDATE users
        SET coins = 0,
            bank = bank + $1
        WHERE guild_id = $2 AND user_id = $3
        `,
        [amount, message.guild.id, message.author.id]
      );

      return message.reply({
        embeds: [
          embed(
            "🏦・Depósito completo",
            `Has depositado todo tu efectivo: **${formatCoins(amount)}**.`
          )
        ]
      });
    }

    if (["withdraw", "retirar"].includes(command)) {
      const amount = parseAmount(args[0]);

      if (!amount) {
        return message.reply("❌ Usa: `M!withdraw cantidad`");
      }

      const user = await getUser(
        message.guild.id,
        message.author.id
      );

      if (Number(user.bank) < amount) {
        return message.reply("❌ No tienes suficiente dinero en el banco.");
      }

      await pool.query(
        `
        UPDATE users
        SET bank = bank - $1,
            coins = coins + $1
        WHERE guild_id = $2 AND user_id = $3
        `,
        [amount, message.guild.id, message.author.id]
      );

      return message.reply({
        embeds: [
          embed(
            "💵・Retiro",
            `Has retirado **${formatCoins(amount)}** del banco.`
          )
        ]
      });
    }

    if (["withdrawall", "retirarall"].includes(command)) {
      const user = await getUser(
        message.guild.id,
        message.author.id
      );

      const amount = Number(user.bank);

      if (amount <= 0) {
        return message.reply("❌ No tienes dinero en el banco.");
      }

      await pool.query(
        `
        UPDATE users
        SET bank = 0,
            coins = coins + $1
        WHERE guild_id = $2 AND user_id = $3
        `,
        [amount, message.guild.id, message.author.id]
      );

      return message.reply({
        embeds: [
          embed(
            "💵・Retiro completo",
            `Has retirado todo tu dinero del banco: **${formatCoins(amount)}**.`
          )
        ]
      });
    }

    if (["pay", "give", "transfer"].includes(command)) {
      const target = message.mentions.users.first();
      const amount = parseAmount(args[1]);

      if (!target || !amount) {
        return message.reply(
          "❌ Usa: `M!pay @usuario cantidad`"
        );
      }

      if (target.bot) {
        return message.reply("❌ No puedes enviar dinero a un bot.");
      }

      if (target.id === message.author.id) {
        return message.reply("❌ No puedes enviarte dinero a ti mismo.");
      }

      const user = await getUser(
        message.guild.id,
        message.author.id
      );

      if (Number(user.coins) < amount) {
        return message.reply("❌ No tienes suficiente dinero.");
      }

      await ensureUser(message.guild.id, target.id);

      await pool.query(
        `
        UPDATE users
        SET coins = coins - $1
        WHERE guild_id = $2 AND user_id = $3
        `,
        [amount, message.guild.id, message.author.id]
      );

      await addCoins(
        message.guild.id,
        target.id,
        amount
      );

      return message.reply({
        embeds: [
          embed(
            "💸・Transferencia",
            `${message.author} ha enviado **${formatCoins(amount)}** a ${target}.`
          )
        ]
      });
    }

    if (["payall", "giveall"].includes(command)) {
      const amount = parseAmount(args[0]);

      if (!amount) {
        return message.reply(
          "❌ Usa: `M!payall cantidad`"
        );
      }

      const user = await getUser(
        message.guild.id,
        message.author.id
      );

      const members = message.guild.members.cache.filter(
        m => !m.user.bot && m.id !== message.author.id
      );

      if (members.size === 0) {
        return message.reply("❌ No hay miembros disponibles.");
      }

      const total = amount * members.size;

      if (Number(user.coins) < total) {
        return message.reply(
          `❌ Necesitas **${formatCoins(total)}** para pagar ${members.size} personas.`
        );
      }

      await pool.query(
        `
        UPDATE users
        SET coins = coins - $1
        WHERE guild_id = $2 AND user_id = $3
        `,
        [total, message.guild.id, message.author.id]
      );

      for (const member of members.values()) {
        await addCoins(
          message.guild.id,
          member.id,
          amount
        );
      }

      return message.reply({
        embeds: [
          embed(
            "💸・Pago global",
            `Has enviado **${formatCoins(amount)}** a **${members.size} miembros**.\n\n💎 Total enviado: **${formatCoins(total)}**`
          )
        ]
      });
    }

    if (["leaderboard", "top", "rich"].includes(command)) {
      const result = await pool.query(
        `
        SELECT user_id, coins + bank AS total
        FROM users
        WHERE guild_id = $1
        ORDER BY total DESC
        LIMIT 10
        `,
        [message.guild.id]
      );

      let text = "";

      result.rows.forEach((row, index) => {
        text += `**${index + 1}.** <@${row.user_id}> — **${formatCoins(row.total)}**\n`;
      });

      return message.reply({
        embeds: [
          embed(
            "🏆・Ranking económico",
            text || "Todavía no hay datos."
          )
        ]
      });
    }

    // ==================================================
    // SHOP
    // ==================================================

    if (
      command === "shop" ||
      command === "tienda"
    ) {
      const result = await pool.query(
        `
        SELECT *
        FROM shop_items
        WHERE guild_id = $1
        ORDER BY id ASC
        `,
        [message.guild.id]
      );

      if (!result.rows.length) {
        return message.reply({
          embeds: [
            embed(
              "🛒・Tienda",
              "La tienda está vacía actualmente."
            )
          ]
        });
      }

      let text = "";

      for (const item of result.rows) {
        if (item.type === "role") {
          const role =
            message.guild.roles.cache.get(item.target_id);

          text += `**#${item.id}**・${role ? role : "Rol eliminado"} — **${formatCoins(item.price)}**\n`;
        } else {
          text += `**#${item.id}**・${item.message} — **${formatCoins(item.price)}**\n`;
        }
      }

      return message.reply({
        embeds: [
          embed(
            "🛒・Tienda de Akari",
            `
Compra recompensas usando tus monedas.

━━━━━━━━━━━━━━━━━━━━

${text}

━━━━━━━━━━━━━━━━━━━━

💗 Usa \`${PREFIX}buy ID\` para comprar.
`
          )
        ]
      });
    }

    if (
      command === "shopedit" ||
      command === "shopadd"
    ) {
      if (!isAdmin(message.member)) {
        return message.reply("❌ Solo administradores.");
      }

      const type = args.shift()?.toLowerCase();

      if (type === "rol" || type === "role") {
        const role = message.mentions.roles.first();
        const price = parseAmount(args[1]);

        if (!role || !price) {
          return message.reply(
            `❌ Usa: \`${PREFIX}shopadd rol @Rol cantidad\``
          );
        }

        await pool.query(
          `
          INSERT INTO shop_items
          (guild_id, type, target_id, price)
          VALUES ($1, 'role', $2, $3)
          `,
          [
            message.guild.id,
            role.id,
            price
          ]
        );

        return message.reply({
          embeds: [
            embed(
              "🛒・Tienda actualizada",
              `
🎭 Rol: ${role}
💰 Precio: **${formatCoins(price)}**

El rol fue añadido a la tienda.
`
            )
          ]
        });
      }

      if (type === "mensaje" || type === "message") {
        const price = parseAmount(args[args.length - 1]);

        if (!price) {
          return message.reply(
            `❌ Usa: \`${PREFIX}shopadd mensaje texto cantidad\``
          );
        }

        const text = args.slice(0, -1).join(" ");

        if (!text) {
          return message.reply("❌ Escribe la recompensa.");
        }

        await pool.query(
          `
          INSERT INTO shop_items
          (guild_id, type, message, price)
          VALUES ($1, 'message', $2, $3)
          `,
          [
            message.guild.id,
            text,
            price
          ]
        );

        return message.reply({
          embeds: [
            embed(
              "🛒・Tienda actualizada",
              `
🎁 Recompensa:
**${text}**

💰 Precio: **${formatCoins(price)}**
`
            )
          ]
        });
      }

      return message.reply("❌ Tipo inválido.");
    }

    if (
      command === "shopdelete" ||
      command === "shopremove"
    ) {
      if (!isAdmin(message.member)) {
        return message.reply("❌ Solo administradores.");
      }

      const id = Number(args[0]);

      if (!id) {
        return message.reply(
          `❌ Usa: \`${PREFIX}shopremove ID\``
        );
      }

      const result = await pool.query(
        `
        DELETE FROM shop_items
        WHERE id = $1 AND guild_id = $2
        RETURNING id
        `,
        [id, message.guild.id]
      );

      if (!result.rows.length) {
        return message.reply("❌ Ese producto no existe.");
      }

      return message.reply({
        embeds: [
          embed(
            "🗑️・Tienda",
            `El producto **#${id}** fue eliminado.`
          )
        ]
      });
    }

    if (
      command === "buy" ||
      command === "comprar"
    ) {
      const id = Number(args[0]);

      if (!id) {
        return message.reply("❌ Usa: `M!buy ID`");
      }

      const result = await pool.query(
        `
        SELECT *
        FROM shop_items
        WHERE id = $1 AND guild_id = $2
        `,
        [id, message.guild.id]
      );

      const item = result.rows[0];

      if (!item) {
        return message.reply("❌ Ese producto no existe.");
      }

      const user = await getUser(
        message.guild.id,
        message.author.id
      );

      if (Number(user.coins) < Number(item.price)) {
        return message.reply("❌ No tienes suficientes monedas.");
      }

      if (item.type === "role") {
        const role =
          message.guild.roles.cache.get(item.target_id);

        if (!role) {
          return message.reply("❌ El rol ya no existe.");
        }

        if (!role.editable) {
          return message.reply("❌ No puedo administrar ese rol.");
        }

        if (message.member.roles.cache.has(role.id)) {
          return message.reply("❌ Ya tienes ese rol.");
        }

        await message.member.roles.add(role);

        await pool.query(
          `
          UPDATE users
          SET coins = coins - $1
          WHERE guild_id = $2 AND user_id = $3
          `,
          [
            item.price,
            message.guild.id,
            message.author.id
          ]
        );

        return message.reply({
          embeds: [
            embed(
              "🛍️・Compra realizada",
              `Has comprado ${role} por **${formatCoins(item.price)}**.`
            )
          ]
        });
      }

      if (item.type === "message") {
        await pool.query(
          `
          UPDATE users
          SET coins = coins - $1
          WHERE guild_id = $2 AND user_id = $3
          `,
          [
            item.price,
            message.guild.id,
            message.author.id
          ]
        );

        return message.reply({
          embeds: [
            embed(
              "🛍️・Recompensa",
              `Has comprado tu recompensa por **${formatCoins(item.price)}**.\n\n🎁 ${item.message}`
            )
          ]
        });
      }
    }

    // ==================================================
    // BLACKJACK SIN APUESTAS
    // ==================================================

    if (["bj", "blackjack"].includes(command)) {
      if (blackjackGames.has(message.author.id)) {
        return message.reply(
          "❌ Ya tienes una partida de blackjack activa."
        );
      }

      const deck = [];
      const suits = ["♠️", "♥️", "♦️", "♣️"];

      const values = [
        ["A", 11],
        ["2", 2],
        ["3", 3],
        ["4", 4],
        ["5", 5],
        ["6", 6],
        ["7", 7],
        ["8", 8],
        ["9", 9],
        ["10", 10],
        ["J", 10],
        ["Q", 10],
        ["K", 10]
      ];

      for (const suit of suits) {
        for (const [name, value] of values) {
          deck.push({
            name,
            value,
            display: `${name}${suit}`
          });
        }
      }

      deck.sort(() => Math.random() - 0.5);

      const player = [
        deck.pop(),
        deck.pop()
      ];

      const dealer = [
        deck.pop(),
        deck.pop()
      ];

      blackjackGames.set(message.author.id, {
        deck,
        player,
        dealer
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("bj_hit")
          .setLabel("Pedir")
          .setEmoji("🃏")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("bj_stand")
          .setLabel("Plantarse")
          .setEmoji("✋")
          .setStyle(ButtonStyle.Secondary)
      );

      return message.reply({
        embeds: [
          blackjackEmbed(
            message.author,
            player,
            dealer,
            false
          )
        ],
        components: [row]
      });
    }

    // ==================================================
    // DIVERSIÓN
    // ==================================================

    if (["coin", "flip"].includes(command)) {
      return message.reply({
        embeds: [
          embed(
            "🪙・Moneda",
            `${message.author} lanzó la moneda.\n\n**${Math.random() < 0.5 ? "🪙 Cara" : "🪙 Cruz"}**`
          )
        ]
      });
    }

    if (["dice", "dado"].includes(command)) {
      const result =
        Math.floor(Math.random() * 6) + 1;

      return message.reply({
        embeds: [
          embed(
            "🎲・Dado",
            `${message.author} lanzó un dado y obtuvo **${result}**.`
          )
        ]
      });
    }

    if (command === "random") {
      const min = Number(args[0]) || 1;
      const max = Number(args[1]) || 100;

      if (min >= max) {
        return message.reply(
          "❌ El mínimo debe ser menor que el máximo."
        );
      }

      const result =
        Math.floor(
          Math.random() * (max - min + 1)
        ) + min;

      return message.reply({
        embeds: [
          embed(
            "🎲・Número aleatorio",
            `Resultado: **${result}**`
          )
        ]
      });
    }

    if (command === "choose") {
      if (args.length < 2) {
        return message.reply(
          "❌ Usa: `M!choose opción1 opción2 opción3`"
        );
      }

      return message.reply({
        embeds: [
          embed(
            "🤔・Elección",
            `He elegido: **${random(args)}**`
          )
        ]
      });
    }

    if (command === "8ball") {
      const answers = [
        "Sí, definitivamente.",
        "Probablemente sí.",
        "No estoy seguro.",
        "Probablemente no.",
        "No.",
        "Las estrellas dicen que sí.",
        "Mejor inténtalo más tarde."
      ];

      return message.reply({
        embeds: [
          embed(
            "🎱・8Ball",
            `🔮 ${random(answers)}`
          )
        ]
      });
    }

    if (["rps", "ppt"].includes(command)) {
      const choices = [
        "piedra",
        "papel",
        "tijera"
      ];

      const userChoice =
        args[0]?.toLowerCase();

      if (!choices.includes(userChoice)) {
        return message.reply(
          "❌ Usa: `M!rps piedra`, `M!rps papel` o `M!rps tijera`."
        );
      }

      const botChoice = random(choices);

      let result = "Empate.";

      if (
        (userChoice === "piedra" &&
          botChoice === "tijera") ||
        (userChoice === "papel" &&
          botChoice === "piedra") ||
        (userChoice === "tijera" &&
          botChoice === "papel")
      ) {
        result = "¡Ganaste! 🎉";
      } else if (
        userChoice !== botChoice
      ) {
        result = "Gané yo. 😎";
      }

      return message.reply({
        embeds: [
          embed(
            "✂️・Piedra, Papel o Tijera",
            `
👤 Tú: **${userChoice}**
🤖 Akari: **${botChoice}**

🌸 ${result}
`
          )
        ]
      });
    }

    // ==================================================
    // HANGMAN
    // ==================================================

    if (command === "hangman") {
      if (hangmanGames.has(message.author.id)) {
        return message.reply(
          "❌ Ya tienes una partida de ahorcado activa."
        );
      }

      const words = [
        "akari",
        "discord",
        "anime",
        "naruto",
        "minecraft",
        "comunidad",
        "javascript"
      ];

      const word = random(words);

      hangmanGames.set(message.author.id, {
        word,
        guessed: [],
        wrong: 0
      });

      const display = word
        .split("")
        .map(x => "_")
        .join(" ");

      return message.reply({
        embeds: [
          embed(
            "🎯・Ahorcado",
            `
Palabra:

**${display}**

💡 Usa \`${PREFIX}guessletter letra\`

❌ Errores: **0/6**
`
          )
        ]
      });
    }

    if (
      command === "guessletter" ||
      command === "letra"
    ) {
      const game =
        hangmanGames.get(message.author.id);

      if (!game) {
        return message.reply(
          `❌ No tienes una partida. Usa \`${PREFIX}hangman\`.`
        );
      }

      const letter =
        normalizeText(args[0] || "");

      if (!/^[a-zñ]$/.test(letter)) {
        return message.reply(
          "❌ Escribe una sola letra."
        );
      }

      if (game.guessed.includes(letter)) {
        return message.reply(
          "❌ Ya probaste esa letra."
        );
      }

      game.guessed.push(letter);

      if (!game.word.includes(letter)) {
        game.wrong++;
      }

      const display = game.word
        .split("")
        .map(x =>
          game.guessed.includes(x)
            ? x
            : "_"
        )
        .join(" ");

      if (!display.includes("_")) {
        hangmanGames.delete(message.author.id);

        return message.reply({
          embeds: [
            embed(
              "🎉・Ahorcado",
              `¡Ganaste!\n\nLa palabra era **${game.word}**.`
            )
          ]
        });
      }

      if (game.wrong >= 6) {
        hangmanGames.delete(message.author.id);

        return message.reply({
          embeds: [
            embed(
              "💥・Ahorcado",
              `Perdiste.\n\nLa palabra era **${game.word}**.`
            )
          ]
        });
      }

      return message.reply({
        embeds: [
          embed(
            "🎯・Ahorcado",
            `
**${display}**

❌ Errores: **${game.wrong}/6**
🔤 Letras: ${game.guessed.join(", ")}
`
          )
        ]
      });
    }

    // ==================================================
    // MEMORY
    // ==================================================

    if (command === "memory") {
      const sequence = Array.from(
        { length: 5 },
        () => Math.floor(Math.random() * 10)
      ).join("");

      memoryGames.set(message.author.id, {
        sequence,
        expires: Date.now() + 30000
      });

      setTimeout(() => {
        const game =
          memoryGames.get(message.author.id);

        if (
          game &&
          game.sequence === sequence
        ) {
          memoryGames.delete(message.author.id);
        }
      }, 31000);

      return message.reply({
        embeds: [
          embed(
            "🧠・Memory",
            `
Memoriza este número:

# ${sequence}

Tienes **30 segundos**.

Después usa:
\`${PREFIX}memory respuesta\`
`
          )
        ]
      });
    }

    if (
      command === "memoryanswer" ||
      (command === "memory" && args[0])
    ) {
      const game =
        memoryGames.get(message.author.id);

      if (!game) {
        return message.reply(
          "❌ No tienes una partida de Memory activa."
        );
      }

      if (Date.now() > game.expires) {
        memoryGames.delete(message.author.id);

        return message.reply(
          "⏰ Se acabó el tiempo."
        );
      }

      if (args[0] === game.sequence) {
        memoryGames.delete(message.author.id);

        return message.reply({
          embeds: [
            embed(
              "🎉・Memory",
              "¡Correcto! Tienes buena memoria. 🧠✨"
            )
          ]
        });
      }

      memoryGames.delete(message.author.id);

      return message.reply({
        embeds: [
          embed(
            "❌・Memory",
            `Incorrecto.\n\nLa respuesta era **${game.sequence}**.`
          )
        ]
      });
    }

    // ==================================================
    // TRIVIA
    // ==================================================

    if (["trivia", "quiz"].includes(command)) {
      const questions = [
        {
          q: "¿Cuál es el planeta conocido como el planeta rojo?",
          a: "marte"
        },
        {
          q: "¿Cuántos lados tiene un hexágono?",
          a: "6"
        },
        {
          q: "¿Cuál es el océano más grande?",
          a: "pacifico"
        }
      ];

      const question = random(questions);

      triviaGames.set(message.author.id, {
        question,
        expires: Date.now() + 30000
      });

      return message.reply({
        embeds: [
          embed(
            "🧠・Trivia",
            `**${question.q}**\n\nResponde con \`${PREFIX}answer respuesta\`.`
          )
        ]
      });
    }

    if (
      command === "answer" ||
      command === "respuesta"
    ) {
      const game =
        triviaGames.get(message.author.id);

      if (!game) {
        return message.reply(
          "❌ No tienes una trivia activa."
        );
      }

      triviaGames.delete(message.author.id);

      const answer = normalizeText(
        args.join(" ")
      );

      if (
        answer === normalizeText(game.question.a)
      ) {
        return message.reply({
          embeds: [
            embed(
              "🎉・Trivia",
              "¡Respuesta correcta! 🌸"
            )
          ]
        });
      }

      return message.reply({
        embeds: [
          embed(
            "❌・Trivia",
            `Respuesta incorrecta.\n\nLa respuesta era **${game.question.a}**.`
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

      const user = await getUser(
        message.guild.id,
        target.id
      );

      return message.reply({
        embeds: [
          embed(
            "💗・Perfil",
            `
👤 Usuario: ${target}

⭐ Nivel: **${user.level}**
✨ XP: **${user.xp}**

💰 Dinero: **${formatCoins(
              Number(user.coins) +
              Number(user.bank)
            )}**

💵 Efectivo: **${formatCoins(user.coins)}**
🏦 Banco: **${formatCoins(user.bank)}**
`
          ).setThumbnail(
            target.displayAvatarURL({
              dynamic: true
            })
          )
        ]
      });
    }

    if (command === "avatar") {
      const target =
        message.mentions.users.first() ||
        message.author;

      return message.reply({
        embeds: [
          embed(
            "🖼️・Avatar",
            `[Abrir avatar](${target.displayAvatarURL({
              extension: "png",
              size: 1024
            })})`
          ).setImage(
            target.displayAvatarURL({
              extension: "png",
              size: 1024
            })
          )
        ]
      });
    }

    if (
      ["hug", "abrazo"].includes(command)
    ) {
      const target =
        message.mentions.users.first();

      if (!target) {
        return message.reply(
          "❌ Menciona a alguien."
        );
      }

      return message.reply({
        embeds: [
          embed(
            "🤗・Abrazo",
            `${message.author} le da un abrazo amistoso a ${target}. 💗`
          )
        ]
      });
    }

    if (
      ["highfive", "choca"].includes(command)
    ) {
      const target =
        message.mentions.users.first();

      if (!target) {
        return message.reply(
          "❌ Menciona a alguien."
        );
      }

      return message.reply({
        embeds: [
          embed(
            "🙌・High Five",
            `${message.author} y ${target} chocaron las manos. ✨`
          )
        ]
      });
    }

    if (command === "wave") {
      const target =
        message.mentions.users.first();

      if (!target) {
        return message.reply(
          "❌ Menciona a alguien."
        );
      }

      return message.reply({
        embeds: [
          embed(
            "👋・Saludo",
            `${message.author} saluda a ${target}. 🌸`
          )
        ]
      });
    }

    if (command === "friend") {
      const target =
        message.mentions.users.first();

      if (!target) {
        return message.reply(
          "❌ Menciona a alguien."
        );
      }

      return message.reply({
        embeds: [
          embed(
            "🤝・Amistad",
            `${message.author} quiere ser amigo/a de ${target}. 💗`
          )
        ]
      });
    }

    if (command === "rep") {
      const target =
        message.mentions.users.first();

      if (!target) {
        return message.reply(
          "❌ Menciona a alguien."
        );
      }

      if (target.bot) {
        return message.reply(
          "❌ No puedes dar reputación a bots."
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

      return message.reply({
        embeds: [
          embed(
            "⭐・Reputación",
            `${message.author} le dio **+1 reputación** a ${target}.`
          )
        ]
      });
    }

    // ==================================================
    // SUGERENCIAS
    // ==================================================

    if (
      command === "suggest" ||
      command === "sugerencia"
    ) {
      const content = rawArguments.trim();

      if (!content) {
        return message.reply(
          `❌ Usa: \`${PREFIX}suggest tu sugerencia\``
        );
      }

      const settings = await pool.query(
        `
        SELECT suggestions_channel
        FROM settings
        WHERE guild_id = $1
        `,
        [message.guild.id]
      );

      const channelId =
        settings.rows[0]?.suggestions_channel;

      if (!channelId) {
        return message.reply(
          "❌ El sistema de sugerencias todavía no está configurado."
        );
      }

      const channel =
        message.guild.channels.cache.get(channelId);

      if (!channel) {
        return message.reply(
          "❌ El canal de sugerencias no existe."
        );
      }

      const suggestion = await pool.query(
        `
        INSERT INTO suggestions
        (guild_id, user_id, channel_id, content)
        VALUES ($1, $2, $3, $4)
        RETURNING id
        `,
        [
          message.guild.id,
          message.author.id,
          channel.id,
          content
        ]
      );

      const id = suggestion.rows[0].id;

      const buttons =
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`suggest_up:${id}`)
            .setLabel("0")
            .setEmoji("👍")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`suggest_down:${id}`)
            .setLabel("0")
            .setEmoji("👎")
            .setStyle(ButtonStyle.Danger)
        );

      const sent = await channel.send({
        embeds: [
          embed(
            `💡・Sugerencia #${id}`,
            `
${content}

━━━━━━━━━━━━━━━━━━━━

👤 Enviada por: ${message.author}
`
          )
        ],
        components: [buttons]
      });

      await pool.query(
        `
        UPDATE suggestions
        SET message_id = $1
        WHERE id = $2
        `,
        [
          sent.id,
          id
        ]
      );

      return message.reply(
        `✅ Tu sugerencia fue enviada a ${channel}.`
      );
    }

    // ==================================================
    // CONFESIONES
    // ==================================================

    if (
      command === "confess" ||
      command === "confesion"
    ) {
      const content = rawArguments.trim();

      if (!content) {
        return message.reply(
          `❌ Usa: \`${PREFIX}confess tu confesión\``
        );
      }

      const settings = await pool.query(
        `
        SELECT confessions_channel
        FROM settings
        WHERE guild_id = $1
        `,
        [message.guild.id]
      );

      const channelId =
        settings.rows[0]?.confessions_channel;

      if (!channelId) {
        return message.reply(
          "❌ El sistema de confesiones todavía no está configurado."
        );
      }

      const channel =
        message.guild.channels.cache.get(channelId);

      if (!channel) {
        return message.reply(
          "❌ El canal de confesiones no existe."
        );
      }

      const result = await pool.query(
        `
        INSERT INTO confessions
        (guild_id, user_id, channel_id, content)
        VALUES ($1, $2, $3, $4)
        RETURNING id
        `,
        [
          message.guild.id,
          message.author.id,
          channel.id,
          content
        ]
      );

      const id = result.rows[0].id;

      await channel.send({
        embeds: [
          embed(
            `🤫・Confesión #${id}`,
            `
> ${content}

━━━━━━━━━━━━━━━━━━━━

🤫 **Confesión anónima**
`
          )
        ]
      });

      await message.delete().catch(() => {});

      return message.channel.send(
        "✅ Tu confesión fue enviada de forma anónima."
      ).then(msg => {
        setTimeout(
          () => msg.delete().catch(() => {}),
          5000
        );
      });
    }

    // ==================================================
    // INFORMACIÓN
    // ==================================================

    if (command === "serverinfo") {
      return message.reply({
        embeds: [
          embed(
            "📚・Información del servidor",
            `
🌸 Nombre: **${message.guild.name}**
👑 Dueño: <@${message.guild.ownerId}>
👥 Miembros: **${message.guild.memberCount}**
💬 Canales: **${message.guild.channels.cache.size}**
🎭 Roles: **${message.guild.roles.cache.size}**
😀 Emojis: **${message.guild.emojis.cache.size}**
`
          )
        ]
      });
    }

    if (command === "membercount") {
      return message.reply({
        embeds: [
          embed(
            "👥・Miembros",
            `Akari Community tiene **${message.guild.memberCount} miembros**.`
          )
        ]
      });
    }

    if (command === "userinfo") {
      const target =
        message.mentions.members.first() ||
        message.member;

      return message.reply({
        embeds: [
          embed(
            "👤・Información del usuario",
            `
👤 Usuario: ${target.user}
🆔 ID: \`${target.id}\`
📅 Cuenta: <t:${Math.floor(target.user.createdTimestamp / 1000)}:F>
📥 Entró al servidor: ${
              target.joinedTimestamp
                ? `<t:${Math.floor(target.joinedTimestamp / 1000)}:F>`
                : "Desconocido"
            }
`
          ).setThumbnail(
            target.user.displayAvatarURL({
              dynamic: true
            })
          )
        ]
      });
    }

    if (command === "roleinfo") {
      const role =
        message.mentions.roles.first() ||
        message.guild.roles.cache.get(args[0]);

      if (!role) {
        return message.reply(
          "❌ Menciona un rol."
        );
      }

      return message.reply({
        embeds: [
          embed(
            "🎭・Información del rol",
            `
🎭 Rol: ${role}
🆔 ID: \`${role.id}\`
👥 Miembros: **${role.members.size}**
📌 Posición: **${role.position}**
`
          )
        ]
      });
    }

    if (command === "channelinfo") {
      const channel =
        message.mentions.channels.first() ||
        message.channel;

      return message.reply({
        embeds: [
          embed(
            "📺・Información del canal",
            `
📺 Canal: ${channel}
🆔 ID: \`${channel.id}\`
📂 Tipo: **${channel.type}**
`
          )
        ]
      });
    }

    if (command === "botinfo") {
      return message.reply({
        embeds: [
          embed(
            "🤖・Información de Akari",
            `
🌸 Nombre: **Akari Bot**
📌 Prefijo: \`${PREFIX}\`
🏠 Servidores: **${client.guilds.cache.size}**
👥 Usuarios: **${client.users.cache.size}**
🏓 Ping: **${client.ws.ping}ms**
⏱️ Uptime: **${Math.floor(
              client.uptime / 1000
            )}s**
`
          )
        ]
      });
    }

    if (command === "uptime") {
      const seconds =
        Math.floor(client.uptime / 1000);

      return message.reply({
        embeds: [
          embed(
            "⏱️・Uptime",
            `Akari lleva funcionando **${seconds} segundos**.`
          )
        ]
      });
    }

    if (command === "roles") {
      const roles =
        message.guild.roles.cache
          .filter(r => r.id !== message.guild.id)
          .map(r => r.toString())
          .slice(0, 50);

      return message.reply({
        embeds: [
          embed(
            "🎭・Roles",
            roles.join(" ") ||
            "No hay roles."
          )
        ]
      });
    }

    if (command === "emojis") {
      const emojis =
        message.guild.emojis.cache;

      return message.reply({
        embeds: [
          embed(
            "😀・Emojis",
            emojis.size
              ? emojis.map(e => e.toString()).join(" ")
              : "No hay emojis."
          )
        ]
      });
    }

    // ==================================================
    // UTILIDADES
    // ==================================================

    if (command === "calc") {
      const expression =
        args.join(" ");

      if (!expression) {
        return message.reply(
          "❌ Usa: `M!calc 10 + 5`"
        );
      }

      if (!/^[0-9+\-*/(). %]+$/.test(expression)) {
        return message.reply(
          "❌ Solo se permiten operaciones matemáticas básicas."
        );
      }

      try {
        const result = Function(
          `"use strict"; return (${expression})`
        )();

        if (!Number.isFinite(result)) {
          return message.reply(
            "❌ Resultado inválido."
          );
        }

        return message.reply({
          embeds: [
            embed(
              "🧮・Calculadora",
              `\`${expression}\` = **${result}**`
            )
          ]
        });
      } catch {
        return message.reply(
          "❌ No pude calcular esa operación."
        );
      }
    }

    if (command === "poll") {
      const question =
        rawArguments.trim();

      if (!question) {
        return message.reply(
          "❌ Usa: `M!poll ¿Te gusta Akari?`"
        );
      }

      const pollMessage =
        await message.channel.send({
          embeds: [
            embed(
              "📊・Encuesta",
              `**${question}**\n\n👍 Sí\n👎 No`
            )
          ]
        });

      await pollMessage.react("👍");
      await pollMessage.react("👎");

      return;
    }

    // ==================================================
    // ANIME
    // ==================================================

    if (
      ["anime", "animehelp"].includes(command)
    ) {
      return message.reply({
        embeds: [
          embed(
            "🌸・Categoría Anime",
            `
╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
          🌸・ANIME
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

👤 \`${PREFIX}animechar\`
🎲 \`${PREFIX}animechoose\`
💡 \`${PREFIX}animefact\`
💬 \`${PREFIX}animequote\`
🧠 \`${PREFIX}animequiz\`
🌸 \`${PREFIX}anime\`
✨ \`${PREFIX}otaku\`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💗 ¡Disfruta de la sección anime de Akari!
`
          )
        ]
      });
    }

    if (
      command === "animechar" ||
      command === "animecharacter"
    ) {
      const character =
        random(animeCharacters);

      return message.reply({
        embeds: [
          embed(
            "🌸・Personaje Anime",
            `
👤 Personaje: **${character.name}**
📺 Anime: **${character.anime}**

💡 ${character.fact}
`
          ).setImage(character.image)
        ]
      });
    }

    if (command === "animechoose") {
      const character =
        random(animeCharacters);

      return message.reply({
        embeds: [
          embed(
            "🎲・Elección Anime",
            `🌸 Akari ha elegido a **${character.name}** de **${character.anime}**.`
          ).setImage(character.image)
        ]
      });
    }

    if (command === "animefact") {
      return message.reply({
        embeds: [
          embed(
            "💡・Dato Anime",
            `🌸 ${random(animeFacts)}`
          )
        ]
      });
    }

    if (command === "animequote") {
      return message.reply({
        embeds: [
          embed(
            "💬・Frase Anime",
            `🌸 ${random(animeQuotes)}`
          )
        ]
      });
    }

    if (command === "animequiz") {
      const quiz =
        random(animeQuizQuestions);

      return message.reply({
        embeds: [
          embed(
            "🧠・Anime Quiz",
            `
🌸 **${quiz.question}**

Escribe tu respuesta en el chat.
`
          )
        ]
      });
    }

    if (command === "otaku") {
      const level =
        Math.floor(Math.random() * 101);

      return message.reply({
        embeds: [
          embed(
            "🌸・Nivel Otaku",
            `${message.author}, tu nivel otaku es de **${level}%**. ✨`
          )
        ]
      });
    }

    // ==================================================
    // ADMIN
    // ==================================================

    if (command === "admin") {
      if (!isAdmin(message.member)) {
        return message.reply(
          "❌ No tienes permiso para usar este comando."
        );
      }

      const menu =
        new StringSelectMenuBuilder()
          .setCustomId("admin_menu")
          .setPlaceholder(
            "🛡️ Selecciona una sección"
          )
          .addOptions([
            {
              label: "Moderación",
              description: "Warn, timeout, kick, ban y clear",
              value: "moderation",
              emoji: "🛡️"
            },
            {
              label: "Tickets",
              description: "Sistema de tickets",
              value: "tickets",
              emoji: "🎫"
            },
            {
              label: "Configuración",
              description: "Configuraciones del servidor",
              value: "config",
              emoji: "⚙️"
            },
            {
              label: "Economía",
              description: "Administración de economía y tienda",
              value: "economy_admin",
              emoji: "💰"
            },
            {
              label: "Niveles",
              description: "Configurar niveles",
              value: "levels_admin",
              emoji: "⭐"
            },
            {
              label: "Sugerencias",
              description: "Configurar sugerencias",
              value: "suggestions_admin",
              emoji: "💡"
            },
            {
              label: "Confesiones",
              description: "Configurar confesiones",
              value: "confessions_admin",
              emoji: "🤫"
            },
            {
              label: "Logs",
              description: "Configurar logs",
              value: "logs_admin",
              emoji: "📋"
            },
            {
              label: "Anti-Spam",
              description: "Controlar Anti-Spam",
              value: "antispam_admin",
              emoji: "🚨"
            },
            {
              label: "Mensajes",
              description: "Say y embeds administrativos",
              value: "messages_admin",
              emoji: "📢"
            },
            {
              label: "Información",
              description: "Información administrativa",
              value: "info_admin",
              emoji: "📊"
            },
            {
              label: "Bienvenidas",
              description: "Configurar bienvenida",
              value: "welcome",
              emoji: "👋"
            }
          ]);

      return message.reply({
        embeds: [
          embed(
            "🛡️・Panel de Administración",
            `
🌸 Bienvenido al panel administrativo de Akari.

Selecciona una sección en el menú para consultar los comandos disponibles.

⚠️ Este panel es exclusivo para administradores.
`
          )
        ],
        components: [
          new ActionRowBuilder()
            .addComponents(menu)
        ]
      });
    }

    // ==================================================
    // SET LEVELS
    // ==================================================

    if (command === "setlevels") {
      if (!isAdmin(message.member)) {
        return message.reply(
          "❌ Solo administradores."
        );
      }

      const channel =
        message.mentions.channels.first() ||
        message.guild.channels.cache.get(args[0]);

      if (!channel) {
        return message.reply(
          `❌ Usa: \`${PREFIX}setlevels #canal\``
        );
      }

      await ensureSettings(
        message.guild.id
      );

      await pool.query(
        `
        UPDATE settings
        SET levels_channel = $1
        WHERE guild_id = $2
        `,
        [
          channel.id,
          message.guild.id
        ]
      );

      return message.reply({
        embeds: [
          embed(
            "⭐・Niveles",
            `El canal de niveles ahora es ${channel}.`
          )
        ]
      });
    }

    // ==================================================
    // SET SUGGESTIONS
    // ==================================================

    if (
      command === "setsuggestions" ||
      command === "suggestionset"
    ) {
      if (!isAdmin(message.member)) {
        return message.reply(
          "❌ Solo administradores."
        );
      }

      const channel =
        message.mentions.channels.first() ||
        message.guild.channels.cache.get(args[0]);

      if (!channel) {
        return message.reply(
          `❌ Usa: \`${PREFIX}setsuggestions #canal\``
        );
      }

      await ensureSettings(
        message.guild.id
      );

      await pool.query(
        `
        UPDATE settings
        SET suggestions_channel = $1
        WHERE guild_id = $2
        `,
        [
          channel.id,
          message.guild.id
        ]
      );

      return message.reply({
        embeds: [
          embed(
            "💡・Sugerencias",
            `El canal de sugerencias ahora es ${channel}.`
          )
        ]
      });
    }

    // ==================================================
    // SET CONFESSIONS
    // ==================================================

    if (
      command === "setconfessions" ||
      command === "confessionset"
    ) {
      if (!isAdmin(message.member)) {
        return message.reply(
          "❌ Solo administradores."
        );
      }

      const channel =
        message.mentions.channels.first() ||
        message.guild.channels.cache.get(args[0]);

      if (!channel) {
        return message.reply(
          `❌ Usa: \`${PREFIX}setconfessions #canal\``
        );
      }

      await ensureSettings(
        message.guild.id
      );

      await pool.query(
        `
        UPDATE settings
        SET confessions_channel = $1
        WHERE guild_id = $2
        `,
        [
          channel.id,
          message.guild.id
        ]
      );

      return message.reply({
        embeds: [
          embed(
            "🤫・Confesiones",
            `El canal de confesiones ahora es ${channel}.`
          )
        ]
      });
    }

    // ==================================================
    // LOGS
    // ==================================================

    if (command === "setlogs") {
      if (!isAdmin(message.member)) {
        return message.reply(
          "❌ Solo administradores."
        );
      }

      const channel =
        message.mentions.channels.first() ||
        message.guild.channels.cache.get(args[0]);

      if (!channel) {
        return message.reply(
          `❌ Usa: \`${PREFIX}setlogs #canal\``
        );
      }

      await ensureSettings(
        message.guild.id
      );

      await pool.query(
        `
        UPDATE settings
        SET logs_channel = $1
        WHERE guild_id = $2
        `,
        [
          channel.id,
          message.guild.id
        ]
      );

      return message.reply({
        embeds: [
          embed(
            "📋・Logs",
            `El canal de logs ahora es ${channel}.`
          )
        ]
      });
    }

    if (command === "logs") {
      if (!isAdmin(message.member)) {
        return message.reply(
          "❌ Solo administradores."
        );
      }

      const option =
        args[0]?.toLowerCase();

      if (
        !["on", "off", "status"].includes(option)
      ) {
        return message.reply(
          `❌ Usa: \`${PREFIX}logs on\`, \`${PREFIX}logs off\` o \`${PREFIX}logs status\``
        );
      }

      await ensureSettings(
        message.guild.id
      );

      if (option === "status") {
        const result = await pool.query(
          `
          SELECT logs_enabled, logs_channel
          FROM settings
          WHERE guild_id = $1
          `,
          [message.guild.id]
        );

        const data = result.rows[0];

        return message.reply({
          embeds: [
            embed(
              "📋・Logs",
              `
Estado: **${
                data?.logs_enabled
                  ? "Activado 🟢"
                  : "Desactivado 🔴"
              }**

Canal: ${
                data?.logs_channel
                  ? `<#${data.logs_channel}>`
                  : "No configurado"
              }
`
            )
          ]
        });
      }

      const enabled =
        option === "on";

      await pool.query(
        `
        UPDATE settings
        SET logs_enabled = $1
        WHERE guild_id = $2
        `,
        [
          enabled,
          message.guild.id
        ]
      );

      return message.reply({
        embeds: [
          embed(
            "📋・Logs",
            `Los logs han sido **${enabled ? "activados 🟢" : "desactivados 🔴"}**.`
          )
        ]
      });
    }

    // ==================================================
    // SET WELCOME
    // ==================================================

    if (command === "setwelcome") {
      if (!isAdmin(message.member)) {
        return message.reply(
          "❌ No tienes permiso."
        );
      }

      const channel =
        message.mentions.channels.first() ||
        message.guild.channels.cache.get(args[0]);

      if (!channel) {
        return message.reply(
          "❌ Usa: `M!setwelcome #canal`"
        );
      }

      await ensureSettings(
        message.guild.id
      );

      await pool.query(
        `
        INSERT INTO settings
        (guild_id, welcome_channel)
        VALUES ($1, $2)
        ON CONFLICT (guild_id)
        DO UPDATE SET welcome_channel = EXCLUDED.welcome_channel
        `,
        [
          message.guild.id,
          channel.id
        ]
      );

      return message.reply({
        embeds: [
          embed(
            "👋・Bienvenidas",
            `El canal de bienvenida ahora es ${channel}.`
          )
        ]
      });
    }

    // ==================================================
    // TICKET PANEL
    // ==================================================

    if (command === "ticketpanel") {
      if (!isAdmin(message.member)) {
        return message.reply(
          "❌ No tienes permiso."
        );
      }

      const menu =
        new StringSelectMenuBuilder()
          .setCustomId("ticket_menu")
          .setPlaceholder(
            "🎫 Selecciona una categoría"
          )
          .addOptions([
            {
              label: "Soporte",
              description: "Necesito ayuda",
              value: "Soporte",
              emoji: "🛠️"
            },
            {
              label: "Reporte",
              description: "Reportar un usuario o situación",
              value: "Reporte",
              emoji: "🚨"
            },
            {
              label: "Duda",
              description: "Tengo una duda",
              value: "Duda",
              emoji: "❓"
            },
            {
              label: "Allys/Affys/Socio",
              description: "Solicitudes de colaboración",
              value: "Allys/Affys/Socio",
              emoji: "🤝"
            },
            {
              label: "Postulación",
              description: "Enviar una postulación",
              value: "Postulación",
              emoji: "📝"
            },
            {
              label: "Otro",
              description: "Otra solicitud",
              value: "Otro",
              emoji: "📌"
            }
          ]);

      return message.channel.send({
        embeds: [
          embed(
            "🌸・𝘼𝙠𝙖𝙧𝙞 𝘾𝙤𝙢𝙢𝙪𝙣𝙞𝙩𝙮",
            `
╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
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
                para abrir tu ticket.
`
          )
        ],
        components: [
          new ActionRowBuilder()
            .addComponents(menu)
        ]
      });
    }

    // ==================================================
    // TICKET ADD
    // ==================================================

    if (command === "add") {
      if (!isStaff(message.member)) {
        return message.reply(
          "❌ Solo el staff puede usar esto."
        );
      }

      const target =
        message.mentions.members.first();

      if (!target) {
        return message.reply(
          `❌ Usa: \`${PREFIX}add @usuario\``
        );
      }

      const ticket =
        await pool.query(
          `
          SELECT *
          FROM tickets
          WHERE channel_id = $1
          `,
          [message.channel.id]
        );

      if (!ticket.rows.length) {
        return message.reply(
          "❌ Este canal no es un ticket."
        );
      }

      await message.channel.permissionOverwrites.edit(
        target.id,
        {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true
        }
      );

      await sendLog(
        message.guild,
        "🎫・Usuario añadido al ticket",
        `${message.author} añadió a ${target} al ticket ${message.channel}.`
      );

      return message.reply({
        embeds: [
          embed(
            "🎫・Usuario añadido",
            `${target} ahora puede acceder a este ticket.`
          )
        ]
      });
    }

    // ==================================================
    // TICKET REMOVE
    // ==================================================

    if (command === "remove") {
      if (!isStaff(message.member)) {
        return message.reply(
          "❌ Solo el staff puede usar esto."
        );
      }

      const target =
        message.mentions.members.first();

      if (!target) {
        return message.reply(
          `❌ Usa: \`${PREFIX}remove @usuario\``
        );
      }

      const ticket =
        await pool.query(
          `
          SELECT *
          FROM tickets
          WHERE channel_id = $1
          `,
          [message.channel.id]
        );

      if (!ticket.rows.length) {
        return message.reply(
          "❌ Este canal no es un ticket."
        );
      }

      await message.channel.permissionOverwrites.edit(
        target.id,
        {
          ViewChannel: false,
          SendMessages: false,
          ReadMessageHistory: false
        }
      );

      await sendLog(
        message.guild,
        "🎫・Usuario retirado del ticket",
        `${message.author} retiró a ${target} del ticket ${message.channel}.`
      );

      return message.reply({
        embeds: [
          embed(
            "🎫・Usuario retirado",
            `${target} ya no puede acceder a este ticket.`
          )
        ]
      });
    }

    // ==================================================
    // TICKET RENAME
    // ==================================================

    if (command === "rename") {
      if (!isStaff(message.member)) {
        return message.reply(
          "❌ Solo el staff puede usar esto."
        );
      }

      const ticket =
        await pool.query(
          `
          SELECT *
          FROM tickets
          WHERE channel_id = $1
          `,
          [message.channel.id]
        );

      if (!ticket.rows.length) {
        return message.reply(
          "❌ Este canal no es un ticket."
        );
      }

      const name =
        args.join("-")
          .toLowerCase()
          .replace(/[^a-z0-9-_]/g, "")
          .slice(0, 90);

      if (!name) {
        return message.reply(
          `❌ Usa: \`${PREFIX}rename nombre\``
        );
      }

      await message.channel.setName(
        name
      );

      await sendLog(
        message.guild,
        "🎫・Ticket renombrado",
        `${message.author} cambió el nombre del ticket a **${name}**.`
      );

      return message.reply({
        embeds: [
          embed(
            "🎫・Ticket renombrado",
            `Nuevo nombre: **${name}**`
          )
        ]
      });
    }

    // ==================================================
    // TICKET PRIORITY
    // ==================================================

    if (command === "priority") {
      if (!isStaff(message.member)) {
        return message.reply(
          "❌ Solo el staff puede usar esto."
        );
      }

      const priority =
        args[0]?.toLowerCase();

      if (
        !["baja", "media", "alta"].includes(priority)
      ) {
        return message.reply(
          `❌ Usa: \`${PREFIX}priority baja\`, \`media\` o \`alta\`.`
        );
      }

      const ticket =
        await pool.query(
          `
          SELECT *
          FROM tickets
          WHERE channel_id = $1
          `,
          [message.channel.id]
        );

      if (!ticket.rows.length) {
        return message.reply(
          "❌ Este canal no es un ticket."
        );
      }

      await pool.query(
        `
        UPDATE tickets
        SET priority = $1
        WHERE channel_id = $2
        `,
        [
          priority,
          message.channel.id
        ]
      );

      return message.reply({
        embeds: [
          embed(
            "🎫・Prioridad actualizada",
            `La prioridad del ticket ahora es **${priority}**.`
          )
        ]
      });
    }

    // ==================================================
    // MODERACIÓN
    // ==================================================

    if (command === "warn") {
      if (!isStaff(message.member)) {
        return message.reply(
          "❌ No tienes permiso."
        );
      }

      const target =
        message.mentions.members.first();

      if (!target) {
        return message.reply(
          `❌ Usa: \`${PREFIX}warn @usuario razón\``
        );
      }

      const reason =
        args.slice(1).join(" ") ||
        "Sin razón especificada";

      const total =
        await addWarning(
          message.guild.id,
          target.id,
          message.author.id,
          reason
        );

      if (total >= 3) {
        try {
          await target.timeout(
            60 * 60 * 1000,
            "3 warnings"
          );
        } catch {}
      }

      await sendLog(
        message.guild,
        "⚠️・Warn",
        `${message.author} dio un warn a ${target}.\n\nRazón: ${reason}\nWarns: ${total}/3`
      );

      return message.reply({
        embeds: [
          embed(
            "⚠️・Warn",
            `
👤 Usuario: ${target}
📝 Razón: **${reason}**
📊 Warns: **${total}/3**

${
  total >= 3
    ? "🔇 Se aplicó un mute de **1 hora**."
    : "⚠️ Al llegar a 3 warns se aplicará un mute de 1 hora."
}
`
          )
        ]
      });
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
        message.mentions.users.first() ||
        message.author;

      const result =
        await pool.query(
          `
          SELECT reason, moderator_id, created_at
          FROM warnings
          WHERE guild_id = $1 AND user_id = $2
          ORDER BY id DESC
          LIMIT 10
          `,
          [
            message.guild.id,
            target.id
          ]
        );

      if (!result.rows.length) {
        return message.reply({
          embeds: [
            embed(
              "⚠️・Warns",
              `${target} no tiene warns.`
            )
          ]
        });
      }

      let text = "";

      result.rows.forEach(
        (row, index) => {
          text += `**${index + 1}.** ${row.reason}\n`;
        }
      );

      return message.reply({
        embeds: [
          embed(
            "⚠️・Warns",
            `👤 ${target}\n\n${text}`
          )
        ]
      });
    }

    if (
      command === "timeout" ||
      command === "mute"
    ) {
      if (!isStaff(message.member)) {
        return message.reply(
          "❌ No tienes permiso."
        );
      }

      const target =
        message.mentions.members.first();

      const minutes =
        Number(args[1]) || 10;

      if (!target) {
        return message.reply(
          `❌ Usa: \`${PREFIX}timeout @usuario minutos\``
        );
      }

      await target.timeout(
        minutes * 60 * 1000,
        args.slice(2).join(" ") ||
        "Moderación"
      );

      await sendLog(
        message.guild,
        "🔇・Timeout",
        `${message.author} aplicó timeout a ${target} durante ${minutes} minutos.`
      );

      return message.reply({
        embeds: [
          embed(
            "🔇・Timeout",
            `${target} ha recibido un timeout de **${minutes} minutos**.`
          )
        ]
      });
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
          `❌ Usa: \`${PREFIX}untimeout @usuario\``
        );
      }

      await target.timeout(null);

      return message.reply({
        embeds: [
          embed(
            "🔊・Timeout retirado",
            `Se retiró el timeout de ${target}.`
          )
        ]
      });
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
          `❌ Usa: \`${PREFIX}kick @usuario razón\``
        );
      }

      const reason =
        args.slice(1).join(" ") ||
        "Sin razón";

      await target.kick(reason);

      await sendLog(
        message.guild,
        "👢・Kick",
        `${message.author} expulsó a ${target.user.tag}.\n\nRazón: ${reason}`
      );

      return message.reply({
        embeds: [
          embed(
            "👢・Kick",
            `${target.user.tag} fue expulsado.`
          )
        ]
      });
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
          `❌ Usa: \`${PREFIX}ban @usuario razón\``
        );
      }

      const reason =
        args.slice(1).join(" ") ||
        "Sin razón";

      await target.ban({
        reason
      });

      await sendLog(
        message.guild,
        "🔨・Ban",
        `${message.author} baneó a ${target.user.tag}.\n\nRazón: ${reason}`
      );

      return message.reply({
        embeds: [
          embed(
            "🔨・Ban",
            `${target.user.tag} fue baneado.`
          )
        ]
      });
    }

    if (command === "clear") {
      if (!isStaff(message.member)) {
        return message.reply(
          "❌ No tienes permiso."
        );
      }

      const amount =
        Number(args[0]);

      if (
        !amount ||
        amount < 1 ||
        amount > 100
      ) {
        return message.reply(
          "❌ Usa una cantidad entre 1 y 100."
        );
      }

      const deleted =
        await message.channel.bulkDelete(
          amount,
          true
        );

      const msg =
        await message.channel.send({
          embeds: [
            embed(
              "🧹・Mensajes eliminados",
              `Se eliminaron **${deleted.size} mensajes**.`
            )
          ]
        });

      await sendLog(
        message.guild,
        "🧹・Mensajes eliminados",
        `${message.author} eliminó **${deleted.size} mensajes** en ${message.channel}.`
      );

      setTimeout(() => {
        msg.delete().catch(() => {});
      }, 4000);

      return;
    }

    // ==================================================
    // ADMIN ECONOMÍA
    // ==================================================

    if (command === "addmoney") {
      if (!isAdmin(message.member)) {
        return message.reply(
          "❌ Solo administradores."
        );
      }

      const target =
        message.mentions.users.first();

      const amount =
        parseAmount(args[1]);

      if (!target || !amount) {
        return message.reply(
          `❌ Usa: \`${PREFIX}addmoney @usuario cantidad\``
        );
      }

      await addCoins(
        message.guild.id,
        target.id,
        amount
      );

      return message.reply({
        embeds: [
          embed(
            "💰・Economía",
            `Se añadieron **${formatCoins(amount)}** a ${target}.`
          )
        ]
      });
    }

    if (command === "removemoney") {
      if (!isAdmin(message.member)) {
        return message.reply(
          "❌ Solo administradores."
        );
      }

      const target =
        message.mentions.users.first();

      const amount =
        parseAmount(args[1]);

      if (!target || !amount) {
        return message.reply(
          `❌ Usa: \`${PREFIX}removemoney @usuario cantidad\``
        );
      }

      await ensureUser(
        message.guild.id,
        target.id
      );

      await pool.query(
        `
        UPDATE users
        SET coins = GREATEST(0, coins - $1)
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
          embed(
            "💰・Economía",
            `Se retiraron **${formatCoins(amount)}** a ${target}.`
          )
        ]
      });
    }

    // ==================================================
    // FIN MESSAGE CREATE
    // ==================================================

  } catch (error) {
    console.error(
      "❌ Error en messageCreate:",
      error
    );

    try {
      await message.reply(
        "❌ Ocurrió un error al ejecutar ese comando."
      );
    } catch {}
  }
});

// ======================================================
// BLACKJACK
// ======================================================

function blackjackValue(hand) {
  let total = 0;
  let aces = 0;

  for (const card of hand) {
    total += card.value;

    if (card.name === "A") {
      aces++;
    }
  }

  while (
    total > 21 &&
    aces > 0
  ) {
    total -= 10;
    aces--;
  }

  return total;
}

function blackjackText(hand) {
  return hand
    .map(card => card.display)
    .join(" ");
}

function blackjackEmbed(
  user,
  player,
  dealer,
  finished
) {
  const playerValue =
    blackjackValue(player);

  let dealerText;

  if (finished) {
    dealerText =
      `${blackjackText(dealer)}\nValor: **${blackjackValue(dealer)}**`;
  } else {
    dealerText =
      `${dealer[0].display} 🂠\nValor visible: **${blackjackValue([dealer[0]])}**`;
  }

  return embed(
    "🃏・Blackjack",
    `
👤 ${user}

🧑‍🎮 **Tus cartas**
${blackjackText(player)}
Valor: **${playerValue}**

🤖 **Cartas de Akari**
${dealerText}

${
  finished
    ? "🌸 Partida terminada."
    : "Elige una acción usando los botones."
}

⚠️ Este blackjack es solo un minijuego y no utiliza apuestas ni dinero.
`
  );
}

// ======================================================
// INTERACCIONES
// ======================================================

client.on(
  "interactionCreate",
  async interaction => {
    try {

      // ==================================================
      // HELP MENU
      // ==================================================

      if (
        interaction.isStringSelectMenu() &&
        interaction.customId === "help_menu"
      ) {
        let title = "";
        let description = "";

        if (interaction.values[0] === "economy") {
          title = "💰・Economía";

          description = `
\`${PREFIX}balance\`
\`${PREFIX}daily\`
\`${PREFIX}work\`
\`${PREFIX}beg\`
\`${PREFIX}deposit\`
\`${PREFIX}depositall\`
\`${PREFIX}withdraw\`
\`${PREFIX}withdrawall\`
\`${PREFIX}pay\`
\`${PREFIX}payall\`
\`${PREFIX}bank\`
\`${PREFIX}leaderboard\`
\`${PREFIX}shop\`
\`${PREFIX}buy\`
\`${PREFIX}bj\`
`;
        }

        if (interaction.values[0] === "fun") {
          title = "🎮・Diversión";

          description = `
\`${PREFIX}coin\`
\`${PREFIX}dice\`
\`${PREFIX}random\`
\`${PREFIX}choose\`
\`${PREFIX}8ball\`
\`${PREFIX}rps\`
\`${PREFIX}hangman\`
\`${PREFIX}guessletter\`
\`${PREFIX}memory\`
\`${PREFIX}trivia\`
\`${PREFIX}bj\`
`;
        }

        if (interaction.values[0] === "social") {
          title = "💗・Social";

          description = `
\`${PREFIX}profile\`
\`${PREFIX}avatar\`
\`${PREFIX}hug\`
\`${PREFIX}highfive\`
\`${PREFIX}wave\`
\`${PREFIX}friend\`
\`${PREFIX}rep\`
\`${PREFIX}suggest\`
\`${PREFIX}confess\`
`;
        }

        if (interaction.values[0] === "info") {
          title = "📚・Información";

          description = `
\`${PREFIX}serverinfo\`
\`${PREFIX}userinfo\`
\`${PREFIX}roleinfo\`
\`${PREFIX}channelinfo\`
\`${PREFIX}botinfo\`
\`${PREFIX}membercount\`
\`${PREFIX}uptime\`
\`${PREFIX}roles\`
\`${PREFIX}emojis\`
`;
        }

        if (interaction.values[0] === "utils") {
          title = "🛠️・Utilidades";

          description = `
\`${PREFIX}ping\`
\`${PREFIX}calc\`
\`${PREFIX}poll\`
`;
        }

        if (interaction.values[0] === "anime") {
          title = "🌸・Anime";

          description = `
\`${PREFIX}anime\`
\`${PREFIX}animechar\`
\`${PREFIX}animechoose\`
\`${PREFIX}animefact\`
\`${PREFIX}animequote\`
\`${PREFIX}animequiz\`
\`${PREFIX}otaku\`
`;
        }

        if (interaction.values[0] === "levels") {
          title = "⭐・Niveles";

          description = `
\`${PREFIX}rank\`
\`${PREFIX}level\`
\`${PREFIX}levels\`

💗 Gana XP participando y conversando en la comunidad.
`;
        }

        return interaction.update({
          embeds: [
            embed(
              title,
              description
            )
          ]
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
            content: "❌ No tienes permiso.",
            ephemeral: true
          });
        }

        let title = "";
        let description = "";

        if (
          interaction.values[0] ===
          "moderation"
        ) {
          title = "🛡️・Moderación";

          description = `
\`${PREFIX}warn @usuario razón\`
\`${PREFIX}warnings @usuario\`
\`${PREFIX}timeout @usuario minutos\`
\`${PREFIX}untimeout @usuario\`
\`${PREFIX}kick @usuario razón\`
\`${PREFIX}ban @usuario razón\`
\`${PREFIX}clear cantidad\`

🌸 Anti-Spam:
5 mensajes seguidos → 1 warn.
3 warns → mute de 1 hora.
`;
        }

        if (
          interaction.values[0] ===
          "tickets"
        ) {
          title = "🎫・Tickets";

          description = `
\`${PREFIX}ticketpanel\`
\`${PREFIX}add @usuario\`
\`${PREFIX}remove @usuario\`
\`${PREFIX}rename nombre\`
\`${PREFIX}priority baja/media/alta\`

🎫 Al cerrar:
• Motivo
• Transcript
• Registro en logs

Categorías:
🛠️ Soporte
🚨 Reporte
❓ Duda
🤝 Allys/Affys/Socio
📝 Postulación
📌 Otro
`;
        }

        if (
          interaction.values[0] ===
          "config"
        ) {
          title = "⚙️・Configuración";

          description = `
\`${PREFIX}setwelcome #canal\`
\`${PREFIX}setlevels #canal\`
\`${PREFIX}setsuggestions #canal\`
\`${PREFIX}setconfessions #canal\`
\`${PREFIX}setlogs #canal\`
`;
        }

        if (
          interaction.values[0] ===
          "economy_admin"
        ) {
          title = "💰・Economía";

          description = `
\`${PREFIX}addmoney @usuario cantidad\`
\`${PREFIX}removemoney @usuario cantidad\`

🛒 Tienda:

\`${PREFIX}shopadd rol @Rol cantidad\`
\`${PREFIX}shopadd mensaje texto cantidad\`
\`${PREFIX}shopremove ID\`
\`${PREFIX}shop\`
`;
        }

        if (
          interaction.values[0] ===
          "levels_admin"
        ) {
          title = "⭐・Niveles";

          description = `
\`${PREFIX}setlevels #canal\`

Configura dónde se enviarán los mensajes de subida de nivel.
`;
        }

        if (
          interaction.values[0] ===
          "suggestions_admin"
        ) {
          title = "💡・Sugerencias";

          description = `
\`${PREFIX}setsuggestions #canal\`

Configura el canal donde se publicarán las sugerencias.
`;
        }

        if (
          interaction.values[0] ===
          "confessions_admin"
        ) {
          title = "🤫・Confesiones";

          description = `
\`${PREFIX}setconfessions #canal\`

Configura el canal de confesiones anónimas.
`;
        }

        if (
          interaction.values[0] ===
          "logs_admin"
        ) {
          title = "📋・Logs";

          description = `
\`${PREFIX}setlogs #canal\`
\`${PREFIX}logs on\`
\`${PREFIX}logs off\`
\`${PREFIX}logs status\`

Los logs registran acciones importantes del servidor.
`;
        }

        if (
          interaction.values[0] ===
          "antispam_admin"
        ) {
          title = "🚨・Anti-Spam";

          description = `
\`${PREFIX}antispam on\`
\`${PREFIX}antispam off\`
\`${PREFIX}antispam status\`

5 mensajes seguidos → 1 warn.
3 warns → mute de 1 hora.
`;
        }

        if (
          interaction.values[0] ===
          "messages_admin"
        ) {
          title = "📢・Mensajes";

          description = `
\`${PREFIX}say mensaje\`
\`${PREFIX}embed #COLOR mensaje\`

Ambos comandos son exclusivos para administradores.
`;
        }

        if (
          interaction.values[0] ===
          "info_admin"
        ) {
          title = "📊・Información";

          description = `
\`${PREFIX}serverinfo\`
\`${PREFIX}membercount\`
\`${PREFIX}botinfo\`
\`${PREFIX}uptime\`
`;
        }

        if (
          interaction.values[0] ===
          "welcome"
        ) {
          title = "👋・Bienvenidas";

          description = `
\`${PREFIX}setwelcome #canal\`

Establece el canal donde Akari enviará las bienvenidas.
`;
        }

        return interaction.update({
          embeds: [
            embed(
              title,
              description
            )
          ]
        });
      }

      // ==================================================
      // SUGGESTION BUTTONS
      // ==================================================

      if (
        interaction.isButton() &&
        (
          interaction.customId.startsWith(
            "suggest_up:"
          ) ||
          interaction.customId.startsWith(
            "suggest_down:"
          )
        )
      ) {
        const [action, idText] =
          interaction.customId.split(":");

        const id = Number(idText);

        const result =
          await pool.query(
            `
            SELECT *
            FROM suggestions
            WHERE id = $1
            `,
            [id]
          );

        const suggestion =
          result.rows[0];

        if (!suggestion) {
          return interaction.reply({
            content: "❌ Esa sugerencia no existe.",
            ephemeral: true
          });
        }

        const newVote =
          action === "suggest_up"
            ? 1
            : -1;

        const previous =
          await pool.query(
            `
            SELECT vote
            FROM suggestion_votes
            WHERE suggestion_id = $1
            AND user_id = $2
            `,
            [
              id,
              interaction.user.id
            ]
          );

        if (previous.rows.length) {
          const oldVote =
            Number(previous.rows[0].vote);

          if (oldVote === newVote) {
            return interaction.reply({
              content: "❌ Ya votaste de esa forma.",
              ephemeral: true
            });
          }

          await pool.query(
            `
            UPDATE suggestion_votes
            SET vote = $1
            WHERE suggestion_id = $2
            AND user_id = $3
            `,
            [
              newVote,
              id,
              interaction.user.id
            ]
          );

          await pool.query(
            `
            UPDATE suggestions
            SET
              upvotes = upvotes + $1,
              downvotes = downvotes + $2
            WHERE id = $3
            `,
            [
              newVote === 1 ? 1 : -1,
              newVote === -1 ? 1 : -1,
              id
            ]
          );
        } else {
          await pool.query(
            `
            INSERT INTO suggestion_votes
            (suggestion_id, user_id, vote)
            VALUES ($1, $2, $3)
            `,
            [
              id,
              interaction.user.id,
              newVote
            ]
          );

          await pool.query(
            `
            UPDATE suggestions
            SET
              upvotes = upvotes + $1,
              downvotes = downvotes + $2
            WHERE id = $3
            `,
            [
              newVote === 1 ? 1 : 0,
              newVote === -1 ? 1 : 0,
              id
            ]
          );
        }

        const updated =
          await pool.query(
            `
            SELECT *
            FROM suggestions
            WHERE id = $1
            `,
            [id]
          );

        const data =
          updated.rows[0];

        const buttons =
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`suggest_up:${id}`)
              .setLabel(String(data.upvotes))
              .setEmoji("👍")
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(`suggest_down:${id}`)
              .setLabel(String(data.downvotes))
              .setEmoji("👎")
              .setStyle(ButtonStyle.Danger)
          );

        return interaction.update({
          embeds: [
            embed(
              `💡・Sugerencia #${id}`,
              `
${data.content}

━━━━━━━━━━━━━━━━━━━━

👤 Enviada por: <@${data.user_id}>
`
            )
          ],
          components: [buttons]
        });
      }

      // ==================================================
      // TICKETS
      // ==================================================

      if (
        interaction.isStringSelectMenu() &&
        interaction.customId ===
        "ticket_menu"
      ) {
        const category =
          interaction.values[0];

        const existing =
          await pool.query(
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

        if (existing.rows.length) {
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
            WHERE guild_id = $1
            AND user_id = $2
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
                .replace(
                  /[^a-z0-9-]/g,
                  ""
                )
                .slice(0, 80),
            type: ChannelType.GuildText,
            permissionOverwrites: [
              {
                id:
                  interaction.guild.roles
                    .everyone.id,
                deny: [
                  PermissionsBitField.Flags
                    .ViewChannel
                ]
              },
              {
                id: interaction.user.id,
                allow: [
                  PermissionsBitField.Flags
                    .ViewChannel,
                  PermissionsBitField.Flags
                    .SendMessages,
                  PermissionsBitField.Flags
                    .ReadMessageHistory
                ]
              },
              {
                id: STAFF_ROLE_ID,
                allow: [
                  PermissionsBitField.Flags
                    .ViewChannel,
                  PermissionsBitField.Flags
                    .SendMessages,
                  PermissionsBitField.Flags
                    .ReadMessageHistory,
                  PermissionsBitField.Flags
                    .ManageChannels
                ]
              }
            ]
          });

        await pool.query(
          `
          INSERT INTO tickets
          (guild_id, user_id, channel_id, category, priority)
          VALUES ($1, $2, $3, $4, 'media')
          `,
          [
            interaction.guild.id,
            interaction.user.id,
            channel.id,
            category
          ]
        );

        const buttons =
          new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(
                  "ticket_claim"
                )
                .setLabel(
                  "Reclamar ticket"
                )
                .setEmoji("🎫")
                .setStyle(
                  ButtonStyle.Primary
                ),
              new ButtonBuilder()
                .setCustomId(
                  "ticket_close"
                )
                .setLabel(
                  "Cerrar ticket"
                )
                .setEmoji("🔒")
                .setStyle(
                  ButtonStyle.Danger
                )
            );

        const ticketText = `
🌸・𝘼𝙠𝙖𝙧𝙞 𝘾𝙤𝙢𝙢𝙪𝙣𝙞𝙩𝙮
🎫・TICKET ABIERTO

¡Bienvenido/a a tu ticket! 💗

Tu solicitud ha sido creada correctamente.

📂 Categoría
${category}

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

💗 Gracias por contactar con Akari Community.
`;

        await channel.send({
          content:
            `<@${interaction.user.id}> <@&${STAFF_ROLE_ID}>`,
          embeds: [
            embed(
              "🎫・Ticket abierto",
              ticketText
            )
          ],
          components: [buttons]
        });

        await sendLog(
          interaction.guild,
          "🎫・Ticket creado",
          `
👤 Usuario: ${interaction.user}
📂 Categoría: **${category}**
📺 Canal: ${channel}
`
        );

        return interaction.reply({
          content:
            `✅ Tu ticket ha sido creado: ${channel}`,
          ephemeral: true
        });
      }

      // ==================================================
      // CLAIM
      // ==================================================

      if (
        interaction.isButton() &&
        interaction.customId ===
        "ticket_claim"
      ) {
        if (
          !isStaff(interaction.member)
        ) {
          return interaction.reply({
            content:
              "❌ Solo el staff puede reclamar tickets.",
            ephemeral: true
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

        const ticket =
          result.rows[0];

        if (!ticket) {
          return interaction.reply({
            content:
              "❌ Este canal no es un ticket.",
            ephemeral: true
          });
        }

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

        await sendLog(
          interaction.guild,
          "🎫・Ticket reclamado",
          `${interaction.user} reclamó ${interaction.channel}.`
        );

        return interaction.reply({
          embeds: [
            embed(
              "🎫・Ticket reclamado",
              `Este ticket ha sido reclamado por ${interaction.user}.`
            )
          ]
        });
      }

      // ==================================================
      // CLOSE MODAL
      // ==================================================

      if (
        interaction.isButton() &&
        interaction.customId ===
        "ticket_close"
      ) {
        if (
          !isStaff(interaction.member)
        ) {
          return interaction.reply({
            content:
              "❌ Solo el staff puede cerrar tickets.",
            ephemeral: true
          });
        }

        const modal =
          new ModalBuilder()
            .setCustomId(
              "ticket_close_modal"
            )
            .setTitle(
              "Cerrar ticket"
            );

        const reason =
          new TextInputBuilder()
            .setCustomId(
              "close_reason"
            )
            .setLabel(
              "Motivo del cierre"
            )
            .setStyle(
              TextInputStyle.Paragraph
            )
            .setRequired(true)
            .setMaxLength(1000)
            .setPlaceholder(
              "Escribe el motivo..."
            );

        modal.addComponents(
          new ActionRowBuilder()
            .addComponents(reason)
        );

        return interaction.showModal(
          modal
        );
      }

      // ==================================================
      // CLOSE MODAL SUBMIT
      // ==================================================

      if (
        interaction.isModalSubmit() &&
        interaction.customId ===
        "ticket_close_modal"
      ) {
        if (
          !isStaff(interaction.member)
        ) {
          return interaction.reply({
            content:
              "❌ Solo el staff puede cerrar tickets.",
            ephemeral: true
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

        const ticket =
          result.rows[0];

        if (!ticket) {
          return interaction.reply({
            content:
              "❌ Este canal no es un ticket.",
            ephemeral: true
          });
        }

        const reason =
          interaction.fields.getTextInputValue(
            "close_reason"
          );

        await interaction.reply({
          embeds: [
            embed(
              "🔒・Cerrando ticket",
              "Preparando el transcript y cerrando el ticket..."
            )
          ]
        });

        try {
          const fetched =
            await interaction.channel.messages.fetch({
              limit: 100
            });

          const messages =
            [...fetched.values()]
              .sort(
                (a, b) =>
                  a.createdTimestamp -
                  b.createdTimestamp
              );

          let transcript =
            `AKARI COMMUNITY - TRANSCRIPT\n`;

          transcript +=
            `====================================\n`;

          transcript +=
            `Canal: ${interaction.channel.name}\n`;

          transcript +=
            `Categoría: ${ticket.category}\n`;

          transcript +=
            `Prioridad: ${ticket.priority || "media"}\n`;

          transcript +=
            `Usuario: ${ticket.user_id}\n`;

          transcript +=
            `Cerrado por: ${interaction.user.tag}\n`;

          transcript +=
            `Motivo: ${reason}\n`;

          transcript +=
            `====================================\n\n`;

          for (const msg of messages) {
            const content =
              msg.content || "[Sin contenido]";

            transcript +=
              `[${new Date(
                msg.createdTimestamp
              ).toLocaleString(
                "es-ES"
              )}] ${msg.author.tag}: ${content}\n`;

            if (msg.attachments.size) {
              for (
                const attachment
                of msg.attachments.values()
              ) {
                transcript +=
                  `  Archivo: ${attachment.url}\n`;
              }
            }
          }

          const attachment =
            new AttachmentBuilder(
              Buffer.from(
                transcript,
                "utf8"
              ),
              {
                name:
                  `transcript-${interaction.channel.name}.txt`
              }
            );

          const logs =
            await getLogsChannel(
              interaction.guild
            );

          if (logs) {
            await logs.send({
              embeds: [
                embed(
                  "🔒・Ticket cerrado",
                  `
🎫 Canal: **${interaction.channel.name}**
👤 Usuario: <@${ticket.user_id}>
👮 Cerrado por: ${interaction.user}
📂 Categoría: **${ticket.category}**
⭐ Prioridad: **${ticket.priority || "media"}**

📝 Motivo:
${reason}
`
                )
              ],
              files: [attachment]
            });
          }

          await pool.query(
            `
            DELETE FROM tickets
            WHERE channel_id = $1
            `,
            [interaction.channel.id]
          );

          setTimeout(
            () => {
              interaction.channel
                .delete()
                .catch(() => {});
            },
            3000
          );
        } catch (error) {
          console.error(
            "Error creando transcript:",
            error
          );
        }

        return;
      }

      // ==================================================
      // BLACKJACK BUTTONS
      // ==================================================

      if (
        interaction.isButton() &&
        [
          "bj_hit",
          "bj_stand"
        ].includes(
          interaction.customId
        )
      ) {
        const game =
          blackjackGames.get(
            interaction.user.id
          );

        if (!game) {
          return interaction.reply({
            content:
              "❌ No tienes una partida activa.",
            ephemeral: true
          });
        }

        if (
          interaction.customId ===
          "bj_hit"
        ) {
          game.player.push(
            game.deck.pop()
          );

          const value =
            blackjackValue(
              game.player
            );

          if (value >= 21) {
            blackjackGames.delete(
              interaction.user.id
            );

            let result;

            if (value === 21) {
              result =
                "🎉 ¡Blackjack! Llegaste a 21.";
            } else {
              result =
                "💥 Te pasaste de 21.";
            }

            return interaction.update({
              embeds: [
                blackjackEmbed(
                  interaction.user,
                  game.player,
                  game.dealer,
                  true
                ).setFooter({
                  text: result
                })
              ],
              components: []
            });
          }

          return interaction.update({
            embeds: [
              blackjackEmbed(
                interaction.user,
                game.player,
                game.dealer,
                false
              )
            ]
          });
        }

        if (
          interaction.customId ===
          "bj_stand"
        ) {
          while (
            blackjackValue(
              game.dealer
            ) < 17
          ) {
            game.dealer.push(
              game.deck.pop()
            );
          }

          const playerValue =
            blackjackValue(
              game.player
            );

          const dealerValue =
            blackjackValue(
              game.dealer
            );

          let result;

          if (dealerValue > 21) {
            result =
              "🎉 ¡Ganaste! Akari se pasó de 21.";
          } else if (
            playerValue > dealerValue
          ) {
            result =
              "🎉 ¡Ganaste!";
          } else if (
            playerValue < dealerValue
          ) {
            result =
              "🤖 Akari ganó.";
          } else {
            result =
              "🤝 Empate.";
          }

          blackjackGames.delete(
            interaction.user.id
          );

          return interaction.update({
            embeds: [
              blackjackEmbed(
                interaction.user,
                game.player,
                game.dealer,
                true
              ).setFooter({
                text: result
              })
            ],
            components: []
          });
        }
      }

    } catch (error) {
      console.error(
        "❌ Error en interactionCreate:",
        error
      );

      if (
        !interaction.replied &&
        !interaction.deferred
      ) {
        try {
          await interaction.reply({
            content:
              "❌ Ocurrió un error.",
            ephemeral: true
          });
        } catch {}
      }
    }
  }
);

// ======================================================
// LOGS DE CAMBIOS
// ======================================================

client.on(
  "userUpdate",
  async (oldUser, newUser) => {
    if (
      oldUser.username !==
      newUser.username
    ) {
      for (
        const guild
        of client.guilds.cache.values()
      ) {
        if (
          guild.members.cache.has(
            newUser.id
          )
        ) {
          await sendLog(
            guild,
            "👤・Usuario actualizado",
            `${newUser} cambió su nombre de usuario.\n\nAnterior: **${oldUser.username}**\nNuevo: **${newUser.username}**`
          );
        }
      }
    }
  }
);

client.on(
  "guildMemberUpdate",
  async (oldMember, newMember) => {
    if (
      oldMember.nickname !==
      newMember.nickname
    ) {
      await sendLog(
        newMember.guild,
        "✏️・Nickname cambiado",
        `${newMember} cambió su nickname.\n\nAnterior: **${oldMember.nickname || "Ninguno"}**\nNuevo: **${newMember.nickname || "Ninguno"}**`
      );
    }
  }
);

client.on(
  "channelUpdate",
  async (oldChannel, newChannel) => {
    if (
      oldChannel.name !==
      newChannel.name
    ) {
      await sendLog(
        newChannel.guild,
        "📺・Canal actualizado",
        `El canal <#${newChannel.id}> cambió de nombre.\n\nAnterior: **${oldChannel.name}**\nNuevo: **${newChannel.name}**`
      );
    }
  }
);

client.on(
  "roleUpdate",
  async (oldRole, newRole) => {
    if (
      oldRole.name !==
      newRole.name
    ) {
      await sendLog(
        newRole.guild,
        "🎭・Rol actualizado",
        `El rol ${newRole} cambió de nombre.\n\nAnterior: **${oldRole.name}**\nNuevo: **${newRole.name}**`
      );
    }
  }
);

client.on(
  "messageDelete",
  async message => {
    if (!message.guild) return;
    if (message.author?.bot) return;

    const content =
      message.content || "[Contenido no disponible]";

    await sendLog(
      message.guild,
      "🗑️・Mensaje eliminado",
      `
👤 Autor: ${
        message.author
          ? message.author
          : "Desconocido"
      }

📺 Canal: ${message.channel}

💬 Contenido:
${content}
`
    );
  }
);

client.on(
  "messageUpdate",
  async (oldMessage, newMessage) => {
    if (!newMessage.guild) return;
    if (newMessage.author?.bot) return;

    if (
      oldMessage.content ===
      newMessage.content
    ) {
      return;
    }

    await sendLog(
      newMessage.guild,
      "✏️・Mensaje editado",
      `
👤 Autor: ${newMessage.author}

📺 Canal: ${newMessage.channel}

Anterior:
${oldMessage.content || "[Vacío]"}

Nuevo:
${newMessage.content || "[Vacío]"}
`
    );
  }
);

client.on(
  "guildBanAdd",
  async ban => {
    await sendLog(
      ban.guild,
      "🔨・Usuario baneado",
      `${ban.user.tag} fue baneado del servidor.`
    );
  }
);

client.on(
  "guildBanRemove",
  async ban => {
    await sendLog(
      ban.guild,
      "🔓・Ban retirado",
      `${ban.user.tag} fue desbaneado.`
    );
  }
);

// ======================================================
// INICIO
// ======================================================

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

    await createTables();

    console.log(
      "🌸 Conectando con Discord..."
    );

    await client.login(TOKEN);

    console.log(
      "✅ Login de Discord realizado."
    );
  } catch (error) {
    console.error(
      "❌ Error iniciando Akari:",
      error
    );

    process.exit(1);
  }
}

start();
