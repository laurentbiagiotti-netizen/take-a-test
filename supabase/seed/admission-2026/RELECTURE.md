# Relecture des QCM d'admission 2026

Base : les QCM proposés par Dylan (dossier Drive « Proposition test et entretien d'admission Cyber 2026 »). Les questions, les bonnes réponses, les explications et le niveau sont inchangés.

## Ce qui a changé

1. **Indice de longueur supprimé.** Dans la version d'origine, la bonne réponse était souvent nettement plus longue que les trois autres (14 questions sur 48 en B1, 21 sur 46 en B3, 20 sur 47 en Mastère). Un candidat qui coche toujours la réponse la plus longue gagnait donc beaucoup de points sans rien savoir. Les mauvaises réponses concernées ont été réécrites pour être aussi longues et aussi crédibles. Il en reste 7, 3 et 6, au niveau du hasard.
2. **Ordre des réponses.** La plateforme mélange les réponses pour chaque candidat : la position A, B, C ou D de la bonne réponse ne donne donc aucun indice.
3. **B1 : 5 énigmes CYBEROKU ajoutées** (mini-sudoku, grille de symboles, message codé, mot caché dans un journal, déduction). Le B1 passe à 55 questions, 55 minutes, seuil proposé 28/55 (50 %).
4. **Mise en forme.** Les questions de code (algorithmes, Python, Bash, PowerShell, journaux, scan nmap) ont retrouvé leurs retours à la ligne.

## Détail des réponses réécrites

### Bachelor 1

**Q32.** À quoi sert une adresse IP ?
- A : « À chiffrer les communications » devient « À chiffrer les données qui circulent pour que personne ne puisse les lire »
- B : « À stocker les mots de passe » devient « À enregistrer les sites visités pour les retrouver plus vite ensuite »
- D : « À mesurer la vitesse de la connexion » devient « À mesurer la vitesse de la connexion entre l'appareil et la box »

**Q34.** Que signifie le cadenas affiché à côté de l'adresse d'un site web ?
- A : « Le site est officiel et sans danger » devient « Le site est officiel et ne présente aucun danger pour vos données »
- B : « Le site a été vérifié par l'État » devient « Le site a été contrôlé et validé par un organisme de l'État »
- C : « Le site ne contient pas de publicité » devient « Le site ne contient ni publicité ni logiciel espion »

**Q39.** Vous utilisez le même mot de passe sur tous vos sites. L'un d'eux se fait voler sa base de données. Quel est le risque ?
- A : « Votre mot de passe est changé automatiquement partout » devient « Le site prévient tous les autres sites, qui changent votre mot de passe »
- B : « Aucun, seul ce site est concerné » devient « Aucun : seul le compte sur ce site est concerné par la fuite »
- C : « Votre ordinateur est automatiquement infecté » devient « Votre ordinateur est infecté dès la prochaine connexion à Internet »

**Q40.** À quoi sert la double authentification (code reçu par SMS ou dans une application) ?
- A : « À accélérer la connexion » devient « À accélérer la connexion en évitant de retaper le mot de passe »
- B : « À sauvegarder vos données » devient « À sauvegarder automatiquement vos données sur votre téléphone »
- C : « À remplacer l'antivirus » devient « À remplacer l'antivirus en bloquant les logiciels dangereux »

**Q41.** Dans un café, deux réseaux Wi-Fi apparaissent : « Cafe_Gratuit » et « Cafe-Gratuit-Free ». Quel est le risque ?
- B : « Le Wi-Fi va ralentir votre téléphone » devient « Aucun : le réseau le plus rapide des deux est forcément le vrai »
- C : « Aucun, tous les Wi-Fi publics sont contrôlés » devient « Aucun : tous les Wi-Fi publics sont contrôlés par l'opérateur »
- D : « Les deux réseaux vont se brouiller » devient « Les deux réseaux vont se brouiller et couper la connexion de tout le monde »

**Q43.** Pourquoi faut-il installer rapidement les mises à jour de son téléphone ou de son ordinateur ?
- A : « Elles suppriment les publicités » devient « Elles suppriment les publicités et les applications inutiles »
- B : « Elles libèrent de l'espace de stockage » devient « Elles libèrent de l'espace de stockage pour installer d'autres applications »
- D : « Elles sont obligatoires par la loi » devient « Elles sont obligatoires par la loi pour tous les appareils connectés »

**Q44.** Qu'est-ce qu'un rançongiciel (ransomware) ?
- B : « Un logiciel de sauvegarde payant » devient « Un logiciel payant qui sauvegarde vos fichiers dans le cloud »
- C : « Un antivirus gratuit » devient « Un antivirus gratuit qui bloque les sites dangereux »
- D : « Un programme qui affiche des publicités » devient « Un programme qui affiche des publicités pour gagner de l'argent »

### B1 : énigmes ajoutées

**Q51.** Énigme CYBEROKU. Dans cette grille, chaque ligne et chaque colonne contient une seule fois les chiffres 1, 2, 3 et 4.  
1 . 3 4  
. 4 . 2  
2 ? 4 .  
4 3 . 1  
Quel chiffre remplace le « ? » ?
Réponses : 1 / 2 / 3 / 4. Bonne réponse : 1. Sur sa ligne, il manque 1 et 3. Dans sa colonne, il y a déjà 4 et 3. Il ne reste que 1.

**Q52.** Énigme CYBEROKU. Dans cette grille, chaque ligne et chaque colonne contient une seule fois les symboles #, @ et $.  
# @ $  
@ $ #  
$ ? @  
Quel symbole remplace le « ? » ?
Réponses : # / @ / $ / On ne peut pas savoir. Bonne réponse : #. La ligne contient déjà $ et @, la colonne contient déjà @ et $ : il ne reste que #.

**Q53.** Énigme CYBEROKU. Un message est codé : chaque lettre est remplacée par son rang dans l'alphabet (A = 1, B = 2…). Que signifie 6 12 1 7 ?
Réponses : FLAG / GLAG / FKAG / ELAG. Bonne réponse : FLAG. 6 = F, 12 = L, 1 = A, 7 = G.

**Q54.** Énigme CYBEROKU. Un mot de passe est caché dans ce journal : prenez la première lettre de chaque ligne.  
Pare-feu activé  
Accès refusé  
Session ouverte  
Sauvegarde terminée  
Quel est le mot caché ?
Réponses : PASS / PAOS / SAPS / PARS. Bonne réponse : PASS. Les premières lettres des lignes donnent P, A, S, S.

**Q55.** Énigme CYBEROKU. Ana, Bilal et Chloé ont chacun trouvé un flag différent : web, réseau ou crypto. Ana n'a pas trouvé le flag web. Chloé a trouvé le flag crypto. Qui a trouvé le flag réseau ?
Réponses : Ana / Bilal / Chloé / On ne peut pas savoir. Bonne réponse : Ana. Chloé a crypto. Ana n'a pas web, donc elle a réseau, et Bilal a web.

### Bachelor 3

**Q3.** Deux postes, 10.0.1.10/24 et 10.0.2.10/24, sont branchés sur le même switch, dans le même VLAN, sans routeur. Peuvent-ils communiquer ?
- A : « Oui, car ils sont sur le même switch » devient « Oui, car un switch transmet les trames à tous les postes qui y sont branchés »
- C : « Non, car les adresses en 10.x sont privées » devient « Non, car les adresses en 10.x sont privées et ne se routent pas entre elles »
- D : « Oui, car ils sont dans le même VLAN » devient « Oui, car deux postes d'un même VLAN partagent le même domaine de diffusion »

**Q7.** Un poste en 192.168.1.20 accède à Internet alors que cette adresse n'est pas routable sur Internet. Quel mécanisme le permet ?
- A : « Le DNS » devient « Le DNS, qui traduit l'adresse privée en nom public »
- C : « Le DHCP » devient « Le DHCP, qui attribue une adresse publique au poste »
- D : « Le VLAN » devient « Le VLAN, qui isole le poste du réseau Internet »

**Q11.** Dans un domaine Active Directory, 15 comptables doivent accéder à un dossier partagé. Quelle est la bonne pratique ?
- A : « Donner les droits au groupe « Tout le monde » » devient « Donner les droits au groupe « Tout le monde », puis restreindre si besoin »
- C : « Donner le compte administrateur à la responsable comptable » devient « Partager le compte de la responsable comptable avec toute l'équipe »
- D : « Ajouter chaque utilisateur individuellement sur le dossier » devient « Ajouter chaque utilisateur individuellement sur les droits du dossier »

**Q13.** Une GPO liée à une unité d'organisation (OU) s'applique :
- A : « À tous les objets du domaine » devient « À tous les objets du domaine, quelle que soit leur unité d'organisation »
- C : « Uniquement aux contrôleurs de domaine » devient « Uniquement aux contrôleurs de domaine présents dans cette OU »
- D : « Uniquement aux groupes contenus dans cette OU » devient « Uniquement aux groupes de sécurité contenus dans cette OU »

**Q16.** Un technicien doit exécuter des commandes d'administration sur un serveur Linux sans connaître le mot de passe root. Quelle est la bonne solution ?
- A : « Créer un deuxième compte avec l'UID 0 » devient « Lui créer un deuxième compte avec l'UID 0 pour éviter de partager root »
- B : « Faire un chmod 777 sur /etc » devient « Faire un chmod 777 sur /etc pour qu'il puisse modifier la configuration »
- D : « Lui communiquer le mot de passe root » devient « Lui communiquer le mot de passe root et le changer après son intervention »

**Q19.** Un collaborateur a quitté l'entreprise. Que faites-vous en priorité de son compte Active Directory ?
- B : « Le supprimer immédiatement » devient « Le supprimer immédiatement pour libérer la licence et l'adresse mail »
- C : « Le laisser actif pour son successeur » devient « Le laisser actif pour que son successeur récupère ses accès »
- D : « Le renommer au nom de son successeur » devient « Le renommer au nom de son successeur pour conserver les droits »

**Q21.** Un utilisateur a saisi son mot de passe sur un faux site reçu par mail. Quelle est l'action prioritaire ?
- B : « Supprimer le mail de sa boîte » devient « Supprimer le mail de sa boîte et de celles des autres destinataires »
- C : « Formater son poste » devient « Formater son poste pour éliminer un éventuel logiciel malveillant »
- D : « Attendre de constater une activité suspecte » devient « Surveiller le compte et attendre de constater une activité suspecte »

**Q26.** Quelle est la différence entre un IDS et un IPS ?
- A : « L'IDS bloque, l'IPS se contente d'alerter » devient « L'IDS bloque le trafic malveillant, l'IPS se contente d'alerter »
- B : « L'IDS est un antivirus, l'IPS un pare-feu » devient « L'IDS analyse les fichiers comme un antivirus, l'IPS filtre les ports comme un pare-feu »
- D : « Il n'y a aucune différence » devient « Aucune : ce sont deux noms commerciaux pour le même équipement »

**Q28.** Comment une application doit-elle stocker les mots de passe de ses utilisateurs ?
- A : « Chiffrés avec une clé stockée sur le serveur » devient « Chiffrés en AES avec une clé stockée sur le même serveur »
- B : « En clair dans une base de données protégée » devient « En clair, dans une base de données accessible uniquement à l'application »
- C : « Encodés en Base64 » devient « Encodés en Base64 pour qu'ils ne soient pas lisibles directement »

**Q29.** Un collaborateur reçoit l'appel d'un « technicien Microsoft » qui lui demande d'installer un logiciel de prise en main à distance pour « corriger un problème ». De quoi s'agit-il ?
- A : « D'une procédure normale de support » devient « D'une procédure normale de support à distance de l'éditeur »
- C : « D'un audit de sécurité mené par le RSSI » devient « D'un audit de sécurité mené par le RSSI pour tester les postes »
- D : « D'une mise à jour automatique de Windows » devient « D'une mise à jour de Windows qui nécessite une intervention manuelle »

**Q30.** Une mise à jour de sécurité critique est publiée pour le pare-feu de l'entreprise. Quelle est la bonne démarche ?
- B : « Ne rien faire tant qu'aucun incident n'est constaté » devient « Attendre qu'un incident soit constaté avant de toucher à un équipement critique »
- C : « L'installer immédiatement en production, sans prévenir personne » devient « L'installer immédiatement en production, sans prévenir ni prévoir de retour arrière »
- D : « Attendre la prochaine maintenance annuelle » devient « Attendre la prochaine maintenance annuelle prévue pour le pare-feu »

**Q31.** Que produit ce script Bash ?
- A : « Serveur$i, trois fois » devient « Serveur$i, trois fois, sur trois lignes »
- C : « Une erreur de syntaxe » devient « Une erreur de syntaxe à cause des guillemets »
- D : « Serveur123 sur une seule ligne » devient « Serveur123, sur une seule ligne »

**Q35.** À quoi sert la ligne #!/bin/bash au début d'un script ?
- B : « C'est un simple commentaire, sans effet » devient « C'est un simple commentaire, ignoré à l'exécution »
- C : « Elle rend le script exécutable » devient « Elle donne au script le droit d'être exécuté »
- D : « Elle importe les commandes de Bash » devient « Elle charge les commandes de Bash dans le script »

**Q36.** Que fait cette commande ?
- A : « Elle compte le nombre d'utilisateurs du système » devient « Elle compte le nombre d'utilisateurs ayant un compte sur le système »
- B : « Elle affiche les mots de passe saisis » devient « Elle affiche les mots de passe saisis par erreur lors des connexions »
- C : « Elle supprime les tentatives échouées du journal » devient « Elle supprime du journal les lignes des connexions échouées »

**Q38.** Un script de création de comptes contient en clair le mot de passe d'un administrateur du domaine. Quel est le problème ?
- A : « Le script sera plus lent à s'exécuter » devient « Le script sera plus lent, car il doit vérifier le mot de passe à chaque compte créé »
- B : « Le mot de passe expirera plus vite » devient « Le mot de passe expirera plus vite, car il est utilisé par un script automatique »
- C : « Aucun, si le script est stocké sur un serveur » devient « Aucun, tant que le script est stocké sur un serveur dont l'accès est protégé par mot de passe »

**Q42.** Un poste ne parvient pas à joindre sa passerelle, alors que les autres postes branchés sur le même switch fonctionnent. Où cherchez-vous en priorité ?
- A : « Sur le pare-feu Internet » devient « Sur le pare-feu Internet, qui filtre peut-être le trafic de ce poste »
- B : « Sur le serveur DNS » devient « Sur le serveur DNS, qui ne résout peut-être plus l'adresse de la passerelle »
- D : « Chez le fournisseur d'accès à Internet » devient « Chez le fournisseur d'accès à Internet, qui coupe peut-être ce poste »

**Q43.** Tous les utilisateurs d'un étage perdent le réseau, alors que le reste du bâtiment fonctionne. Quelle est la cause la plus probable ?
- A : « Une panne du serveur DNS » devient « Une panne du serveur DNS central de l'entreprise »
- B : « Une panne du fournisseur d'accès à Internet » devient « Une coupure chez le fournisseur d'accès à Internet »
- D : « Des mots de passe expirés » devient « Des mots de passe expirés pour les utilisateurs de cet étage »

**Q46.** Au démarrage de session, un poste affiche : « The trust relationship between this workstation and the primary domain failed. » Que signifie ce message ?
- A : « Le serveur DNS est injoignable » devient « Le serveur DNS est injoignable depuis le poste au moment de la connexion »
- B : « Le mot de passe de l'utilisateur a expiré » devient « Le mot de passe de l'utilisateur a expiré et doit être changé »
- C : « La licence Windows a expiré » devient « La licence Windows du poste a expiré et doit être réactivée »

**Q47.** Une connexion SSH vers un serveur échoue avec le message « Connection refused ». Que peut-on en déduire ?
- B : « Le serveur n'existe pas » devient « Le serveur n'existe pas ou est éteint »
- C : « Le mot de passe est incorrect » devient « Le mot de passe ou la clé SSH sont incorrects »
- D : « Le nom du serveur n'est pas résolu par le DNS » devient « Le nom du serveur n'est pas résolu par le DNS »

**Q49.** Les utilisateurs signalent que le serveur de fichiers est très lent tous les jours entre 12 h et 13 h, et seulement sur ce créneau. Quelle hypothèse vérifiez-vous en premier ?
- B : « Une infection par un virus » devient « Une infection par un virus qui se déclenche sur le serveur »
- C : « Une panne du serveur DNS » devient « Une panne intermittente du serveur DNS de l'entreprise »
- D : « Un câble réseau défectueux » devient « Un câble réseau défectueux entre le serveur et le switch »

**Q50.** Un utilisateur ne peut plus ouvrir sa session : « Votre compte a été verrouillé ». Que faites-vous ?
- A : « Supprimer et recréer son compte » devient « Supprimer son compte et lui en recréer un nouveau avec un mot de passe provisoire »
- B : « Le déverrouiller immédiatement, sans autre vérification » devient « Le déverrouiller immédiatement pour qu'il puisse travailler, sans autre vérification »
- C : « Désactiver le verrouillage des comptes pour tout le monde » devient « Désactiver le verrouillage des comptes pour tout le monde afin d'éviter que cela se reproduise »

### Mastère (M1)

**Q4.** Quel mécanisme remplace ARP en IPv6 pour trouver l'adresse MAC d'un voisin ?
- A : « IGMP » devient « IGMP (Internet Group Management Protocol) »
- C : « DHCPv6 » devient « DHCPv6 (Dynamic Host Configuration Protocol) »
- D : « ARPv6 » devient « ARPv6 (version IPv6 du protocole ARP) »

**Q6.** Un serveur web répond sur le port 443 depuis le réseau interne, mais pas depuis Internet via l'adresse IP publique. Le service fonctionne. Quelle est la cause la plus probable ?
- A : « Le serveur DNS interne est en panne » devient « Le serveur DNS interne est en panne et ne résout plus le nom du site »
- B : « Le service web est arrêté » devient « Le service web est arrêté sur le serveur depuis la dernière mise à jour »
- C : « Le certificat TLS du serveur a expiré » devient « Le certificat TLS du serveur a expiré et bloque les connexions externes »

**Q9.** Les postes résolvent correctement les noms internes de l'entreprise, mais aucun nom Internet. Où cherchez-vous en priorité ?
- A : « Dans les enregistrements PTR » devient « Dans les enregistrements PTR de la zone de résolution inverse »
- B : « Dans la zone DNS interne » devient « Dans les enregistrements A de la zone DNS interne de l'entreprise »
- D : « Dans la configuration du serveur DHCP » devient « Dans les options de serveur DNS distribuées par le serveur DHCP »

**Q12.** Que fait la commande ss -tulpn sous Linux ?
- A : « Elle teste la connectivité vers un hôte » devient « Elle teste la connectivité TCP et UDP vers un hôte distant »
- B : « Elle affiche la table de routage » devient « Elle affiche la table de routage et les interfaces associées »
- D : « Elle capture le trafic réseau » devient « Elle capture le trafic réseau des ports TCP et UDP »

**Q17.** Quelle est la principale différence entre un conteneur et une machine virtuelle ?
- A : « Le conteneur est mieux isolé, car il est séparé au niveau matériel » devient « Le conteneur est mieux isolé, car il est séparé de l'hôte au niveau matériel »
- B : « Une VM ne peut pas fonctionner sur un hôte Linux » devient « Une VM ne peut pas fonctionner sur un hôte Linux, contrairement au conteneur »
- D : « Il n'y a aucune différence d'isolation » devient « Aucune en matière d'isolation : seule la consommation de ressources diffère »

**Q18.** Dans un plan de continuité, que désigne le RPO ?
- A : « La durée maximale d'interruption admissible » devient « La durée maximale d'interruption admissible avant le retour du service »
- B : « Le délai de notification d'un incident » devient « Le délai maximal pour notifier un incident aux autorités et aux clients »
- D : « Le nombre de copies de sauvegarde » devient « Le nombre de copies de sauvegarde à conserver hors site »

**Q23.** Pourquoi MD5 n'est-il plus utilisé pour garantir l'intégrité en sécurité ?
- A : « Il est trop lent » devient « Il est trop lent pour vérifier de gros fichiers en production »
- B : « Il nécessite une clé secrète » devient « Il nécessite une clé secrète partagée entre l'émetteur et le destinataire »
- D : « Il est réversible » devient « Il est réversible : on retrouve le contenu d'origine à partir de l'empreinte »

**Q24.** Dans une connexion HTTPS, à quoi sert principalement le certificat du serveur ?
- B : « À compresser les échanges » devient « À compresser les échanges pour accélérer le chargement des pages »
- C : « À chiffrer directement toutes les données échangées » devient « À chiffrer directement, avec sa clé publique, toutes les données échangées »
- D : « À authentifier l'utilisateur auprès du serveur » devient « À authentifier l'utilisateur auprès du serveur sans mot de passe »

**Q26.** En quoi consiste une attaque XSS stockée ?
- C : « L'attaquant injecte une requête SQL dans un formulaire » devient « L'attaquant injecte une requête SQL dans un formulaire pour lire la base »
- D : « L'attaquant sature le serveur de requêtes » devient « L'attaquant sature le serveur de requêtes pour le rendre indisponible »

**Q29.** Pour les comptes utilisateurs standards, que recommandent aujourd'hui l'ANSSI et le NIST sur le changement périodique obligatoire des mots de passe ?
- A : « Ne jamais changer un mot de passe, même compromis » devient « Ne jamais imposer de changement, même lorsque le mot de passe est compromis »
- B : « L'imposer tous les 30 jours » devient « Imposer un changement tous les 30 jours, sans réutilisation des anciens »
- D : « L'imposer tous les 6 mois avec des règles de complexité renforcées » devient « Imposer un changement tous les 6 mois avec des règles de complexité renforcées »

**Q30.** Que signifie l'approche Zero Trust ?
- A : « Aucun utilisateur n'a accès au système d'information » devient « Aucun utilisateur n'a accès au système d'information sans badge physique »
- B : « Les pare-feu deviennent inutiles » devient « Les pare-feu deviennent inutiles, car chaque poste se protège lui-même »
- C : « Tous les disques doivent être chiffrés » devient « Tous les disques et tous les échanges doivent être chiffrés, sans exception »

**Q35.** Dans un script Bash, que contient la variable $? juste après l'exécution d'une commande ?
- A : « Le nombre d'arguments du script » devient « Le nombre d'arguments passés au script »
- C : « Le PID du script » devient « Le PID du dernier processus lancé »
- D : « Le nom du script » devient « Le nom du script en cours d'exécution »

**Q38.** Quel est le problème de ce code Python, si host est saisi par l'utilisateur ?
- A : « Il n'y a aucun problème » devient « Aucun, car la commande ping ne modifie rien sur le système »
- C : « Il est vulnérable au XSS » devient « Il est vulnérable au XSS si le résultat est affiché dans une page »
- D : « Il provoque un dépassement de tampon » devient « Il provoque un dépassement de tampon si host est trop long »

**Q40.** Un développeur a poussé une clé d'API dans un dépôt Git public, puis l'a supprimée dans le commit suivant. Que faut-il faire ?
- A : « Rien, puisqu'elle a été supprimée » devient « Rien, puisqu'elle a été supprimée dans le commit suivant »
- B : « Renommer le fichier qui la contenait » devient « Renommer le fichier qui la contenait et forcer un nouveau commit »
- D : « Rendre le dépôt privé, cela suffit » devient « Rendre le dépôt privé, ce qui suffit à protéger la clé »

**Q41.** Le journal /var/log/auth.log contient des centaines de lignes en quelques minutes :
- A : « Une injection SQL » devient « Une injection SQL dans le formulaire de connexion »
- B : « Une attaque par déni de service » devient « Une attaque par déni de service sur le port SSH »
- C : « Un scan de ports » devient « Un scan de ports mené depuis une seule adresse »

**Q43.** Un journal du serveur web contient la requête suivante :
- A : « Une injection SQL » devient « Une injection SQL (SQL injection) »
- B : « Une attaque XSS » devient « Une attaque XSS (cross-site scripting) »
- C : « Une attaque CSRF » devient « Une attaque CSRF (cross-site request forgery) »

**Q44.** Dans le cycle classique de réponse à incident, quelle phase suit la détection et l'analyse ?
- A : « Le retour d'expérience » devient « Le retour d'expérience et les leçons apprises »
- C : « La notification à la CNIL » devient « La notification à la CNIL et aux personnes concernées »
- D : « La préparation » devient « La préparation des équipes et des outils »

**Q50.** Le SIEM signale qu'un même compte s'est connecté à 9 h 02 depuis Paris, puis à 9 h 10 depuis Singapour. Comment l'interprétez-vous ?
- A : « Une panne du SIEM » devient « Une panne du SIEM, qui a mal géolocalisé l'une des deux connexions »
- B : « Un simple décalage horaire » devient « Un simple décalage horaire entre les journaux de deux serveurs »
- D : « Un comportement normal » devient « Un comportement normal pour un collaborateur qui voyage beaucoup »
