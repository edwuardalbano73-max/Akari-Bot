
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
  ChannelType
} = require("discord.js");

const fs = require("node:fs");
const path = require("node:path");

// ==================== AKARI BOT ====================

const TOKEN = process.env.DISCORD_TOKEN;
const OWNER_ID = process.env.BOT_OWNER_ID;

if (!TOKEN) {
  throw new Error("Falta la variable DISCORD_TOKEN en Render.");
}
if (!OWNER_ID) {
  throw new Error("Falta BOT_OWNER_ID: introduce tu ID de Discord en Render.");
}

const PREFIX = "M";
const PINK = 0xff9dcc;
const DATA_FILE = path.join(__dirname, "akari-data.json");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

const defaultData = {
  guilds: {},
  users: {},
  spam: {}
};

let data = defaultData;

try {
  if (fs.existsSync(DATA_FILE)) {
    const loaded = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    data = {
      ...defaultData,
      ...loaded,
      guilds: loaded.guilds || {},
      users: loaded.users || {},
      spam: loaded.spam || {}
    };
  }
} catch (error) {
  console.error("No se pudo leer akari-data.json:", error);
  throw new Error("El archivo de datos tiene JSON inválido. Corrígelo antes de iniciar.");
}

function save() {
  const temp = DATA_FILE + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(data, null, 2));
  fs.renameSync(temp, DATA_FILE);
}

function embed(title, description = "") {
  return new EmbedBuilder()
    .setColor(PINK)
    .setTitle(`🌸 ${title}`)
    .setDescription(description)
    .setFooter({ text: "Akari Bot 🌸" })
    .setTimestamp();
}

function getGuild(guildId) {
  if (!data.guilds[guildId]) {
    data.guilds[guildId] = {
      admins: [],
      welcomeChannel: null,
      goodbyeChannel: null,
      logsChannel: null,
      antiLink: false,
      antiSpam: false,
      ticketsCategory: null
    };
  }
  return data.guilds[guildId];
}

function getUser(userId) {
  if (!data.users[userId]) {
    data.users[userId] = {
      wallet: 500,
      bank: 0,
      inventory: [],
      xp: 0,
      level: 0,
      lastWork: 0,
      lastSlut: 0,
      lastRob: 0,
      lastCrime: 0,
      lastDaily: 0,
      warnings: 0
    };
  }

  const user = data.users[userId];
  user.wallet ??= 500;
  user.bank ??= 0;
  user.inventory ??= [];
  user.xp ??= 0;
  user.level ??= 0;
  user.warnings ??= 0;
  return user;
}

function money(n) {
  return `${Math.floor(n).toLocaleString("es-ES")} monedas 🌸`;
}

function parseAmount(value, max) {
  if (!value) return null;
  if (value.toLowerCase() === "all") return max;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) return null;
  return Math.min(n, max);
}

function isAdmin(message) {
  if (!message.guild) return false;
  const settings = getGuild(message.guild.id);
  return message.author.id === OWNER_ID ||
    message.member.permissions.has(PermissionFlagsBits.Administrator) ||
    settings.admins.some(id => message.member.roles.cache.has(id));
}

function isOwner(message) {
  return message.author.id === OWNER_ID;
}

async function logAction(guild, text) {
  const settings = getGuild(guild.id);
  const channel = settings.logsChannel
    ? guild.channels.cache.get(settings.logsChannel)
    : null;

  if (channel && channel.isTextBased()) {
    await channel.send({ embeds: [embed("Registro", text)] }).catch(() => {});
  }
}

async function reply(message, title, description) {
  return message.reply({ embeds: [embed(title, description)] });
}

const cooldowns = new Map();

function onCooldown(userId, command, seconds) {
  const key = `${userId}:${command}`;
  const now = Date.now();
  const until = cooldowns.get(key) || 0;

  if (until > now) return Math.ceil((until - now) / 1000);

  cooldowns.set(key, now + seconds * 1000);
  return 0;
}

function helpMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("akari_help")
      .setPlaceholder("🌸 Selecciona una categoría")
      .addOptions(
        { label: "General e información", value: "general", emoji: "🌸" },
        { label: "Economía", value: "economy", emoji: "💰" },
        { label: "Tienda e inventario", value: "shop", emoji: "🛍️" },
        { label: "Diversión", value: "fun", emoji: "🎮" },
        { label: "Social", value: "social", emoji: "💗" },
        { label: "Niveles y ranking", value: "levels", emoji: "🌟" },
        { label: "Moderación", value: "moderation", emoji: "🛡️" },
        { label: "Tickets", value: "tickets", emoji: "🎟️" }
      )
  );
}

function adminMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("akari_admin")
      .setPlaceholder("⚙️ Selecciona una sección")
      .addOptions(
        { label: "Bienvenidas y despedidas", value: "greetings", emoji: "👋" },
        { label: "Registros", value: "logs", emoji: "📋" },
        { label: "Seguridad", value: "security", emoji: "🛡️" },
        { label: "Tickets", value: "ticketconfig", emoji: "🎟️" },
        { label: "Roles autorizados", value: "roles", emoji: "🔐" },
        { label: "Estado de configuración", value: "status", emoji: "📊" }
      )
  );
}

const helpPages = {
  general:
    "**Mhelp** — menú de ayuda\n" +
    "**Mbot** — información del bot\n" +
    "**Mserver** — información del servidor\n" +
    "**Mping** — latencia\n" +
    "**Mavatar [@usuario]** — avatar\n" +
    "**Mprofile [@usuario]** — perfil",

  economy:
    "**Mwork** — trabajar\n" +
    "**Mslut** — trabajo ficticio de riesgo\n" +
    "**Mrob @usuario** — intentar robar\n" +
    "**Mcrime** — crimen ficticio\n" +
    "**Mpay @usuario cantidad** — transferir monedas\n" +
    "**Mdep all/cantidad** — depositar en el banco\n" +
    "**Mwith all/cantidad** — retirar del banco\n" +
    "**Mbj all/cantidad** — apostar en el minijuego\n" +
    "**Mbal [@usuario]** — consultar cartera y banco\n" +
    "**Mbank** — consultar el banco\n" +
    "**Mdaily** — recompensa diaria",

  shop:
    "**Mshop** — ver la tienda\n" +
    "**Mbuy artículo** — comprar un artículo\n" +
    "**Minventory** — ver tu inventario\n" +
    "**Msell artículo** — vender un artículo\n" +
    "**Muse artículo** — usar un artículo",

  fun:
    "**Mcoinflip** — cara o cruz\n" +
    "**Mdice** — tirar un dado\n" +
    "**Mguess** — adivinar un número\n" +
    "**Mmeme** — meme aleatorio",

  social:
    "**Mhug @usuario** — abrazo ficticio\n" +
    "**Mkiss @usuario** — beso ficticio\n" +
    "**Mfriend @usuario** — enviar amistad\n" +
    "**Mcompat @usuario** — compatibilidad\n" +
    "**Mprofile [@usuario]** — perfil",

  levels:
    "**Mlevel [@usuario]** — consultar nivel\n" +
    "**Mrank [@usuario]** — consultar clasificación\n" +
    "Escribe mensajes para ganar experiencia.",

  moderation:
    "**Mkick @usuario [razón]** — expulsar\n" +
    "**Mban @usuario [razón]** — banear\n" +
    "**Mmute @usuario minutos [razón]** — timeout\n" +
    "**Munmute @usuario** — quitar timeout\n" +
    "**Mwarn @usuario [razón]** — advertir\n" +
    "**Mclear cantidad** — borrar mensajes\n" +
    "Requiere permisos de moderación.",

  tickets:
    "**Mticket** — abrir un ticket\n" +
    "**Mclose** — cerrar el ticket actual\n" +
    "El bot necesita permisos para crear y eliminar canales."
};

client.once("ready", () => {
  console.log(`🌸 ${client.user.tag} está en línea.`);
  client.user.setPresence({
    activities: [{ name: "Akari Bot 🌸" }],
    status: "online"
  });
});

client.on("guildMemberAdd", async member => {
  const settings = getGuild(member.guild.id);
  const channel = settings.welcomeChannel
    ? member.guild.channels.cache.get(settings.welcomeChannel)
    : null;

  if (channel && channel.isTextBased()) {
    await channel.send({
      embeds: [
        embed("¡Bienvenido/a a Akari Community! 🌸",
          `¡Hola, ${member}! Esperamos que disfrutes tu estancia 💗`)
          .setThumbnail(member.user.displayAvatarURL())
      ]
    }).catch(() => {});
  }
});

