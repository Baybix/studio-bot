require('./keep_alive');
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType, SlashCommandBuilder, REST, Routes } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel]
});

// ─── CONFIG ─────────────────────────────────────────────────────────────────
const CONFIG = {
  TOKEN: process.env.TOKEN,
  CLIENT_ID: '1491618085340315688',
  GUILD_ID: '1491620151538352282',

  // IDs des salons (à remplir après création du serveur)
  CHANNELS: {
    ANNONCES: '1491620679919997048',
    TARIFS: '1491620729551327313',
    EXEMPLES: '1491620753030910055',
    REGLES: '1491620704892883004',
    TICKETS: '1491620840691863635',          // Salon où le bouton ouvre un ticket
    TICKET_CATEGORY: '1491620414596845629', // Catégorie où les tickets s'ouvrent
    LOGS: '1491620861948723295',
  },

  // IDs des rôles
  ROLES: {
    MEMBRE: '1491621069474238494',             // Rôle donné auto à l'arrivée
    ADMIN: '1491621115922092092',
    CLIENT: '1491621155776364644',             // Rôle donné quand ticket fermé avec commande
  },

  // Infos du studio
  STUDIO: {
    NOM: 'BayaneMIX',
    COULEUR: '#FF6B35',                   // Couleur des embeds (change selon ta charte)
    INSTAGRAM: 'https://www.instagram.com/byane_b/?hl=fr',
    EMAIL: 'enayebmusicpro@email.com',
  }
};

// ─── TARIFS ─────────────────────────────────────────────────────────────────
const TARIFS = [
  {
    service: '🎚️ Mix Standard',
    prix: '60€',
    details: 'Mix complet · Révisions illimitées · Livraison sous 72h',
    couleur: '#FF6B35'
  },
  {
    service: '🎛️ Mix + Mastering',
    prix: '90€',
    details: 'Mix + Master prêt pour les plateformes · Révisions illimitées · Livraison sous 72h',
    couleur: '#FF6B35'
  },
  {
    service: '🎤 Mastering seul',
    prix: '30€',
    details: 'Master professionnel · Compatible Spotify/Apple Music/YouTube',
    couleur: '#FF6B35'
  },
  {
    service: '🗂️ EP / Album (5+ titres)',
    prix: 'Sur devis',
    details: 'Tarif dégressif · Cohérence sonore garantie · Délai à définir ensemble',
    couleur: '#FF6B35'
  }
];

// ─── READY ───────────────────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`✅ Bot connecté : ${client.user.tag}`);
  await registerCommands();
});

// ─── SLASH COMMANDS ──────────────────────────────────────────────────────────
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName('setup')
      .setDescription('Initialise tous les salons du serveur (Admin seulement)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
      .setName('tarifs')
      .setDescription('Affiche les tarifs du studio dans le salon tarifs'),

    new SlashCommandBuilder()
      .setName('annonce')
      .setDescription('Envoie une annonce officielle (Admin seulement)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption(opt =>
        opt.setName('message').setDescription('Contenu de l\'annonce').setRequired(true))
      .addStringOption(opt =>
        opt.setName('titre').setDescription('Titre de l\'annonce').setRequired(false)),

    new SlashCommandBuilder()
      .setName('fermer')
      .setDescription('Ferme le ticket en cours'),

    new SlashCommandBuilder()
      .setName('exemples')
      .setDescription('Affiche les infos du salon exemples'),
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
  await rest.put(Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID), { body: commands });
  console.log('✅ Slash commands enregistrées');
}

// ─── NOUVEAU MEMBRE ──────────────────────────────────────────────────────────
client.on('guildMemberAdd', async (member) => {
  // Donner le rôle membre automatiquement
  const role = member.guild.roles.cache.get(CONFIG.ROLES.MEMBRE);
  if (role) await member.roles.add(role).catch(console.error);

  // Message de bienvenue en DM
  const welcomeEmbed = new EmbedBuilder()
    .setColor(CONFIG.STUDIO.COULEUR)
    .setTitle(`👋 Bienvenue sur ${CONFIG.STUDIO.NOM}`)
    .setDescription(
      `Bienvenue sur le serveur officiel du studio !\n\n` +
      `Tu peux :\n` +
      `🎚️ Consulter les **tarifs** dans <#${CONFIG.CHANNELS.TARIFS}>\n` +
      `🎧 Écouter des **exemples** dans <#${CONFIG.CHANNELS.EXEMPLES}>\n` +
      `📩 Ouvrir un **ticket** dans <#${CONFIG.CHANNELS.TICKETS}> pour commander\n\n` +
      `N'hésite pas à poser tes questions.`
    )
    .setFooter({ text: CONFIG.STUDIO.NOM })
    .setTimestamp();

  await member.send({ embeds: [welcomeEmbed] }).catch(() => {
    // DMs désactivés, on ignore
  });
});

