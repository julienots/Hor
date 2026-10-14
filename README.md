# NIGHTSHIFT — The Hollow Parade

Jeu d'horreur 3D cartoon original du studio **SUPERESSENCE**. Tu fais la maintenance de nuit au
*Carnaval des Veilleurs*, un parc d'attractions intérieur abandonné, de minuit à 6 h. Cinq mascottes
mécaniques ne suivent plus leur programmation. Il faut surveiller les caméras, gérer l'énergie,
les portes, les lumières, le volet du conduit, le leurre sonore et la décharge électrique.

Le jeu tourne sur Android (APK), dans un navigateur sur PC (clavier et souris) et sur mobile (tactile).
On peut aussi **quitter la cabine et explorer le bâtiment à pied**, lampe torche à la main.

## Installer l'APK Android

1. Télécharge [`releases/Nightshift-0.2.0.apk`](releases/Nightshift-0.2.0.apk) sur ton téléphone.
2. Ouvre-le ; Android demande d'autoriser l'installation depuis cette source (navigateur ou
   gestionnaire de fichiers) : accepte, puis « Installer ».
3. Lance « Nightshift ». Le jeu fonctionne hors ligne et s'affiche en paysage.

L'APK est signé avec une clé personnelle (`android/nightshift.keystore`), pas par le Play Store :
Play Protect peut afficher un avertissement, c'est normal pour une installation manuelle.

Pour reconstruire l'APK (JDK 17+ et Android SDK avec `platforms;android-34` et `build-tools;34.0.0`) :

```bash
ANDROID_HOME=/chemin/vers/android-sdk ./android/build-apk.sh   # → android/build/Nightshift.apk
```

Le script n'utilise pas Gradle : il compile le jeu en un fichier HTML autonome, l'embarque dans une
WebView plein écran (`android/src/.../MainActivity.java`), puis assemble et signe l'APK.

## Lancer le jeu

Prérequis : Node.js 18 ou plus récent.

```bash
npm install
npm run dev        # serveur de développement : http://localhost:5173
```

Pour jouer sur un téléphone du même réseau Wi-Fi, ouvre l'adresse « Network » affichée par
`npm run dev` (par exemple `http://192.168.1.20:5173`).

## Compiler

```bash
npm run build          # version web dans dist/ (à héberger sur n'importe quel serveur statique)
npm run build:single   # un seul fichier autonome : dist-single/index.html (~680 Ko)
npm run preview        # sert la version compilée de dist/
```

Le fichier `dist-single/index.html` contient tout le jeu (code, moteur 3D, styles). Il n'a besoin
d'Internet que pour les polices Google Fonts : sans réseau, des polices de remplacement s'affichent.

## Tests

```bash
npm test                                       # tests de la simulation (Vitest)
node tests/unit/stats.mjs                      # statistiques d'équilibrage sur 40 nuits par niveau
npm run dev & node tests/e2e/smoke.mjs         # test navigateur (Chromium + Playwright), captures dans test-results/
```

Le rapport des tests réellement exécutés est dans [`docs/RAPPORT_TESTS.md`](docs/RAPPORT_TESTS.md).

## Commandes

| Action | Clavier | Tactile / souris |
|---|---|---|
| Regarder à gauche / à droite | souris vers les bords, flèches ← → | glisser le doigt |
| Porte ouest / est | **Q** / **D** | boutons « Porte » ou boutons rouges en 3D |
| Lumière ouest / est | **A** / **E** | boutons « Lumière » ou boutons blancs en 3D |
| Volet du conduit | **S** | bouton « Volet du conduit » ou bouton bleu sur le bureau |
| Caméras | **Espace** | bouton « Caméras » ou la tablette sur le bureau |
| Choisir une caméra | **1** à **9**, **0** = CAM 10 | carte des caméras |
| Leurre sonore (salle affichée) | **L** | bouton |
| Décharge (CAM 09 uniquement) | **X** | bouton |
| Réinitialiser la caméra | **R** | bouton |
| Pause | **Échap** ou **P** | bouton ❚❚ |
| Diagnostic de l'IA | **F3** | Paramètres → Diagnostic |

### À pied (exploration)