client.on("guildMemberRemove", async member => {
  const settings = getGuild(member.guild.id);
  const channel = settings.goodbyeChannel
    ? member.guild.channels.cache.get(settings.goodbyeChannel)
    : null;

  if (channel && channel.isTextBased()) {
    await channel.send({
      embeds: [
        embed("¡Hasta pronto! 🌸",
          `**${member.user.tag}** ha salido del servidor.`)
      ]
    }).catch(() => {});
  }
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isStringSelectMenu()) return;

  if (interaction.customId === "akari_help") {
    const page = helpPages[interaction.values[0]];
    if (!page) {
      return interaction.reply({
        content: "Categoría no encontrada.",
        ephemeral: true
      });
    }

    return interaction.reply({
      embeds: [embed("Comandos de Akari", page)],
      ephemeral: true
    });
  }

  if (interaction.customId === "akari_admin") {
    if (!interaction.guild || !interaction.member) {
      return interaction.reply({
        content: "Este menú solo funciona en un servidor.",
        ephemeral: true
      });
    }

    const settings = getGuild(interaction.guild.id);
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const permitted = interaction.user.id === OWNER_ID ||
      member.permissions.has(PermissionFlagsBits.Administrator) ||
      settings.admins.some(id => member.roles.cache.has(id));

    if (!permitted) {
      return interaction.reply({
        content: "🔒 No tienes permiso para usar este panel.",
        ephemeral: true
      });
    }

    const pages = {
      greetings:
        "**Configurar bienvenida:**\n`Madmin welcome #canal`\n\n" +
        "**Configurar despedida:**\n`Madmin goodbye #canal`\n\n" +
        "**Desactivar:** `Madmin welcome off` o `Madmin goodbye off`",

      logs:
        "**Establecer canal de registros:**\n`Madmin logs #canal`\n\n" +
        "**Desactivar registros:** `Madmin logs off`",

      security:
        "**Activar antienlaces:** `Madmin antilink on`\n" +
        "**Desactivar antienlaces:** `Madmin antilink off`\n\n" +
        "**Activar antispam:** `Madmin antispam on`\n" +
        "**Desactivar antispam:** `Madmin antispam off`",

      ticketconfig:
        "**Abrir ticket:** `Mticket`\n" +
        "**Cerrar ticket:** `Mclose`\n\n" +
        "Los tickets se crean como canales privados.",

      roles:
        "**Añadir rol autorizado:** `Maddadmin @rol`\n" +
        "**Quitar rol autorizado:** `Mremoveadmin @rol`\n" +
        "**Ver roles:** `Mlistadmin`\n\n" +
        "Solo el propietario configurado del bot puede gestionar estos roles.",

      status:
        `Bienvenidas: ${settings.welcomeChannel ? `<#${settings.welcomeChannel}>` : "desactivadas"}\n` +
        `Despedidas: ${settings.goodbyeChannel ? `<#${settings.goodbyeChannel}>` : "desactivadas"}\n` +
        `Registros: ${settings.logsChannel ? `<#${settings.logsChannel}>` : "desactivados"}\n` +
        `Antienlaces: ${settings.antiLink ? "activado" : "desactivado"}\n` +
        `Antispam: ${settings.antiSpam ? "activado" : "desactivado"}\n` +
        `Roles autorizados: ${settings.admins.length}`
    };

    return interaction.reply({
      embeds: [embed("Panel de administración", pages[interaction.values[0]])],
      ephemeral: true
    });
  }
});

