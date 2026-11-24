# VJOD sur la télé : la version de test

Cette fiche sert à installer la version de test de VJOD sur une télé LG ou Samsung, puis à vérifier que tout marche. Comptez une demi-heure. Notez ce qui ne va pas (avec une photo de l'écran si possible) et le numéro du point.

## Récupérer le fichier

Les fichiers sont construits automatiquement à chaque mise à jour. Sur GitHub, ouvrez la demande de fusion « matv-native-client », onglet **Checks**, puis la ligne **Build**. En bas de la page, dans **Artifacts** :

- **webos** pour une télé LG : le fichier `VJOD_webOS_v….ipk` ;
- **tizen** pour une télé Samsung : le fichier `VJOD_Tizen_Regular_v….wgt` (télés de 2017 et après).

Chaque archive se télécharge en .zip : décompressez-la sur l'ordinateur.

## Installer

L'ordinateur et la télé doivent être sur le même réseau.

**LG (webOS).** Sur la télé, installez l'appli **Developer Mode** depuis le magasin LG, connectez-vous avec un compte LG développeur (gratuit) et activez le mode développeur ; la télé redémarre. Sur l'ordinateur, installez **Dev Manager Desktop** (webosbrew), ajoutez la télé avec l'adresse et la phrase de passe affichées dans l'appli Developer Mode, puis glissez le fichier `.ipk` dans la liste des applis. VJOD apparaît dans le ruban des applis. Le mode développeur s'éteint au bout de 50 heures : relancez l'appli Developer Mode et appuyez sur « Extend » pour le garder.

**Samsung (Tizen).** Le fichier `.wgt` n'est pas signé : utilisez **Apps2Samsung**, qui le signe pour votre télé et l'installe. Sur la télé, ouvrez Applications, tapez 1 2 3 4 5 sur la télécommande pour faire apparaître le mode développeur, activez-le et indiquez l'adresse de l'ordinateur, puis redémarrez la télé. Dans Apps2Samsung, choisissez la télé et le fichier `.wgt`. VJOD apparaît dans les applications.

Au premier lancement, entrez l'adresse du serveur Jellyfin et votre compte, comme sur le téléphone.

## Ce qu'il faut regarder

**1. Le lecteur.** Lancez un film de la bibliothèque, puis appuyez sur OK. Tout va bien si l'image démarre en quelques secondes, que les commandes s'affichent en bas avec le titre et la barre de progression, que gauche et droite avancent ou reculent, et que Retour ferme les commandes puis quitte le film. Essayez aussi un épisode : à la fin, la carte « Épisode suivant » propose la suite.

**2. Un film IPTV en MKV.** Ouvrez un film venant du fournisseur IPTV (catalogue VOD de Ma TV), de préférence un MKV. Tout va bien si le film se lance. Si la télé ne sait pas lire le fichier, le message « Ce fichier ne se lit pas tel quel sur cette TV : Ma TV en prépare une version lisible… » s'affiche, puis le film démarre là où vous en étiez. Un saut dans le film doit reprendre au bon endroit après quelques secondes.

**3. Le choix de la source dans Ma TV.** Ouvrez une chaîne en direct, puis le mini-guide et le menu **Sources** (OK long sur l'image). Tout va bien si la liste montre « Automatique » puis les flux de la chaîne avec leur définition, leur débit et une pastille (en lecture, choisie…). OK sur un flux change d'image tout de suite ; OK long le garde pour cette chaîne, et il reste choisi la prochaine fois. Si une chaîne saccade, la télé doit passer seule sur une source plus légère.

**4. Les accents des titres.** Parcourez l'accueil, la recherche et le guide TV. Tout va bien si les titres et descriptions s'écrivent correctement (« Amélie », « Le Dîner de cons », « Ça », « Œuvre »), sans signes bizarres (« Ã© », « ? », carrés). Dans la recherche, taper « amelie » sans accent doit trouver « Amélie ».

**5. La fiche d'un film.** Ouvrez un film depuis l'accueil. Tout va bien si l'image de fond, le titre, l'année, la durée, les notes et le résumé s'affichent, avec les boutons (Lecture, Bande-annonce, Favori…) atteignables aux flèches. Sur une série, le bouton dit « Reprendre l'épisode … » si vous l'avez commencée, et les saisons et épisodes défilent. Retour revient là où vous étiez.

**6. Le mode enfants.** Dans Paramètres → Compte → Famille, activez **Mode enfants**. Tout va bien si la barre du haut ne garde qu'Accueil, Films, Séries, TV et Replay (plus d'Explorer, de Bientôt ni d'En route), si l'accueil se réduit aux bibliothèques, aux derniers ajouts, à « Reprendre » et « À suivre », et si plus rien ne propose de demander un titre. Si un contrôle parental est réglé sur le profil, les titres bloqués n'apparaissent nulle part, recherche et suggestions comprises. Pour sortir du mode enfants, la télé demande le code PIN s'il y en a un.

**7. La liaison Trakt.** Dans Paramètres → Intégrations → Seerr → **Trakt**, choisissez « Relier mon compte Trakt ». Tout va bien si un code et un QR code s'affichent ; après validation sur le téléphone, la télé affiche votre nom Trakt sans rien toucher. Le lendemain, la rangée « Pour vous » peut inclure des titres venus de Trakt. « Délier » doit revenir à l'état de départ.

**8. La reprise d'un film commencé sur le téléphone.** Sur le téléphone, lancez un film de la bibliothèque, regardez quelques minutes puis arrêtez. Sur la télé, revenez à l'accueil. Tout va bien si le film apparaît dans « Reprendre » avec sa barre de progression, et si la fiche propose « Reprendre de … » à la bonne minute (à une ou deux minutes près). Faites aussi l'inverse : un film arrêté sur la télé doit reprendre au bon endroit sur le téléphone.

## En cas de souci

Paramètres → À propos → **Diagnostics et logs** → « Afficher les journaux » permet d'envoyer un rapport au serveur juste après le problème : précisez l'heure dans votre message. Pour revenir à la version d'avant, désinstallez VJOD et réinstallez l'ancien fichier.
