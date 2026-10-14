# NIGHTSHIFT — THE HOLLOW PARADE · Audit et plan (SUPERESSENCE)

## 1. Audit de l'existant (14/10/2026)

| Élément | Constat |
|---|---|
| Dépôt `julienots/Hor`, branche `claude/new-session-vlg96z` | **Vide** : aucun commit, aucun fichier, aucun asset. |
| Moteur | Aucun. Pas de Unity, Unreal, Godot ni Blender installés dans l'environnement de développement. |
| Outils disponibles | Node 22, npm, Chromium + Playwright (tests navigateur), ffmpeg, Python 3. |
| Assets existants | Aucun (rien à conserver, rien n'a été supprimé). |

Conséquence : il n'y a pas de base à reprendre, on crée un **prototype jouable**.

## 2. Choix techniques

- **Moteur : Three.js (WebGL) + Vite.** C'est le seul moteur 3D réellement compilable et testable ici.
  Le jeu tourne dans un navigateur PC **et Android** (commandes tactiles), sans installation.
- **Modèles 3D : générés par code (procéduraux).** Pas d'outil de modélisation ni de banque d'assets
  sous licence disponible. Les mascottes sont donc construites à partir de géométries travaillées
  (tours/lathe, tubes, extrusions, déformations de sommets), de textures peintes par programme
  (peinture écaillée, rouille, plastique jauni, coutures, visages) et d'un **rig articulé hiérarchique**
  (os nommés) animé par des clips d'animation. **Ce ne sont pas des modèles professionnels sculptés** :
  ils sont identifiés comme *placeholders avancés* et la liste des modèles finaux à produire est dans
  `docs/ASSETS_A_PRODUIRE.md`. Le code est prévu pour charger des `.glb` riggés plus tard.
- **Audio : 100 % synthétisé** par Web Audio (aucun son copié). Spatialisation gauche/droite/conduit.
- **Logique séparée du rendu** : la simulation (nuits, énergie, portes, IA) est en JavaScript pur,
  testée par Vitest sans navigateur. Le rendu et l'audio ne font que lire l'état.

## 3. Cœur de jeu retenu

Jeu de **salle de surveillance** (pas d'exploration libre) : le joueur est dans la cabine de
maintenance du *Carnaval des Veilleurs*, de minuit à 6 h. On approfondit donc caméras, énergie,
portes, volet de conduit, leurre sonore et disjoncteur, comme le permet la phase 6 du cahier des charges.

## 4. Plan par lots et critères d'acceptation

| Lot | Contenu | Critères d'acceptation |
|---|---|---|
| A | Audit + plan (ce document) | Document présent dans le dépôt. |
| B | Squelette Vite/Three, cabine 3D, regard gauche/droite, portes, lumières, énergie, horloge | La nuit se lance, l'énergie baisse selon l'usage, 6 h = victoire, 0 % = panne. |
| C | Premier ennemi complet : Le Maître de Cérémonie (modèle, anim, IA, contre-mesure, jumpscare) | Il avance hors observation, se voit à la porte avec la lumière, recule si porte fermée, sinon jumpscare. Test automatique. |
| D | Mimi, Roi des Rouages, Madame Ruban, le Chœur + nuits 1→5 | Chaque ennemi a une règle propre et une contre-mesure ; un « joueur robot » qui applique les règles survit, un joueur inactif meurt (tests). |
| E | Caméras (11 vues), parasites, leurre sonore, disjoncteur, histoire (messages, notes), secrets (tickets dorés) | Toutes les caméras s'affichent ; les secrets se trouvent par l'observation. |
| F | Éclairage, brouillard, post-traitement, audio, jumpscares | Aucune erreur console ; captures d'écran vérifiées. |
| G | Menus, pause, paramètres, accessibilité, sauvegarde, tests, build, README | Build Vite réussi, tests Vitest + Playwright exécutés et rapportés honnêtement. |
