Grille d'entretien M1 Cyber 2026 (Dylan Charré, version condensée du document Drive)

1. Vous découvrez un fichier suspect sur un serveur. Que faites-vous ?
   Attendu : isoler sans éteindre, préserver les preuves (copie, empreinte, journaux), rechercher l'empreinte sans envoyer le fichier sur VirusTotal, chercher l'origine et la propagation, ne rien supprimer avant d'avoir compris, corriger, informer.
2. Quelle politique de mots de passe mettriez-vous en place aujourd'hui ?
   Attendu : longueur plutôt que complexité, MFA, contrôle des mots de passe compromis, changement sur incident, gestionnaire de mots de passe, comptes administrateurs séparés.
3. On vous demande de tester la sécurité du site web de l'entreprise. Comment procédez-vous ?
   Attendu : autorisation écrite et périmètre, préproduction, reconnaissance puis OWASP Top 10, rapport hiérarchisé avec recommandations.
4. Comment sécurisez-vous les échanges entre un serveur local et le cloud ?
   Attendu : VPN ou TLS mutuel, IAM minimal, secrets dans un coffre, filtrage et segmentation, journalisation centralisée.
5. Vendredi 17 h : faille critique activement exploitée sur votre VPN exposé. Que faites-vous ?
   Attendu : ne pas attendre lundi, évaluer l'exposition, chercher des traces, contournement ou correctif d'urgence validé, communiquer.
6. PME de 80 personnes sans politique de sécurité : vos cinq premières actions, dans quel ordre ?
   Attendu : inventaire, sauvegardes isolées et testées, MFA messagerie et accès distants, mises à jour, comptes admin séparés, sensibilisation ; guide d'hygiène ANSSI, priorisation par le risque.
7. Segmenter le réseau (postes, serveurs, Wi-Fi invités, imprimantes, administration) : zones et flux ?
   Attendu : un VLAN par zone, filtrage par pare-feu, Wi-Fi invités isolé, DMZ, réseau d'administration via bastion, matrice des flux, imprimantes isolées.
   S'il bloque : « Un invité sur le Wi-Fi peut-il joindre vos serveurs ? »
8. Comment protégez-vous les comptes administrateurs d'un domaine AD ?
   Attendu : peu de membres dans « Admins du domaine », comptes distincts, tiering, MFA, LAPS, Protected Users, surveillance des groupes à privilèges.
   S'il bloque : « Un admin du domaine se connecte sur un poste infecté : que risque-t-il ? »
9. Comment détecteriez-vous qu'un attaquant est déjà présent sur le réseau ?
   Attendu : SIEM et EDR, connaissance du normal, signaux (horaires et lieux anormaux, nouveaux comptes ou ajouts à des groupes admin, RDP ou SMB entre postes, trafic sortant ou DNS inhabituel, antivirus désactivé). Bonus : threat hunting.
   S'il bloque : « Un attaquant a un compte valide : qu'est-ce qui le trahirait ? »
10. Valider la sécurité d'une application web avant sa mise en ligne : que vérifiez-vous ?
   Attendu : authentification et sessions, contrôle d'accès par rôle, validation des entrées (OWASP), secrets hors du code, dépendances, HTTPS et en-têtes, journalisation, exposition, scan ou test d'intrusion.
   S'il bloque : « Qu'est-ce qui permettrait à un utilisateur de voir les données d'un autre ? »
