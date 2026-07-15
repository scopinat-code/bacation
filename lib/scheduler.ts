import {
  ActivityPreference,
  DAY_KEYS,
  DAY_LABELS,
  DayKey,
  FixedEvent,
  ScheduleBlock,
  ScheduleResult,
  ScheduleWarning,
  VacationPlan,
  schoolLevelOf,
} from "./types";

type Interval = { start: number; end: number; category?: string };
const LIFE_TIME_INCREMENT = 10;

export function activityGridMinutes(plan: Pick<VacationPlan, "schoolLevel">): number {
  const level = schoolLevelOf(plan);
  if (level === "middle") return 60;
  if (level === "high") return 30;
  return 10;
}

export class MustHaveScheduleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MustHaveScheduleError";
  }
}

export function toMinutes(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function toTime(value: number): string {
  const safe = Math.max(0, Math.min(1439, value));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function isWeekend(day: DayKey) {
  return day === "sat" || day === "sun";
}

function lifeRange(plan: VacationPlan, day: DayKey): Interval {
  return isWeekend(day)
    ? { start: toMinutes(plan.lifeHours.weekendWake), end: toMinutes(plan.lifeHours.weekendSleep) }
    : { start: toMinutes(plan.lifeHours.weekdayWake), end: toMinutes(plan.lifeHours.weekdaySleep) };
}

function overlaps(a: Interval, b: Interval) {
  return a.start < b.end && b.start < a.end;
}

export function validatePlan(plan: VacationPlan): string[] {
  const errors: string[] = [];
  const lifeTimes = Object.values(plan.lifeHours).map(toMinutes);
  if (!plan.startDate || !plan.endDate) errors.push("방학 시작일과 종료일을 모두 골라주세요.");
  if (plan.startDate && plan.endDate && plan.startDate > plan.endDate) errors.push("방학 종료일은 시작일보다 뒤여야 해요.");
  if (lifeTimes.some((time) => Number.isFinite(time) && time % LIFE_TIME_INCREMENT !== 0)) errors.push("일어나고 자는 시간은 10분 단위로 골라주세요.");
  if (toMinutes(plan.lifeHours.weekdayWake) >= toMinutes(plan.lifeHours.weekdaySleep)) errors.push("평일 취침 시간은 기상 시간보다 뒤여야 해요.");
  if (toMinutes(plan.lifeHours.weekendWake) >= toMinutes(plan.lifeHours.weekendSleep)) errors.push("주말 취침 시간은 기상 시간보다 뒤여야 해요.");
  return errors;
}

export function findFixedEventConflicts(events: FixedEvent[]): string[] {
  const conflicts: string[] = [];
  for (const day of DAY_KEYS) {
    const onDay = events.filter((event) => event.days.includes(day));
    for (let i = 0; i < onDay.length; i += 1) {
      for (let j = i + 1; j < onDay.length; j += 1) {
        const a = onDay[i];
        const b = onDay[j];
        const aRange = { start: toMinutes(a.start) - a.bufferMinutes, end: toMinutes(a.end) + a.bufferMinutes };
        const bRange = { start: toMinutes(b.start) - b.bufferMinutes, end: toMinutes(b.end) + b.bufferMinutes };
        if (overlaps(aRange, bRange)) conflicts.push(`${DAY_LABELS[day]}요일의 ‘${a.title}’와 ‘${b.title}’ 일정이 겹쳐요.`);
      }
    }
  }
  return conflicts;
}

function blankBlocks(): Record<DayKey, ScheduleBlock[]> {
  return DAY_KEYS.reduce((result, day) => {
    result[day] = [];
    return result;
  }, {} as Record<DayKey, ScheduleBlock[]>);
}

function candidateStarts(range: Interval, duration: number, preference: ActivityPreference["preference"], gridMinutes: number): number[] {
  const morningEnd = Math.min(range.end, 12 * 60);
  const afternoonStart = Math.max(range.start, 13 * 60);
  const starts: number[] = [];
  const add = (start: number, end: number) => {
    for (let time = Math.ceil(start / gridMinutes) * gridMinutes; time + duration <= end; time += gridMinutes) starts.push(time);
  };
  if (preference === "morning") {
    add(range.start + 30, morningEnd);
    add(afternoonStart, range.end - 60);
  } else if (preference === "afternoon") {
    add(afternoonStart, range.end - 60);
    add(range.start + 30, morningEnd);
  } else {
    add(range.start + 30, morningEnd);
    add(afternoonStart, range.end - 60);
  }
  return starts;
}

function fullRangeStarts(range: Interval, duration: number, gridMinutes: number): number[] {
  const starts: number[] = [];
  for (let time = Math.ceil(range.start / gridMinutes) * gridMinutes; time + duration <= range.end; time += gridMinutes) starts.push(time);
  return starts;
}

function sortBlocks(blocks: ScheduleBlock[]) {
  blocks.sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
}

function addFixedBlocks(plan: VacationPlan, events: FixedEvent[], blocks: Record<DayKey, ScheduleBlock[]>, occupied: Record<DayKey, Interval[]>) {
  const owner = schoolLevelOf(plan) === "elementary" ? "부모님이 정한" : "학생과 가족이 정한";
  for (const event of events) {
    for (const day of event.days) {
      const start = toMinutes(event.start);
      const end = toMinutes(event.end);
      occupied[day].push({ start: start - event.bufferMinutes, end: end + event.bufferMinutes, category: "fixed" });
      blocks[day].push({
        id: `${event.id}-${day}`,
        sourceId: event.id,
        day,
        title: event.title,
        icon: "📌",
        category: "fixed",
        start: event.start,
        end: event.end,
        period: "fixed",
        kind: "fixed",
        reason: event.bufferMinutes ? `${owner} 고정 일정 · 앞뒤 ${event.bufferMinutes}분 여유 포함` : `${owner} 고정 일정`,
        locked: true,
      });
    }
  }
}

type RequiredCandidate = { day: DayKey; start: number };
type RequiredPlacement = { activity: ActivityPreference; day: DayKey; start: number; occurrence: number };

function requiredCandidates(plan: VacationPlan, activity: ActivityPreference, occupied: Record<DayKey, Interval[]>): RequiredCandidate[] {
  const candidates: RequiredCandidate[] = [];
  const gridMinutes = activityGridMinutes(plan);
  for (const day of DAY_KEYS) {
    for (const start of fullRangeStarts(lifeRange(plan, day), activity.durationMinutes, gridMinutes)) {
      const interval = { start, end: start + activity.durationMinutes };
      if (!occupied[day].some((item) => overlaps(interval, item))) candidates.push({ day, start });
    }
  }
  return candidates.sort((a, b) => {
    const aPeriod = a.start < 12 * 60 ? "morning" : "afternoon";
    const bPeriod = b.start < 12 * 60 ? "morning" : "afternoon";
    const aPreferred = activity.preference === "any" || activity.preference === aPeriod ? 0 : 1;
    const bPreferred = activity.preference === "any" || activity.preference === bPeriod ? 0 : 1;
    return aPreferred - bPreferred || a.start - b.start || DAY_KEYS.indexOf(a.day) - DAY_KEYS.indexOf(b.day);
  });
}

function placeRequiredActivities(
  plan: VacationPlan,
  activities: ActivityPreference[],
  blocks: Record<DayKey, ScheduleBlock[]>,
  occupied: Record<DayKey, Interval[]>,
) {
  if (!activities.length) return;
  const groups = activities.map((activity) => ({
    activity,
    candidates: requiredCandidates(plan, activity, occupied),
  })).sort((a, b) => (a.candidates.length / a.activity.frequency) - (b.candidates.length / b.activity.frequency)
    || b.activity.durationMinutes - a.activity.durationMinutes);
  const placements: RequiredPlacement[] = [];

  const placeGroup = (groupIndex: number): boolean => {
    if (groupIndex >= groups.length) return true;
    const group = groups[groupIndex];
    const placeOccurrence = (occurrence: number, candidateIndex: number): boolean => {
      if (occurrence >= group.activity.frequency) return placeGroup(groupIndex + 1);
      const remaining = group.activity.frequency - occurrence;
      let available = 0;
      for (let index = candidateIndex; index < group.candidates.length; index += 1) {
        const candidate = group.candidates[index];
        const interval = { start: candidate.start, end: candidate.start + group.activity.durationMinutes };
        if (!occupied[candidate.day].some((item) => overlaps(interval, item))) available += 1;
      }
      if (available < remaining) return false;
      for (let index = candidateIndex; index < group.candidates.length; index += 1) {
        const candidate = group.candidates[index];
        const interval = { start: candidate.start, end: candidate.start + group.activity.durationMinutes, category: group.activity.category };
        if (occupied[candidate.day].some((item) => overlaps(interval, item))) continue;
        occupied[candidate.day].push(interval);
        placements.push({ activity: group.activity, day: candidate.day, start: candidate.start, occurrence });
        if (placeOccurrence(occurrence + 1, index + 1)) return true;
        placements.pop();
        occupied[candidate.day].pop();
      }
      return false;
    };
    return placeOccurrence(0, 0);
  };

  if (!placeGroup(0)) {
    const names = activities.map((activity) => `‘${activity.name}’`).join(", ");
    throw new MustHaveScheduleError(`${names}을 요청한 횟수만큼 꼭 넣을 수 없어요. 고정 일정이나 횟수를 조정해 주세요.`);
  }

  for (const placement of placements) {
    const end = placement.start + placement.activity.durationMinutes;
    const period = placement.start < 12 * 60 ? "morning" : "afternoon";
    blocks[placement.day].push({
      id: `${placement.activity.id}-${placement.occurrence}-${placement.day}`,
      sourceId: placement.activity.id,
      day: placement.day,
      title: placement.activity.name,
      icon: placement.activity.icon,
      category: placement.activity.category,
      start: toTime(placement.start),
      end: toTime(end),
      period,
      kind: "activity",
      reason: schoolLevelOf(plan) === "elementary" ? "‘꼭 넣어줘!’로 고른 활동을 빠짐없이 먼저 배치했어요." : "‘반드시 포함’으로 선택한 활동을 빠짐없이 먼저 배치했어요.",
      locked: false,
      mustHave: true,
    });
  }
}

export function generateSchedule(plan: VacationPlan, fixedEvents: FixedEvent[], activities: ActivityPreference[]): ScheduleResult {
  const inputErrors = [...validatePlan(plan), ...findFixedEventConflicts(fixedEvents)];
  if (inputErrors.length) throw new Error(inputErrors.join("\n"));

  const blocks = blankBlocks();
  const occupied = Object.fromEntries(DAY_KEYS.map((day) => [day, [] as Interval[]])) as Record<DayKey, Interval[]>;
  const warnings: ScheduleWarning[] = [];
  const unplaced: ScheduleResult["unplaced"] = [];
  addFixedBlocks(plan, fixedEvents, blocks, occupied);
  const gridMinutes = activityGridMinutes(plan);
  const level = schoolLevelOf(plan);

  const selected = activities.filter((activity) => activity.selected && activity.frequency > 0);
  const required = selected.filter((activity) => activity.mustHave);
  const optional = selected.filter((activity) => !activity.mustHave).sort((a, b) => b.frequency - a.frequency);
  placeRequiredActivities(plan, required, blocks, occupied);

  for (const activity of optional) {
    let placed = 0;
    const usedDays = new Set<DayKey>();
    for (let occurrence = 0; occurrence < activity.frequency; occurrence += 1) {
      const candidates: { day: DayKey; start: number; score: number }[] = [];
      for (const day of DAY_KEYS) {
        const range = lifeRange(plan, day);
        const activityCount = blocks[day].filter((block) => block.kind === "activity").length;
        const dailyCap = level === "elementary" ? (isWeekend(day) ? 3 : 2) : level === "middle" ? 4 : (isWeekend(day) ? 5 : 6);
        if (activityCount >= dailyCap) continue;
        for (const start of candidateStarts(range, activity.durationMinutes, activity.preference, gridMinutes)) {
          const interval = { start, end: start + activity.durationMinutes };
          if (occupied[day].some((item) => overlaps(interval, item))) continue;
          const period = start < 12 * 60 ? "morning" : "afternoon";
          const preferenceMatch = activity.preference === "any" || activity.preference === period;
          const sameCategory = occupied[day].some((item) => item.category === activity.category);
          const edgeSpace = Math.min(start - range.start, range.end - interval.end);
          const score = (preferenceMatch ? 45 : 0) + (usedDays.has(day) ? -35 : 18) - activityCount * 14 - (sameCategory ? 24 : 0) + Math.min(edgeSpace / 30, 8) + (isWeekend(day) ? 2 : 6) - DAY_KEYS.indexOf(day) * 0.1;
          candidates.push({ day, start, score });
        }
      }
      candidates.sort((a, b) => b.score - a.score);
      const best = candidates[0];
      if (!best) break;
      const end = best.start + activity.durationMinutes;
      const period = best.start < 12 * 60 ? "morning" : "afternoon";
      blocks[best.day].push({
        id: `${activity.id}-${occurrence}-${best.day}`,
        sourceId: activity.id,
        day: best.day,
        title: activity.name,
        icon: activity.icon,
        category: activity.category,
        start: toTime(best.start),
        end: toTime(end),
        period,
        kind: "activity",
        reason: `${activity.preference === "any" ? "비어 있는 시간" : period === "morning" ? "선호한 오전" : "선호한 오후"}에, 다른 활동과 겹치지 않게 넣었어요.`,
        locked: false,
        mustHave: activity.mustHave,
      });
      occupied[best.day].push({ start: best.start, end, category: activity.category });
      usedDays.add(best.day);
      placed += 1;
    }
    if (placed < activity.frequency) {
      const missing = activity.frequency - placed;
      unplaced.push({ activityId: activity.id, name: activity.name, missing, reason: "고정 일정과 여유 시간을 지키면서 넣을 자리가 부족해요." });
      warnings.push({
        id: `capacity-${activity.id}`,
        tone: "notice",
        title: `${activity.name} ${missing}회를 넣지 못했어요`,
        description: "빈도를 줄이거나 주말에 직접 옮겨볼 수 있어요.",
      });
    }
  }

  for (const day of DAY_KEYS) sortBlocks(blocks[day]);
  if (!warnings.length) warnings.push({ id: "balanced", tone: "notice", title: "여유 있게 잘 만들어졌어요", description: "매일 빈 시간을 남기고 선택한 활동을 골고루 나눴어요." });
  return { blocks, warnings, unplaced, generatedAt: new Date().toISOString(), version: 2 };
}

export function validateManualScheduleBlock(
  plan: VacationPlan,
  fixedEvents: FixedEvent[],
  result: ScheduleResult,
  day: DayKey,
  startValue: string,
  endValue: string,
): string | null {
  const start = toMinutes(startValue);
  const end = toMinutes(endValue);
  if (!startValue || !endValue || start >= end) return "종료 시각은 시작 시각보다 뒤여야 해요.";
  if (start % LIFE_TIME_INCREMENT || end % LIFE_TIME_INCREMENT) return "시각은 10분 단위로 골라주세요.";
  const range = lifeRange(plan, day);
  if (start < range.start || end > range.end) {
    return `${DAY_LABELS[day]}요일의 기상·취침 시간 안에서 골라주세요.`;
  }
  for (const event of fixedEvents.filter((item) => item.days.includes(day))) {
    const fixed = { start: toMinutes(event.start) - event.bufferMinutes, end: toMinutes(event.end) + event.bufferMinutes };
    if (overlaps({ start, end }, fixed)) return `‘${event.title}’의 앞뒤 여유 시간과 겹쳐요.`;
  }
  const conflict = result.blocks[day].find((block) => block.kind !== "fixed" && overlaps(
    { start, end },
    { start: toMinutes(block.start), end: toMinutes(block.end) },
  ));
  if (conflict) return `‘${conflict.title}’ 일정과 겹쳐요.`;
  return null;
}

export function findSlotOnDay(
  plan: VacationPlan,
  result: ScheduleResult,
  block: ScheduleBlock,
  day: DayKey,
  preferredPeriod?: "morning" | "afternoon",
): { day: DayKey; start: string; end: string } | null {
  const duration = toMinutes(block.end) - toMinutes(block.start);
  const range = lifeRange(plan, day);
  const occupied = result.blocks[day]
    .filter((item) => item.id !== block.id)
    .map((item) => ({ start: toMinutes(item.start), end: toMinutes(item.end) }));
  const starts = candidateStarts(range, duration, preferredPeriod ?? (block.period === "fixed" ? "any" : block.period), activityGridMinutes(plan))
    .filter((start) => !preferredPeriod || (preferredPeriod === "morning" ? start < 12 * 60 : start >= 13 * 60));
  for (const start of starts) {
    if (day === block.day && start === toMinutes(block.start)) continue;
    if (!occupied.some((item) => overlaps({ start, end: start + duration }, item))) return { day, start: toTime(start), end: toTime(start + duration) };
  }
  return null;
}

export function findAlternativeSlot(plan: VacationPlan, result: ScheduleResult, block: ScheduleBlock): { day: DayKey; start: string; end: string } | null {
  const currentIndex = DAY_KEYS.indexOf(block.day);
  const days = [...DAY_KEYS.slice(currentIndex + 1), ...DAY_KEYS.slice(0, currentIndex + 1)];
  for (const day of days) {
    const slot = findSlotOnDay(plan, result, block, day);
    if (slot) return slot;
  }
  return null;
}
