# WaveFlow - Instructions de Configuration

## 🎯 Aperçu

WaveFlow est votre application de time tracking intelligente et gamifiée pour Wave Digital Agency.

## 🚀 Fonctionnalités implémentées

### ✅ Core Features
- **Authentication complète** : Connexion/déconnexion sécurisée avec Supabase Auth
- **Timer intelligent** : Démarrage/arrêt de sessions avec calcul automatique des pauses
- **Gestion des projets** : Structure projets > lots > tâches
- **Catégories simples** : Documentation, Veille, Réunion, Autre
- **Gamification** : Points, niveaux, badges, séries (streaks)
- **Classement** : Leaderboard en temps réel
- **Calcul automatique des pauses** : Selon le planning de travail

### 📊 Pages créées
1. **Login** - Page de connexion avec design moderne
2. **Tracker** - Interface principale de time tracking
3. **Dashboard** - Vue d'ensemble pour Admin/PO (placeholder)
4. **Mes Stats** - Statistiques personnelles pour développeurs
5. **Analytics** - Analytics avancés pour Admin/PO (placeholder)
6. **Projets** - Gestion des projets (placeholder)
7. **Équipe** - Gestion de l'équipe (placeholder)
8. **Classement** - Leaderboard avec design gamifié
9. **Paramètres** - Configuration utilisateur

## 🔧 Configuration initiale

### 1. Variables d'environnement

Les variables Supabase sont déjà configurées dans `.env` :
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY

### 2. Base de données

La base de données Supabase a été configurée automatiquement avec :
- Toutes les tables nécessaires
- Row Level Security (RLS) activé
- Policies de sécurité
- Lots templates par défaut
- Catégories simples par défaut
- Achievements/badges par défaut

### 3. Créer un compte

Deux méthodes pour créer un compte :

#### Méthode 1 : Via la page d'inscription (Recommandé)

1. Lancez l'application
2. Sur la page de connexion, cliquez sur **"Créer un compte"**
3. Remplissez le formulaire :
   - Nom complet : Ayoub Benali
   - Email : ayoub@wavedigital.ma
   - Mot de passe : (votre choix, min 6 caractères)
   - Rôle : Administrateur
4. Cliquez sur **"Créer mon compte"**
5. Vous serez automatiquement connecté et redirigé vers le Tracker

#### Méthode 2 : Manuellement via Supabase (Alternative)

1. Allez dans votre dashboard Supabase
2. Allez dans Authentication > Users
3. Créez un nouvel utilisateur :
   - Email : ayoub@wavedigital.ma
   - Password : (votre choix)
   - Confirmer l'email immédiatement

4. Ensuite, exécutez ce SQL dans l'éditeur SQL Supabase pour créer le profil :

```sql
-- Créer le profil pour l'utilisateur (remplacez USER_ID par l'ID de l'utilisateur créé)
INSERT INTO profiles (id, full_name, role, points, level, streak_days)
VALUES (
  'USER_ID_FROM_AUTH_USERS',  -- Remplacez par l'ID réel
  'Ayoub Benali',
  'admin',
  1250,
  5,
  12
);
```

### 4. Créer des projets de test (optionnel)

```sql
-- Insérer un projet de test
INSERT INTO projects (name, client_name, status, color, created_by, assigned_users)
VALUES (
  'Bâtir',
  'Particuliers',
  'active',
  '#06B6D4',
  'USER_ID',  -- Remplacez par votre user ID
  ARRAY['USER_ID']::UUID[]
);

-- Récupérer l'ID du projet créé
SELECT id FROM projects WHERE name = 'Bâtir';

-- Ajouter des lots au projet (remplacez PROJECT_ID)
INSERT INTO project_lots (project_id, custom_name, estimated_hours, order_index)
VALUES
  ('PROJECT_ID', 'Backend', 30, 1),
  ('PROJECT_ID', 'Frontend', 40, 2),
  ('PROJECT_ID', 'Tests', 15, 3);

-- Récupérer l'ID d'un lot
SELECT id FROM project_lots WHERE project_id = 'PROJECT_ID' AND custom_name = 'Backend';

-- Ajouter des tâches à un lot (remplacez LOT_ID)
INSERT INTO tasks (lot_id, name, status, order_index)
VALUES
  ('LOT_ID', 'API Authentication', 'in_progress', 1),
  ('LOT_ID', 'Database Schema', 'todo', 2),
  ('LOT_ID', 'API Endpoints', 'todo', 3);
```

## 🎨 Architecture technique

### Stack
- **Frontend** : Next.js 14 (App Router), React 18
- **UI** : Tailwind CSS + shadcn/ui
- **Database** : Supabase (PostgreSQL)
- **Auth** : Supabase Auth
- **State Management** : React Context API
- **Icons** : Lucide React
- **Font** : Red Hat Display

