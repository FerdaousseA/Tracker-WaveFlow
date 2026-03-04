export const COLORS = {
  primaryWhite: '#FFFFFF',
  darkGray: '#2D3748',
  navyBlue: '#1A365D',
  turquoise: '#06B6D4',
  turquoiseLight: '#22D3EE',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
} as const;

export const DEFAULT_LOTS = [
  'Backend',
  'Frontend',
  'Tests',
  'IA',
  'Workflow',
  'Design',
  'DevOps',
  'Réunion',
] as const;

export const PROJECT_COLORS = [
  '#06B6D4',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#F97316',
  '#14B8A6',
] as const;

export const WEEKLY_GOAL_HOURS = 40;

export const WORK_SCHEDULE = {
  monday: { start: '08:00', end: '18:00', pause: { start: '13:00', end: '14:00' } },
  tuesday: { start: '08:00', end: '18:00', pause: { start: '13:00', end: '14:00' } },
  wednesday: { start: '08:00', end: '18:00', pause: { start: '13:00', end: '14:00' } },
  thursday: { start: '08:00', end: '18:00', pause: { start: '13:00', end: '14:00' } },
  friday: { start: '08:00', end: '18:00', pause: { start: '13:00', end: '15:00' } },
  saturday: { start: '08:00', end: '13:00', pause: null },
  sunday: null,
} as const;
