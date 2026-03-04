export type UserRole = 'chef_de_projet' | 'admin' | 'member';

export type ProjectStatus = 'active' | 'paused' | 'archived' | 'completed';

export type TaskStatus = 'todo' | 'in_progress' | 'done';

export type EntryType = 'project' | 'simple_category';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  avatar_url?: string;
  points: number;
  level: number;
  streak_days: number;
  last_active_date?: string;
  badges: string[];
  is_active: boolean;
  created_at: string;
}

export interface Client {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'lead';
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  client_id?: string;
  client_name?: string;
  status: ProjectStatus;
  color: string;
  created_by: string;
  assigned_users: string[];
  deadline?: string;
  real_time_minutes?: number; // Accumulated real time from timers
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role_in_project: 'owner' | 'member';
  created_at: string;
}

export interface ProjectTimerSession {
  id: string;
  project_id: string;
  started_by: string;
  started_at: string;
  ended_at?: string;
  total_minutes?: number;
  created_at: string;
}

export interface PlanningSheet {
  id: string;
  project_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PlanningColumn {
  id: string;
  sheet_id: string;
  name: string;
  order_index: number;
  type: string;
}

export interface PlanningRow {
  id: string;
  sheet_id: string;
  order_index: number;
}

export interface PlanningCell {
  id: string;
  row_id: string;
  column_id: string;
  value_text: string;
  updated_at: string;
}

export interface LotTemplate {
  id: string;
  name: string;
  estimated_hours?: number;
  order_index: number;
  is_default: boolean;
}

export interface ProjectLot {
  id: string;
  project_id: string;
  template_id?: string;
  custom_name?: string;
  estimated_hours: number;
  actual_hours: number; // Kept for backward compatibility in hours
  real_time_minutes?: number; // Accumulated real time in minutes
  order_index: number;
  created_at: string;
}

export interface Task {
  // Legacy or Generic Task interface - keeping for compatibility if utilized elsewhere
  id: string;
  lot_id: string;
  name: string;
  description?: string;
  estimated_hours?: number;
  actual_hours: number;
  status: TaskStatus;
  order_index: number;
  created_at: string;
}

export interface LotTask {
  id: string;
  project_id: string;
  lot_id: string;
  name: string;
  estimated_minutes: number;
  created_by?: string;
  created_at: string;
  legacy_task_id?: string;
  // Computed fields from joins
  real_time_minutes?: number;
  creator?: Profile;
}

export interface SimpleCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface TimeEntry {
  id: string;
  user_id: string;
  entry_type: EntryType;
  project_id?: string;
  lot_id?: string;
  task_id?: string;
  lot_task_id?: string;
  category_id?: string;
  start_time: string;
  end_time?: string;
  duration_minutes: number;
  auto_pause_minutes: number;
  notes?: string;
  created_at: string;
  updated_at?: string;
  is_modified: boolean;
  modified_at?: string;
  is_manual_entry: boolean;
}

export interface ActiveSession {
  id: string;
  user_id: string;
  time_entry_id: string;
  started_at: string;
  last_ping: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  points: number;
  criteria: Record<string, any>;
}

export interface UserAchievement {
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
}

export interface ProjectWithDetails extends Project {
  lots?: ProjectLot[];
  members?: ProjectMember[];
  timer_sessions?: ProjectTimerSession[];
  total_estimated_hours?: number;
  total_actual_hours?: number;
  progress_percentage?: number;
  clients?: Partial<Client> | null;
}

export interface Report {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  file_path: string;
  file_type?: string;
  file_size?: number;
  created_by?: string;
  created_at: string;
}

export interface TimeEntryWithDetails extends TimeEntry {
  project?: Project;
  lot?: ProjectLot;
  task?: Task;
  lot_task?: LotTask;
  category?: SimpleCategory;
  profile?: Profile;
}

export interface LeaderboardEntry {
  user: Profile;
  weekly_hours: number;
  weekly_points: number;
  rank: number;
}
