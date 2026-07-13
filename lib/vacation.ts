import { DAY_KEYS, DAY_LABELS, DayKey, ExceptionEvent, ScheduleBlock, ScheduleResult, VacationPlan } from "./types";

export interface VacationDay {
  date: string | null;
  day: DayKey;
  label: string;
  blocks: ScheduleBlock[];
  isException: boolean;
}

export interface VacationWeek {
  id: string;
  label: string;
  days: VacationDay[];
}

function parseDate(value: string) {
  return new Date(`${value}T12:00:00`);
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shortDate(value: string) {
  const [, month, day] = value.split("-").map(Number);
  return `${month}월 ${day}일`;
}

function mondayOf(date: Date) {
  const result = new Date(date);
  const offset = result.getDay() === 0 ? 6 : result.getDay() - 1;
  result.setDate(result.getDate() - offset);
  return result;
}

function sundayOf(date: Date) {
  const result = mondayOf(date);
  result.setDate(result.getDate() + 6);
  return result;
}

function exceptionBlock(exception: ExceptionEvent, day: DayKey, date: string): ScheduleBlock {
  return {
    id: `exception-${exception.id}-${date}`,
    sourceId: exception.id,
    day,
    title: exception.title,
    icon: "🧳",
    category: "fixed",
    start: exception.start,
    end: exception.end,
    period: "fixed",
    kind: "fixed",
    reason: "이 날짜의 반복 일정을 대신하는 특별 일정이에요.",
    locked: true,
  };
}

export function exceptionIncludesDate(exception: ExceptionEvent, date: string) {
  return exception.startDate <= date && date <= exception.endDate;
}

export function buildVacationWeeks(plan: VacationPlan, result: ScheduleResult, exceptions: ExceptionEvent[]): VacationWeek[] {
  if (!plan.startDate || !plan.endDate) return [];
  const start = parseDate(plan.startDate);
  const end = parseDate(plan.endDate);
  const firstMonday = mondayOf(start);
  const lastSunday = sundayOf(end);
  const weeks: VacationWeek[] = [];
  const cursor = new Date(firstMonday);

  while (cursor <= lastSunday) {
    const days: VacationDay[] = DAY_KEYS.map((day, index) => {
      const current = new Date(cursor);
      current.setDate(current.getDate() + index);
      const date = formatDate(current);
      if (current < start || current > end) return { date: null, day, label: DAY_LABELS[day], blocks: [], isException: false };
      const exception = exceptions.find((item) => exceptionIncludesDate(item, date));
      return {
        date,
        day,
        label: `${DAY_LABELS[day]} · ${current.getDate()}일`,
        blocks: exception
          ? [exceptionBlock(exception, day, date)]
          : result.blocks[day].map((block) => ({ ...block, id: `${block.id}-${date}` })),
        isException: Boolean(exception),
      };
    });
    const realDays = days.filter((day) => day.date);
    const first = realDays[0]?.date ?? formatDate(cursor);
    const last = realDays.at(-1)?.date ?? first;
    weeks.push({ id: formatDate(cursor), label: `${shortDate(first)} - ${shortDate(last)}`, days });
    cursor.setDate(cursor.getDate() + 7);
  }
  return weeks;
}