client.on("messageCreate", async message => {
  if (message.author.bot || !message.guild) return;

  const settings = getGuild(message.guild.id);
  const user = getUser(message.author.id);

  // Experiencia por mensajes.
  user.xp += Math.floor(Math.random() * 6) + 5;
  const nextLevel = (user.level + 1) * 100;

  if (user.xp >= nextLevel) {
    user.xp -= nextLevel;
    user.level++;
    message.channel.send({
      embeds: [
        embed("¡Subiste de nivel! 🌟",
          `${message.author} ahora es nivel **${user.level}**.`)
      ]
    }).catch(() => {});
  }

  // Antispam sencillo.
  if (settings.antiSpam) {
    const key = `${message.guild.id}:${message.author.id}`;
    const now = Date.now();
    const old = data.spam[key] || [];
    const recent = old.filter(t => now - t < 8000);
    recent.push(now);
    data.spam[key] = recent;

    if (recent.length >= 6) {
      data.spam[key] = [];
      await message.delete().catch(() => {});
      await message.member.timeout(60_000, "Antispam de Akari Bot").catch(() => {});
      await logAction(message.guild, `Antispam: ${message.author.tag}`);
      return;
    }
  }

  // Antienlaces.
  if (settings.antiLink && /(https?:\/\/|discord\.gg\/|www\.)/i.test(message.content)) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      await message.delete().catch(() => {});
      await message.channel.send({
        content: `${message.author}`,
        embeds: [embed("Enlace eliminado", "Los enlaces no están permitidos aquí.")]
      }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000)).catch(() => {});
      await logAction(message.guild, `Enlace eliminado de ${message.author.tag}`);
      return;
    }
  }

  if (!message.content.toLowerCase().startsWith(PREFIX.toLowerCase())) {
    save();
    return;
  }

  const input = message.content.slice(PREFIX.length).trim();
  if (!input) return;

  const args = input.split(/\s+/);
  const command = args.shift().toLowerCase();

  try {
    // ================ AYUDA Y GENERAL ================

    if (command === "help") {
      return message.reply({
        embeds: [
          embed("Akari Bot 🌸",
            "¡Hola! Selecciona una categoría para ver sus comandos.\n" +
            "Usa `Madmin` para abrir el panel de administración autorizado.")
        ],
        components: [helpMenu()]
      });
    }

    if (command === "ping") {
      return reply(message, "Pong! 🌸", `Latencia: **${client.ws.ping} ms**`);
    }

    if (command === "bot") {
      return reply(message, "Información del bot",
        `Nombre: **${client.user.tag}**\nServidores: **${client.guilds.cache.size}**\nUsuarios en caché: **${client.users.cache.size}**`);
    }

    if (command === "server") {
      return reply(message, "Información del servidor",
        `Nombre: **${message.guild.name}**\nMiembros: **${message.guild.memberCount}**\nCanales: **${message.guild.channels.cache.size}**`);
    }

    if (command === "avatar") {
      const target = message.mentions.users.first() || message.author;
      return message.reply({
        embeds: [
          embed(`Avatar de ${target.username}`)
            .setImage(target.displayAvatarURL({ size: 1024 }))
        ]
      });
    }

    if (command === "profile") {
      const target = message.mentions.users.first() || message.author;
      const u = getUser(target.id);
      return reply(message, `Perfil de ${target.username}`,
        `Nivel: **${u.level}**\nExperiencia: **${u.xp} XP**\nCartera: **${money(u.wallet)}**\nBanco: **${money(u.bank)}**`);
    }

    // ================ ECONOMÍA ================

    if (command === "bal" || command === "balance") {
      const target = message.mentions.users.first() || message.author;
      const u = getUser(target.id);
      return reply(message, `Saldo de ${target.username}`,
        `👛 Cartera: **${money(u.wallet)}**\n🏦 Banco: **${money(u.bank)}**\n💰 Total: **${money(u.wallet + u.bank)}**`);
    }

    if (command === "bank") {
      return reply(message, "Tu banco", `Saldo bancario: **${money(user.bank)}**`);
    }

    if (command === "work" || command === "slut" || command === "crime") {
      const config = {
        work: { field: "lastWork", cooldown: 30, min: 100, max: 300, title: "Trabajo" },
        slut: { field: "lastSlut", cooldown: 60, min: 100, max: 350, title: "Trabajo ficticio de riesgo" },
        crime: { field: "lastCrime", cooldown: 120, min: 500, max: 700, title: "Crimen ficticio" }
      }[command];

      const wait = onCooldown(message.author.id, command, config.cooldown);
      if (wait) return reply(message, "Espera un poquito 🌸", `Vuelve a intentarlo en **${wait} segundos**.`);

      let amount;
      let text;

      if (command === "crime" && Math.random() < 0.2) {
        amount = -600;
        text = `La misión salió mal y perdiste **${money(600)}**.`;
      } else if (command === "slut" && Math.random() < 0.3) {
        amount = -Math.floor(Math.random() * 201 + 300);
        text = `El trabajo salió mal y perdiste **${money(-amount)}**.`;
      } else {
        amount = Math.floor(Math.random() * (config.max - config.min + 1)) + config.min;
        text = `Ganaste **${money(amount)}**.`;
      }

      user.wallet = Math.max(0, user.wallet + amount);
      save();
      return reply(message, config.title, text + `\nCartera actual: **${money(user.wallet)}**`);
    }

    if (command === "rob") {
      const target = message.mentions.users.first();
      if (!target || target.bot || target.id === message.author.id) {
        return reply(message, "Uso incorrecto", "Usa `Mrob @usuario`.");
      }

      const wait = onCooldown(message.author.id, "rob", 120);
      if (wait) return reply(message, "Espera", `Prueba otra vez en **${wait} segundos**.`);

      const victim = getUser(target.id);
      if (victim.wallet < 100) return reply(message, "Robo imposible", "Ese usuario no tiene suficiente dinero en la cartera.");

      if (Math.random() < 0.45) {
        const amount = Math.min(victim.wallet, Math.floor(Math.random() * 201) + 50);
        victim.wallet -= amount;
        user.wallet += amount;
        save();
        return reply(message, "¡Robo exitoso!", `Conseguiste **${money(amount)}** de ${target}.`);
      }

      const fine = Math.min(user.wallet, Math.floor(Math.random() * 151) + 50);
      user.wallet -= fine;
      save();
      return reply(message, "¡Te atraparon!", `Fallaste y pagaste una multa de **${money(fine)}**.`);
    }

    if (command === "pay") {
      const target = message.mentions.users.first();
      const amount = Number(args[1]);

      if (!target || target.bot || target.id === message.author.id ||
          !Number.isSafeInteger(amount) || amount <= 0) {
        return reply(message, "Uso incorrecto", "Usa `Mpay @usuario cantidad`.");
      }
      if (user.wallet < amount) return reply(message, "Saldo insuficiente", "No tienes suficiente dinero en la cartera.");

      user.wallet -= amount;
      getUser(target.id).wallet += amount;
      save();
      return reply(message, "Transferencia completada",
        `${message.author} envió **${money(amount)}** a ${target}.`);
    }

    if (command === "dep" || command === "deposit") {
      const amount = parseAmount(args[0], user.wallet);
      if (amount === null || amount === 0) {
        return reply(message, "Uso incorrecto", "Usa `Mdep all` o `Mdep cantidad`.");
      }

      user.wallet -= amount;
      user.bank += amount;
      save();
      return reply(message, "Depósito realizado", `Depositaste **${money(amount)}**.`);
    }

    if (command === "with" || command === "withdraw") {
      const amount = parseAmount(args[0], user.bank);
      if (amount === null || amount === 0) {
        return reply(message, "Uso incorrecto", "Usa `Mwith all` o `Mwith cantidad`.");
      }

      user.bank -= amount;
      user.wallet += amount;
      save();
      return reply(message, "Retiro realizado", `Retiraste **${money(amount)}**.`);
    }

    if (command === "bj") {
      const amount = parseAmount(args[0], user.wallet);
      if (amount === null || amount === 0) {
        return reply(message, "Uso incorrecto", "Usa `Mbj all` o `Mbj cantidad`.");
      }

      user.wallet -= amount;

      // Minijuego sencillo de azar inspirado en blackjack.
      const playerScore = Math.floor(Math.random() * 10) + 12;
      const dealerScore = Math.floor(Math.random() * 10) + 12;
      let result;

      if (playerScore > dealerScore) {
        const winnings = amount * 2;
        user.wallet += winnings;
        result = `¡Ganaste **${money(amount)}**!`;
      } else if (playerScore === dealerScore) {
        user.wallet += amount;
        result = "¡Empate! Recuperaste tu apuesta.";
      } else {
        result = `Perdiste **${money(amount)}**.`;
      }

      save();
      return reply(message, "Blackjack 🌸",
        `Tu puntuación: **${playerScore}**\nBanca: **${dealerScore}**\n${result}\nCartera: **${money(user.wallet)}**`);
    }

    if (command === "daily") {
      const wait = onCooldown(message.author.id, "daily", 86400);
      if (wait) return reply(message, "Recompensa diaria", `Vuelve en **${Math.ceil(wait / 3600)} horas**.`);

      const amount = 500;
      user.wallet += amount;
      save();
      return reply(message, "Recompensa diaria 🌸", `Recibiste **${money(amount)}**.`);
    }

    // ================ TIENDA E INVENTARIO ================

    const shop = {
      rosa: { price: 100, description: "Una rosa para regalar." },
      pastel: { price: 250, description: "Un pastel delicioso." },
      amuleto: { price: 500, description: "Un amuleto decorativo." }
    };

    if (command === "shop") {
      const listing = Object.entries(shop)
        .map(([name, item]) => `**${name}** — ${money(item.price)}\n${item.description}`)
        .join("\n\n");
      return reply(message, "Tienda de Akari", listing);
    }

    if (command === "buy") {
      const name = (args[0] || "").toLowerCase();
      const item = shop[name];
      if (!item) return reply(message, "Artículo desconocido", "Usa `Mshop` para ver los artículos.");
      if (user.wallet < item.price) return reply(message, "Saldo insuficiente", "No tienes suficiente dinero.");

      user.wallet -= item.price;
      user.inventory.push(name);
      save();
      return reply(message, "¡Compra realizada!", `Compraste **${name}** por **${money(item.price)}**.`);
    }

    if (command === "inventory" || command === "inv") {
      const counts = {};
      for (const item of user.inventory) counts[item] = (counts[item] || 0) + 1;
      const text = Object.keys(counts).length
        ? Object.entries(counts).map(([name, n]) => `**${name}** × ${n}`).join("\n")
        : "Tu inventario está vacío. Usa `Mshop`.";
      return reply(message, "Tu inventario 🛍️", text);
    }

    if (command === "sell") {
      const name = (args[0] || "").toLowerCase();
      const index = user.inventory.indexOf(name);
      if (index === -1 || !shop[name]) {
        return reply(message, "No tienes ese artículo", "Revisa tu inventario con `Minventory`.");
      }

      user.inventory.splice(index, 1);
      const amount = Math.floor(shop[name].price / 2);
      user.wallet += amount;
      save();
      return reply(message, "Artículo vendido", `Vendiste **${name}** por **${money(amount)}**.`);
    }

    if (command === "use") {
      const name = (args[0] || "").toLowerCase();
      const index = user.inventory.indexOf(name);
      if (index === -1) return reply(message, "Artículo no encontrado", "Revisa tu inventario.");

      user.inventory.splice(index, 1);
      save();
      return reply(message, "Artículo utilizado", `Usaste **${name}**. ¡Gracias por jugar! 🌸`);
    }

    // ================ DIVERSIÓN Y SOCIAL ================

    if (command === "coinflip") {
      return reply(message, "Cara o cruz", Math.random() < 0.5 ? "Salió **cara** 🌸" : "Salió **cruz** 🌸");
    }

    if (command === "dice") {
      return reply(message, "Dado 🎲", `Sacaste **${Math.floor(Math.random() * 6) + 1}**.`);
    }

    if (command === "guess") {
      const n = Number(args[0]);
      if (!Number.isInteger(n) || n < 1 || n > 5) {
        return reply(message, "Adivina el número", "Usa `Mguess 1` hasta `Mguess 5`.");
      }
      const secret = Math.floor(Math.random() * 5) + 1;
      return reply(message, "Adivinanza", n === secret ? "¡Acertaste! 🌸" : `No era ese. El número era **${secret}**.`);
    }

    if (command === "meme") {
      const memes = [
        "Yo diciendo que solo estaré cinco minutos en Discord… y amanece.",
        "Mi cartera después de entrar a la tienda: adiós, monedas.",
        "Cuando el bot responde justo cuando iba a cerrar Discord."
      ];
      return reply(message, "Meme de Akari", memes[Math.floor(Math.random() * memes.length)]);
    }

    if (["hug", "kiss", "friend"].includes(command)) {
      const target = message.mentions.users.first();
      if (!target || target.bot || target.id === message.author.id) {
        return reply(message, "Uso incorrecto", `Usa \`M${command} @usuario\`.`);
      }

      const text = {
        hug: `🤗 ${message.author} le manda un abrazo amistoso a ${target}.`,
        kiss: `🌸 ${message.author} le manda un beso ficticio y amistoso a ${target}.`,
        friend: `💗 ${message.author} quiere ser amigo/a de ${target}.`
      }[command];

      return reply(message, "Momento social", text);
    }

    if (command === "compat") {
      const target = message.mentions.users.first();
      if (!target || target.id === message.author.id) {
        return reply(message, "Uso incorrecto", "Usa `Mcompat @usuario`.");
      }
      const percentage = Math.floor(Math.random() * 101);
      return reply(message, "Compatibilidad 💗",
        `${message.author.username} + ${target.username}\nCompatibilidad de amistad: **${percentage}%**`);
    }

    if (command === "level" || command === "rank") {
      const target = message.mentions.users.first() || message.author;
      const u = getUser(target.id);
      const rank = Object.values(data.users)
        .filter(x => x && typeof x.xp === "number")
        .sort((a, b) => (b.level * 100 + b.xp) - (a.level * 100 + a.xp))
        .findIndex(x => x === u) + 1;

      return reply(message, `Nivel de ${target.username}`,
        `Nivel: **${u.level}**\nExperiencia: **${u.xp} XP**\nPosición aproximada: **#${rank || "?"}**`);
    }

    // ================ MADMIN Y CONFIGURACIÓN ================

    if (command === "admin") {
      if (!isAdmin(message)) {
        return reply(message, "Acceso denegado", "No tienes permiso para abrir `Madmin`.");
      }

      const option = (args[0] || "").toLowerCase();
      const value = args[1];
      const channel = message.mentions.channels.first();
      const enabled = value === "on";

      if (!option) {
        return message.reply({
          embeds: [
            embed("Panel administrativo 🌸",
              "Selecciona una sección. Los ajustes se cambian con los comandos indicados en el menú.")
          ],
          components: [adminMenu()]
        });
      }

      if (["welcome", "goodbye", "logs"].includes(option)) {
        const key = {
          welcome: "welcomeChannel",
          goodbye: "goodbyeChannel",
          logs: "logsChannel"
        }[option];

        if (value === "off") {
          settings[key] = null;
          save();
          return reply(message, "Configuración actualizada", `${option}: desactivado.`);
        }

        if (!channel || !channel.isTextBased()) {
          return reply(message, "Falta un canal", `Usa \`Madmin ${option} #canal\` o \`Madmin ${option} off\`.`);
        }

        settings[key] = channel.id;
        save();
        return reply(message, "Configuración actualizada", `${option}: ${channel}.`);
      }

      if (["antilink", "antispam"].includes(option)) {
        if (!["on", "off"].includes(value)) {
          return reply(message, "Uso incorrecto", `Usa \`Madmin ${option} on\` o \`Madmin ${option} off\`.`);
        }

        settings[option === "antilink" ? "antiLink" : "antiSpam"] = enabled;
        save();
        return reply(message, "Seguridad actualizada", `${option}: **${enabled ? "activado" : "desactivado"}**.`);
      }

      return reply(message, "Ajuste desconocido",
        "Opciones: `welcome`, `goodbye`, `logs`, `antilink`, `antispam`.");
    }

    if (["addadmin", "removeadmin", "listadmin"].includes(command)) {
      if (!isOwner(message)) {
        return reply(message, "Acceso denegado", "Solo el propietario configurado de Akari Bot puede gestionar los roles autorizados.");
      }

      if (command === "listadmin") {
        const roles = settings.admins.map(id => `<@&${id}>`).join("\n");
        return reply(message, "Roles autorizados", roles || "No hay roles adicionales autorizados.");
      }

      const role = message.mentions.roles.first();
      if (!role) {
        return reply(message, "Uso incorrecto", `Usa \`M${command} @rol\`.`);
      }

      if (command === "addadmin") {
        if (!settings.admins.includes(role.id)) settings.admins.push(role.id);
        save();
        return reply(message, "Rol autorizado", `${role} ya puede acceder a \`Madmin\` en este servidor.`);
      }

      settings.admins = settings.admins.filter(id => id !== role.id);
      save();
      return reply(message, "Rol eliminado", `${role} ya no tiene acceso adicional a \`Madmin\`.`);
    }

    // ================ MODERACIÓN ================

    if (["kick", "ban", "mute", "unmute", "warn", "clear"].includes(command)) {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator) &&
          !message.member.permissions.has(PermissionFlagsBits.ModerateMembers) &&
          !message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return reply(message, "Permiso insuficiente", "Necesitas permisos de moderación.");
      }

      if (command === "clear") {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
          return reply(message, "Permiso insuficiente", "Necesitas Gestionar mensajes.");
        }

        const amount = Number(args[0]);
        if (!Number.isInteger(amount) || amount < 1 || amount > 100) {
          return reply(message, "Uso incorrecto", "Usa `Mclear 1-100`.");
        }

        const deleted = await message.channel.bulkDelete(amount, true).catch(() => null);
        if (!deleted) return reply(message, "No se pudo borrar", "Discord no permitió borrar esos mensajes.");
        return reply(message, "Mensajes eliminados", `Se eliminaron **${deleted.size}** mensajes.`);
      }

      const target = message.mentions.members.first();
      if (!target) return reply(message, "Falta usuario", `Usa \`M${command} @usuario\`.`);
      if (target.id === message.author.id || target.id === OWNER_ID) {
        return reply(message, "Acción bloqueada", "No puedes aplicar esa acción a ese usuario.");
      }

      const reason = args.slice(1).join(" ") || "Sin razón indicada";

      if (command === "kick") {
        if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
          return reply(message, "Permiso insuficiente", "Necesitas Expulsar miembros.");
        }
        if (!target.kickable) return reply(message, "No se pudo expulsar", "Revisa la jerarquía de roles y permisos.");
        await target.kick(reason);
        await logAction(message.guild, `${target.user.tag} fue expulsado. Razón: ${reason}`);
        return reply(message, "Usuario expulsado", `${target.user.tag}\nRazón: ${reason}`);
      }

      if (command === "ban") {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
          return reply(message, "Permiso insuficiente", "Necesitas Banear miembros.");
        }
        if (!target.bannable) return reply(message, "No se pudo banear", "Revisa la jerarquía de roles y permisos.");
        await target.ban({ reason });
        await logAction(message.guild, `${target.user.tag} fue baneado. Razón: ${reason}`);
        return reply(message, "Usuario baneado", `${target.user.tag}\nRazón: ${reason}`);
      }

      if (command === "mute") {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
          return reply(message, "Permiso insuficiente", "Necesitas Moderar miembros.");
        }
        const minutes = Number(args[1]);
        if (!Number.isInteger(minutes) || minutes < 1 || minutes > 40320) {
          return reply(message, "Duración inválida", "Usa `Mmute @usuario minutos [razón]`.");
        }
        if (!target.moderatable) return reply(message, "No se pudo silenciar", "Revisa la jerarquía de roles.");
        await target.timeout(minutes * 60000, reason);
        await logAction(message.guild, `${target.user.tag} recibió timeout de ${minutes} minutos. ${reason}`);
        return reply(message, "Timeout aplicado", `${target.user.tag}: **${minutes} minutos**.`);
      }

      if (command === "unmute") {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
          return reply(message, "Permiso insuficiente", "Necesitas Moderar miembros.");
        }
        if (!target.moderatable) return reply(message, "No se pudo quitar", "Revisa la jerarquía de roles.");
        await target.timeout(null, reason);
        return reply(message, "Timeout eliminado", `Se quitó el timeout de ${target.user.tag}.`);
      }

      if (command === "warn") {
        const u = getUser(target.id);
        u.warnings++;
        save();
        await logAction(message.guild, `${target.user.tag} recibió una advertencia. Total: ${u.warnings}. Razón: ${reason}`);
        return reply(message, "Advertencia registrada", `${target.user.tag} tiene **${u.warnings}** advertencia(s).\nRazón: ${reason}`);
      }
    }

    // ================ TICKETS ================

    if (command === "ticket") {
      const existing = message.guild.channels.cache.find(
        c => c.type === ChannelType.GuildText &&
          c.name === `ticket-${message.author.id}`
      );

      if (existing) {
        return reply(message, "Ya tienes un ticket", `Puedes continuar aquí: ${existing}`);
      }

      const channel = await message.guild.channels.create({
        name: `ticket-${message.author.id}`,
        type: ChannelType.GuildText,
        topic: `Ticket de ${message.author.tag} (${message.author.id})`,
        permissionOverwrites: [
          { id: message.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: message.author.id, allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory
          ] },
          { id: client.user.id, allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ReadMessageHistory
          ] }
        ]
      }).catch(() => null);

      if (!channel) return reply(message, "Error al crear ticket", "Revisa los permisos del bot.");

      await channel.send({
        content: `${message.author}`,
        embeds: [embed("Ticket abierto 🎟️", "Describe tu consulta. El equipo de soporte te ayudará pronto.\nUsa `Mclose` para cerrar este ticket.")]
      });

      return reply(message, "Ticket creado", `Tu ticket está aquí: ${channel}`);
    }

    if (command === "close") {
      if (!message.channel.name.startsWith("ticket-")) {
        return reply(message, "Esto no es un ticket", "Usa `Mclose` dentro de tu canal de ticket.");
      }

      const ownerId = message.channel.name.slice("ticket-".length);
      if (message.author.id !== ownerId && !isAdmin(message)) {
        return reply(message, "Acceso denegado", "Solo quien abrió el ticket o el equipo autorizado puede cerrarlo.");
      }

      await reply(message, "Ticket cerrado", "Este canal se eliminará en unos segundos.");
      setTimeout(() => message.channel.delete("Ticket cerrado").catch(() => {}), 3000);
      return;
    }

    save();
  } catch (error) {
    console.error(`Error en M${command}:`, error);
    await message.reply({
      embeds: [embed("Ocurrió un error", "No pude completar esa acción. Revisa mis permisos y la consola de Render.")],
      allowedMentions: { repliedUser: false }
    }).catch(() => {});
  }
});

client.on("error", error => console.error("Discord client error:", error));
process.on("unhandledRejection", error => console.error("Promesa rechazada:", error));

client.login(TOKEN);
