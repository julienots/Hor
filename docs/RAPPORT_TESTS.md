# Rapport de tests — 14/10/2026 (mis à jour : exploration + APK)

Environnement : conteneur Linux, Node 22, Chromium 141 (Playwright 1.56) en **rendu logiciel
SwiftShader, sans GPU**. Aucun appareil Android ni PC de jeu réel n'était disponible.

## Tests réellement exécutés

### 1. Simulation — `npm test` (Vitest) : **21/21 réussis**

Ajouts exploration : jauge de détection qui tue, jauge qui redescend en quittant la salle,
lampe qui fige le Maître et fait fuir Ruban, traque quand la cabine est vide (et fin de traque au
retour), commandes de la cabine inaccessibles dehors.

| Test | Résultat |
|---|---|
| Plus court chemin sur la carte | ✔ |
| Nuit de 6 h gagnée sans ennemi | ✔ |
| Consommation d'énergie selon l'usage | ✔ |
| Panne à 0 % : portes ouvertes, Parade, Roi des Rouages | ✔ |
| Maître de Cérémonie figé quand sa caméra est regardée | ✔ |
| Maître de Cérémonie : recule porte fermée, tue porte ouverte | ✔ |
| Mimi accélérée par le bruit | ✔ |
| Leurre dans l'atelier : Mimi recule | ✔ |
| Roi des Rouages : décharge, puis sabotage (énergie, porte bloquée) | ✔ |
| Madame Ruban : caméra figée, réinitialisation, porte = attente, lumière = recul | ✔ |
| Le Chœur : suit le leurre, imite un son entendu | ✔ |
| Équité nuits 1 à 5 (robot ≥ 11/12 victoires, joueur passif ≥ 11/12 morts) | ✔ ×5 |

### 2. Équilibrage — `node tests/unit/stats.mjs` (40 nuits par niveau, robot à 1,2 s de réaction)

| Nuit | Victoires du robot | Énergie finale moyenne | Minimum |
|---|---|---|---|
| 1 | 40/40 | 57,6 % | 53,0 % |
| 2 | 40/40 | 33,6 % | 24,3 % |
| 3 | 40/40 | 26,3 % | 9,7 % |
| 4 | 40/40 | 16,8 % | 5,2 % |
| 5 | 40/40 | 5,8 % | 0,0 % |
| 6 (bonus) | 11/40 | 0,0 % | 0,0 % |

La nuit 6 est volontairement très difficile ; le robot ne fait pas d'économies d'énergie fines.

### 3. Navigateur — `node tests/e2e/smoke.mjs` : **15/15 vérifications réussies**

Sur la version de développement **et** sur la version autonome `dist-single/index.html` :
menu, dossiers des mascottes (5 modèles), lancement de la nuit 1, bande d'Odile, lumière (A),
porte (Q), volet, ouverture des caméras, parcours des 10 caméras, fermeture, mascottes aux portes
et au conduit, jumpscare du Maître de Cérémonie, écran de fin, victoire à 6 h, sauvegarde (nuit 2
débloquée), paramètres, **aucune erreur JavaScript**.

Captures vérifiées visuellement : menu, cabine, lumières, portes, 10 caméras, 5 jumpscares,
Mimi dans le conduit, écrans de fin, mise en page téléphone portrait (412×860) et paysage (860×412).

### 3 bis. Exploration — `node tests/e2e/explore.mjs` : **13/13 réussies**

Bâtiment continu (v0.3.0) : les **22 traversées** (11 liaisons, dans les deux sens) se font à pied
sans transition ; les murs sont infranchissables hors des ouvertures ; passage continu salle de
fête → scène vérifié au clavier.


Se lever, franchir la porte ouest, lampe, couloir → salle de fête, collision avec une table,
regarder le Maître sous la lampe (pas de détection), jauge qui monte lampe éteinte, capture, visite
de toutes les salles (captures vérifiées), aucune erreur JavaScript.

### 3 ter. APK Android

- `android/build-apk.sh` : réussi. `apksigner verify` : signature valide. `aapt dump badging` :
  paquet `com.superessence.nightshift`, version 0.3.0, Android 7.0+ (API 24), cible API 34.
- Le fichier HTML embarqué dans l'APK a passé les deux tests navigateur (15/15 et 10/10) chargé en
  `file://`, comme dans la WebView.
- **Non testé : installation et lancement sur un vrai téléphone ou un émulateur** (pas d'émulateur
  Android disponible dans l'environnement).

### 4. Compilation

- `npm run build` : réussi (dist/, JS ≈ 150 Ko gzip pour le moteur + 35 Ko pour le jeu).
- `npm run build:single` : réussi (dist-single/index.html, 684 Ko, 190 Ko gzip).

## Non testé / à faire sur appareil réel

- **Fréquence d'images réelle** : mesurée à ~3,5 images/s en rendu logiciel sans GPU, ce qui ne
  représente pas un appareil réel. À mesurer sur Android milieu de gamme (qualité « Basse » prévue
  pour mobile) et sur PC.
- Son : le moteur audio a tourné sans erreur, mais **l'écoute réelle** (volumes, spatialisation
  gauche/droite, fatigue auditive) n'a pas pu être évaluée dans le conteneur.
- Vibrations Android, plein écran, encoche (safe areas), gestes sur vrais écrans tactiles.
- Safari / iOS non testé.
- Session de jeu humaine complète des 6 nuits (seul le robot les a jouées).
- Pas de build installable (APK/EXE) : non produit, car aucun outil de packaging n'a été exécuté.
