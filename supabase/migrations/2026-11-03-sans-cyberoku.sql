-- Retire les énigmes CYBEROKU de l'épreuve B1 déjà chargée (QCM de Dylan seuls).
delete from attempts a using invites i, profiles p
 where i.preview and p.email = i.email and a.candidate_id = p.id and a.test_id = i.test_id
   and i.test_id in (select id from tests where title = $q$Admission Bachelor 1 Cybersécurité 2026$q$);
delete from questions where test_id in (select id from tests where title = $q$Admission Bachelor 1 Cybersécurité 2026$q$)
   and (prompt like 'Énigme CYBEROKU%' or domain = 'Énigmes CYBEROKU');
update questions q set position = n.rn from (
  select id, dense_rank() over (partition by test_id order by position) as rn from questions
   where test_id in (select id from tests where title = $q$Admission Bachelor 1 Cybersécurité 2026$q$)) n
 where q.id = n.id;
update tests set description = $q$QCM d'admission B1 Cyber (proposition de Dylan, v2, relue). 50 questions, 66 minutes, 1 point par question ; questions à plusieurs réponses : tout ou rien. Aucun prérequis technique : logique, raisonnement pas à pas et bons réflexes numériques. Plus une enquête Crime GeoGuess (7 minutes, 4 points) et trois exercices de détection du phishing dans Cybersup OS (9 minutes, 6 points). Seuil d'admissibilité proposé : 30/60.$q$, duration_minutes = 66, pass_mark = 30,
       domain_floors = $q${"Algorithmique": 0.3, "Anglais": 0.3, "Fonctionnement du numérique": 0.3, "Logique et raisonnement": 0.3, "Réflexes cyber": 0.3}$q$::jsonb
 where title = $q$Admission Bachelor 1 Cybersécurité 2026$q$;
