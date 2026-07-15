export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type DayKey = (typeof DAY_KEYS)[number];
export type TimePreference = "morning" | "afternoon" | "any";
export type ActivityCategory = "study" | "reading" | "exercise" | "creative" | "outdoor" | "play" | "rest";
export type SchoolLevel = "elementary" | "middle" | "high";
export type SchoolGrade = "1" | "2" | "3" | "4" | "5" | "6";

export const SCHOOL_LEVEL_LABELS: Record<SchoolLevel, string> = {
  elementary: "초등학생",
  middle: "중학생",
  high: "고등학생",
};

export const SCHOOL_GRADE_OPTIONS: Record<SchoolLevel, SchoolGrade[]> = {
  elementary: ["1", "2", "3", "4", "5", "6"],
  middle: ["1", "2", "3"],
  high: ["1", "2", "3"],
};

export const DAY_LABELS: Record<DayKey, string> = {
  mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토", sun: "일",
};

export interface LifeHours {
  weekdayWake: string;
  weekdaySleep: string;
  weekendWake: string;
  weekendSleep: string;
}

export interface VacationPlan {
  startDate: string;
  endDate: string;
  nickname: string;
  /** Older saved plans and test fixtures omit this field and are treated as elementary. */
  schoolLevel?: SchoolLevel;
  grade: SchoolGrade;
  lifeHours: LifeHours;
}

export function schoolLevelOf(plan: Pick<VacationPlan, "schoolLevel">): SchoolLevel {
  return plan.schoolLevel ?? "elementary";
}

export function schoolGradeLabel(plan: Pick<VacationPlan, "schoolLevel" | "grade">): string {
  const prefix: Record<SchoolLevel, string> = { elementary: "초등", middle: "중등", high: "고등" };
  return `${prefix[schoolLevelOf(plan)]} ${plan.grade}학년`;
}

export function studentNoun(plan: Pick<VacationPlan, "schoolLevel">): "아이" | "학생" {
  return schoolLevelOf(plan) === "elementary" ? "아이" : "학생";
}

export interface FixedEvent {
  id: string;
  title: string;
  days: DayKey[];
  start: string;
  end: string;
  bufferMinutes: number;
}

export interface ExceptionEvent {
  id: string;
  startDate: string;
  endDate: string;
  title: string;
  start: string;
  end: string;
}

export interface ActivityPreference {
  id: string;
  category: ActivityCategory;
  name: string;
  icon: string;
  frequency: number;
  preference: TimePreference;
  mustHave: boolean;
  selected: boolean;
  durationMinutes: number;
}

export interface ScheduleBlock {
  id: string;
  sourceId: string;
  day: DayKey;
  title: string;
  icon: string;
  category: ActivityCategory | "fixed" | "manual";
  start: string;
  end: string;
  period: "morning" | "afternoon" | "fixed";
  kind: "activity" | "fixed" | "manual";
  reason: string;
  locked: boolean;
  mustHave?: boolean;
}

export interface ScheduleWarning {
  id: string;
  tone: "notice" | "warning";
  title: string;
  description: string;
}

export interface ScheduleResult {
  blocks: Record<DayKey, ScheduleBlock[]>;
  warnings: ScheduleWarning[];
  unplaced: { activityId: string; name: string; missing: number; reason: string }[];
  generatedAt: string;
  version: number;
}

export interface PlannerState {
  step: number;
  plan: VacationPlan;
  fixedEvents: FixedEvent[];
  exceptions: ExceptionEvent[];
  activities: ActivityPreference[];
  result: ScheduleResult | null;
}
