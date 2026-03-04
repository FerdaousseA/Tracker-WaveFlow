export function calculateAutoPause(startTime: Date, endTime: Date): number {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const totalDurationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);

  if (totalDurationMinutes < 15) {
    return 0;
  }

  let totalPauseMinutes = 0;

  let currentDate = new Date(start);
  currentDate.setHours(0, 0, 0, 0);

  while (currentDate <= end) {
    const dayOfWeek = currentDate.getDay();

    const sessionStart = currentDate.getTime() === new Date(start).setHours(0, 0, 0, 0)
      ? start
      : new Date(currentDate);

    const sessionEnd = currentDate.getDate() === end.getDate() &&
                       currentDate.getMonth() === end.getMonth() &&
                       currentDate.getFullYear() === end.getFullYear()
      ? end
      : new Date(currentDate.getTime() + 24 * 60 * 60 * 1000 - 1);

    if (dayOfWeek >= 1 && dayOfWeek <= 4) {
      const pauseStart = new Date(currentDate);
      pauseStart.setHours(13, 0, 0, 0);
      const pauseEnd = new Date(currentDate);
      pauseEnd.setHours(14, 0, 0, 0);

      totalPauseMinutes += calculateOverlap(sessionStart, sessionEnd, pauseStart, pauseEnd);
    }

    if (dayOfWeek === 5) {
      const pauseStart = new Date(currentDate);
      pauseStart.setHours(13, 0, 0, 0);
      const pauseEnd = new Date(currentDate);
      pauseEnd.setHours(15, 0, 0, 0);

      totalPauseMinutes += calculateOverlap(sessionStart, sessionEnd, pauseStart, pauseEnd);
    }

    currentDate.setDate(currentDate.getDate() + 1);
    currentDate.setHours(0, 0, 0, 0);
  }

  const calculatedPause = Math.floor(totalPauseMinutes);
  return Math.min(calculatedPause, Math.floor(totalDurationMinutes * 0.9));
}

function calculateOverlap(
  sessionStart: Date,
  sessionEnd: Date,
  pauseStart: Date,
  pauseEnd: Date
): number {
  const overlapStart = Math.max(sessionStart.getTime(), pauseStart.getTime());
  const overlapEnd = Math.min(sessionEnd.getTime(), pauseEnd.getTime());

  if (overlapStart < overlapEnd) {
    return (overlapEnd - overlapStart) / (1000 * 60);
  }

  return 0;
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) {
    return `${mins}min`;
  }

  if (mins === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${mins}min`;
}

export function calculateDurationMinutes(startTime: Date, endTime: Date): number {
  return Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
}