// ─── COMMANDES ───────────────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {

  // ── Slash Commands ──
  if (interaction.isChatInputCommand()) {

    // /setup
    if (interaction.commandName === 'setup') {
      await interaction.deferReply({ ephemeral: true });
      await setupTicketSalon(interaction);
      await setupTarifsSalon(interaction);
      await interaction.editReply('✅ Setup terminé ! Vérifie les salons.');
    }

    // /tarifs
    if (interaction.commandName === 'tarifs') {
      await interaction.deferReply({ ephemeral: true });
      await envoyerTarifs(interaction.guild);
      await interaction.editReply('✅ Tarifs envoyés !');
    }

    // /annonce
    if (interaction.commandName === 'annonce') {
      const message = interaction.options.getString('message');
      const titre = interaction.options.getString('titre') || `📢 Annonce — ${CONFIG.STUDIO.NOM}`;
      const canal = interaction.guild.channels.cache.get(CONFIG.CHANNELS.ANNONCES);
      if (!canal) return interaction.reply({ content: '❌ Salon annonces introuvable.', ephemeral: true });

      const embed = new EmbedBuilder()
        .setColor(CONFIG.STUDIO.COULEUR)
        .setTitle(titre)
        .setDescription(message)
        .setFooter({ text: CONFIG.STUDIO.NOM })
        .setTimestamp();

      await canal.send({ content: '@everyone', embeds: [embed] });
      await interaction.reply({ content: '✅ Annonce envoyée !', ephemeral: true });
    }

    // /fermer
    if (interaction.commandName === 'fermer') {
      if (!interaction.channel.name.startsWith('ticket-')) {
        return interaction.reply({ content: '❌ Cette commande s\'utilise uniquement dans un ticket.', ephemeral: true });
      }
      await fermerTicket(interaction.channel, interaction.user, interaction.guild);
      await interaction.reply({ content: '🔒 Ticket en cours de fermeture...', ephemeral: true });
    }

    // /exemples
    if (interaction.commandName === 'exemples') {
      const embed = new EmbedBuilder()
        .setColor(CONFIG.STUDIO.COULEUR)
        .setTitle('🎧 Exemples de mix')
        .setDescription(
          `Dans ce salon tu trouveras des exemples de projets mixés.\n\n` +
          `**Format :** Avant ➜ Après avec description du projet.\n\n` +
          `Pour commander, ouvre un ticket dans <#${CONFIG.CHANNELS.TICKETS}>`
        )
        .setFooter({ text: CONFIG.STUDIO.NOM });
      await interaction.reply({ embeds: [embed] });
    }
  }

  // ── Boutons ──
  if (interaction.isButton()) {

    // Ouvrir un ticket
    if (interaction.customId === 'ouvrir_ticket') {
      await ouvrirTicket(interaction);
    }

    // Fermer ticket via bouton
    if (interaction.customId === 'fermer_ticket') {
      await interaction.reply({ content: '🔒 Fermeture du ticket...', ephemeral: true });
      await fermerTicket(interaction.channel, interaction.user, interaction.guild);
    }

    // Confirmer fermeture
    if (interaction.customId === 'confirmer_fermeture') {
      await interaction.channel.delete().catch(console.error);
    }
  }
});

// ─── SETUP SALON TICKETS ─────────────────────────────────────────────────────
async function setupTicketSalon(interaction) {
  const canal = interaction.guild.channels.cache.get(CONFIG.CHANNELS.TICKETS);
  if (!canal) return;

  const embed = new EmbedBuilder()
    .setColor(CONFIG.STUDIO.COULEUR)
    .setTitle(`🎚️ Commander un mix — ${CONFIG.STUDIO.NOM}`)
    .setDescription(
      `**Tu veux faire mixer ton projet ?**\n\n` +
      `Clique sur le bouton ci-dessous pour ouvrir un ticket privé.\n` +
      `Je te répondrai dans les **24 à 48h**.\n\n` +
      `📋 **Prépare :**\n` +
      `· Tes stems/instrumentals séparés\n` +
      `· Des références sonores\n` +
      `· Le style de mix que tu veux\n\n` +
      `💰 Consulte les tarifs dans <#${CONFIG.CHANNELS.TARIFS}>\n` +
      `🎧 Écoute les exemples dans <#${CONFIG.CHANNELS.EXEMPLES}>`
    )
    .setFooter({ text: `${CONFIG.STUDIO.NOM} · ${CONFIG.STUDIO.EMAIL}` })
    .setTimestamp();

  const bouton = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ouvrir_ticket')
      .setLabel('📩 Ouvrir un ticket')
      .setStyle(ButtonStyle.Primary)
  );

  await canal.send({ embeds: [embed], components: [bouton] });
}

// ─── SETUP SALON TARIFS ───────────────────────────────────────────────────────
async function setupTarifsSalon(interaction) {
  const canal = interaction.guild.channels.cache.get(CONFIG.CHANNELS.TARIFS);
  if (!canal) return;
  await envoyerTarifs(interaction.guild);
}

