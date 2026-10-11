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
  ChannelType
} = require("discord.js");

const { Pool } = require("pg");
const http = require("http");

// ======================================================
// AKARI BOT
// ======================================================

console.log("🌸 AKARI: index.js se está ejecutando...");

const TOKEN = process.env.DISCORD_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;
const PORT = process.env.PORT || 10000;

if (!TOKEN) {
  throw new Error("Falta la variable DISCORD_TOKEN.");
}

if (!DATABASE_URL) {
  throw new Error("Falta la variable DATABASE_URL de PostgreSQL.");
}

console.log("🌸 AKARI: variables de entorno encontradas.");

// ======================================================
// HTTP SERVER PARA RENDER
// ======================================================

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("🌸 Akari Bot está funcionando correctamente.");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Puerto HTTP abierto en ${PORT}`);
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
  partials: [Partials.Channel, Partials.Message, Partials.User]
});

const PREFIX = "M!";
const COLOR = 0xff9dcc;

const STAFF_ROLE_ID = "1555318924365799546";

// ======================================================
// VARIABLES
// ======================================================

const spamTracker = new Map();

const blackjackGames = new Map();

const animeCharacters = [
  "Naruto Uzumaki",
  "Sasuke Uchiha",
  "Goku",
  "Vegeta",
  "Monkey D. Luffy",
  "Roronoa Zoro",
  "Tanjiro Kamado",
  "Nezuko Kamado",
  "Gojo Satoru",
  "Megumi Fushiguro",
  "Anya Forger",
  "Levi Ackerman",
  "Eren Yeager",
  "Mikasa Ackerman",
  "Saitama",
  "Genos",
  "Edward Elric",
  "Killua Zoldyck",
  "Gon Freecss",
  "Light Yagami"
];

const animeFacts = [
  "Naruto pertenece al clan Uzumaki.",
  "Goku es el protagonista principal de Dragon Ball.",
  "Luffy quiere convertirse en el Rey de los Piratas.",
  "Tanjiro es el protagonista de Kimetsu no Yaiba.",
  "Gojo es uno de los personajes más poderosos de Jujutsu Kaisen.",
  "Anya Forger puede leer la mente en Spy x Family.",
  "Saitama es conocido por derrotar enemigos con un solo golpe.",
  "Edward Elric es el protagonista de Fullmetal Alchemist.",
  "Levi Ackerman pertenece al Cuerpo de Exploración.",
  "Killua Zoldyck proviene de una familia de asesinos."
];

const animeQuotes = [
  "¡Nunca abandonaré mi camino!",
  "¡Seguiré avanzando aunque sea difícil!",
  "¡Mis amigos son importantes para mí!",
  "¡No voy a rendirme ahora!",
  "¡Un verdadero guerrero sigue adelante!"
];

const animeQuiz = [
  {
    question: "¿Quién quiere convertirse en Rey de los Piratas?",
    options: ["Goku", "Luffy", "Naruto", "Gojo"],
    answer: "Luffy"
  },
  {
    question: "¿Quién puede leer la mente en Spy x Family?",
    options: ["Anya", "Mikasa", "Nezuko", "Sakura"],
    answer: "Anya"
  },
  {
    question: "¿Cuál es el nombre del protagonista de Dragon Ball?",
    options: ["Goku", "Luffy", "Levi", "Eren"],
    answer: "Goku"
  },
  {
    question: "¿Quién es el protagonista de Kimetsu no Yaiba?",
    options: ["Tanjiro", "Gojo", "Zoro", "Killua"],
    answer: "Tanjiro"
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

function isAdmin(member) {
  return member.permissions.has(PermissionsBitField.Flags.Administrator);
}

function isStaff(member) {
  return (
    isAdmin(member) ||
    member.roles.cache.has(STAFF_ROLE_ID)
  );
}

function random(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatCoins(number) {
  return Number(number || 0).toLocaleString("es-ES");
}

function getMention(message) {
  return message.mentions.users.first();
}

async function ensureUser(guildId, userId) {
  await pool.query(
    `
    INSERT INTO users (guild_id, user_id, coins, bank, daily, work)
    VALUES ($1, $2, 500, 0, 0, 0)
    ON CONFLICT (guild_id, user_id)
    DO NOTHING
    `,
    [guildId, userId]
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

// ======================================================
// BASE DE DATOS
// ======================================================

async function createTables() {
  console.log("🌸 Creando/verificando tablas...");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      coins BIGINT DEFAULT 500,
      bank BIGINT DEFAULT 0,
      daily BIGINT DEFAULT 0,
      work BIGINT DEFAULT 0,
      PRIMARY KEY (guild_id, user_id)
    )
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS bank BIGINT DEFAULT 0
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      guild_id TEXT PRIMARY KEY,
      welcome_channel TEXT,
      welcome_message TEXT
    )
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
    )
  `);

  await pool.query(`
    ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS claimed_by TEXT
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS warnings (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      reason TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reputation (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      reputation INTEGER DEFAULT 0,
      PRIMARY KEY (guild_id, user_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS shop_items (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      type TEXT NOT NULL,
      target_id TEXT,
      message TEXT,
      price BIGINT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  console.log("✅ Tablas verificadas correctamente.");
}

// ======================================================
// READY
// ======================================================

client.once("clientReady", async () => {
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

client.on("guildMemberAdd", async member => {
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

    const channelId = result.rows[0].welcome_channel;
    if (!channelId) return;

    const channel = member.guild.channels.cache.get(channelId);
    if (!channel) return;

    const miembros = member.guild.memberCount;

    const welcomeText = `
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

👥・Ahora somos **${miembros}** miembros.
`;

    await channel.send({
      content: welcomeText
    });
  } catch (error) {
    console.error("Error bienvenida:", error);
  }
});

// ======================================================
// ANTI-SPAM
// 5 MENSAJES SEGUIDOS = WARN
// 3 WARNS = MUTE 1 HORA
// ======================================================

async function handleAntiSpam(message) {
  if (!message.guild || message.author.bot) return;

  const key = `${message.guild.id}:${message.author.id}`;

  const now = Date.now();
  const old = spamTracker.get(key);

  if (!old || now - old.lastMessage > 7000) {
    spamTracker.set(key, {
      count: 1,
      lastMessage: now
    });
    return;
  }

  old.count++;
  old.lastMessage = now;

  if (old.count < 5) return;

  spamTracker.delete(key);

  const totalWarnings = await addWarning(
    message.guild.id,
    message.author.id,
    client.user.id,
    "Anti-spam: 5 mensajes consecutivos."
  );

  try {
    await message.delete();
  } catch {}

  if (totalWarnings >= 3) {
    const member = await message.guild.members
      .fetch(message.author.id)
      .catch(() => null);

    if (member && member.moderatable) {
      await member.timeout(
        60 * 60 * 1000,
        "Anti-spam: 3 warnings acumulados."
      ).catch(() => {});
    }

    await message.channel.send({
      embeds: [
        embed(
          "🚨・ANTI-SPAM",
          `${message.author} recibió su **3.er warning** por spam.\n\n🔇 Se aplicó un **mute de 1 hora**.`
        )
      ]
    }).then(msg => {
      setTimeout(() => msg.delete().catch(() => {}), 8000);
    });

    return;
  }

  await message.channel.send({
    embeds: [
      embed(
        "⚠️・ANTI-SPAM",
        `${message.author} recibió un warning por enviar **5 mensajes consecutivos**.\n\n📊 Warnings: **${totalWarnings}/3**`
      )
    ]
  }).then(msg => {
    setTimeout(() => msg.delete().catch(() => {}), 8000);
  });
}

// ======================================================
// MENSAJES
// ======================================================

client.on("messageCreate", async message => {
  try {
    if (!message.guild || message.author.bot) return;

    await handleAntiSpam(message);

    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const command = args.shift()?.toLowerCase();

    if (!command) return;

    await ensureUser(message.guild.id, message.author.id);

    // ==================================================
    // PING
    // ==================================================

    if (command === "ping") {
      return message.reply({
        embeds: [
          embed(
            "🏓・PONG",
            `💗 Latencia: **${client.ws.ping}ms**\n🌸 Akari está funcionando correctamente.`
          )
        ]
      });
    }

    // ==================================================
    // HELP
    // ==================================================

    if (["help", "ayuda"].includes(command)) {
      const menu = new StringSelectMenuBuilder()
        .setCustomId("help_menu")
        .setPlaceholder("🌸 Selecciona una categoría")
        .addOptions(
          {
            label: "Economía",
            description: "Dinero, banco y tienda",
            value: "economia",
            emoji: "💰"
          },
          {
            label: "Diversión",
            description: "Juegos y entretenimiento",
            value: "diversion",
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
            description: "Información del servidor",
            value: "informacion",
            emoji: "📚"
          },
          {
            label: "Utilidades",
            description: "Herramientas útiles",
            value: "utilidades",
            emoji: "🛠️"
          },
          {
            label: "Anime",
            description: "Comandos de anime",
            value: "anime",
            emoji: "🌸"
          }
        );

      return message.reply({
        embeds: [
          embed(
            "🌸・AKARI HELP",
            `Bienvenido/a al centro de comandos de **Akari Community**. 💗\n\nSelecciona una categoría en el menú para ver los comandos disponibles.\n\n> 🌸 Prefix: \`${PREFIX}\`\n> 💗 Comandos fáciles de usar\n> ✨ Nuevos comandos próximamente`
          )
        ],
        components: [
          new ActionRowBuilder().addComponents(menu)
        ]
      });
    }

    // ==================================================
    // ECONOMÍA
    // ==================================================

    if (["balance", "bal", "coins"].includes(command)) {
      const user = getMention(message) || message.author;

      await ensureUser(message.guild.id, user.id);

      const result = await pool.query(
        `
        SELECT coins, bank
        FROM users
        WHERE guild_id = $1 AND user_id = $2
        `,
        [message.guild.id, user.id]
      );

      const data = result.rows[0];

      return message.reply({
        embeds: [
          embed(
            "💰・BALANCE",
            `👤 Usuario: ${user}\n\n💵 Efectivo: **${formatCoins(data.coins)}** monedas\n🏦 Banco: **${formatCoins(data.bank)}** monedas\n💎 Total: **${formatCoins(Number(data.coins) + Number(data.bank))}** monedas`
          )
        ]
      });
    }

    if (command === "daily") {
      const result = await pool.query(
        `SELECT daily FROM users WHERE guild_id=$1 AND user_id=$2`,
        [message.guild.id, message.author.id]
      );

      const last = Number(result.rows[0].daily || 0);
      const now = Date.now();

      if (now - last < 24 * 60 * 60 * 1000) {
        const remaining = 24 * 60 * 60 * 1000 - (now - last);
        const hours = Math.ceil(remaining / 3600000);

        return message.reply({
          embeds: [
            embed(
              "⏳・DAILY",
              `Ya reclamaste tu recompensa diaria.\n\n⏰ Regresa en aproximadamente **${hours}h**.`
            )
          ]
        });
      }

      const amount = random(250, 500);

      await pool.query(
        `
        UPDATE users
        SET coins = coins + $1, daily = $2
        WHERE guild_id=$3 AND user_id=$4
        `,
        [amount, now, message.guild.id, message.author.id]
      );

      return message.reply({
        embeds: [
          embed(
            "🎁・RECOMPENSA DIARIA",
            `¡Has recibido **${amount} monedas**! 💗\n\nVuelve mañana para reclamar otra recompensa.`
          )
        ]
      });
    }

    if (command === "work") {
      const result = await pool.query(
        `SELECT work FROM users WHERE guild_id=$1 AND user_id=$2`,
        [message.guild.id, message.author.id]
      );

      const last = Number(result.rows[0].work || 0);
      const now = Date.now();

      if (now - last < 30 * 1000) {
        return message.reply({
          embeds: [
            embed(
              "⏳・TRABAJO",
              "Estás cansado/a. Espera **30 segundos** antes de volver a trabajar."
            )
          ]
        });
      }

      const jobs = [
        "trabajaste en una cafetería ☕",
        "ayudaste en una tienda 🛍️",
        "hiciste un trabajo online 💻",
        "ayudaste a un vecino 🏠",
        "trabajaste en Akari Community 🌸"
      ];

      const job = jobs[random(0, jobs.length - 1)];
      const amount = random(100, 300);

      await pool.query(
        `
        UPDATE users
        SET coins = coins + $1, work = $2
        WHERE guild_id=$3 AND user_id=$4
        `,
        [amount, now, message.guild.id, message.author.id]
      );

      return message.reply({
        embeds: [
          embed(
            "💼・TRABAJO",
            `🌸 ${job}\n\n💰 Ganaste **${amount} monedas**.`
          )
        ]
      });
    }

    if (command === "beg") {
      const amount = random(20, 100);

      await pool.query(
        `
        UPDATE users
        SET coins = coins + $1
        WHERE guild_id=$2 AND user_id=$3
        `,
        [amount, message.guild.id, message.author.id]
      );

      return message.reply({
        embeds: [
          embed(
            "🥺・BEG",
            `Alguien tuvo piedad de ti y te dio **${amount} monedas**. 💗`
          )
        ]
      });
    }

    if (["pay", "give", "transfer"].includes(command)) {
      const target = message.mentions.users.first();
      const amount = Number(args[1] || args[0]);

      if (!target || target.bot) {
        return message.reply("❌ Debes mencionar a un usuario.");
      }

      if (!Number.isInteger(amount) || amount <= 0) {
        return message.reply("❌ Indica una cantidad válida.");
      }

      if (target.id === message.author.id) {
        return message.reply("❌ No puedes enviarte dinero a ti mismo.");
      }

      const result = await pool.query(
        `
        SELECT coins
        FROM users
        WHERE guild_id=$1 AND user_id=$2
        `,
        [message.guild.id, message.author.id]
      );

      if (Number(result.rows[0].coins) < amount) {
        return message.reply("❌ No tienes suficientes monedas.");
      }

      await ensureUser(message.guild.id, target.id);

      await pool.query(
        `
        UPDATE users
        SET coins = coins - $1
        WHERE guild_id=$2 AND user_id=$3
        `,
        [amount, message.guild.id, message.author.id]
      );

      await pool.query(
        `
        UPDATE users
        SET coins = coins + $1
        WHERE guild_id=$2 AND user_id=$3
        `,
        [amount, message.guild.id, target.id]
      );

      return message.reply({
        embeds: [
          embed(
            "💸・TRANSFERENCIA",
            `${message.author} envió **${formatCoins(amount)} monedas** a ${target}. 💗`
          )
        ]
      });
    }

    if (["deposit", "dep"].includes(command)) {
      const result = await pool.query(
        `SELECT coins FROM users WHERE guild_id=$1 AND user_id=$2`,
        [message.guild.id, message.author.id]
      );

      const coins = Number(result.rows[0].coins);
      const amount = args[0]?.toLowerCase() === "all"
        ? coins
        : Number(args[0]);

      if (!Number.isInteger(amount) || amount <= 0) {
        return message.reply("❌ Usa `M!deposit cantidad` o `M!deposit all`.");
      }

      if (amount > coins) {
        return message.reply("❌ No tienes suficiente dinero en efectivo.");
      }

      await pool.query(
        `
        UPDATE users
        SET coins = coins - $1, bank = bank + $1
        WHERE guild_id=$2 AND user_id=$3
        `,
        [amount, message.guild.id, message.author.id]
      );

      return message.reply({
        embeds: [
          embed(
            "🏦・DEPÓSITO",
            `Has depositado **${formatCoins(amount)} monedas** en tu banco. 💰`
          )
        ]
      });
    }

    if (["depositall", "depall"].includes(command)) {
      const result = await pool.query(
        `
        SELECT coins
        FROM users
        WHERE guild_id=$1 AND user_id=$2
        `,
        [message.guild.id, message.author.id]
      );

      const amount = Number(result.rows[0].coins);

      if (amount <= 0) {
        return message.reply("❌ No tienes monedas para depositar.");
      }

      await pool.query(
        `
        UPDATE users
        SET coins = 0, bank = bank + $1
        WHERE guild_id=$2 AND user_id=$3
        `,
        [amount, message.guild.id, message.author.id]
      );

      return message.reply({
        embeds: [
          embed(
            "🏦・DEPÓSITO TOTAL",
            `Has depositado todas tus monedas.\n\n💰 Cantidad: **${formatCoins(amount)}**`
          )
        ]
      });
    }

    if (["withdraw", "retirar"].includes(command)) {
      const result = await pool.query(
        `SELECT bank FROM users WHERE guild_id=$1 AND user_id=$2`,
        [message.guild.id, message.author.id]
      );

      const bank = Number(result.rows[0].bank);

      const amount = args[0]?.toLowerCase() === "all"
        ? bank
        : Number(args[0]);

      if (!Number.isInteger(amount) || amount <= 0) {
        return message.reply("❌ Usa `M!withdraw cantidad` o `M!withdraw all`.");
      }

      if (amount > bank) {
        return message.reply("❌ No tienes suficiente dinero en el banco.");
      }

      await pool.query(
        `
        UPDATE users
        SET bank = bank - $1, coins = coins + $1
        WHERE guild_id=$2 AND user_id=$3
        `,
        [amount, message.guild.id, message.author.id]
      );

      return message.reply({
        embeds: [
          embed(
            "💵・RETIRO",
            `Has retirado **${formatCoins(amount)} monedas** de tu banco.`
          )
        ]
      });
    }

    if (["withdrawall", "retirarall"].includes(command)) {
      const result = await pool.query(
        `SELECT bank FROM users WHERE guild_id=$1 AND user_id=$2`,
        [message.guild.id, message.author.id]
      );

      const amount = Number(result.rows[0].bank);

      if (amount <= 0) {
        return message.reply("❌ No tienes dinero en el banco.");
      }

      await pool.query(
        `
        UPDATE users
        SET bank = 0, coins = coins + $1
        WHERE guild_id=$2 AND user_id=$3
        `,
        [amount, message.guild.id, message.author.id]
      );

      return message.reply({
        embeds: [
          embed(
            "💵・RETIRO TOTAL",
            `Has retirado todo tu dinero del banco.\n\n💰 Cantidad: **${formatCoins(amount)}**`
          )
        ]
      });
    }

    if (["leaderboard", "top", "rich"].includes(command)) {
      const result = await pool.query(
        `
        SELECT user_id, (coins + bank) AS total
        FROM users
        WHERE guild_id=$1
        ORDER BY (coins + bank) DESC
        LIMIT 10
        `,
        [message.guild.id]
      );

      let text = "";

      result.rows.forEach((row, index) => {
        text += `**${index + 1}.** <@${row.user_id}> — 💰 **${formatCoins(row.total)}**\n`;
      });

      if (!text) text = "Todavía no hay datos.";

      return message.reply({
        embeds: [
          embed("🏆・TOP DE RIQUEZA", text)
        ]
      });
    }

    // ==================================================
    // SHOP
    // ==================================================

    if (["shop", "tienda"].includes(command)) {
      const result = await pool.query(
        `
        SELECT *
        FROM shop_items
        WHERE guild_id=$1
        ORDER BY id ASC
        `,
        [message.guild.id]
      );

      if (!result.rows.length) {
        return message.reply({
          embeds: [
            embed(
              "🛒・TIENDA",
              "La tienda está vacía actualmente. 🌸"
            )
          ]
        });
      }

      let text = "";

      for (const item of result.rows) {
        if (item.type === "role") {
          const role = message.guild.roles.cache.get(item.target_id);
          text += `**#${item.id}** — 🎭 ${role ? role.name : "Rol eliminado"}\n`;
        } else {
          text += `**#${item.id}** — 💬 ${item.message}\n`;
        }

        text += `💰 Precio: **${formatCoins(item.price)}**\n\n`;
      }

      return message.reply({
        embeds: [
          embed(
            "🛒・AKARI SHOP",
            `${text}\n💗 Compra usando \`${PREFIX}buy ID\`.`
          )
        ]
      });
    }

    if (command === "buy") {
      const id = Number(args[0]);

      if (!id) {
        return message.reply("❌ Usa `M!buy ID`.");
      }

      const result = await pool.query(
        `
        SELECT *
        FROM shop_items
        WHERE id=$1 AND guild_id=$2
        `,
        [id, message.guild.id]
      );

      if (!result.rows.length) {
        return message.reply("❌ Ese artículo no existe.");
      }

      const item = result.rows[0];

      const userResult = await pool.query(
        `
        SELECT coins
        FROM users
        WHERE guild_id=$1 AND user_id=$2
        `,
        [message.guild.id, message.author.id]
      );

      const coins = Number(userResult.rows[0].coins);

      if (coins < Number(item.price)) {
        return message.reply("❌ No tienes suficientes monedas.");
      }

      if (item.type === "role") {
        const role = message.guild.roles.cache.get(item.target_id);

        if (!role) {
          return message.reply("❌ El rol de este artículo ya no existe.");
        }

        const member = await message.guild.members.fetch(message.author.id);

        if (member.roles.cache.has(role.id)) {
          return message.reply("❌ Ya tienes ese rol.");
        }

        if (
          role.position >= message.guild.members.me.roles.highest.position
        ) {
          return message.reply("❌ No puedo entregar ese rol.");
        }

        await member.roles.add(role);

        await pool.query(
          `
          UPDATE users
          SET coins = coins - $1
          WHERE guild_id=$2 AND user_id=$3
          `,
          [item.price, message.guild.id, message.author.id]
        );

        return message.reply({
          embeds: [
            embed(
              "🛒・COMPRA REALIZADA",
              `Has comprado el rol ${role} por **${formatCoins(item.price)} monedas**. 💗`
            )
          ]
        });
      }

      await pool.query(
        `
        UPDATE users
        SET coins = coins - $1
        WHERE guild_id=$2 AND user_id=$3
        `,
        [item.price, message.guild.id, message.author.id]
      );

      return message.reply({
        embeds: [
          embed(
            "🛒・COMPRA REALIZADA",
            `💬 Recompensa:\n${item.message}\n\n💰 Precio: **${formatCoins(item.price)}**`
          )
        ]
      });
    }

    // ==================================================
    // DIVERSIÓN
    // ==================================================

    if (["coin", "flip"].includes(command)) {
      const result = Math.random() < 0.5 ? "🪙 Cara" : "🪙 Cruz";

      return message.reply({
        embeds: [
          embed("🪙・MONEDA", `Resultado: **${result}**`)
        ]
      });
    }

    if (["dice", "dado"].includes(command)) {
      const number = random(1, 6);

      return message.reply({
        embeds: [
          embed("🎲・DADO", `Has sacado **${number}**.`)
        ]
      });
    }

    if (command === "random") {
      const max = Number(args[0]);

      if (!max || max <= 0) {
        return message.reply("❌ Usa `M!random número`.");
      }

      return message.reply({
        embeds: [
          embed(
            "🎲・RANDOM",
            `Número generado: **${random(1, max)}**`
          )
        ]
      });
    }

    if (command === "choose") {
      if (args.length < 2) {
        return message.reply("❌ Escribe al menos dos opciones separadas por espacios.");
      }

      const choice = args[random(0, args.length - 1)];

      return message.reply({
        embeds: [
          embed(
            "🤔・DECISIÓN",
            `Akari ha elegido:\n\n💗 **${choice}**`
          )
        ]
      });
    }

    if (command === "8ball") {
      const answers = [
        "Sí. 💗",
        "No. 🌸",
        "Probablemente.",
        "No estoy segura.",
        "Definitivamente sí.",
        "Definitivamente no."
      ];

      return message.reply({
        embeds: [
          embed(
            "🔮・8BALL",
            answers[random(0, answers.length - 1)]
          )
        ]
      });
    }

    if (["rps", "ppt"].includes(command)) {
      const choices = ["piedra", "papel", "tijera"];
      const userChoice = args[0]?.toLowerCase();

      if (!choices.includes(userChoice)) {
        return message.reply(
          "❌ Usa `M!rps piedra`, `M!rps papel` o `M!rps tijera`."
        );
      }

      const botChoice = choices[random(0, 2)];

      let result;

      if (userChoice === botChoice) {
        result = "🤝 ¡Empate!";
      } else if (
        (userChoice === "piedra" && botChoice === "tijera") ||
        (userChoice === "papel" && botChoice === "piedra") ||
        (userChoice === "tijera" && botChoice === "papel")
      ) {
        result = "🎉 ¡Ganaste!";
      } else {
        result = "😼 ¡Akari ganó!";
      }

      return message.reply({
        embeds: [
          embed(
            "✊・PIEDRA PAPEL TIJERA",
            `👤 Tú: **${userChoice}**\n🌸 Akari: **${botChoice}**\n\n${result}`
          )
        ]
      });
    }

    if (command === "guess") {
      const number = Number(args[0]);
      const secret = random(1, 10);

      if (!number || number < 1 || number > 10) {
        return message.reply("❌ Elige un número del 1 al 10.");
      }

      return message.reply({
        embeds: [
          embed(
            "🎯・ADIVINA",
            number === secret
              ? `🎉 ¡Correcto! Era **${secret}**.`
              : `❌ No era ese. El número era **${secret}**.`
          )
        ]
      });
    }

    // ==================================================
    // BLACKJACK SIN APUESTAS
    // ==================================================

    if (["blackjack", "bj"].includes(command)) {
      const key = `${message.guild.id}:${message.author.id}`;

      if (blackjackGames.has(key)) {
        return message.reply("❌ Ya tienes una partida de blackjack activa.");
      }

      const card = () => random(1, 11);

      const player = [card(), card()];
      const dealer = [card(), card()];

      blackjackGames.set(key, {
        player,
        dealer
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`bj_hit_${message.author.id}`)
          .setLabel("Pedir carta")
          .setEmoji("🃏")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`bj_stand_${message.author.id}`)
          .setLabel("Plantarse")
          .setEmoji("🛑")
          .setStyle(ButtonStyle.Secondary)
      );

      return message.reply({
        embeds: [
          embed(
            "🃏・BLACKJACK",
            `Tus cartas: **${player.join(" + ")} = ${player.reduce((a, b) => a + b, 0)}**\n\nDealer muestra: **${dealer[0]} + ?**\n\n🌸 Este modo es solamente un minijuego y **no utiliza apuestas ni dinero**.`
          )
        ],
        components: [row]
      });
    }

    // ==================================================
    // SOCIAL
    // ==================================================

    if (["hug", "abrazo"].includes(command)) {
      const target = message.mentions.users.first();

      if (!target) {
        return message.reply("❌ Menciona a alguien.");
      }

      return message.reply({
        embeds: [
          embed(
            "🤗・ABRAZO",
            `${message.author} le da un abrazo amistoso a ${target}. 🌸`
          )
        ]
      });
    }

    if (command === "highfive") {
      const target = message.mentions.users.first();

      if (!target) {
        return message.reply("❌ Menciona a alguien.");
      }

      return message.reply({
        embeds: [
          embed(
            "🖐️・HIGH FIVE",
            `${message.author} y ${target} chocan las manos. 💗`
          )
        ]
      });
    }

    if (command === "wave") {
      const target = message.mentions.users.first();

      return message.reply({
        embeds: [
          embed(
            "👋・SALUDO",
            target
              ? `${message.author} saluda a ${target}. 🌸`
              : `${message.author} saluda a todos. 🌸`
          )
        ]
      });
    }

    if (command === "friend") {
      const target = message.mentions.users.first();

      if (!target) {
        return message.reply("❌ Menciona a alguien.");
      }

      return message.reply({
        embeds: [
          embed(
            "💗・AMISTAD",
            `${message.author} considera a ${target} una buena amistad. 🌸`
          )
        ]
      });
    }

    if (command === "profile" || command === "perfil") {
      const target = message.mentions.users.first() || message.author;

      const result = await pool.query(
        `
        SELECT coins, bank
        FROM users
        WHERE guild_id=$1 AND user_id=$2
        `,
        [message.guild.id, target.id]
      );

      const data = result.rows[0];

      return message.reply({
        embeds: [
          embed(
            "💗・PERFIL",
            `👤 **Usuario:** ${target}\n\n💰 Efectivo: **${formatCoins(data.coins)}**\n🏦 Banco: **${formatCoins(data.bank)}**\n\n🌸 Gracias por formar parte de Akari Community.`
          ).setThumbnail(target.displayAvatarURL({ dynamic: true }))
        ]
      });
    }

    if (command === "avatar") {
      const target = message.mentions.users.first() || message.author;

      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLOR)
            .setTitle(`🖼️・AVATAR DE ${target.username}`)
            .setImage(target.displayAvatarURL({
              extension: "png",
              size: 1024
            }))
        ]
      });
    }

    if (command === "rep") {
      const target = message.mentions.users.first();

      if (!target) {
        return message.reply("❌ Menciona a alguien.");
      }

      if (target.id === message.author.id) {
        return message.reply("❌ No puedes darte reputación a ti mismo.");
      }

      await pool.query(
        `
        INSERT INTO reputation
        (guild_id, user_id, reputation)
        VALUES ($1,$2,1)
        ON CONFLICT (guild_id,user_id)
        DO UPDATE SET reputation = reputation + 1
        `,
        [message.guild.id, target.id]
      );

      return message.reply({
        embeds: [
          embed(
            "⭐・REPUTACIÓN",
            `${message.author} le dio **+1 reputación** a ${target}. 💗`
          )
        ]
      });
    }

    // ==================================================
    // INFORMACIÓN
    // ==================================================

    if (command === "serverinfo") {
      const guild = message.guild;

      return message.reply({
        embeds: [
          embed(
            "🌸・SERVER INFO",
            `🏠 Servidor: **${guild.name}**\n👥 Miembros: **${guild.memberCount}**\n💬 Canales: **${guild.channels.cache.size}**\n🎭 Roles: **${guild.roles.cache.size}**`
          )
        ]
      });
    }

    if (command === "userinfo") {
      const target = message.mentions.members.first() || message.member;

      return message.reply({
        embeds: [
          embed(
            "👤・USER INFO",
            `👤 Usuario: ${target.user}\n🆔 ID: \`${target.id}\`\n📅 Cuenta creada: <t:${Math.floor(target.user.createdTimestamp / 1000)}:D>\n📥 Entró al servidor: ${target.joinedTimestamp ? `<t:${Math.floor(target.joinedTimestamp / 1000)}:D>` : "Desconocido"}`
          )
        ]
      });
    }

    if (command === "roleinfo") {
      const role = message.mentions.roles.first();

      if (!role) {
        return message.reply("❌ Menciona un rol.");
      }

      return message.reply({
        embeds: [
          embed(
            "🎭・ROLE INFO",
            `🎭 Rol: ${role}\n🆔 ID: \`${role.id}\`\n👥 Miembros: **${role.members.size}**`
          )
        ]
      });
    }

    if (command === "channelinfo") {
      return message.reply({
        embeds: [
          embed(
            "📺・CHANNEL INFO",
            `📺 Canal: ${message.channel}\n🆔 ID: \`${message.channel.id}\`\n📌 Tipo: **${message.channel.type}**`
          )
        ]
      });
    }

    if (command === "membercount") {
      return message.reply({
        embeds: [
          embed(
            "👥・MIEMBROS",
            `Akari Community tiene actualmente **${message.guild.memberCount} miembros**. 🌸`
          )
        ]
      });
    }

    if (command === "uptime") {
      const seconds = Math.floor(process.uptime());
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);

      return message.reply({
        embeds: [
          embed(
            "⏱️・UPTIME",
            `🌸 Akari lleva conectado:\n\n**${hours}h ${minutes}m**`
          )
        ]
      });
    }

    if (command === "botinfo") {
      return message.reply({
        embeds: [
          embed(
            "🤖・AKARI BOT",
            `🌸 Nombre: **${client.user.username}**\n🏠 Servidores: **${client.guilds.cache.size}**\n⚡ Ping: **${client.ws.ping}ms**\n💗 Prefix: \`${PREFIX}\``
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
        return message.reply("❌ Escribe una operación.");
      }

      if (!/^[0-9+\-*/().%\s]+$/.test(expression)) {
        return message.reply("❌ Solo se permiten operaciones matemáticas básicas.");
      }

      try {
        const result = Function(`"use strict"; return (${expression})`)();

        if (!Number.isFinite(result)) {
          return message.reply("❌ Resultado inválido.");
        }

        return message.reply({
          embeds: [
            embed(
              "🧮・CALCULADORA",
              `📌 Operación: \`${expression}\`\n\n✨ Resultado: **${result}**`
            )
          ]
        });
      } catch {
        return message.reply("❌ No pude calcular esa operación.");
      }
    }

    if (command === "poll") {
      if (!args.length) {
        return message.reply("❌ Usa `M!poll pregunta`.");
      }

      const question = args.join(" ");

      return message.channel.send({
        embeds: [
          embed(
            "📊・ENCUESTA",
            `**${question}**\n\n👍 Sí\n👎 No`
          )
        ]
      }).then(async msg => {
        await msg.react("👍");
        await msg.react("👎");
      });
    }

    // ==================================================
    // ANIME
    // ==================================================

    if (["anime", "animehelp"].includes(command)) {
      return message.reply({
        embeds: [
          embed(
            "🌸・ANIME",
            `Bienvenido a la categoría anime de Akari. 💗\n\n` +
            `🌸 \`${PREFIX}animechar\` — Personaje aleatorio\n` +
            `📚 \`${PREFIX}animefact\` — Dato de anime\n` +
            `💬 \`${PREFIX}animequote\` — Frase original\n` +
            `🧠 \`${PREFIX}animequiz\` — Quiz anime\n` +
            `🎲 \`${PREFIX}animechoose\` — Elige un personaje\n` +
            `✨ \`${PREFIX}otaku\` — Perfil otaku`
          )
        ]
      });
    }

    if (["animechar", "animecharacter"].includes(command)) {
      const character =
        animeCharacters[random(0, animeCharacters.length - 1)];

      return message.reply({
        embeds: [
          embed(
            "🌸・PERSONAJE ANIME",
            `Tu personaje aleatorio es:\n\n✨ **${character}**`
          )
        ]
      });
    }

    if (command === "animefact") {
      const fact = animeFacts[random(0, animeFacts.length - 1)];

      return message.reply({
        embeds: [
          embed(
            "📚・DATO ANIME",
            `🌸 ${fact}`
          )
        ]
      });
    }

    if (command === "animequote") {
      const quote =
        animeQuotes[random(0, animeQuotes.length - 1)];

      return message.reply({
        embeds: [
          embed(
            "💬・FRASE ANIME",
            `「${quote}」`
          )
        ]
      });
    }

    if (command === "animequiz") {
      const quiz =
        animeQuiz[random(0, animeQuiz.length - 1)];

      return message.reply({
        embeds: [
          embed(
            "🧠・ANIME QUIZ",
            `**${quiz.question}**\n\n` +
            `A) ${quiz.options[0]}\n` +
            `B) ${quiz.options[1]}\n` +
            `C) ${quiz.options[2]}\n` +
            `D) ${quiz.options[3]}\n\n` +
            `💗 Responde con el nombre de tu opción.`
          )
        ]
      });
    }

    if (command === "animechoose") {
      const options = args.filter(Boolean);

      if (options.length < 2) {
        return message.reply(
          "❌ Usa, por ejemplo: `M!animechoose Naruto Goku Luffy`."
        );
      }

      const choice =
        options[random(0, options.length - 1)];

      return message.reply({
        embeds: [
          embed(
            "🌸・ELECCIÓN ANIME",
            `Akari eligió:\n\n✨ **${choice}**`
          )
        ]
      });
    }

    if (command === "otaku") {
      const level = random(1, 100);

      return message.reply({
        embeds: [
          embed(
            "🌸・NIVEL OTAKU",
            `${message.author}\n\n✨ Tu nivel otaku aleatorio es:\n\n**${level}%** 🌸`
          )
        ]
      });
    }

    // ==================================================
    // ADMIN
    // ==================================================

    if (command === "admin") {
      if (!isAdmin(message.member)) {
        return message.reply("❌ Solo los administradores pueden usar este comando.");
      }

      const menu = new StringSelectMenuBuilder()
        .setCustomId("admin_menu")
        .setPlaceholder("⚙️ Selecciona una sección")
        .addOptions(
          {
            label: "Moderación",
            description: "Warnings, mute, kick, ban y clear",
            value: "moderacion",
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
            description: "Configuración del servidor",
            value: "configuracion",
            emoji: "⚙️"
          },
          {
            label: "Economía",
            description: "Configuración de la tienda",
            value: "economia",
            emoji: "💰"
          },
          {
            label: "Información",
            description: "Información administrativa",
            value: "informacion",
            emoji: "📊"
          },
          {
            label: "Bienvenidas",
            description: "Configurar canal de bienvenida",
            value: "bienvenidas",
            emoji: "👋"
          }
        );

      return message.reply({
        embeds: [
          embed(
            "⚙️・AKARI ADMIN",
            `Panel administrativo de **Akari Community**.\n\nSelecciona una sección para ver las herramientas disponibles.`
          )
        ],
        components: [
          new ActionRowBuilder().addComponents(menu)
        ]
      });
    }

    // ==================================================
    // SET WELCOME
    // ==================================================

    if (command === "setwelcome") {
      if (!isAdmin(message.member)) {
        return message.reply("❌ Solo administradores.");
      }

      const channel =
        message.mentions.channels.first() ||
        message.guild.channels.cache.get(args[0]);

      if (!channel) {
        return message.reply(
          "❌ Menciona el canal donde quieres las bienvenidas."
        );
      }

      await pool.query(
        `
        INSERT INTO settings
        (guild_id, welcome_channel)
        VALUES ($1,$2)
        ON CONFLICT (guild_id)
        DO UPDATE SET welcome_channel=$2
        `,
        [message.guild.id, channel.id]
      );

      return message.reply({
        embeds: [
          embed(
            "👋・BIENVENIDAS CONFIGURADAS",
            `Las bienvenidas ahora se enviarán en ${channel}. 🌸`
          )
        ]
      });
    }

    // ==================================================
    // SHOP EDIT
    // ==================================================

    if (command === "shopedit") {
      if (!isAdmin(message.member)) {
        return message.reply("❌ Solo administradores.");
      }

      const type = args.shift()?.toLowerCase();

      if (!type || !["rol", "role", "mensaje", "message"].includes(type)) {
        return message.reply(
          `❌ Uso:\n\`${PREFIX}shopedit rol @Rol cantidad\`\n\`${PREFIX}shopedit mensaje texto cantidad\``
        );
      }

      if (["rol", "role"].includes(type)) {
        const role = message.mentions.roles.first();
        const price = Number(args[args.length - 1]);

        if (!role) {
          return message.reply("❌ Debes mencionar un rol.");
        }

        if (!Number.isInteger(price) || price <= 0) {
          return message.reply("❌ Debes indicar un precio válido.");
        }

        await pool.query(
          `
          INSERT INTO shop_items
          (guild_id, type, target_id, message, price)
          VALUES ($1,'role',$2,NULL,$3)
          `,
          [message.guild.id, role.id, price]
        );

        return message.reply({
          embeds: [
            embed(
              "🛒・SHOP EDIT",
              `🎭 Rol añadido a la tienda: ${role}\n💰 Precio: **${formatCoins(price)}**`
            )
          ]
        });
      }

      const price = Number(args[args.length - 1]);
      const text = args.slice(0, -1).join(" ");

      if (!text || !Number.isInteger(price) || price <= 0) {
        return message.reply(
          `❌ Uso: \`${PREFIX}shopedit mensaje Texto de recompensa 500\``
        );
      }

      await pool.query(
        `
        INSERT INTO shop_items
        (guild_id, type, target_id, message, price)
        VALUES ($1,'message',NULL,$2,$3)
        `,
        [message.guild.id, text, price]
      );

      return message.reply({
        embeds: [
          embed(
            "🛒・SHOP EDIT",
            `💬 Recompensa añadida:\n${text}\n\n💰 Precio: **${formatCoins(price)}**`
          )
        ]
      });
    }

    // ==================================================
    // MODERACIÓN
    // ==================================================

    if (["warn", "warnings", "warns"].includes(command)) {
      if (!isStaff(message.member)) {
        return message.reply("❌ No tienes permisos.");
      }

      const target =
        message.mentions.members.first();

      if (!target) {
        return message.reply("❌ Menciona a un usuario.");
      }

      if (command !== "warn") {
        const result = await pool.query(
          `
          SELECT COUNT(*)::int AS total
          FROM warnings
          WHERE guild_id=$1 AND user_id=$2
          `,
          [message.guild.id, target.id]
        );

        return message.reply({
          embeds: [
            embed(
              "⚠️・WARNINGS",
              `${target} tiene **${result.rows[0].total} warnings**.`
            )
          ]
        });
      }

      const reason =
        args.slice(1).join(" ") || "Sin razón especificada";

      const total = await addWarning(
        message.guild.id,
        target.id,
        message.author.id,
        reason
      );

      if (total >= 3 && target.moderatable) {
        await target.timeout(
          60 * 60 * 1000,
          "3 warnings acumulados."
        ).catch(() => {});

        return message.reply({
          embeds: [
            embed(
              "🔇・MUTE",
              `${target} recibió su **3.er warning**.\n\n⏰ Mute aplicado: **1 hora**\n📝 Razón: ${reason}`
            )
          ]
        });
      }

      return message.reply({
        embeds: [
          embed(
            "⚠️・WARNING",
            `${target} recibió un warning.\n\n📊 Total: **${total}/3**\n📝 Razón: ${reason}`
          )
        ]
      });
    }

    if (command === "timeout") {
      if (!isStaff(message.member)) {
        return message.reply("❌ No tienes permisos.");
      }

      const target = message.mentions.members.first();
      const minutes = Number(args[1] || args[0]);

      if (!target || !minutes || minutes <= 0) {
        return message.reply(
          "❌ Uso: `M!timeout @usuario minutos`."
        );
      }

      if (!target.moderatable) {
        return message.reply("❌ No puedo aplicar timeout a ese usuario.");
      }

      await target.timeout(
        minutes * 60 * 1000,
        "Moderación de Akari."
      );

      return message.reply({
        embeds: [
          embed(
            "🔇・TIMEOUT",
            `${target} recibió un timeout de **${minutes} minutos**.`
          )
        ]
      });
    }

    if (command === "untimeout") {
      if (!isStaff(message.member)) {
        return message.reply("❌ No tienes permisos.");
      }

      const target = message.mentions.members.first();

      if (!target) {
        return message.reply("❌ Menciona a un usuario.");
      }

      await target.timeout(null, "Timeout retirado.");

      return message.reply({
        embeds: [
          embed(
            "🔊・TIMEOUT RETIRADO",
            `Se retiró el timeout de ${target}.`
          )
        ]
      });
    }

    if (command === "kick") {
      if (!isStaff(message.member)) {
        return message.reply("❌ No tienes permisos.");
      }

      const target = message.mentions.members.first();

      if (!target) {
        return message.reply("❌ Menciona a un usuario.");
      }

      if (!target.kickable) {
        return message.reply("❌ No puedo expulsar a ese usuario.");
      }

      await target.kick(
        args.slice(1).join(" ") || "Sin razón"
      );

      return message.reply({
        embeds: [
          embed(
            "👢・KICK",
            `${target.user.tag} fue expulsado del servidor.`
          )
        ]
      });
    }

    if (command === "ban") {
      if (!isStaff(message.member)) {
        return message.reply("❌ No tienes permisos.");
      }

      const target = message.mentions.members.first();

      if (!target) {
        return message.reply("❌ Menciona a un usuario.");
      }

      if (!target.bannable) {
        return message.reply("❌ No puedo banear a ese usuario.");
      }

      await target.ban({
        reason: args.slice(1).join(" ") || "Sin razón"
      });

      return message.reply({
        embeds: [
          embed(
            "🔨・BAN",
            `${target.user.tag} fue baneado del servidor.`
          )
        ]
      });
    }

    if (command === "clear") {
      if (!isStaff(message.member)) {
        return message.reply("❌ No tienes permisos.");
      }

      const amount = Number(args[0]);

      if (!amount || amount < 1 || amount > 100) {
        return message.reply(
          "❌ Indica una cantidad entre 1 y 100."
        );
      }

      await message.channel.bulkDelete(amount, true);

      return message.channel.send({
        embeds: [
          embed(
            "🧹・CLEAR",
            `Se eliminaron **${amount} mensajes**.`
          )
        ]
      }).then(msg => {
        setTimeout(() => msg.delete().catch(() => {}), 5000);
      });
    }

    // ==================================================
    // TICKETS
    // ==================================================

    if (command === "ticketpanel") {
      if (!isAdmin(message.member)) {
        return message.reply("❌ Solo administradores.");
      }

      const menu = new StringSelectMenuBuilder()
        .setCustomId("ticket_menu")
        .setPlaceholder("👇 Selecciona una categoría")
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
            emoji: "❓"
          },
          {
            label: "Allys/Affys/Socio",
            value: "Allys/Affys/Socio",
            emoji: "🤝"
          },
          {
            label: "Postulación",
            value: "Postulación",
            emoji: "📝"
          },
          {
            label: "Otro",
            value: "Otro",
            emoji: "📌"
          }
        );

      const text = `
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
`;

      return message.channel.send({
        embeds: [
          embed("🌸・AKARI COMMUNITY", text)
        ],
        components: [
          new ActionRowBuilder().addComponents(menu)
        ]
      });
    }

  } catch (error) {
    console.error("❌ Error en messageCreate:", error);

    if (!message.replied && !message.deferred) {
      message.reply(
        "❌ Ocurrió un error al ejecutar ese comando."
      ).catch(() => {});
    }
  }
});

