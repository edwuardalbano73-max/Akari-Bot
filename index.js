
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
const http = require("node:http");

const TOKEN = process.env.DISCORD_TOKEN;
const OWNER_ID = process.env.BOT_OWNER_ID || "";
const PREFIX = "M";
const PINK = 0xff9dcc;
const DATA_FILE = "./akari-data.json";

if (!TOKEN) {
  console.error("Falta la variable DISCORD_TOKEN en Render.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel, Partials.GuildMember, Partials.User]
});

let db = {};
try {
  if (fs.existsSync(DATA_FILE)) {
    db = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  }
} catch (error) {
  console.error("No se pudo leer akari-data.json:", error.message);
  db = {};
}

function save() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
  } catch (error) {
    console.error("Error guardando datos:", error.message);
  }
}

function guildData(guildId) {
  if (!db[guildId]) {
    db[guildId] = {
      users: {},
      config: {
        welcome: null,
        goodbye: null,
        logs: null,
        antilink: false,
        antispam: false,
        tickets: null,
        ticketCategory: null
      },
      admins: []
    };
  }

  const g = db[guildId];
  g.users ||= {};
  g.config ||= {};
  g.admins ||= [];
  return g;
}

function userData(guildId, userId) {
  const g = guildData(guildId);
  if (!g.users[userId]) {
    g.users[userId] = {
      wallet: 0,
      bank: 0,
      lastDaily: 0,
      lastWork: 0,
      lastRob: 0,
      xp: 0,
      level: 0,
      warns: 0,
      inventory: {},
      lastMessage: 0,
      spamCount: 0
    };
  }

  const u = g.users[userId];
  u.wallet ??= 0;
  u.bank ??= 0;
  u.lastDaily ??= 0;
  u.lastWork ??= 0;
  u.lastRob ??= 0;
  u.xp ??= 0;
  u.level ??= 0;
  u.warns ??= 0;
  u.inventory ||= {};
  return u;
}

function embed(title, description = "") {
  return new EmbedBuilder()
    .setColor(PINK)
    .setTitle(`🌸 ${title}`)
    .setDescription(description)
    .setTimestamp();
}

async function reply(message, title, description) {
  return message.reply({ embeds: [embed(title, description)] });
}

function isAdmin(member) {
  return Boolean(
    member &&
    (member.permissions.has(PermissionFlagsBits.Administrator) ||
      member.permissions.has(PermissionFlagsBits.ManageGuild) ||
      member.id === OWNER_ID ||
      guildData(member.guild.id).admins.includes(member.id))
  );
}

function isModerator(member) {
  return Boolean(
    member &&
    (isAdmin(member) ||
      member.permissions.has(PermissionFlagsBits.ModerateMembers) ||
      member.permissions.has(PermissionFlagsBits.KickMembers) ||
      member.permissions.has(PermissionFlagsBits.BanMembers))
  );
}

async function sendLog(guild, text) {
  const id = guildData(guild.id).config.logs;
  if (!id) return;

  const channel = guild.channels.cache.get(id);
  if (!channel || !channel.isTextBased()) return;

  try {
    await channel.send({ embeds: [embed("Registro", text)] });
  } catch (error) {
    console.error("No se pudo enviar el registro:", error.message);
  }
}

function duration(ms) {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds} segundos`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} minutos`;
  return `${Math.ceil(seconds / 3600)} horas`;
}

function getTarget(message, args) {
  return message.mentions.members.first() ||
    message.guild.members.cache.get(args[0]) ||
    null;
}

const cooldowns = new Map();
const recentMessages = new Map();