| Action | Clavier / souris | Tactile |
|---|---|---|
| Se lever / s'asseoir (dans la cabine) | **G** | « Se lever » / « S'asseoir » |
| Marcher | **Z Q S D** ou **W A S D**, flèches | joystick à gauche |
| Regarder | souris (clic pour capturer le curseur) | glisser à droite |
| Courir (bruyant) | **Maj** | « Courir » |
| Lampe torche | **F** | « Lampe » |
| Changer de salle | marcher dans une porte (veilleuse rouge au-dessus) | idem |

Règles à pied : rester dans la salle d'une mascotte remplit la jauge rouge (bord de l'écran,
battements de cœur) ; la lampe braquée **fige le Maître de Cérémonie** et **fait fuir Madame Ruban** ;
courir fait du bruit (Mimi). Si une mascotte atteint la cabine vide, elle **te traque** de salle en
salle : retourne dans la cabine pour qu'elle abandonne. Les portes blindées fermées bloquent le passage.
Les fragments dorés peuvent aussi se ramasser à pied.

## Les cinq mascottes (chapitre 1)

| Mascotte | Arrive | Règle à apprendre |
|---|---|---|
| Le Maître de Cérémonie | Nuit 1 | Ne bouge pas tant que sa caméra est regardée. Porte ouest fermée quand il est derrière. Ses ricanements grésillants dans les haut-parleurs sont des leurres. |
| Mimi la Marionnette | Nuit 1 (2 h) | Passe par les conduits, attirée par le bruit. Fermer le volet quand elle tapote devant toi ; un leurre dans l'atelier la fait reculer. |
| Le Roi des Rouages | Nuit 2 | Sabote la salle des machines (CAM 09) : une décharge le renvoie. Sinon : perte d'énergie et porte est bloquée ouverte. |
| Madame Ruban | Nuit 3 | Fige des caméras (horodatage bloqué) et crée de fausses alertes. À la porte est, seule la lumière la fait reculer. |
| Le Chœur | Nuit 4 | Suit les leurres sonores et imite les sons entendus (imitations à plusieurs voix légèrement fausses). Porte fermée s'il y arrive. |

À 0 % d'énergie, tout s'éteint et la mélodie de la Parade annonce le Roi des Rouages.
Fiches complètes (histoire, silhouette, matériaux, rig, animations, sons, IA) : [`docs/ENNEMIS.md`](docs/ENNEMIS.md).

## Contenu

- 5 nuits + 1 nuit bonus, difficulté croissante (niveaux d'IA qui montent aussi au fil des heures).
- 10 caméras : scène, salle de fête, réception, cuisine, atelier, deux couloirs, conduits (vision
  nocturne), salle des machines, loge des costumes.
- Histoire : bandes magnétiques d'Odile Marchal, l'ancienne gardienne ; fiches des mascottes.
- Secret : 5 fragments de partition dorés cachés dans les caméras à certaines heures (un par nuit).
  Les trouver tous change la fin de la nuit 5.
- Détails qui changent entre deux observations (affiches, têtes de rechange, ustensiles).
- Menus, pause, paramètres (volumes séparés dont jumpscares, qualité graphique, sensibilité,
  sous-titres des sons, réduction des flashs, tremblements, vibrations), sauvegarde automatique locale.

## Structure

```
src/
  sim/          logique pure (sans rendu) : carte, nuits, énergie, IA des 5 ennemis, histoire
  models/       modèles 3D procéduraux : textures peintes, géométries, rig et clips d'animation
  render/       décor (cabine + 10 salles), éclairage partagé, post-traitement, jumpscares
  audio/        moteur audio Web Audio entièrement synthétisé
  game.js       une nuit : relie simulation, rendu, audio et interface
  main.js       menus, navigation, entrées, boucle principale
tests/unit/     tests Vitest + joueur robot d'équilibrage
tests/e2e/      test de fumée navigateur et outil de capture
viewer.html     visionneuse de modèles : /viewer.html?m=mc&clip=jumpscare&t=0.5
docs/           audit et plan, fiches des ennemis, assets à produire, rapport de tests
```

## Limites connues (honnêtement)

Les mascottes sont des **modèles procéduraux** construits par le code (formes travaillées, textures
peintes par programme, rig articulé, 8 à 10 animations chacune). Ce ne sont pas des modèles sculptés
par un artiste 3D. La liste des modèles finaux à produire est dans
[`docs/ASSETS_A_PRODUIRE.md`](docs/ASSETS_A_PRODUIRE.md).
