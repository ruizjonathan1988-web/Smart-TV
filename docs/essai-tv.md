# VJOD sur la télé : la version de test

Cette fiche sert à installer la version de test de VJOD sur une télé LG ou Samsung, puis à vérifier que tout marche. Comptez une heure la première fois, installation comprise. Notez ce qui ne va pas (avec une photo de l'écran si possible) et le numéro du point.

## Récupérer le fichier

Jon vous envoie le fichier qui correspond à votre télé :

- télé **LG** : le fichier `VJOD_webOS_v….ipk` ;
- télé **Samsung** (2017 et après) : le fichier `VJOD_Tizen_Regular_v….wgt`.

Pour Jon : les fichiers sont construits automatiquement à chaque mise à jour. Sur GitHub, ouvrir la demande de fusion « matv-native-client », onglet **Checks**, ligne **Build**, puis en bas de la page, dans **Artifacts**, « webos » ou « tizen ». Il faut être connecté à GitHub pour les télécharger. Chaque archive arrive en .zip à décompresser avant de l'envoyer.

Avant de commencer, notez aussi l'adresse du serveur Jellyfin et votre identifiant, que Jon vous donne.

## Installer

L'ordinateur et la télé doivent être sur le même réseau.

**LG (webOS)**, avec un ordinateur (Windows, Mac ou Linux).

1. Créez un compte gratuit sur le site des développeurs LG (webostv.developer.lge.com).
2. Sur la télé, installez l'appli **Developer Mode** depuis le magasin LG, connectez-vous avec ce compte et activez **Dev Mode Status**. La télé redémarre.
3. Rouvrez l'appli Developer Mode et activez **Key Server**. Notez l'adresse IP et la phrase de passe affichées.
4. Sur l'ordinateur, installez **Dev Manager Desktop** (projet webosbrew, sur GitHub), ajoutez la télé avec cette adresse et cette phrase de passe, puis glissez le fichier `.ipk` dans la liste des applis.
5. VJOD apparaît dans le ruban des applis.

Attention : le mode développeur s'éteint au bout de 50 heures, et **VJOD disparaît de la télé avec lui**. Pour l'éviter, rouvrez l'appli Developer Mode de temps en temps et appuyez sur **Extend**. S'il a expiré, réactivez-le et réinstallez le fichier.

**Samsung (Tizen)**, avec un ordinateur ou un téléphone.

1. Installez **Apps2Samsung** : il existe pour Windows, Mac, Linux, Android et iPhone. Il signe le fichier pour votre télé et l'installe.
2. Sur la télé, ouvrez **Applications**, puis tapez 1 2 3 4 5 sur la télécommande. La fenêtre du mode développeur s'ouvre.
3. Activez le mode développeur et entrez l'adresse IP de l'appareil où tourne Apps2Samsung (ordinateur ou téléphone). Redémarrez la télé en maintenant le bouton marche quelques secondes.
4. Dans Apps2Samsung, choisissez la télé puis le fichier `.wgt`. Il peut vous demander de vous connecter à un compte Samsung.
5. VJOD apparaît dans les applications.

Attention : laissez le mode développeur allumé. Si vous l'éteignez, la télé supprime VJOD.

**Premier lancement.** Entrez l'adresse du serveur Jellyfin, puis votre identifiant et votre mot de passe. Plus simple : choisissez **Connexion rapide**. La télé affiche un code à valider dans VJOD ou Jellyfin sur votre téléphone, sans rien taper à la télécommande.

**Mettre à jour.** Quand Jon envoie une nouvelle version, installez le nouveau fichier par-dessus, de la même façon. Vos réglages et votre connexion sont gardés.

## Ce qu'il faut regarder

**1. Le lecteur.** Lancez un film de la bibliothèque, puis appuyez sur OK. Tout va bien si l'image démarre en quelques secondes, que les commandes s'affichent avec le titre en haut, la barre de progression et les temps en bas, que gauche et droite avancent ou reculent, et que Retour ferme les commandes puis quitte le film. Le bouton « Audio et sous-titres » doit permettre de changer de langue. Essayez aussi un épisode : à la fin, la carte « Épisode suivant » propose la suite.

**2. Un film IPTV en MKV.** Dans Films, ouvrez un film marqué **IPTV** (il vient du fournisseur, pas de la bibliothèque), de préférence un MKV. Tout va bien si le film se lance. Si la télé ne sait pas lire le fichier, le message « Ce fichier ne se lit pas tel quel sur cette TV : Ma TV en prépare une version lisible… » s'affiche, puis le film démarre là où vous en étiez. Un saut dans le film doit reprendre au bon endroit après quelques secondes.

**3. Le choix de la source dans Ma TV.** Dans TV, ouvrez une chaîne en direct. Maintenez OK sur l'image pour ouvrir le mini-guide, puis choisissez **Sources**. Tout va bien si la liste montre « Automatique » puis les flux de la chaîne avec leur définition, leur débit et une pastille (en lecture, choisie…). OK sur un flux change d'image tout de suite ; OK long le garde pour cette chaîne, et il reste choisi la prochaine fois. Si une chaîne saccade, la télé doit passer seule sur une source plus légère.

**4. Les accents des titres.** Parcourez l'accueil, la recherche et le guide TV. Tout va bien si les titres et descriptions s'écrivent correctement (« Amélie », « Le Dîner de cons », « Ça », « Œuvre »), sans signes bizarres (« Ã© », « ? », carrés). Dans la recherche, taper « amelie » sans accent doit trouver « Amélie ».

**5. La fiche d'un film.** Ouvrez un film depuis l'accueil. Tout va bien si l'image de fond, le titre, l'année, la durée, les notes et le résumé s'affichent, avec les boutons (Lecture, Bande-annonce, Favori…) atteignables aux flèches. Sur une série, le bouton dit « Reprendre l'épisode … » si vous l'avez commencée, et les saisons et épisodes défilent. Retour revient là où vous étiez.

**6. Le mode enfants.** Dans Paramètres → Compte → Famille, activez **Mode enfants**. Tout va bien si la barre du haut ne garde qu'Accueil, Films, Séries, TV et Replay (plus d'Explorer, de Bientôt ni d'En route), si l'accueil se réduit aux bibliothèques, aux derniers ajouts, à « Reprendre » et « À suivre », et si plus rien ne propose de demander un titre. Si un contrôle parental est réglé sur le profil, les titres bloqués n'apparaissent nulle part, recherche et suggestions comprises. Pour sortir du mode enfants, la télé demande le code PIN s'il y en a un.

**7. La liaison Trakt.** Dans Paramètres → Intégrations → Seerr → **Trakt**, choisissez « Relier mon compte Trakt ». Tout va bien si un code et un QR code s'affichent ; après validation sur le téléphone, la télé affiche votre nom Trakt sans rien toucher. Le lendemain, la rangée « Pour vous » peut inclure des titres venus de Trakt. « Délier » doit revenir à l'état de départ.

**8. La reprise d'un film commencé sur le téléphone.** Sur le téléphone, lancez un film de la bibliothèque, regardez quelques minutes puis arrêtez. Sur la télé, revenez à l'accueil. Tout va bien si le film apparaît dans « Reprendre » avec sa barre de progression, et si la fiche propose « Reprendre de … » à la bonne minute (à une ou deux minutes près). Faites aussi l'inverse : un film arrêté sur la télé doit reprendre au bon endroit sur le téléphone. Refaites l'essai avec un film **IPTV** : c'est le cas qui a été corrigé, il doit lui aussi reprendre à la bonne minute d'un appareil à l'autre.

**9. Demander un titre.** Dans Explorer ou dans la recherche, ouvrez un film que vous n'avez pas encore et choisissez **Demander**. Tout va bien si la demande part, si le titre apparaît dans **En route** avec son état (en attente, validé, téléchargement…), puis s'il passe « Prêt » quand il arrive dans la bibliothèque.

## En cas de souci

Juste après le problème, allez dans Paramètres → À propos → **Diagnostics et logs** → **Afficher les journaux** et envoyez le rapport au serveur. Prévenez Jon en lui donnant l'heure du problème et le numéro du point. Pour revenir à la version d'avant, désinstallez VJOD et réinstallez l'ancien fichier.
