# Assets finaux à produire

Les modèles actuels sont des **placeholders avancés générés par code** (`src/models/characters/*.js`) :
formes de révolution et extrusions, bosselage, textures peintes par programme, rig articulé
hiérarchique et clips d'animation codés. Ils sont jouables et lisibles, mais **ce ne sont pas des
modèles professionnels sculptés**. Pour atteindre la qualité visée, il faut produire :

## Mascottes (5 personnages)

Format conseillé : **glTF binaire (.glb)**, Y vers le haut, 1 unité = 1 m, personnage tourné vers +Z.

| Élément | Exigence |
|---|---|
| Maillage | 15 000 à 40 000 triangles (LOD1 ≈ 50 %, LOD2 ≈ 20 % pour mobile) |
| Textures PBR | Base color, normal, ORM (occlusion / rugosité / métal), 2048² (1024² mobile) ; émissive pour les yeux |
| Rig | Squelette avec les noms d'os actuels : `hips, spine, chest, neck, head, jaw, shoulderL/R, elbowL/R, handL/R, thighL/R, kneeL/R, footL/R` (+ os spécifiques ci-dessous), skinning ≤ 4 influences |
| Animations | `idle, walk, observe, peek, frozen, attack, jumpscare, stunned` + spécifiques |
| Collision | Capsule simple (le jeu n'utilise pas de physique pour les mascottes) |

Spécifiques :
- **Maître de Cérémonie** : 6 plaques faciales (`plate0…5`), doigts 3 phalanges, canne-micro ; anim `present`, `lean`.
- **Mimi** : os de cou extensible (`neck0…5`), genoux inversés, mâchoire coulissante ; anims `crawl`, `ventpeek`.
- **Roi des Rouages** : 2 portes de poitrine (`chestDoorL/R`), 3 engrenages animés, couronne ; anim `sabotage`.
- **Madame Ruban** : 18 à 30 rubans en os chaînés ou simulation de tissu ; anim `peek`.
- **Le Chœur** : 5 têtes avec mâchoires séparées (`headLapin…headClown`, `jaw*`), 3e bras ; anim `sing`.

## Décors

- Kits modulaires (murs, sols, plafonds, portes blindées, conduits) avec lightmaps.
- Accessoires : tables de fête, chaises, chapeaux, gâteaux, caisses, générateur, armoires
  électriques, portants de costumes, coiffeuse, CRT, ventilateur, magnétophone.
- Affiches et dessins originaux en haute définition (les versions actuelles sont peintes par code).

## Audio

Tous les sons sont actuellement **synthétisés en temps réel** (`src/audio/audio.js`). Pour une
version finale : enregistrements Foley (métal, servos, tissus, porcelaine), voix d'Odile enregistrée
par une comédienne, musique de la Parade orchestrée (orgue de Barbarie, fanfare), cris de jumpscare
spécifiques. Format : OGG/Opus 48 kHz + version AAC pour iOS.

## Intégration prévue

`src/models/index.js` est le point d'entrée unique : remplacer un constructeur procédural par un
chargement `GLTFLoader` qui renvoie le même objet `{ root, rig, height }` suffit. Les clips
peuvent alors être pilotés par `THREE.AnimationMixer`.