// ======================================================
// INTERACCIONES
// ======================================================

client.on("interactionCreate", async interaction => {
  try {

    // ==================================================
    // HELP MENU
    // ==================================================

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "help_menu"
    ) {
      const value = interaction.values[0];

      const categories = {
        economia: {
          title: "💰・ECONOMÍA",
          text:
            `\`${PREFIX}balance\` — Ver dinero\n` +
            `\`${PREFIX}daily\` — Recompensa diaria\n` +
            `\`${PREFIX}work\` — Trabajar\n` +
            `\`${PREFIX}beg\` — Pedir dinero\n` +
            `\`${PREFIX}pay\` — Enviar dinero\n` +
            `\`${PREFIX}deposit\` — Depositar\n` +
            `\`${PREFIX}withdraw\` — Retirar\n` +
            `\`${PREFIX}depositall\` — Depositar todo\n` +
            `\`${PREFIX}withdrawall\` — Retirar todo\n` +
            `\`${PREFIX}shop\` — Ver tienda\n` +
            `\`${PREFIX}buy\` — Comprar\n` +
            `\`${PREFIX}leaderboard\` — Top de riqueza`
        },

        diversion: {
          title: "🎮・DIVERSIÓN",
          text:
            `\`${PREFIX}coin\` — Lanzar moneda\n` +
            `\`${PREFIX}dice\` — Lanzar dado\n` +
            `\`${PREFIX}random\` — Número aleatorio\n` +
            `\`${PREFIX}choose\` — Elegir opción\n` +
            `\`${PREFIX}8ball\` — Bola mágica\n` +
            `\`${PREFIX}rps\` — Piedra, papel o tijera\n` +
            `\`${PREFIX}guess\` — Adivinar número\n` +
            `\`${PREFIX}blackjack\` — Blackjack sin apuestas`
        },

        social: {
          title: "💗・SOCIAL",
          text:
            `\`${PREFIX}profile\` — Ver perfil\n` +
            `\`${PREFIX}avatar\` — Ver avatar\n` +
            `\`${PREFIX}hug\` — Abrazo amistoso\n` +
            `\`${PREFIX}highfive\` — High five\n` +
            `\`${PREFIX}wave\` — Saludar\n` +
            `\`${PREFIX}friend\` — Amistad\n` +
            `\`${PREFIX}rep\` — Reputación`
        },

        informacion: {
          title: "📚・INFORMACIÓN",
          text:
            `\`${PREFIX}serverinfo\` — Información del servidor\n` +
            `\`${PREFIX}userinfo\` — Información de usuario\n` +
            `\`${PREFIX}roleinfo\` — Información de rol\n` +
            `\`${PREFIX}channelinfo\` — Información del canal\n` +
            `\`${PREFIX}membercount\` — Miembros\n` +
            `\`${PREFIX}botinfo\` — Información de Akari\n` +
            `\`${PREFIX}uptime\` — Tiempo conectado`
        },

        utilidades: {
          title: "🛠️・UTILIDADES",
          text:
            `\`${PREFIX}ping\` — Latencia\n` +
            `\`${PREFIX}calc\` — Calculadora\n` +
            `\`${PREFIX}poll\` — Crear encuesta`
        },

        anime: {
          title: "🌸・ANIME",
          text:
            `\`${PREFIX}anime\` — Menú anime\n` +
            `\`${PREFIX}animechar\` — Personaje aleatorio\n` +
            `\`${PREFIX}animefact\` — Dato anime\n` +
            `\`${PREFIX}animequote\` — Frase original\n` +
            `\`${PREFIX}animequiz\` — Quiz\n` +
            `\`${PREFIX}animechoose\` — Elegir personaje\n` +
            `\`${PREFIX}otaku\` — Nivel otaku`
        }
      };

      const category = categories[value];

      if (!category) return;

      return interaction.update({
        embeds: [
          embed(
            category.title,
            category.text
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
          content: "❌ No tienes permisos.",
          ephemeral: true
        });
      }

      const value = interaction.values[0];

      const data = {
        moderacion: {
          title: "🛡️・MODERACIÓN",
          text:
            `\`${PREFIX}warn @usuario razón\`\n` +
            `\`${PREFIX}warnings @usuario\`\n` +
            `\`${PREFIX}timeout @usuario minutos\`\n` +
            `\`${PREFIX}untimeout @usuario\`\n` +
            `\`${PREFIX}kick @usuario\`\n` +
            `\`${PREFIX}ban @usuario\`\n` +
            `\`${PREFIX}clear cantidad\`\n\n` +
            `🚨 Anti-spam activo:\n` +
            `5 mensajes consecutivos → 1 Warn\n` +
            `3 Warns → Mute de 1 hora`
        },

        tickets: {
          title: "🎫・TICKETS",
          text:
            `\`${PREFIX}ticketpanel\` — Crear panel de tickets\n\n` +
            `Categorías:\n` +
            `🛠️ Soporte\n` +
            `🚨 Reporte\n` +
            `❓ Duda\n` +
            `🤝 Allys/Affys/Socio\n` +
            `📝 Postulación\n` +
            `📌 Otro`
        },

        configuracion: {
          title: "⚙️・CONFIGURACIÓN",
          text:
            `\`${PREFIX}setwelcome #canal\` — Configurar bienvenidas`
        },

        economia: {
          title: "💰・ECONOMÍA",
          text:
            `\`${PREFIX}shop\` — Ver tienda\n` +
            `\`${PREFIX}shopedit rol @Rol cantidad\`\n` +
            `\`${PREFIX}shopedit mensaje texto cantidad\`\n\n` +
            `Los artículos pueden ser roles o recompensas de texto.`
        },

        informacion: {
          title: "📊・INFORMACIÓN",
          text:
            `\`${PREFIX}serverinfo\`\n` +
            `\`${PREFIX}membercount\`\n` +
            `\`${PREFIX}botinfo\`\n` +
            `\`${PREFIX}uptime\``
        },

        bienvenidas: {
          title: "👋・BIENVENIDAS",
          text:
            `\`${PREFIX}setwelcome #canal\`\n\n` +
            `Configura el canal donde Akari enviará automáticamente el mensaje de bienvenida.`
        }
      };

      const selected = data[value];

      return interaction.update({
        embeds: [
          embed(selected.title, selected.text)
        ]
      });
    }

    // ==================================================
    // TICKETS MENU
    // ==================================================

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "ticket_menu"
    ) {
      const category = interaction.values[0];
      const guild = interaction.guild;

      const existing = await pool.query(
        `
        SELECT *
        FROM tickets
        WHERE guild_id=$1 AND user_id=$2
        `,
        [guild.id, interaction.user.id]
      );

      if (existing.rows.length) {
        const channel = guild.channels.cache.get(
          existing.rows[0].channel_id
        );

        return interaction.reply({
          content: channel
            ? `❌ Ya tienes un ticket abierto: ${channel}`
            : "❌ Ya tienes un ticket abierto.",
          ephemeral: true
        });
      }

      const channel = await guild.channels.create({
        name: `ticket-${interaction.user.username}`.toLowerCase().slice(0, 90),
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory
            ]
          },
          {
            id: STAFF_ROLE_ID,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory
            ]
          }
        ]
      });

      await pool.query(
        `
        INSERT INTO tickets
        (guild_id,user_id,channel_id,category)
        VALUES ($1,$2,$3,$4)
        `,
        [
          guild.id,
          interaction.user.id,
          channel.id,
          category
        ]
      );

      const buttons = new ActionRowBuilder().addComponents(
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
        content: `${interaction.user} <@&${STAFF_ROLE_ID}>`,
        embeds: [
          embed("🌸・AKARI COMMUNITY", ticketText)
        ],
        components: [buttons]
      });

      return interaction.reply({
        content: `🎫 Ticket creado correctamente: ${channel}`,
        ephemeral: true
      });
    }

    // ==================================================
    // TICKET CLAIM
    // ==================================================

    if (
      interaction.isButton() &&
      interaction.customId === "ticket_claim"
    ) {
      if (!isStaff(interaction.member)) {
        return interaction.reply({
          content: "❌ Solo el staff puede reclamar tickets.",
          ephemeral: true
        });
      }

      const result = await pool.query(
        `
        SELECT *
        FROM tickets
        WHERE channel_id=$1
        `,
        [interaction.channel.id]
      );

      if (!result.rows.length) {
        return interaction.reply({
          content: "❌ Este canal no es un ticket.",
          ephemeral: true
        });
      }

      const ticket = result.rows[0];

      if (ticket.claimed_by) {
        return interaction.reply({
          content: `❌ Este ticket ya fue reclamado por <@${ticket.claimed_by}>.`,
          ephemeral: true
        });
      }

      await pool.query(
        `
        UPDATE tickets
        SET claimed_by=$1
        WHERE channel_id=$2
        `,
        [interaction.user.id, interaction.channel.id]
      );

      return interaction.reply({
        embeds: [
          embed(
            "🎫・TICKET RECLAMADO",
            `Este ticket ha sido reclamado por ${interaction.user}.`
          )
        ]
      });
    }

    // ==================================================
    // TICKET CLOSE
    // ==================================================

    if (
      interaction.isButton() &&
      interaction.customId === "ticket_close"
    ) {
      if (!isStaff(interaction.member)) {
        return interaction.reply({
          content: "❌ Solo el staff puede cerrar tickets.",
          ephemeral: true
        });
      }

      await interaction.reply({
        embeds: [
          embed(
            "🔒・TICKET CERRADO",
            "Este ticket será eliminado en **5 segundos**."
          )
        ]
      });

      await pool.query(
        `
        DELETE FROM tickets
        WHERE channel_id=$1
        `,
        [interaction.channel.id]
      );

      setTimeout(() => {
        interaction.channel.delete().catch(() => {});
      }, 5000);

      return;
    }

    // ==================================================
    // BLACKJACK BUTTONS
    // ==================================================

    if (
      interaction.isButton() &&
      (
        interaction.customId.startsWith("bj_hit_") ||
        interaction.customId.startsWith("bj_stand_")
      )
    ) {
      const userId = interaction.customId.split("_")[2];

      if (interaction.user.id !== userId) {
        return interaction.reply({
          content: "❌ Esta partida pertenece a otro usuario.",
          ephemeral: true
        });
      }

      const key = `${interaction.guild.id}:${interaction.user.id}`;
      const game = blackjackGames.get(key);

      if (!game) {
        return interaction.reply({
          content: "❌ Esta partida ya terminó.",
          ephemeral: true
        });
      }

      const total = game.player.reduce((a, b) => a + b, 0);

      if (interaction.customId.startsWith("bj_hit_")) {
        game.player.push(random(1, 11));

        const newTotal = game.player.reduce((a, b) => a + b, 0);

        if (newTotal > 21) {
          blackjackGames.delete(key);

          return interaction.update({
            embeds: [
              embed(
                "🃏・BLACKJACK",
                `Tus cartas: **${game.player.join(" + ")} = ${newTotal}**\n\n💥 Te pasaste de 21.\n\n🌸 Fin de la partida.`
              )
            ],
            components: []
          });
        }

        return interaction.update({
          embeds: [
            embed(
              "🃏・BLACKJACK",
              `Tus cartas: **${game.player.join(" + ")} = ${newTotal}**\n\nDealer muestra: **${game.dealer[0]} + ?**`
            )
          ]
        });
      }

      while (game.dealer.reduce((a, b) => a + b, 0) < 17) {
        game.dealer.push(random(1, 11));
      }

      const playerTotal = game.player.reduce((a, b) => a + b, 0);
      const dealerTotal = game.dealer.reduce((a, b) => a + b, 0);

      let result;

      if (dealerTotal > 21) {
        result = "🎉 ¡Ganaste!";
      } else if (playerTotal > dealerTotal) {
        result = "🎉 ¡Ganaste!";
      } else if (playerTotal === dealerTotal) {
        result = "🤝 ¡Empate!";
      } else {
        result = "🌸 Ganó el dealer.";
      }

      blackjackGames.delete(key);

      return interaction.update({
        embeds: [
          embed(
            "🃏・BLACKJACK",
            `👤 Tus cartas: **${game.player.join(" + ")} = ${playerTotal}**\n` +
            `🌸 Dealer: **${game.dealer.join(" + ")} = ${dealerTotal}**\n\n` +
            `${result}`
          )
        ],
        components: []
      });
    }

  } catch (error) {
    console.error("❌ Error en interactionCreate:", error);

    if (!interaction.replied && !interaction.deferred) {
      interaction.reply({
        content: "❌ Ocurrió un error.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

// ======================================================
// START
// ======================================================

async function start() {
  console.log("🌸 AKARI: entrando en start()...");
  console.log("🌸 Conectando con PostgreSQL...");

  await pool.query("SELECT 1");

  console.log("✅ PostgreSQL conectado correctamente.");

  await createTables();

  console.log("🌸 Conectando con Discord...");

  await client.login(TOKEN);

  console.log("✅ Login de Discord realizado.");
}

start().catch(error => {
  console.error("❌ ERROR FATAL:");
  console.error(error);
});
