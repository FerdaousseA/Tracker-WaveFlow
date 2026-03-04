import { supabase } from './supabase';
import { startOfMonth, subMonths, format, subDays, eachDayOfInterval, isSameDay, isWithinInterval, startOfDay, endOfDay, differenceInMinutes, subHours } from 'date-fns';
import { fr } from 'date-fns/locale';

export interface ProjectHealth {
    id: string;
    name: string;
    color: string;
    hours: number;
    tasksCount: number;
    completedTasks: number;
    progress: number;
    status: string;
    memberCount: number;
}

export interface Anomaly {
    id: string;
    type: 'long_session' | 'missing_tracking' | 'late_activity';
    user_name: string;
    date: string;
    details: string;
    severity: 'low' | 'medium' | 'high';
}

export interface DashboardStats {
    myTimeToday: number;
    myTimeWeek: number;
    myActiveProjects: number;
    teamTimeWeek?: number;
    activeMembers?: number;
    totalMembers?: number;
    weeklyTrend: { name: string; value: number }[];
    projectBreakdown: { name: string; value: number; color: string }[];
    recentActivity: any[];
}

export interface GlobalAnalytics {
    totalHours: number;
    previousTotalHours: number;
    percentChange: number;
    tasksCompleted: number;
    activeProjects: number;
    activeMembers: number;
    projectBreakdown: { name: string; hours: number; color: string }[];
    memberBreakdown: { name: string; hours: number; color: string }[];
    statusDistribution: { name: string; value: number; fill: string }[];
    activityTrend: { name: string; current: number; previous: number }[];
    dailyActivity: { date: string; hours: number }[];
    radarData: { subject: string; A: number; fullMark: number }[];
    anomalies: Anomaly[];
    projectHealth: ProjectHealth[];
    drillDownEntries: any[];
}

export interface FilterOptions {
    startDate?: Date;
    endDate?: Date;
    projectId?: string;
    memberId?: string;
    granularity?: 'day' | 'week' | 'month';
}

// Helper to normalize Supabase join results (sometimes returns array depending on API version/config)
const normalize = (val: any) => Array.isArray(val) ? val[0] : val;

