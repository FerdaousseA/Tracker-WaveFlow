
# 🌊 WaveFlow

> Modern Project Management, Planning & Time Tracking SaaS built with Next.js and Supabase.

WaveFlow is a full-featured project management and productivity platform designed for digital teams and agencies.  
It integrates advanced planning, task management, real-time tracking, dashboards, notifications, reporting and role-based access control in a secure and scalable SaaS architecture.

---

# 🚀 Core Features

---

## 🗂 Projets
- Create and manage multiple projects
- Project ownership system
- Multi-project secure architecture
- Project-based team assignment
- Data isolation per project

---

## 📊 Planning (Google Sheets–like)

- Dynamic spreadsheet-style grid
- Drag & drop row reordering
- Cell merging (rows / columns / rectangular merge)
- Structured planning per project
- Persistent storage in Supabase
- Excel (.xlsx) import support
- Independent planning persistence layer

---

## 📥 Excel Import
- Upload any `.xlsx` file
- Automatically parse rows and columns
- Preserve Excel structure
- Store imported sheets in database
- Render Excel sheets directly inside WaveFlow

---

## ✅ Tâches
- Task creation and assignment
- Status management
- Task-to-lot relationship
- Linked with tracker & timesheets
- Time accumulation per task

---

## ⏱ Tracker (Real-Time Time Tracking)

The Tracker is the productivity engine of WaveFlow.

- Start / Stop task-based timer
- Real-time session tracking
- Automatic duration calculation
- Persistent session storage
- Link tracked time directly to:
  - Tasks
  - Projects
  - Users
- Feeds dashboards, ranking and reports

---

## 📄 Feuilles de Temps (Timesheets)

- Manual time entry
- View all tracked sessions
- Daily / weekly breakdown
- Total hours calculation
- Per-user time visibility
- Manager validation ready structure

---

## 📊 Dashboards

### 👤 Personal Dashboard (All Users)
- Personal productivity summary
- Total hours worked
- Active projects overview
- Task progress status
- Recent activity

### 👨‍💼 Admin / Chef de Projet Dashboard
- Project performance metrics
- Team productivity overview
- Aggregated tracked hours
- Ranking visibility
- Time distribution per project
- Activity insights

Dashboards are powered by aggregated Supabase queries and real-time calculations.

---

## 🏆 Classement (Productivity Ranking)

- Ranking based on tracked hours
- Time contribution scoring
- User comparison per project
- Gamification logic
- Encourages engagement & accountability

---

## 📑 Rapports

- Project-based reports
- Time-based reports
- User productivity reports
- Aggregated statistics
- Data export ready structure

---

## 🔔 Notifications

WaveFlow includes a built-in notification system:

- Task assignment notifications
- Project updates
- Activity alerts
- Role or team updates
- Real-time visibility of important actions

Notifications improve team coordination and productivity.

---

## ⚙️ Paramètres (Settings)

Users can manage:

- Account preferences
- Application configuration
- Role-based settings visibility
- Project preferences
- Interface customizations (future-ready structure)

---

## 👤 Profil

Each user has a personal profile page including:

- Personal information
- Role display
- Productivity summary
- Activity overview
- Account management options

---

## 👥 Équipe

- Team management
- Role assignment
- Member invitation logic
- Secure access control
- Project-based membership isolation

---

# 🔐 Role-Based Access Control

WaveFlow implements three global roles:

- **admin** → Global read-only access  
- **chef_de_projet** → Full management rights  
- **member** → Project-scoped permissions  

Security is enforced using **Supabase Row Level Security (RLS)** at database level.

---

# 🏗 Architecture

WaveFlow follows a modern SaaS architecture:

Frontend (Next.js App Router + TypeScript)
        ↓
Supabase Backend (PostgreSQL + RLS + RPC)
        ↓
Database-level multi-tenant isolation

All permissions are enforced at database level using RLS policies.

---

# 🛠 Tech Stack

### Frontend
- Next.js (App Router)
- React
- TypeScript
- Tailwind CSS
- three.js

### Backend
- Supabase
- PostgreSQL
- Row Level Security (RLS)
- Supabase RPC
- Custom SQL migrations

### Security
- Supabase Authentication
- JWT-based authentication
- Role-based access control
- Multi-tenant isolation

### Development Environment
- Windows + PowerShell
- Supabase CLI
- VS Code 

---


# ⚙️ Installation

### Clone repository

```bash
git clone https://github.com/your-username/waveflow.git
cd waveflow
```

### Install dependencies

```bash
npm install
```

### Setup environment variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### Run locally

```bash
npm run dev
```

App runs at:

http://localhost:3000

---

# 🗄 Database Management

Push changes:

```bash
npx supabase db push
```

Repair migrations:

```bash
npx supabase migration repair
```