### Structure du code
```
/app
  /(dashboard)          # Routes protégées
    /tracker            # Page principale de tracking
    /dashboard          # Dashboard Admin/PO
    /stats              # Stats développeur
    /analytics          # Analytics Admin/PO
    /projets            # Gestion projets
    /equipe             # Gestion équipe
    /classement         # Leaderboard
    /parametres         # Paramètres
  /login                # Page de connexion

/components
  /shared               # Composants partagés (Sidebar)
  /tracker              # Composants du tracker
  /ui                   # shadcn/ui components

/contexts
  /auth-context.tsx     # Contexte d'authentification

/hooks
  /use-timer.ts         # Hook personnalisé pour le timer
  /use-toast.ts         # Hook pour les notifications

/lib
  /supabase.ts          # Client Supabase
  /pause-calculator.ts  # Calcul des pauses automatiques
  /gamification.ts      # Logique de gamification
  /constants.ts         # Constantes de l'app

/types
  /database.ts          # Types TypeScript
```

## 🔒 Sécurité

### Row Level Security (RLS)
- **Développeurs** : Voient uniquement leurs propres données
- **Admin/PO** : Accès complet à toutes les données
- Toutes les tables sensibles ont RLS activé

### Policies implémentées
- Users can view own profile
- Users can update own profile
- Admin and PO can manage projects
- Devs can view assigned projects
- Users can view own time entries
- etc.

## 🎮 Système de gamification

### Points
- 1 point par heure trackée
- +5 points si notes ajoutées
- +10 points par jour consécutif
- +50 points pour semaine complète

### Niveaux
- Niveau 1 : 0-100 points
- Niveau 2 : 101-250 points
- Niveau 3 : 251-500 points
- etc. (progression exponentielle)

### Badges par défaut
- 🔥 Fire Starter (3 jours consécutifs)
- 🔥🔥 On Fire (7 jours)
- 🔥🔥🔥 Unstoppable (14 jours)
- 🔥🔥🔥🔥 Legend (30 jours)
- ⚡ Speed Demon (10h en 1 jour)
- 🎯 Perfect Week (100% objectif)
- 📝 Note Taker (50 sessions avec notes)
- 🌟 First Blood (premier timer)
- 🤝 Team Player (20h réunions)
- 📚 Knowledge Seeker (30h doc/veille)

## ⏰ Calcul des pauses automatiques

Le système déduit automatiquement les pauses du temps tracké :

- **Lundi à Jeudi** : 13h-14h (1h)
- **Vendredi** : 13h-15h (2h)
- **Samedi** : Pas de pause
- **Dimanche** : Pas de travail

Exemple : Si vous démarrez un timer à 12h et l'arrêtez à 15h un lundi, le système comptera 2h de travail effectif (3h - 1h de pause).

## 🚀 Lancement de l'application

L'application est déjà construite et prête. Elle démarre automatiquement.

## 📝 Utilisation

### Pour les développeurs :

1. **Se connecter** avec les identifiants créés
2. **Page Tracker** :
   - Démarrer un timer sur un projet ou une catégorie simple
   - Le timer tourne en temps réel
   - Arrêter et ajouter des notes (optionnel)
3. **Page Mes Stats** : Voir ses statistiques personnelles
4. **Page Classement** : Voir sa position et celle des collègues

### Pour Admin/PO :

Accès à toutes les pages ci-dessus PLUS :
- **Dashboard** : Vue d'ensemble de tous les projets
- **Analytics** : Analyses détaillées
- **Projets** : Créer et gérer les projets
- **Équipe** : Gérer les membres de l'équipe

## 🎯 Prochaines étapes

### Pages à compléter :
1. **Dashboard Admin/PO** : KPIs, graphiques, alertes
2. **Analytics** : Graphiques avancés, exports
3. **Gestion des projets** : CRUD complet avec lots et tâches
4. **Gestion de l'équipe** : Invitation, rôles, stats par personne
5. **Historique du jour** : Afficher les entrées de temps de la journée

### Fonctionnalités à ajouter :
1. **Exports** : Excel, PDF, CSV
2. **Notifications en temps réel** : Pushs, emails
3. **Modification a posteriori** : Interface pour corriger les entrées
4. **Détection d'inactivité** : Alertes si timer oublié
5. **Rapports automatiques** : Hebdomadaires, mensuels
6. **Mode sombre** : Thème sombre complet
7. **App mobile** : Version React Native

## 💡 Conseils

- Utilisez le classement pour motiver l'équipe
- Les badges se débloquent automatiquement
- Les séries (streaks) encouragent la régularité
- Les notes sur les sessions donnent des points bonus
- Le timer calcule automatiquement les pauses, pas besoin de les gérer manuellement

## 🐛 Débogage

Si vous rencontrez des problèmes :

1. Vérifiez que l'utilisateur existe dans `auth.users` ET dans `profiles`
2. Vérifiez les RLS policies si des données ne s'affichent pas
3. Consultez la console du navigateur pour les erreurs
4. Vérifiez les logs Supabase pour les erreurs serveur

## 📞 Support

Pour toute question ou problème, référez-vous à la documentation Supabase ou Next.js.

---

**WaveFlow** - Surfez sur votre productivité ! 🌊
