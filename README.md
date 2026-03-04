# 🌊 WaveFlow

**Surfez sur votre productivité**

Application de time tracking intelligente et gamifiée pour Wave Digital Agency.

![WaveFlow Banner](https://res.cloudinary.com/du3hl0zhl/image/upload/v1761043361/LOGO_WAVE_DIGITA_AGENCY_2025_rjyfg9.png)

## ✨ Fonctionnalités principales

### 🎯 Time Tracking
- Timer intelligent avec démarrage/arrêt simple
- Tracking par projet > lot > tâche
- Catégories simples (Documentation, Veille, Réunion, Autre)
- Calcul automatique des pauses selon planning
- Modification a posteriori avec traçabilité
- Historique détaillé des sessions

### 🎮 Gamification
- **Système de points** : Gagnez des points en trackant votre temps
- **Niveaux** : Progressez et montez en niveau
- **Badges** : Débloquez des achievements
- **Séries (Streaks)** : Maintenez votre régularité
- **Classement** : Comparez-vous aux autres (de manière saine et motivante)

### 📊 Analytics & Dashboards
- Dashboard global pour Admin/PO
- Statistiques personnelles pour chaque développeur
- Graphiques de répartition du temps
- Suivi budget vs réel par projet
- Alertes de dépassement
- KPIs en temps réel

### 👥 Gestion d'équipe
- 3 rôles : Admin, PO, Dev
- Permissions granulaires
- Vue par projet et par personne
- Exports pour facturation

## 🎨 Design moderne

- Interface épurée et intuitive
- Police Red Hat Display
- Palette de couleurs turquoise & navy blue
- Animations fluides
- Responsive design
- Mode sombre (à venir)

## 🛠️ Stack technique

- **Frontend** : Next.js 14, React 18, TypeScript
- **UI** : Tailwind CSS, shadcn/ui
- **Database** : Supabase (PostgreSQL)
- **Auth** : Supabase Auth
- **Icons** : Lucide React
- **Charts** : Recharts (à venir)

## 🚀 Installation

L'application est déjà configurée et prête à l'emploi.

### Prérequis
- Node.js 18+
- Compte Supabase (déjà configuré)

### Configuration
1. Les variables d'environnement sont dans `.env`
2. La base de données est configurée automatiquement
3. Créez votre compte via la page d'inscription (recommandé) ou manuellement
4. Consultez SETUP_INSTRUCTIONS.md pour plus de détails

### Création du premier compte

**Méthode simple :**
1. Lancez l'application
2. Cliquez sur "Créer un compte" sur la page de connexion
3. Remplissez le formulaire et choisissez le rôle "Administrateur"
4. Connectez-vous automatiquement

## 📖 Documentation

Consultez [SETUP_INSTRUCTIONS.md](./SETUP_INSTRUCTIONS.md) pour :
- Instructions détaillées de configuration
- Création de données de test
- Guide d'utilisation
- Architecture technique
- Sécurité et RLS

## 🎯 Utilisation

### Développeur
1. Connectez-vous
2. Allez sur **Tracker**
3. Démarrez un timer sur un projet ou une activité
4. Travaillez
5. Arrêtez le timer et ajoutez des notes (optionnel)
6. Gagnez des points et des badges !

### Admin / PO
Toutes les fonctionnalités développeur PLUS :
- Dashboard avec vue d'ensemble
- Analytics détaillés
- Gestion des projets
- Gestion de l'équipe
- Exports et rapports

## 🏆 Système de gamification

### Gagnez des points
- ⏱️ 1 point par heure trackée
- 📝 +5 points avec des notes
- 🔥 +10 points par jour consécutif
- 🎯 +50 points pour semaine complète

### Débloquez des badges
- 🔥 **Fire Starter** : 3 jours d'affilée
- 🔥🔥 **On Fire** : 7 jours d'affilée
- 🔥🔥🔥 **Unstoppable** : 14 jours
- ⚡ **Speed Demon** : 10h en une journée
- 🎯 **Perfect Week** : Objectif hebdo 100%
- Et bien d'autres...

## 🔒 Sécurité

- Row Level Security (RLS) activé sur toutes les tables
- Développeurs voient uniquement leurs données
- Admin/PO ont accès complet
- Authentification sécurisée via Supabase
- Sessions JWT avec auto-refresh

## 📈 Roadmap

### Phase 1 - MVP ✅
- [x] Time tracking basique
- [x] Projets/lots/tâches
- [x] Gamification
- [x] Classement
- [x] Calcul pauses auto

### Phase 2 - En cours
- [ ] Dashboard complet
- [ ] Analytics avancés
- [ ] Gestion projets CRUD
- [ ] Exports Excel/PDF
- [ ] Notifications

### Phase 3 - À venir
- [ ] App mobile
- [ ] Mode sombre
- [ ] IA pour suggestions
- [ ] Intégrations (Slack, etc.)
- [ ] Rapports automatiques

## 🤝 Contribution

Ce projet est développé pour Wave Digital Agency.

## 📄 Licence

Propriété de Wave Digital Agency.

## 📞 Support

Pour toute question, consultez la documentation ou contactez l'équipe technique.

---

**WaveFlow** - Parce que chaque minute compte ! 🌊

Développé avec par Wave Digital Agency