async function envoyerTarifs(guild) {
  const canal = guild.channels.cache.get(CONFIG.CHANNELS.TARIFS);
  if (!canal) return;

  const headerEmbed = new EmbedBuilder()
    .setColor(CONFIG.STUDIO.COULEUR)
    .setTitle(`💰 Tarifs — ${CONFIG.STUDIO.NOM}`)
    .setDescription(
      `Tous les tarifs incluent :\n` +
      `✅ Révisions illimitées\n` +
      `✅ Fichier WAV + MP3 livrés\n` +
      `✅ Compatible toutes plateformes\n` +
      `✅ Communication directe tout au long du projet\n\n` +
      `*Tarifs dégressifs disponibles pour EP et albums.*`
    );

  await canal.send({ embeds: [headerEmbed] });

  for (const tarif of TARIFS) {
    const embed = new EmbedBuilder()
      .setColor(tarif.couleur)
      .setTitle(`${tarif.service} — ${tarif.prix}`)
      .setDescription(tarif.details);
    await canal.send({ embeds: [embed] });
  }

  const footerEmbed = new EmbedBuilder()
    .setColor(CONFIG.STUDIO.COULEUR)
    .setDescription(`📩 Pour commander, ouvre un ticket dans <#${CONFIG.CHANNELS.TICKETS}>\n📸 Instagram : ${CONFIG.STUDIO.INSTAGRAM}`)
    .setFooter({ text: `${CONFIG.STUDIO.NOM} · Mis à jour le ${new Date().toLocaleDateString('fr-FR')}` });

  await canal.send({ embeds: [footerEmbed] });
}

// ─── OUVRIR TICKET ────────────────────────────────────────────────────────────
async function ouvrirTicket(interaction) {
  const guild = interaction.guild;
  const user = interaction.user;

  // Vérifier si l'utilisateur a déjà un ticket ouvert
  const existant = guild.channels.cache.find(
    c => c.name === `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`
  );

  if (existant) {
    return interaction.reply({
      content: `❌ Tu as déjà un ticket ouvert : ${existant}`,
      ephemeral: true
    });
  }

  // Créer le salon ticket
  const ticketChan = await guild.channels.create({
    name: `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
    type: ChannelType.GuildText,
    parent: CONFIG.CHANNELS.TICKET_CATEGORY,
    permissionOverwrites: [
      {
        id: guild.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: user.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      },
      {
        id: CONFIG.ROLES.ADMIN,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      },
    ],
  });

  // Message dans le ticket
  const embed = new EmbedBuilder()
    .setColor(CONFIG.STUDIO.COULEUR)
    .setTitle(`🎚️ Ticket — ${user.username}`)
    .setDescription(
      `Bienvenue ${user} !\n\n` +
      `Pour que je puisse traiter ta demande rapidement, merci de me donner :\n\n` +
      `**1.** Le service souhaité (mix / mix+master / master)\n` +
      `**2.** Le nombre de titres\n` +
      `**3.** Le style / genre musical\n` +
      `**4.** Des références sonores si tu en as\n` +
      `**5.** Ta deadline si tu en as une\n\n` +
      `Je reviens vers toi sous **24 à 48h**. 🎧`
    )
    .setFooter({ text: `${CONFIG.STUDIO.NOM} · Ticket ouvert le ${new Date().toLocaleDateString('fr-FR')}` });

  const boutonFermer = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('fermer_ticket')
      .setLabel('🔒 Fermer le ticket')
      .setStyle(ButtonStyle.Danger)
  );

  await ticketChan.send({ content: `${user} <@&${CONFIG.ROLES.ADMIN}>`, embeds: [embed], components: [boutonFermer] });

  // Log
  const logChan = guild.channels.cache.get(CONFIG.CHANNELS.LOGS);
  if (logChan) {
    const logEmbed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('📩 Nouveau ticket')
      .addFields(
        { name: 'Utilisateur', value: `${user.tag}`, inline: true },
        { name: 'Salon', value: `${ticketChan}`, inline: true },
        { name: 'Date', value: new Date().toLocaleString('fr-FR'), inline: true }
      );
    await logChan.send({ embeds: [logEmbed] });
  }

  await interaction.reply({
    content: `✅ Ton ticket a été créé : ${ticketChan}`,
    ephemeral: true
  });
}

// ─── FERMER TICKET ────────────────────────────────────────────────────────────
async function fermerTicket(channel, user, guild) {
  const embed = new EmbedBuilder()
    .setColor('#FF0000')
    .setTitle('🔒 Ticket fermé')
    .setDescription(`Ticket fermé par ${user}.\n\nMerci d'avoir utilisé nos services ! 🎧\nN'hésite pas à laisser un retour sur Instagram : ${CONFIG.STUDIO.INSTAGRAM}`)
    .setTimestamp();

  const bouton = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('confirmer_fermeture')
      .setLabel('🗑️ Supprimer le salon')
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({ embeds: [embed], components: [bouton] });

  // Log
  const logChan = guild.channels.cache.get(CONFIG.CHANNELS.LOGS);
  if (logChan) {
    const logEmbed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('🔒 Ticket fermé')
      .addFields(
        { name: 'Salon', value: channel.name, inline: true },
        { name: 'Fermé par', value: user.tag, inline: true },
        { name: 'Date', value: new Date().toLocaleString('fr-FR'), inline: true }
      );
    await logChan.send({ embeds: [logEmbed] });
  }
}

// ─── LANCEMENT ───────────────────────────────────────────────────────────────
client.login(CONFIG.TOKEN);
