# Fiches des ennemis — Chapitre 1

Chaque ennemi est une machine à états (`src/sim/enemies.js`) : `inactive → roam → atDoor →
(retreat | attack)`, plus `sabotage` et `stunned` pour le Roi des Rouages. À chaque « opportunité
de mouvement » (intervalle propre à l'ennemi), un tirage sur 20 est comparé au niveau d'IA (0 à 20)
de la nuit et de l'heure (`src/sim/nights.js`). Aucune attaque n'arrive sans annonce : chaque mort
est précédée d'au moins un indice sonore sous-titré et d'un délai pour réagir.

---

## 1. Le Maître de Cérémonie

- **Histoire** : présentateur de la Parade des Veilleurs. Son visage de plaques articulées composait
  des centaines d'expressions ; il n'en reste qu'un sourire trop large.
- **Silhouette** : 2,35 m, haut-de-forme cabossé penché, redingote rouge à basques, jambes fines,
  doigts télescopiques de 22 cm, canne-micro.
- **Matériaux** : tissu bordeaux poussiéreux à coutures dorées, gilet à carreaux, plaques de visage en
  peinture crème écaillée, métal rouillé, laiton, porcelaine jaunie et fissurée.
- **Rig** : 20 os + mâchoire + 6 plaques faciales pivotantes + 30 phalanges.
- **Animations** : repos, marche, observation, présentation, penché (couloir), à la porte, figé,
  attaque, jumpscare (plaques qui s'écartent), désactivation.
- **Sons** : pas lourds, ronronnement de servo, ricanement grésillant (haut-parleur).
- **Indices** : disparaît de la CAM 06, pas lourds à gauche, visible avec la lumière ouest.
- **IA** : Scène → Salle de fête → Couloir ouest → Porte ouest. **Ne bouge pas si sa caméra est
  regardée en direct** (une caméra figée par Madame Ruban ne compte pas).
- **Ruse** : ricanements dans les haut-parleurs côté est (son filtré et saturé, sous-titré
  « haut-parleurs ») pour faire fermer la mauvaise porte.
- **Contre-mesure** : porte ouest fermée à la fin de son compte à rebours (4,5 à 9 s) → retour en salle de fête.
- **Attaque** : porte ouverte à la fin du compte à rebours.

## 2. Mimi la Marionnette

- **Histoire** : vedette du théâtre de marionnettes. Ses fils ont été coupés la nuit de la Parade.
- **Silhouette** : 1,2 m, tête de porcelaine trop grosse, couettes de laine, robe en cloche, genoux
  inversés, cou télescopique en anneaux, croix de manipulation cassée dans le dos.
- **Matériaux** : bois peint rayé, porcelaine fissurée avec éclat manquant, tissu à carreaux, laine.
- **Rig** : 20 os, genoux inversés, cou extensible (6 anneaux), mâchoire de ventriloque coulissante.
- **Animations** : repos (tête tirée par un fil invisible), marche, ramper, sortie du conduit,
  observation, attaque, jumpscare (cou qui se déplie), désactivation.
- **Sons** : raclements (lointain / proche), tapotements, petit rire.
- **IA** : Atelier → conduit lointain → conduit proche → bouche du conduit. **Le bruit du joueur
  augmente ses chances d'avancer** (portes, volet). Bloquée au conduit proche si le volet est fermé.
- **Contre-mesures** : volet fermé quand elle est à la bouche → retour à l'atelier ; leurre sonore
  joué dans l'atelier quand elle est dans le conduit → retour immédiat.
- **Attaque** : volet ouvert à la fin de son compte à rebours.

## 3. Le Roi des Rouages

- **Histoire** : mascotte d'ouverture, montée sur un mécanisme d'horlogerie géant.
- **Silhouette** : 2,4 m, torse-tonneau, petite tête à monocle, couronne d'engrenages, bras-pistons.
- **Matériaux** : métal peint violet rouillé, cerclages de laiton, cape rouge, col d'hermine sale.
- **Rig** : 20 os + mâchoire ; portes de poitrine qui s'ouvrent sur 3 engrenages rotatifs et une chaudière.
- **Animations** : repos, marche lourde, sabotage (arrache les câbles), observation, attaque,
  jumpscare (poitrine ouverte), désactivation (engrenages qui ralentissent).
- **Sons** : pas très graves, grincement d'engrenages, décharge, câbles arrachés.
- **IA** : Cuisine → Couloir est → Salle des machines (lent : opportunité toutes les 8,5 s).
- **Contre-mesure** : décharge depuis la CAM 09 pendant le sabotage (−3 % d'énergie).
- **Échec** : −12 % d'énergie, porte est bloquée ouverte 20 s, coupure des lumières 2,5 s.
- **Finale** : à 0 % d'énergie, il apparaît à la porte ouest au son de la Parade.

## 4. Madame Ruban

- **Histoire** : danseuse du final, reliée au système vidéo pour synchroniser les projecteurs.
- **Silhouette** : 2,55 m, très fine, masque de porcelaine allongé, un œil bandé, taille en bobine,
  jupe de 18 rubans animés.
- **Matériaux** : corset sarcelle écaillé, porcelaine, bois de bobine, rubans de tissu colorés.
- **Rig** : 20 os, rubans déformés en temps réel.
- **Animations** : pose de danseuse, glissé sur pointes, glissement par la porte, jumpscare
  (rubans déchaînés), observation, désactivation.
- **IA** : Réception → Couloir est → Porte est. **Sabotage vidéo** périodique : fige une caméra
  (de préférence une où se trouve un ennemi, pour le cacher) pendant 25 s et crée une fausse alerte
  sur la carte. L'horodatage de la caméra figée ne bouge plus.
- **Contre-mesures** : « Réinitialiser » remet la caméra en direct (2,5 s hors ligne) ; à la porte,
  **1,4 s de lumière** la fait reculer. Fermer la porte ne fait que la faire attendre.
- **Attaque** : fin du compte à rebours, porte ouverte et pas assez éclairée.

## 5. Le Chœur

- **Histoire** : cinq têtes de la troupe soudées sur un châssis commun après la Parade.
- **Silhouette** : corps bossu en patchwork, têtes de lapin (centrale), ours, oiseau, chat (sur le
  torse) et clown (à l'envers dans le dos), trois bras dépareillés.
- **Matériaux** : tissus cousus, soudures incandescentes, plastique jauni, métal rouillé.
- **Rig** : 20 os + bras supplémentaire articulé ; 5 mâchoires qui chantent désynchronisées.
- **Animations** : repos, marche, chant, à la porte, jumpscare, désactivation.
- **IA** : se déplace sur le graphe des salles **vers le dernier leurre sonore** (30 s), sinon vers
  la porte la plus proche. Garde en mémoire les sons réels entendus et les **imite** (copies
  désaccordées à plusieurs voix, sous-titrées « plusieurs voix, légèrement fausses »).
- **Contre-mesures** : leurre dans une salle éloignée tant qu'il n'est pas à une porte ; porte fermée
  à la fin de son compte à rebours.
- **Attaque** : porte ouverte à la fin du compte à rebours.

---

## Équité vérifiée par les tests

`tests/unit/simulation.test.js` fait jouer un **joueur robot** qui applique uniquement ces règles,
avec 1,2 s de temps de réaction. Sur 12 graines par nuit, il doit gagner au moins 11 fois, et un
joueur passif doit perdre au moins 11 fois. `node tests/unit/stats.mjs` donne les statistiques sur 40 nuits.
