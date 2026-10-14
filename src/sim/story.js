// Récit : messages enregistrés de l'ancienne gardienne, Odile Marchal, laissés sur le magnétophone de la cabine.
export const NIGHT_MESSAGES = {
  1: [
    "Allô ? Si tu entends ça, c'est que la société t'a confié ma cabine. Je m'appelle Odile. J'ai fait cinq ans de nuits ici, au Carnaval des Veilleurs.",
    "Les mascottes ne sont plus censées bouger depuis la Dernière Parade. Officiellement. Officieusement… garde un œil sur elles.",
    "Le Maître de Cérémonie, sur la scène : il ne bouge pas tant que tu le regardes sur les caméras. Dès que tu détournes les yeux, il avance vers le couloir ouest.",
    "S'il arrive à la porte gauche, allume la lumière pour vérifier, puis FERME la porte. Il finit par repartir. Et méfie-toi des haut-parleurs : quand il ricane à travers eux, ça grésille. Ce n'est pas lui qui est là.",
    "Vers deux heures, Mimi se réveille dans l'atelier. Elle passe par les conduits et elle déteste le silence… non, pardon : elle ADORE le bruit. Chaque porte que tu claques l'attire.",
    "Quand tu entends tapoter juste devant toi, ferme le volet du conduit. Pas avant. Et si elle est dans les conduits, un leurre sonore joué dans l'atelier la fait reculer.",
    "Tout consomme de l'énergie : portes, lumières, caméras, volet. À zéro… n'arrive pas à zéro. Bonne nuit.",
  ],
  2: [
    "Te revoilà. Bien. Ce soir, le Roi des Rouages se met en route. Il est lent, très lent, mais il connaît le bâtiment mieux que nous.",
    "Il va à la salle des machines — caméra 09. S'il y reste, il arrache les câbles : tu perds de l'énergie et la porte est se bloque ouverte un moment.",
    "Quand tu l'entends grincer, ouvre la caméra 09 et envoie une DÉCHARGE. Ça le renvoie en cuisine. Ça coûte un peu d'énergie, mais moins que ce qu'il te volerait.",
  ],
  3: [
    "Nuit trois. Madame Ruban. Elle a été la première à… changer. Elle touche aux caméras.",
    "Parfois une caméra rejoue une vieille image. Regarde l'horodatage en bas : s'il est figé, l'image est fausse. Utilise RÉINITIALISER pour la remettre en direct.",
    "Elle vient par la porte est. La porte ne l'arrête pas vraiment : elle attend derrière. Ce qu'elle ne supporte pas, c'est la lumière. Éclaire-la jusqu'à ce qu'elle recule.",
  ],
  4: [
    "Le Chœur. Cinq têtes de l'ancienne troupe soudées sur un seul corps. Il écoute tout. Et il répète.",
    "Il imite les bruits qu'il a entendus pour t'attirer du mauvais côté. Écoute bien : ses imitations sonnent comme plusieurs voix en même temps, légèrement fausses.",
    "Il suit le bruit. Joue un leurre loin de toi — la scène, la cuisine, la loge — et il ira là-bas. S'il atteint une porte, ferme-la.",
  ],
  5: [
    "Dernière nuit de la semaine. C'est la date anniversaire de la Dernière Parade. Ils sont tous réveillés. Tous.",
    "Si tu as trouvé des fragments dorés de la partition dans les caméras… garde-les. Je crois que la mélodie complète peut les endormir pour de bon.",
    "Je ne serai plus là pour te parler après ce soir. Tiens jusqu'à six heures.",
  ],
  6: [
    "(Bande vierge. Seulement une respiration, puis une mélodie de fanfare jouée à l'envers.)",
  ],
};

export const LORE = {
  mc: {
    name: 'Le Maître de Cérémonie',
    bio: "Présentateur de la Parade des Veilleurs. Son visage est fait de plaques articulées qui composaient autrefois des centaines d'expressions ; il n'en reste qu'un sourire trop large. Ses doigts télescopiques désignaient les enfants à faire monter sur scène.",
    rule: 'Ne bouge pas tant que sa caméra est regardée. Porte ouest fermée quand il est là. Ses ricanements grésillants viennent des haut-parleurs : ce sont des leurres.',
  },
  mimi: {
    name: 'Mimi la Marionnette',
    bio: "Petite vedette du théâtre de marionnettes. Ses fils ont été coupés la nuit de la Parade, mais elle a appris à se déplacer seule, genoux à l'envers, cou dépliable, dans les conduits d'aération.",
    rule: 'Attirée par le bruit. Volet du conduit fermé quand elle tapote devant toi. Un leurre joué dans l\'atelier la fait reculer.',
  },
  roi: {
    name: 'Le Roi des Rouages',
    bio: "Mascotte d'ouverture, montée sur un mécanisme d'horlogerie géant. Son torse s'ouvre sur un engrenage qui tournait pour le final. Il est lent, mais il sait où se trouve le cœur électrique du bâtiment.",
    rule: 'Sabote la salle des machines (CAM 09). Une décharge le renvoie. S\'il réussit : perte d\'énergie et porte est bloquée ouverte.',
  },
  ruban: {
    name: 'Madame Ruban',
    bio: "Danseuse du final, enveloppée de rubans motorisés. Elle a été reliée au système de vidéo du parc pour synchroniser les projecteurs… et elle s'en souvient.",
    rule: "Fige des caméras (horodatage bloqué) et crée de fausses alertes. À la porte est, seule la lumière la fait reculer.",
  },
  choeur: {
    name: 'Le Chœur',
    bio: "Cinq têtes de mascottes de la troupe, soudées sur un châssis commun après la Parade. Personne ne sait qui l'a assemblé. Il chante faux, et il imite tout ce qu'il entend.",
    rule: 'Suit les leurres sonores. Ses imitations sonnent comme plusieurs voix légèrement fausses. Ferme la porte s\'il y arrive.',
  },
};

export const ENDINGS = {
  normal: "6 h 00. Les néons de service se rallument. Dans les caméras, les mascottes sont revenues à leur place, comme si rien ne s'était passé. Sur le bureau, quelqu'un a laissé un ticket de parade… daté de demain.",
  secret: "6 h 00. Tu poses les cinq fragments dorés sur la console et la mélodie complète passe dans les haut-parleurs. Une à une, les mascottes s'assoient. Sur la caméra de la loge, Odile Marchal t'adresse un signe de la main — puis l'image s'éteint pour de bon. Fin secrète : « La Dernière Parade ».",
};

// Fragments de partition cachés : un par nuit, visible dans une caméra pendant une fenêtre horaire.
export const FRAGMENTS = [
  { id: 'frag1', night: 1, cam: 'CAM10', from: 1, to: 3 },
  { id: 'frag2', night: 2, cam: 'CAM04', from: 2, to: 4 },
  { id: 'frag3', night: 3, cam: 'CAM05', from: 3, to: 5 },
  { id: 'frag4', night: 4, cam: 'CAM03', from: 1, to: 3 },
  { id: 'frag5', night: 5, cam: 'CAM09', from: 4, to: 6 },
];