client.once("ready", () => {
  console.log(`Akari Bot conectado como ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: "Akari Community 🌸" }],
    status: "online"
  });
});

client.on("guildMemberAdd", async member => {
  const cfg = guildData(member.guild.id).config;
  if (!cfg.welcome) return;

  const channel = member.guild.channels.cache.get(cfg.welcome);
  if (!channel || !channel.isTextBased()) return;

  try {
    await channel.send({
      embeds: [
        embed(
          "¡Bienvenido/a a Akari Community!",
          `¡Hola ${member}! 🌸\nEsperamos que disfrutes tu estancia en **${member.guild.name}**.\nAhora somos **${member.guild.memberCount}** miembros.`
        ).setThumbnail(member.user.displayAvatarURL())
      ]
    });
  } catch (error) {
    console.error("Error de bienvenida:", error.message);
  }
});

client.on("guildMemberRemove", async member => {
  const cfg = guildData(member.guild.id).config;
  if (!cfg.goodbye) return;

  const channel = member.guild.channels.cache.get(cfg.goodbye);
  if (!channel || !channel.isTextBased()) return;

  try {
    await channel.send({
      embeds: [
        embed(
          "Hasta pronto",
          `**${member.user.tag}** ha salido del servidor. 🌷`
        )
      ]
    });
  } catch (error) {
    console.error("Error de despedida:", error.message);
  }
});

const helpOptions = [
  { label: "General", value: "general", emoji: "🌸", description: "Información y utilidades" },
  { label: "Economía", value: "economy", emoji: "💰", description: "Dinero y banco" },
  { label: "Tienda", value: "shop", emoji: "🛍️", description: "Comprar y vender" },
  { label: "Diversión", value: "fun", emoji: "🎮", description: "Juegos y entretenimiento" },
  { label: "Social", value: "social", emoji: "💕", description: "Comandos sociales" },
  { label: "Niveles", value: "levels", emoji: "⭐", description: "XP y experiencia" },
  { label: "Moderación", value: "mod", emoji: "🛡️", description: "Herramientas del equipo" },
  { label: "Tickets", value: "tickets", emoji: "🎫", description: "Ayuda y soporte" }
];

const helpTexts = {
  general:
    "`Mhelp` — panel de ayuda\n`Mping` — latencia\n`Mbot` — información del bot\n`Mserver` — información del servidor\n`Mavatar [@usuario]` — avatar\n`Mprofile [@usuario]` — perfil",
  economy:
    "`Mbal` — saldo\n`Mbank` — saldo del banco\n`Mwork` — trabajar\n`Mdaily` — recompensa diaria\n`Mrob @usuario` — intentar robar\n`Mdep cantidad` — depositar\n`Mwith cantidad` — retirar\n`Mpay @usuario cantidad` — transferir",
  shop:
    "`Mshop` — catálogo\n`Mbuy artículo` — comprar\n`Minv` — inventario\n`Msell artículo` — vender\n`Muse artículo` — usar artículo",
  fun:
    "`Mcoinflip` — cara o cruz\n`Mdice` — lanzar dado\n`Mguess número` — adivinar del 1 al 5\n`Mmeme` — meme aleatorio",
  social:
    "`Mhug @usuario` — abrazo amistoso\n`Mkiss @usuario` — gesto amistoso\n`Mfriend @usuario` — amistad\n`Mcompat @usuario` — compatibilidad aleatoria",
  levels:
    "`Mlevel [@usuario]` — nivel\n`Mrank` — clasificación de experiencia",
  mod:
    "`Mkick @usuario [motivo]`\n`Mban @usuario [motivo]`\n`Mmute @usuario minutos [motivo]`\n`Munmute @usuario`\n`Mwarn @usuario [motivo]`\n`Mclear cantidad`",
  tickets:
    "`Mticket` — abrir ticket\n`Mclose` — cerrar ticket actual"
};

function helpEmbed(category = "general") {
  const selected = helpOptions.find(o => o.value === category) || helpOptions[0];
  return embed(`Ayuda • ${selected.label}`, helpTexts[selected.value]);
}

function helpMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("akari_help")
      .setPlaceholder("Selecciona una categoría 🌸")
      .addOptions(helpOptions)
  );
}

client.on("interactionCreate", async interaction => {
  try {
    if (!interaction.isStringSelectMenu()) return;

    if (interaction.customId === "akari_help") {
      await interaction.update({
        embeds: [helpEmbed(interaction.values[0])],
        components: [helpMenu()]
      });
    }
  } catch (error) {
    console.error("Error de interacción:", error.message);
    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({
          content: "Ocurrió un error con esta interacción.",
          ephemeral: true
        });
      } catch {}
    }
  }
});

client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot) return;

  const g = guildData(message.guild.id);
  const u = userData(message.guild.id, message.author.id);
  const content = message.content.trim();
  const parts = content.split(/\s+/);
  const command = (parts.shift() || "").toLowerCase();
  const args = parts;
  const cfg = g.config;

  // XP por mensajes
  if (content.length > 2) {
    u.xp += Math.floor(Math.random() * 6) + 5;
    const needed = (u.level + 1) * 100;

    if (u.xp >= needed) {
      u.xp -= needed;
      u.level++;
      message.channel.send({
        embeds: [
          embed("¡Subiste de nivel!", `${message.author} ahora es nivel **${u.level}**. ⭐`)
        ]
      }).catch(() => {});
    }
  }

  // Antispam sencillo
  if (cfg.antispam) {
    const key = `${message.guild.id}:${message.author.id}`;
    const now = Date.now();
    const recent = recentMessages.get(key) || [];
    recent.push(now);
    const fresh = recent.filter(t => now - t < 5000);
    recentMessages.set(key, fresh);

    if (fresh.length > 6 && !isModerator(message.member)) {
      try {
        await message.delete();
        await message.member.timeout(60_000, "Antispam automático");
        await message.channel.send(`${message.author}, evita enviar demasiados mensajes seguidos.`)
          .then(m => setTimeout(() => m.delete().catch(() => {}), 5000))
          .catch(() => {});
      } catch (error) {
        console.error("Error antispam:", error.message);
      }
      return;
    }
  }

  // Antilink básico
  if (
    cfg.antilink &&
    /(https?:\/\/|discord\.gg\/|www\.)/i.test(content) &&
    !isModerator(message.member)
  ) {
    try {
      await message.delete();
      await message.channel.send(`${message.author}, no se permiten enlaces aquí.`)
        .then(m => setTimeout(() => m.delete().catch(() => {}), 5000))
        .catch(() => {});
      await sendLog(message.guild, `Enlace bloqueado de ${message.author.tag}.`);
    } catch (error) {
      console.error("Error antilink:", error.message);
    }
    return;
  }

  if (!command.startsWith(PREFIX.toLowerCase())) {
    save();
    return;
  }

  const name = command.slice(PREFIX.length);
  const now = Date.now();

  try {
    switch (name) {
      case "help": {
        await message.reply({
          embeds: [helpEmbed()],
          components: [helpMenu()]
        });
        break;
      }

      case "ping":
        await reply(message, "Pong!", `Latencia: **${client.ws.ping} ms**`);
        break;

      case "bot":
        await reply(
          message,
          "Akari Bot",
          `Bot rosa de Akari Community 🌸\nServidores: **${client.guilds.cache.size}**\nUsuarios visibles: **${client.guilds.cache.reduce((n, guild) => n + guild.memberCount, 0)}**`
        );
        break;

      case "server":
        await reply(
          message,
          message.guild.name,
          `Miembros: **${message.guild.memberCount}**\nCanales: **${message.guild.channels.cache.size}**\nCreado: <t:${Math.floor(message.guild.createdTimestamp / 1000)}:D>`
        );
        break;

      case "avatar": {
        const member = message.mentions.users.first() ||
          await client.users.fetch(args[0]).catch(() => null) ||
          message.author;
        await message.reply({
          embeds: [
            embed(`Avatar de ${member.username}`)
              .setImage(member.displayAvatarURL({ size: 1024 }))
          ]
        });
        break;
      }

      case "profile": {
        const member = message.mentions.members.first() || message.member;
        const data = userData(message.guild.id, member.id);
        await reply(
          message,
          `Perfil de ${member.user.username}`,
          `Nivel: **${data.level}**\nXP: **${data.xp}**\nCartera: **${data.wallet} monedas**\nBanco: **${data.bank} monedas**`
        );
        break;
      }

      case "bal":
      case "balance":
        await reply(
          message,
          "Tu saldo",
          `Cartera: **${u.wallet} monedas** 💵\nBanco: **${u.bank} monedas** 🏦`
        );
        break;

      case "bank":
        await reply(message, "Banco", `Tienes **${u.bank} monedas** guardadas.`);
        break;

      case "work": {
        const key = `${message.author.id}:work`;
        const left = (cooldowns.get(key) || 0) - now;
        if (left > 0) {
          await reply(message, "Espera un poco", `Podrás trabajar en **${duration(left)}**.`);
          break;
        }
        const earned = Math.floor(Math.random() * 201) + 100;
        u.wallet += earned;
        cooldowns.set(key, now + 30_000);
        await reply(message, "Trabajo completado", `Ganaste **${earned} monedas**. 💰`);
        break;
      }

      case "daily": {
        const wait = 24 * 60 * 60 * 1000;
        const left = u.lastDaily + wait - now;
        if (u.lastDaily && left > 0) {
          await reply(message, "Recompensa diaria", `Vuelve en **${duration(left)}**.`);
          break;
        }
        u.lastDaily = now;
        u.wallet += 500;
        await reply(message, "Recompensa diaria", "Recibiste **500 monedas**. 🌸");
        break;
      }

      case "dep":
      case "deposit": {
        const amount = Number(args[0]);
        if (!Number.isInteger(amount) || amount <= 0) {
          await reply(message, "Cantidad inválida", "Usa `Mdep cantidad`.");
          break;
        }
        if (u.wallet < amount) {
          await reply(message, "Saldo insuficiente", "No tienes suficiente dinero en tu cartera.");
          break;
        }
        u.wallet -= amount;
        u.bank += amount;
        await reply(message, "Depósito realizado", `Depositaste **${amount} monedas**.`);
        break;
      }

      case "with":
      case "withdraw": {
        const amount = Number(args[0]);
        if (!Number.isInteger(amount) || amount <= 0) {
          await reply(message, "Cantidad inválida", "Usa `Mwith cantidad`.");
          break;
        }
        if (u.bank < amount) {
          await reply(message, "Saldo insuficiente", "No tienes suficiente dinero en el banco.");
          break;
        }
        u.bank -= amount;
        u.wallet += amount;
        await reply(message, "Retiro realizado", `Retiraste **${amount} monedas**.`);
        break;
      }

      case "pay": {
        const target = message.mentions.users.first();
        const amount = Number(args.find(a => /^\d+$/.test(a)));
        if (!target || target.bot || target.id === message.author.id ||
            !Number.isInteger(amount) || amount <= 0) {
          await reply(message, "Uso incorrecto", "Usa `Mpay @usuario cantidad`.");
          break;
        }
        if (u.wallet < amount) {
          await reply(message, "Saldo insuficiente", "No tienes suficiente dinero.");
          break;
        }
        const receiver = userData(message.guild.id, target.id);
        u.wallet -= amount;
        receiver.wallet += amount;
        await reply(message, "Transferencia completada", `Enviaste **${amount} monedas** a ${target}.`);
        break;
      }

      case "rob": {
        const target = message.mentions.users.first();
        const key = `${message.author.id}:rob`;
        const left = (cooldowns.get(key) || 0) - now;
        if (left > 0) {
          await reply(message, "Espera", `Inténtalo de nuevo en **${duration(left)}**.`);
          break;
        }
        if (!target || target.bot || target.id === message.author.id) {
          await reply(message, "Uso incorrecto", "Usa `Mrob @usuario`.");
          break;
        }
        const victim = userData(message.guild.id, target.id);
        cooldowns.set(key, now + 120_000);
        if (victim.wallet < 100) {
          await reply(message, "Robo fallido", "Esa persona no tiene suficiente dinero en su cartera.");
          break;
        }
        if (Math.random() < 0.3) {
          const stolen = Math.min(victim.wallet, Math.floor(Math.random() * 201) + 100);
          victim.wallet -= stolen;
          u.wallet += stolen;
          await reply(message, "¡Lo lograste!", `Conseguiste **${stolen} monedas** de ${target}.`);
        } else {
          const fine = Math.min(u.wallet, 100);
          u.wallet -= fine;
          await reply(message, "Te atraparon", `Fallaste y pagaste una multa de **${fine} monedas**.`);
        }
        break;
      }

      case "shop":
        await reply(
          message,
          "Tienda de Akari",
          "`flor` — 100 monedas\n`corazon` — 250 monedas\n`cristal` — 500 monedas\n\nCompra con `Mbuy artículo`."
        );
        break;

      case "buy": {
        const item = (args[0] || "").toLowerCase();
        const prices = { flor: 100, corazon: 250, cristal: 500 };
        if (!prices[item]) {
          await reply(message, "Artículo no encontrado", "Usa `Mshop` para ver los artículos.");
          break;
        }
        if (u.wallet < prices[item]) {
          await reply(message, "Saldo insuficiente", "No tienes suficientes monedas.");
          break;
        }
        u.wallet -= prices[item];
        u.inventory[item] = (u.inventory[item] || 0) + 1;
        await reply(message, "Compra completada", `Compraste **${item}**. 🌸`);
        break;
      }

      case "inv":
      case "inventory": {
        const items = Object.entries(u.inventory)
          .filter(([, count]) => count > 0)
          .map(([item, count]) => `• **${item}** x${count}`);
        await reply(message, "Inventario", items.length ? items.join("\n") : "Tu inventario está vacío.");
        break;
      }

      case "sell": {
        const item = (args[0] || "").toLowerCase();
        const values = { flor: 50, corazon: 125, cristal: 250 };
        if (!values[item] || !u.inventory[item]) {
          await reply(message, "No puedes venderlo", "No tienes ese artículo. Revisa `Minv`.");
          break;
        }
        u.inventory[item]--;
        u.wallet += values[item];
        await reply(message, "Venta completada", `Vendiste **${item}** por **${values[item]} monedas**.`);
        break;
      }

      case "use": {
        const item = (args[0] || "").toLowerCase();
        if (!u.inventory[item] || !["flor", "corazon", "cristal"].includes(item)) {
          await reply(message, "Artículo no disponible", "No tienes ese artículo.");
          break;
        }
        u.inventory[item]--;
        await reply(message, "Artículo utilizado", `Has utilizado **${item}**. 🌷`);
        break;
      }

      case "coinflip":
        await reply(message, "Cara o cruz", Math.random() < 0.5 ? "Salió **cara**. 🪙" : "Salió **cruz**. 🪙");
        break;

      case "dice":
        await reply(message, "Dado", `Salió el número **${Math.floor(Math.random() * 6) + 1}**. 🎲`);
        break;

      case "guess": {
        const guess = Number(args[0]);
        if (!Number.isInteger(guess) || guess < 1 || guess > 5) {
          await reply(message, "Adivina", "Usa `Mguess` seguido de un número del 1 al 5.");
          break;
        }
        const answer = Math.floor(Math.random() * 5) + 1;
        await reply(message, "Adivina el número", guess === answer ? `¡Correcto! Era **${answer}**. 🎉` : `Era **${answer}**. ¡Inténtalo otra vez!`);
        break;
      }

      case "meme":
        await reply(message, "Meme", "No tengo una galería de memes configurada todavía. 🌸");
        break;

      case "hug":
      case "kiss":
      case "friend":
      case "compat": {
        const target = message.mentions.users.first();
        if (!target || target.id === message.author.id || target.bot) {
          await reply(message, "Uso incorrecto", `Menciona a alguien: \`M${name} @usuario\`.`);
          break;
        }
        const texts = {
          hug: `${message.author} le manda un abrazo amistoso a ${target}. 🤗`,
          kiss: `${message.author} le envía un saludo cariñoso a ${target}. 💕`,
          friend: `${message.author} quiere ser amigo/a de ${target}. 🌸`,
          compat: `La compatibilidad amistosa entre ${message.author} y ${target} es **${Math.floor(Math.random() * 101)}%**.`
        };
        await reply(message, "Social", texts[name]);
        break;
      }

      case "level": {
        const target = message.mentions.users.first() || message.author;
        const data = userData(message.guild.id, target.id);
        await reply(message, `Nivel de ${target.username}`, `Nivel: **${data.level}**\nXP: **${data.xp}/${(data.level + 1) * 100}**`);
        break;
      }

      case "rank": {
        const ranking = Object.entries(g.users)
          .sort((a, b) => (b[1].level * 100 + b[1].xp) - (a[1].level * 100 + a[1].xp))
          .slice(0, 10);
        const lines = ranking.map(([id, data], i) =>
          `**${i + 1}.** <@${id}> — nivel ${data.level}, ${data.xp} XP`
        );
        await reply(message, "Clasificación", lines.join("\n") || "Aún no hay niveles.");
        break;
      }

      case "welcome":
      case "goodbye":
      case "logs": {
        if (!isAdmin(message.member)) {
          await reply(message, "Sin permiso", "Necesitas permisos de administración para usar este comando.");
          break;
        }
        const channel = message.mentions.channels.first();
        const value = (args[0] || "").toLowerCase();
        const key = name === "welcome" ? "welcome" : name === "goodbye" ? "goodbye" : "logs";

        if (value === "off" || value === "desactivar") {
          cfg[key] = null;
          save();
          await reply(message, "Configuración actualizada", `Se desactivó **${key}**.`);
          break;
        }

        if (!channel || channel.type !== ChannelType.GuildText) {
          await reply(message, "Canal inválido", `Usa \`M${name} #canal\` o \`M${name} off\`.`);
          break;
        }
        cfg[key] = channel.id;
        save();
        await reply(message, "Configuración actualizada", `**${key}** se enviará en ${channel}.`);
        break;
      }

      case "antilink":
      case "antispam": {
        if (!isAdmin(message.member)) {
          await reply(message, "Sin permiso", "Necesitas permisos de administración.");
          break;
        }
        const value = (args[0] || "").toLowerCase();
        if (!["on", "off", "activar", "desactivar"].includes(value)) {
          await reply(message, "Uso", `Usa \`M${name} on\` o \`M${name} off\`.`);
          break;
        }
        cfg[name] = value === "on" || value === "activar";
        save();
        await reply(message, "Configuración actualizada", `${name} está **${cfg[name] ? "activado" : "desactivado"}**.`);
        break;
      }

      case "admin": {
        if (!isAdmin(message.member)) {
          await reply(message, "Sin permiso", "Solo el equipo de administración puede usar este panel.");
          break;
        }

        const section = (args[0] || "").toLowerCase();
        if (!section) {
          const menu = new StringSelectMenuBuilder()
            .setCustomId("akari_help")
            .setPlaceholder("Consulta las categorías de ayuda")
            .addOptions(helpOptions);
          await message.reply({
            embeds: [
              embed(
                "Panel de administración",
                "Configuración disponible:\n`Mwelcome #canal/off`\n`Mgoodbye #canal/off`\n`Mlogs #canal/off`\n`Mantilink on/off`\n`Mantispam on/off`\n`Maddadmin @usuario`\n`Mremoveadmin @usuario`\n`Mlistadmin`\n\nModeración: `Mkick`, `Mban`, `Mmute`, `Munmute`, `Mwarn`, `Mclear`"
              )
            ],
            components: [new ActionRowBuilder().addComponents(menu)]
          });
          break;
        }

        if (section === "welcome" || section === "goodbye" || section === "logs") {
          const channel = message.mentions.channels.first();
          const key = section;
          if ((args[1] || "").toLowerCase() === "off") {
            cfg[key] = null;
          } else if (channel && channel.type === ChannelType.GuildText) {
            cfg[key] = channel.id;
          } else {
            await reply(message, "Uso", `Madmin ${section} #canal o Madmin ${section} off`);
            break;
          }
          save();
          await reply(message, "Configuración guardada", `${section}: ${cfg[key] ? `<#${cfg[key]}>` : "desactivado"}`);
          break;
        }

        if (section === "antilink" || section === "antispam") {
          const value = (args[1] || "").toLowerCase();
          if (!["on", "off"].includes(value)) {
            await reply(message, "Uso", `Madmin ${section} on/off`);
            break;
          }
          cfg[section] = value === "on";
          save();
          await reply(message, "Configuración guardada", `${section}: **${value}**`);
          break;
        }

        await reply(message, "Opción desconocida", "Usa `Madmin` para ver las opciones.");
        break;
      }

      case "addadmin":
      case "removeadmin": {
        if (!isAdmin(message.member)) {
          await reply(message, "Sin permiso", "Necesitas permisos de administración.");
          break;
        }
        const target = message.mentions.users.first();
        if (!target) {
          await reply(message, "Uso", `Usa \`M${name} @usuario\`.`);
          break;
        }
        if (target.id === OWNER_ID) {
          await reply(message, "Acción no permitida", "No puedes modificar al propietario configurado.");
          break;
        }
        if (name === "addadmin") {
          if (!g.admins.includes(target.id)) g.admins.push(target.id);
        } else {
          g.admins = g.admins.filter(id => id !== target.id);
        }
        save();
        await reply(message, "Administradores", `${target} ${name === "addadmin" ? "añadido/a a" : "eliminado/a de"} la lista.`);
        break;
      }

      case "listadmin":
        if (!isAdmin(message.member)) {
          await reply(message, "Sin permiso", "Necesitas permisos de administración.");
          break;
        }
        await reply(message, "Administradores", g.admins.length ? g.admins.map(id => `<@${id}>`).join("\n") : "No hay administradores añadidos.");
        break;

      case "kick":
      case "ban": {
        if (!isModerator(message.member)) {
          await reply(message, "Sin permiso", "Necesitas permisos de moderación.");
          break;
        }
        const target = getTarget(message, args);
        const reason = args.slice(target && message.mentions.members.first() ? 1 : target ? 1 : 0).join(" ") || "Sin motivo especificado";

        if (!target) {
          await reply(message, "Uso incorrecto", `Usa \`M${name} @usuario motivo\`.`);
          break;
        }
        if (target.id === message.author.id || target.id === client.user.id ||
            target.id === OWNER_ID || !target.manageable) {
          await reply(message, "Acción no permitida", "No puedo moderar a ese miembro por permisos o jerarquía de roles.");
          break;
        }

        if (name === "kick") {
          await target.kick(reason);
        } else {
          if (!target.bannable) {
            await reply(message, "Sin permiso", "Mi rol no puede expulsar permanentemente a ese miembro.");
            break;
          }
          await target.ban({ reason });
        }
        await reply(message, "Moderación completada", `${target.user.tag} fue ${name === "kick" ? "expulsado/a" : "baneado/a"}.\nMotivo: ${reason}`);
        await sendLog(message.guild, `${name}: ${target.user.tag}. Motivo: ${reason}`);
        break;
      }

      case "mute": {
        if (!isModerator(message.member)) {
          await reply(message, "Sin permiso", "Necesitas permisos de moderación.");
          break;
        }
        const target = getTarget(message, args);
        const durationArg = args.find(a => /^\d+$/.test(a));
        const minutes = Number(durationArg);
        if (!target || !Number.isInteger(minutes) || minutes < 1 || minutes > 40320) {
          await reply(message, "Uso incorrecto", "Usa `Mmute @usuario minutos motivo` (máximo 28 días).");
          break;
        }
        if (target.id === message.author.id || target.id === OWNER_ID || !target.moderatable) {
          await reply(message, "Acción no permitida", "No puedo aplicar timeout a ese miembro.");
          break;
        }
        const reason = args.filter(a => a !== durationArg && !/^<@!?\d+>$/.test(a)).join(" ") || "Sin motivo";
        await target.timeout(minutes * 60_000, reason);
        await reply(message, "Timeout aplicado", `${target.user.tag} tendrá timeout por **${minutes} minutos**.`);
        await sendLog(message.guild, `Timeout: ${target.user.tag}, ${minutes} minutos. ${reason}`);
        break;
      }

      case "unmute": {
        if (!isModerator(message.member)) {
          await reply(message, "Sin permiso", "Necesitas permisos de moderación.");
          break;
        }
        const target = getTarget(message, args);
        if (!target) {
          await reply(message, "Uso", "Usa `Munmute @usuario`.");
          break;
        }
        if (!target.moderatable) {
          await reply(message, "Sin permiso", "No puedo quitarle el timeout a ese miembro.");
          break;
        }
        await target.timeout(null, "Timeout retirado por moderación");
        await reply(message, "Timeout retirado", `Se retiró el timeout de ${target.user.tag}.`);
        break;
      }

      case "warn": {
        if (!isModerator(message.member)) {
          await reply(message, "Sin permiso", "Necesitas permisos de moderación.");
          break;
        }
        const target = getTarget(message, args);
        if (!target || target.id === message.author.id || target.user.bot) {
          await reply(message, "Uso", "Usa `Mwarn @usuario motivo`.");
          break;
        }
        const data = userData(message.guild.id, target.id);
        data.warns++;
        const reason = args.filter(a => !/^<@!?\d+>$/.test(a)).join(" ") || "Sin motivo";
        await reply(message, "Advertencia", `${target.user.tag} recibió una advertencia (**${data.warns}**).\nMotivo: ${reason}`);
        await sendLog(message.guild, `Advertencia para ${target.user.tag}: ${reason}. Total: ${data.warns}`);
        break;
      }

      case "clear": {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
          await reply(message, "Sin permiso", "Necesitas el permiso Gestionar mensajes.");
          break;
        }
        const amount = Number(args[0]);
        if (!Number.isInteger(amount) || amount < 1 || amount > 100) {
          await reply(message, "Cantidad inválida", "Usa `Mclear 1-100`.");
          break;
        }
        const deleted = await message.channel.bulkDelete(amount + 1, true);
        const notice = await message.channel.send(`🌸 Se eliminaron ${Math.max(0, deleted.size - 1)} mensajes.`);
        setTimeout(() => notice.delete().catch(() => {}), 4000);
        break;
      }

      case "ticket": {
        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
          await reply(message, "Permiso faltante", "Necesito el permiso Gestionar canales.");
          break;
        }

        const existing = message.guild.channels.cache.find(
          c => c.type === ChannelType.GuildText &&
            c.topic === `Akari ticket owner:${message.author.id}`
        );
        if (existing) {
          await reply(message, "Ticket existente", `Ya tienes un ticket abierto: ${existing}`);
          break;
        }

        const channel = await message.guild.channels.create({
          name: `ticket-${message.author.username}`.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 90),
          type: ChannelType.GuildText,
          topic: `Akari ticket owner:${message.author.id}`,
          permissionOverwrites: [
            { id: message.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            {
              id: message.author.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory
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

        await channel.send({
          content: `${message.author}`,
          embeds: [embed("Ticket abierto", "Explica tu consulta y el equipo de Akari te ayudará.\nCierra el ticket con `Mclose`.")]
        });
        await reply(message, "Ticket creado", `Tu ticket está aquí: ${channel}`);
        break;
      }

      case "close": {
        const channel = message.channel;
        if (
          channel.type !== ChannelType.GuildText ||
          !channel.topic?.startsWith("Akari ticket owner:")
        ) {
          await reply(message, "No es un ticket", "Este comando solo funciona dentro de un ticket.");
          break;
        }
        const ownerId = channel.topic.split("owner:")[1];
        if (message.author.id !== ownerId && !isModerator(message.member)) {
          await reply(message, "Sin permiso", "Solo quien abrió el ticket o un moderador puede cerrarlo.");
          break;
        }
        await reply(message, "Ticket cerrado", "Este canal se eliminará en 3 segundos.");
        setTimeout(() => channel.delete("Ticket cerrado").catch(() => {}), 3000);
        break;
      }

      default:
        // Los comandos inexistentes no generan spam.
        break;
    }
  } catch (error) {
    console.error(`Error en M${name}:`, error);
    try {
      await message.reply({
        embeds: [
          embed("Error del comando", "No pude completar esta acción. Revisa los permisos del bot y los registros de Render.")
        ]
      });
    } catch {}
  } finally {
    save();
  }
});

// Servidor HTTP para que Render detecte el puerto.
const PORT = Number(process.env.PORT) || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Akari Bot está funcionando 🌸");
}).listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor HTTP activo en el puerto ${PORT}`);
});

client.login(TOKEN).catch(error => {
  console.error("No se pudo iniciar sesión en Discord:", error);
  process.exit(1);
});
