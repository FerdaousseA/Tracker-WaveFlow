import { supabase } from './supabase';
import type { Profile } from '@/types';

export function calculatePointsForDuration(durationMinutes: number): number {
  const hours = durationMinutes / 60;
  return Math.floor(hours);
}

export function calculateLevel(points: number): number {
  if (points < 100) return 1;
  if (points < 250) return 2;
  if (points < 500) return 3;
  if (points < 1000) return 4;
  if (points < 2000) return 5;
  if (points < 4000) return 6;
  if (points < 8000) return 7;
  if (points < 15000) return 8;
  if (points < 25000) return 9;
  if (points < 40000) return 10;

  return Math.floor(10 + (points - 40000) / 5000);
}

export function getPointsForNextLevel(currentPoints: number): number {
  const currentLevel = calculateLevel(currentPoints);

  const levelThresholds = [0, 100, 250, 500, 1000, 2000, 4000, 8000, 15000, 25000, 40000];

  if (currentLevel < levelThresholds.length) {
    return levelThresholds[currentLevel];
  }

  return 40000 + (currentLevel - 10) * 5000;
}

export async function awardPoints(userId: string, durationMinutes: number, hasNotes: boolean = false) {
  const points = calculatePointsForDuration(durationMinutes);
  const bonusPoints = hasNotes ? 5 : 0;
  const totalPoints = points + bonusPoints;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('points, level')
    .eq('id', userId)
    .maybeSingle();

  if (profileError || !profile) return;

  const newPoints = profile.points + totalPoints;
  const newLevel = calculateLevel(newPoints);

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      points: newPoints,
      level: newLevel,
    })
    .eq('id', userId);

  if (updateError) {
    console.error('Error updating points:', updateError);
  }

  return { pointsAwarded: totalPoints, newLevel };
}

export async function updateStreak(userId: string) {
  const today = new Date().toISOString().split('T')[0];

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('streak_days, last_active_date')
    .eq('id', userId)
    .maybeSingle();

  if (profileError || !profile) return;

  const lastActiveDate = profile.last_active_date;
  let newStreakDays = profile.streak_days;

  if (!lastActiveDate) {
    newStreakDays = 1;
  } else {
    const lastDate = new Date(lastActiveDate);
    const todayDate = new Date(today);
    const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return;
    } else if (diffDays === 1) {
      newStreakDays = profile.streak_days + 1;
    } else {
      newStreakDays = 1;
    }
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      streak_days: newStreakDays,
      last_active_date: today,
    })
    .eq('id', userId);

  if (updateError) {
    console.error('Error updating streak:', updateError);
  }

  await checkAndAwardStreakAchievements(userId, newStreakDays);

  return newStreakDays;
}

async function checkAndAwardStreakAchievements(userId: string, streakDays: number) {
  const streakMilestones = [
    { days: 3, name: 'Fire Starter' },
    { days: 7, name: 'On Fire' },
    { days: 14, name: 'Unstoppable' },
    { days: 30, name: 'Legend' },
  ];

  for (const milestone of streakMilestones) {
    if (streakDays >= milestone.days) {
      const { data: achievement } = await supabase
        .from('achievements')
        .select('id')
        .eq('name', milestone.name)
        .maybeSingle();

      if (achievement) {
        const { data: existing } = await supabase
          .from('user_achievements')
          .select('*')
          .eq('user_id', userId)
          .eq('achievement_id', achievement.id)
          .maybeSingle();

        if (!existing) {
          await supabase
            .from('user_achievements')
            .insert({
              user_id: userId,
              achievement_id: achievement.id,
            });
        }
      }
    }
  }
}

export function getMotivationalMessage(context: 'start' | 'long_session' | 'end_productive' | 'badge' | 'streak' | 'weekly_goal'): string {
  const messages = {
    start: [
      "C'est parti ! 🚀",
      "Let's do this! 💪",
      "Focus mode ON 🎯",
      "Prêt à briller ? ✨",
      "En avant ! 🌊",
    ],
    long_session: [
      "Wow, tu es dans le flow ! 🌊",
      "Tu es en feu ! 🔥",
      "Concentration maximale ! 🎯",
      "Impressionnant ! 💪",
    ],
    end_productive: [
      "Excellente journée ! Tu as explosé tes objectifs ! 🎉",
      "Bravo, journée productive au top ! 🌟",
      "Tu es une machine ! Superbe travail ! 💪",
      "Quelle performance ! 🚀",
    ],
    badge: [
      "Badge débloqué ! 🎊",
      "Nouveau badge gagné ! 🏆",
      "Achievement unlocked! ⭐",
    ],
    streak: [
      "Série maintenue ! Continue comme ça ! 🔥",
      "Ta régularité est impressionnante ! 💪",
      "Rien ne t'arrête ! 🚀",
    ],
    weekly_goal: [
      "Semaine parfaite ! +50 points bonus ! ⭐",
      "Objectif hebdo atteint ! Bravo ! 🎯",
      "100% cette semaine ! Tu es au top ! 🏆",
    ],
  };

  const contextMessages = messages[context];
  return contextMessages[Math.floor(Math.random() * contextMessages.length)];
}