export const analyticsService = {
    async fetchDashboardData(userId: string, role: string): Promise<DashboardStats> {
        try {
            const todayStart = startOfDay(new Date());
            const weekStart = subDays(todayStart, 7);
            const isAdminOrChef = role === 'admin' || role === 'chef_de_projet';

            const [
                { data: myEntriesToday, error: err1 },
                { data: myEntriesWeek, error: err2 },
                { data: myProjects, error: err3 },
                { data: teamEntriesWeek, error: err4 },
                { data: allMembers, error: err5 }
            ] = await Promise.all([
                supabase.from('time_entries').select('duration_minutes').eq('user_id', userId).gte('start_time', todayStart.toISOString()),
                supabase.from('time_entries').select('duration_minutes, start_time').eq('user_id', userId).gte('start_time', weekStart.toISOString()),
                supabase.from('project_members').select('project_id').eq('user_id', userId),
                isAdminOrChef ? supabase.from('time_entries').select('duration_minutes').gte('start_time', weekStart.toISOString()) : Promise.resolve({ data: [], error: null }),
                isAdminOrChef ? supabase.from('profiles').select('id, is_active') : Promise.resolve({ data: [], error: null })
            ]);

            if (err1 || err2 || err3 || err4 || err5) {
                console.error('Supabase error in dashboard fetch:', { err1, err2, err3, err4, err5 });
            }

            const myTimeToday = (myEntriesToday?.reduce((acc, curr) => acc + curr.duration_minutes, 0) || 0) / 60;
            const myTimeWeek = (myEntriesWeek?.reduce((acc, curr) => acc + curr.duration_minutes, 0) || 0) / 60;
            const teamTimeWeek = isAdminOrChef ? (teamEntriesWeek?.reduce((acc, curr) => acc + curr.duration_minutes, 0) || 0) / 60 : undefined;

            // Weekly Trend for Dashboard
            const days = eachDayOfInterval({ start: weekStart, end: new Date() });
            const weeklyTrend = days.map(day => {
                const dayMinutes = (myEntriesWeek || [])
                    .filter(te => isSameDay(new Date(te.start_time), day))
                    .reduce((acc, curr) => acc + curr.duration_minutes, 0);
                return {
                    name: format(day, 'EEE', { locale: fr }),
                    value: Number((dayMinutes / 60).toFixed(1))
                };
            });

            // Recent Activity with normalized joins
            const { data: rawActivity, error: activityErr } = await supabase
                .from('time_entries')
                .select(`
                    id, start_time, duration_minutes, notes, user_id, project_id,
                    project:projects(name, color),
                    profile:profiles!user_id(full_name)
                `)
                .order('start_time', { ascending: false })
                .limit(10);

            if (activityErr) console.error('Activity fetch error:', activityErr);

            const recentActivity = (rawActivity || []).map(te => ({
                ...te,
                project: normalize(te.project),
                profile: normalize(te.profile)
            }));

            return {
                myTimeToday: Number(myTimeToday.toFixed(1)),
                myTimeWeek: Number(myTimeWeek.toFixed(1)),
                myActiveProjects: myProjects?.length || 0,
                teamTimeWeek: teamTimeWeek ? Number(teamTimeWeek.toFixed(1)) : undefined,
                activeMembers: allMembers?.filter(m => m.is_active).length || 0,
                totalMembers: allMembers?.length || 0,
                weeklyTrend,
                projectBreakdown: [], // Handled by UI
                recentActivity
            };
        } catch (error) {
            console.error('Critical dashboard error:', error);
            throw error;
        }
    },

    async fetchGlobalAnalytics(filters: FilterOptions): Promise<GlobalAnalytics> {
        try {
            const now = filters.endDate || new Date();
            const start = filters.startDate || subDays(now, 30);
            const prevDuration = differenceInMinutes(now, start);
            const prevStart = subDays(start, Math.ceil(prevDuration / (60 * 24)));

            // 1. Fetch Core Data with Filters
            let query = supabase.from('time_entries').select(`
                id, start_time, duration_minutes, notes, user_id, project_id,
                project:projects(name, color, status),
                profile:profiles!user_id(full_name)
            `).gte('start_time', prevStart.toISOString()).lte('start_time', now.toISOString());

            if (filters.projectId) query = query.eq('project_id', filters.projectId);
            if (filters.memberId) query = query.eq('user_id', filters.memberId);

            const [
                { data: rawEntries, error: entErr },
                { data: tasks, error: taskErr },
                { data: projects, error: projErr },
                { data: profiles, error: profErr }
            ] = await Promise.all([
                query,
                supabase.from('tasks').select('id, status, project_id'),
                supabase.from('projects').select('id, name, color, status'),
                supabase.from('profiles').select('id, full_name, points')
            ]);

            if (entErr || taskErr || projErr || profErr) {
                console.error('Supabase error in analytics fetch:', { entErr, taskErr, projErr, profErr });
            }

            const safeEntries = (rawEntries || []).map(te => ({
                ...te,
                project: normalize(te.project),
                profile: normalize(te.profile)
            }));

            const currentEntries = safeEntries.filter(te => isWithinInterval(new Date(te.start_time), { start, end: now }));
            const previousEntries = safeEntries.filter(te => isWithinInterval(new Date(te.start_time), { start: prevStart, end: start }));

            const totalMinutes = currentEntries.reduce((acc, curr) => acc + curr.duration_minutes, 0);
            const prevMinutes = previousEntries.reduce((acc, curr) => acc + curr.duration_minutes, 0);
            const totalHours = Math.round(totalMinutes / 60);
            const prevHours = Math.round(prevMinutes / 60);

            const percentChange = prevHours > 0 ? ((totalHours - prevHours) / prevHours) * 100 : 0;

            const projectMinutes = new Map<string, number>();
            const memberMinutes = new Map<string, number>();
            currentEntries.forEach(te => {
                if (te.project_id) projectMinutes.set(te.project_id, (projectMinutes.get(te.project_id) || 0) + te.duration_minutes);
                if (te.user_id) memberMinutes.set(te.user_id, (memberMinutes.get(te.user_id) || 0) + te.duration_minutes);
            });

            const projectBreakdown = (projects || []).map(p => ({
                name: p.name,
                hours: Math.round((projectMinutes.get(p.id) || 0) / 60),
                color: p.color
            })).sort((a, b) => b.hours - a.hours).slice(0, 5);

            const memberBreakdown = (profiles || []).map(p => ({
                name: p.full_name,
                hours: Math.round((memberMinutes.get(p.id) || 0) / 60),
                color: '#3b82f6'
            })).sort((a, b) => b.hours - a.hours).slice(0, 5);

            const days = eachDayOfInterval({ start, end: now });
            const dailyActivity = days.map(day => {
                const dayMinutes = currentEntries
                    .filter(te => isSameDay(new Date(te.start_time), day))
                    .reduce((acc, curr) => acc + curr.duration_minutes, 0);
                return {
                    date: format(day, 'dd/MM'),
                    hours: Number((dayMinutes / 60).toFixed(1))
                };
            });

            const anomalies: Anomaly[] = [];
            currentEntries.forEach(te => {
                if (te.duration_minutes > 480) {
                    anomalies.push({
                        id: te.id,
                        type: 'long_session',
                        user_name: te.profile?.full_name || 'Inconnu',
                        date: format(new Date(te.start_time), 'PP', { locale: fr }),
                        details: `Session de ${Math.round(te.duration_minutes / 60)}h ${te.duration_minutes % 60}m`,
                        severity: 'high'
                    });
                }
            });

            const tasksCompleted = (tasks || []).filter(t => t.status === 'done').length;
            const statusCounts = (tasks || []).reduce((acc: any, t) => {
                acc[t.status] = (acc[t.status] || 0) + 1;
                return acc;
            }, { todo: 0, in_progress: 0, done: 0 });

            return {
                totalHours,
                previousTotalHours: prevHours,
                percentChange: Number(percentChange.toFixed(1)),
                tasksCompleted,
                activeProjects: (projects || []).filter(p => p.status === 'active').length,
                activeMembers: (profiles || []).filter(p => memberMinutes.has(p.id)).length,
                projectBreakdown,
                memberBreakdown,
                statusDistribution: [
                    { name: 'À faire', value: statusCounts.todo, fill: '#94a3b8' },
                    { name: 'En cours', value: statusCounts.in_progress, fill: '#3b82f6' },
                    { name: 'Terminé', value: statusCounts.done, fill: '#22c55e' },
                ],
                activityTrend: [],
                dailyActivity,
                radarData: [
                    { subject: 'Efficacité', A: 85, fullMark: 100 },
                    { subject: 'Volume', A: Math.min(100, (totalHours / 160) * 100), fullMark: 100 },
                    { subject: 'Vitesse', A: tasksCompleted > 0 ? 90 : 20, fullMark: 100 },
                    { subject: 'Régularité', A: 75, fullMark: 100 },
                ],
                anomalies,
                projectHealth: (projects || []).map(p => {
                    const pTasks = (tasks || []).filter(t => t.project_id === p.id);
                    const pCompleted = pTasks.filter(t => t.status === 'done').length;
                    return {
                        id: p.id,
                        name: p.name,
                        color: p.color,
                        hours: Math.round((projectMinutes.get(p.id) || 0) / 60),
                        tasksCount: pTasks.length,
                        completedTasks: pCompleted,
                        progress: pTasks.length > 0 ? Math.round((pCompleted / pTasks.length) * 100) : 0,
                        status: p.status,
                        memberCount: (profiles || []).length
                    };
                }),
                drillDownEntries: safeEntries.slice(0, 50)
            };
        } catch (error) {
            console.error('Critical analytics error:', error);
            throw error;
        }
    }
};
