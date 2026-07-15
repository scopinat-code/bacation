import { describe, expect, it } from "vitest";
import { activityGridMinutes, findAlternativeSlot, findFixedEventConflicts, findSlotOnDay, generateSchedule, moveBlockWithCascade, MustHaveScheduleError, toMinutes, validateManualScheduleBlock, validatePlan } from "../lib/scheduler";
import { buildVacationWeeks } from "../lib/vacation";
import { ActivityPreference, DAY_KEYS, FixedEvent, ScheduleBlock, ScheduleResult, VacationPlan } from "../lib/types";

const plan: VacationPlan = {
  startDate: "2026-07-20",
  endDate: "2026-08-16",
  nickname: "도토리",
  grade: "3",
  lifeHours: {
    weekdayWake: "08:00",
    weekdaySleep: "21:30",
    weekendWake: "09:00",
    weekendSleep: "22:00",
  },
};

const activity = (patch: Partial<ActivityPreference> = {}): ActivityPreference => ({
  id: "reading",
  category: "reading",
  name: "책 읽기",
  icon: "📚",
  frequency: 3,
  preference: "morning",
  mustHave: true,
  selected: true,
  durationMinutes: 60,
  ...patch,
});

describe("input validation", () => {
  it("rejects an end date before the start date", () => {
    expect(validatePlan({ ...plan, endDate: "2026-07-01" })).toContain("방학 종료일은 시작일보다 뒤여야 해요.");
  });

  it("rejects wake and sleep times outside a 10-minute boundary", () => {
    const invalid = { ...plan, lifeHours: { ...plan.lifeHours, weekdayWake: "08:01" } };
    expect(validatePlan(invalid)).toContain("일어나고 자는 시간은 10분 단위로 골라주세요.");
  });

  it("detects fixed event conflicts including travel buffers", () => {
    const events: FixedEvent[] = [
      { id: "a", title: "영어", days: ["mon"], start: "14:00", end: "15:00", bufferMinutes: 20 },
      { id: "b", title: "수영", days: ["mon"], start: "15:15", end: "16:00", bufferMinutes: 0 },
    ];
    expect(findFixedEventConflicts(events)[0]).toContain("영어");
  });
});

describe("schedule generation", () => {
  it("places the requested frequency without overlapping fixed events", () => {
    const fixed: FixedEvent[] = [{ id: "swim", title: "수영", days: ["mon", "wed"], start: "10:00", end: "12:00", bufferMinutes: 30 }];
    const result = generateSchedule(plan, fixed, [activity()]);
    const placed = Object.values(result.blocks).flat().filter((block) => block.kind === "activity");
    expect(placed).toHaveLength(3);
    expect(placed.every((block) => toMinutes(block.start) >= 8 * 60)).toBe(true);
    expect(result.unplaced).toHaveLength(0);
  });

  it("prioritizes a preferred morning when space exists", () => {
    const result = generateSchedule(plan, [], [activity({ frequency: 1, preference: "morning" })]);
    const placed = Object.values(result.blocks).flat().find((block) => block.kind === "activity");
    expect(placed?.period).toBe("morning");
  });

  it("reports activities that cannot fit instead of silently dropping them", () => {
    const busy: FixedEvent[] = [{ id: "busy", title: "온종일 캠프", days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], start: "08:00", end: "22:00", bufferMinutes: 0 }];
    const result = generateSchedule(plan, busy, [activity({ frequency: 5, mustHave: false })]);
    expect(result.unplaced[0]).toMatchObject({ name: "책 읽기", missing: 5 });
    expect(result.warnings[0].title).toContain("넣지 못했어요");
  });

  it("fails the whole generation when a required activity is physically impossible", () => {
    const busy: FixedEvent[] = [{ id: "busy", title: "온종일 캠프", days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], start: "08:00", end: "22:00", bufferMinutes: 0 }];
    expect(() => generateSchedule(plan, busy, [activity({ frequency: 1, mustHave: true })])).toThrow(MustHaveScheduleError);
  });

  it("backtracks so every required activity is included when a valid arrangement exists", () => {
    const compactPlan: VacationPlan = { ...plan, lifeHours: { weekdayWake: "08:00", weekdaySleep: "12:00", weekendWake: "08:00", weekendSleep: "12:00" } };
    const fixed: FixedEvent[] = [
      { id: "tue-early", title: "화요일 아침", days: ["tue"], start: "08:00", end: "09:00", bufferMinutes: 0 },
      { id: "tue-late", title: "화요일 나머지", days: ["tue"], start: "10:00", end: "12:00", bufferMinutes: 0 },
      { id: "other-days", title: "다른 요일 종일", days: ["wed", "thu", "fri", "sat", "sun"], start: "08:00", end: "12:00", bufferMinutes: 0 },
    ];
    const short = activity({ id: "short", name: "짧은 필수", frequency: 1, durationMinutes: 60, mustHave: true });
    const long = activity({ id: "long", name: "긴 필수", frequency: 1, durationMinutes: 180, mustHave: true });
    const result = generateSchedule(compactPlan, fixed, [short, long]);
    const placed = Object.values(result.blocks).flat();
    expect(placed.filter((block) => block.sourceId === "short")).toHaveLength(1);
    expect(placed.filter((block) => block.sourceId === "long")).toHaveLength(1);
    expect(placed.find((block) => block.sourceId === "short")?.day).toBe("tue");
    expect(placed.find((block) => block.sourceId === "long")?.day).toBe("mon");
  });

  it("uses the exact 10-minute awake boundary for required activities", () => {
    const tenMinutePlan: VacationPlan = { ...plan, lifeHours: { weekdayWake: "08:10", weekdaySleep: "09:10", weekendWake: "08:10", weekendSleep: "09:10" } };
    const result = generateSchedule(tenMinutePlan, [], [activity({ frequency: 1, durationMinutes: 60, mustHave: true })]);
    const placed = Object.values(result.blocks).flat().find((block) => block.sourceId === "reading")!;
    expect(`${placed.start}-${placed.end}`).toBe("08:10-09:10");
  });

  it("keeps legacy plans on the elementary 10-minute activity grid", () => {
    expect(activityGridMinutes(plan)).toBe(10);
  });

  it("aligns middle-school generated activities to full-hour starts", () => {
    const middlePlan: VacationPlan = { ...plan, schoolLevel: "middle", grade: "2", lifeHours: { weekdayWake: "08:10", weekdaySleep: "12:10", weekendWake: "08:10", weekendSleep: "12:10" } };
    const result = generateSchedule(middlePlan, [], [activity({ frequency: 1, durationMinutes: 60, mustHave: true })]);
    const placed = Object.values(result.blocks).flat().find((block) => block.sourceId === "reading")!;
    expect(activityGridMinutes(middlePlan)).toBe(60);
    expect(toMinutes(placed.start) % 60).toBe(0);
  });

  it("aligns high-school generated activities to 30-minute starts", () => {
    const highPlan: VacationPlan = { ...plan, schoolLevel: "high", grade: "1", lifeHours: { weekdayWake: "08:10", weekdaySleep: "12:10", weekendWake: "08:10", weekendSleep: "12:10" } };
    const result = generateSchedule(highPlan, [], [activity({ frequency: 1, durationMinutes: 60, mustHave: true })]);
    const placed = Object.values(result.blocks).flat().find((block) => block.sourceId === "reading")!;
    expect(activityGridMinutes(highPlan)).toBe(30);
    expect(toMinutes(placed.start) % 30).toBe(0);
  });

  it("lets required activities exceed the soft daily activity cap", () => {
    const required = ["a", "b", "c"].map((id) => activity({ id, name: `필수 ${id}`, frequency: 7, durationMinutes: 60, mustHave: true }));
    const result = generateSchedule(plan, [], required);
    const placed = Object.values(result.blocks).flat().filter((block) => block.kind === "activity");
    expect(placed).toHaveLength(21);
    expect(result.unplaced).toHaveLength(0);
  });

  it("finds a non-overlapping alternative for an editable block", () => {
    const result = generateSchedule(plan, [], [activity({ frequency: 1 })]);
    const block = Object.values(result.blocks).flat().find((item) => item.kind === "activity")!;
    const alternative = findAlternativeSlot(plan, result, block);
    expect(alternative).not.toBeNull();
    expect(`${alternative?.day}-${alternative?.start}`).not.toBe(`${block.day}-${block.start}`);
  });

  it("finds a valid slot on the day selected by drag and drop", () => {
    const result = generateSchedule(plan, [], [activity({ frequency: 1 })]);
    const block = Object.values(result.blocks).flat().find((item) => item.kind === "activity")!;
    const slot = findSlotOnDay(plan, result, block, "fri");
    expect(slot?.day).toBe("fri");
    expect(toMinutes(slot!.start)).toBeGreaterThanOrEqual(8 * 60);
  });

  it("previews and places a drag target in the requested half of the day", () => {
    const result = generateSchedule(plan, [], [activity({ frequency: 1 })]);
    const block = Object.values(result.blocks).flat().find((item) => item.kind === "activity")!;
    const afternoon = findSlotOnDay(plan, result, block, "fri", "afternoon");
    expect(afternoon?.day).toBe("fri");
    expect(toMinutes(afternoon!.start)).toBeGreaterThanOrEqual(13 * 60);
  });
});

describe("manual schedule validation", () => {
  it("accepts a non-overlapping 10-minute schedule inside awake hours", () => {
    const result = generateSchedule(plan, [], []);
    expect(validateManualScheduleBlock(plan, [], result, "mon", "10:10", "11:20")).toBeNull();
  });

  it("rejects invalid increments, awake-hour overflow, activity overlap, and fixed buffers", () => {
    const result = generateSchedule(plan, [], []);
    expect(validateManualScheduleBlock(plan, [], result, "mon", "10:05", "11:00")).toContain("10분 단위");
    expect(validateManualScheduleBlock(plan, [], result, "mon", "07:50", "08:50")).toContain("기상·취침");
    result.blocks.mon.push({ id: "manual", sourceId: "manual", day: "mon", title: "직접 일정", icon: "➕", category: "manual", start: "10:00", end: "11:00", period: "morning", kind: "manual", reason: "직접 추가", locked: false });
    expect(validateManualScheduleBlock(plan, [], result, "mon", "10:30", "11:30")).toContain("직접 일정");
    const fixed: FixedEvent[] = [{ id: "swim", title: "수영", days: ["mon"], start: "14:00", end: "15:00", bufferMinutes: 20 }];
    expect(validateManualScheduleBlock(plan, fixed, result, "mon", "13:50", "14:00")).toContain("앞뒤 여유");
  });
});

describe("exact calendar cascade moves", () => {
  const scheduleBlock = (overrides: Partial<ScheduleBlock> = {}): ScheduleBlock => ({
    id: "moving",
    sourceId: "moving",
    day: "mon",
    title: "옮기는 일정",
    icon: "⭐",
    category: "play",
    start: "09:00",
    end: "10:00",
    period: "morning",
    kind: "activity",
    reason: "테스트 일정",
    locked: false,
    ...overrides,
  });
  const emptyResult = (): ScheduleResult => ({
    blocks: DAY_KEYS.reduce((blocks, day) => ({ ...blocks, [day]: [] }), {} as ScheduleResult["blocks"]),
    warnings: [],
    unplaced: [],
    generatedAt: "2026-07-16T00:00:00.000Z",
    version: 2,
  });

  it("places a block on the exact requested day and 10-minute time", () => {
    const result = emptyResult();
    const block = scheduleBlock();
    result.blocks.mon.push(block);
    const moved = moveBlockWithCascade(plan, result, block, "wed", "10:30");
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(moved.result.blocks.wed.find((item) => item.id === block.id)).toMatchObject({ start: "10:30", end: "11:30" });
    expect(moved.result.blocks.mon).toHaveLength(0);
  });

  it("pushes every overlapping movable block later while preserving order", () => {
    const result = emptyResult();
    const block = scheduleBlock();
    result.blocks.mon.push(block);
    result.blocks.tue.push(
      scheduleBlock({ id: "first", sourceId: "first", day: "tue", title: "첫 일정", start: "10:00", end: "11:00" }),
      scheduleBlock({ id: "second", sourceId: "second", day: "tue", title: "둘째 일정", start: "11:00", end: "12:00" }),
    );
    const moved = moveBlockWithCascade(plan, result, block, "tue", "10:30");
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(moved.shifted.map((item) => [item.blockId, item.start, item.end])).toEqual([
      ["first", "11:30", "12:30"],
      ["second", "12:30", "13:30"],
    ]);
  });

  it("moves a cascading block past a later fixed event", () => {
    const result = emptyResult();
    const block = scheduleBlock();
    result.blocks.mon.push(block);
    result.blocks.tue.push(
      scheduleBlock({ id: "movable", sourceId: "movable", day: "tue", start: "10:30", end: "11:30" }),
      scheduleBlock({ id: "fixed", sourceId: "fixed", day: "tue", title: "학원", category: "fixed", start: "11:30", end: "12:30", period: "fixed", kind: "fixed", locked: true }),
    );
    const moved = moveBlockWithCascade(plan, result, block, "tue", "10:00");
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(moved.shifted[0]).toMatchObject({ blockId: "movable", start: "12:30", end: "13:30" });
  });

  it("rejects direct overlap with fixed or locked schedules", () => {
    const result = emptyResult();
    const block = scheduleBlock();
    result.blocks.mon.push(block);
    result.blocks.tue.push(scheduleBlock({ id: "locked", sourceId: "locked", day: "tue", title: "잠긴 일정", start: "10:00", end: "11:00", locked: true }));
    const moved = moveBlockWithCascade(plan, result, block, "tue", "10:30");
    expect(moved).toMatchObject({ ok: false });
    if (moved.ok) return;
    expect(moved.error).toContain("고정되어");
  });

  it("protects the buffer around a fixed parent schedule", () => {
    const result = emptyResult();
    const block = scheduleBlock();
    result.blocks.mon.push(block);
    result.blocks.tue.push(scheduleBlock({ id: "fixed-tue", sourceId: "academy", day: "tue", title: "학원", category: "fixed", start: "14:00", end: "15:00", period: "fixed", kind: "fixed", locked: true }));
    const fixed: FixedEvent[] = [{ id: "academy", title: "학원", days: ["tue"], start: "14:00", end: "15:00", bufferMinutes: 20 }];
    const moved = moveBlockWithCascade(plan, result, block, "tue", "13:10", fixed);
    expect(moved).toMatchObject({ ok: false });
  });

  it("rejects the entire move when the cascade passes sleep time", () => {
    const result = emptyResult();
    const block = scheduleBlock();
    result.blocks.mon.push(block);
    result.blocks.tue.push(scheduleBlock({ id: "late", sourceId: "late", day: "tue", start: "21:00", end: "22:00" }));
    const moved = moveBlockWithCascade(plan, result, block, "tue", "21:00");
    expect(moved).toMatchObject({ ok: false });
    if (moved.ok) return;
    expect(moved.error).toContain("취침 시간");
  });
});

describe("vacation calendar expansion", () => {
  it("expands the whole vacation into Monday-to-Sunday weeks", () => {
    const result = generateSchedule(plan, [], [activity({ frequency: 1 })]);
    const weeks = buildVacationWeeks(plan, result, []);
    expect(weeks).toHaveLength(4);
    expect(weeks[0].days[0].date).toBe("2026-07-20");
    expect(weeks.at(-1)?.days[6].date).toBe("2026-08-16");
  });

  it("replaces the repeated schedule on every date in a special range", () => {
    const result = generateSchedule(plan, [], [activity({ frequency: 1 })]);
    const weeks = buildVacationWeeks(plan, result, [{ id: "trip", startDate: "2026-07-22", endDate: "2026-07-24", title: "가족 여행", start: "09:00", end: "18:00" }]);
    const days = weeks.flatMap((week) => week.days);
    const specialDays = days.filter((day) => day.date && day.date >= "2026-07-22" && day.date <= "2026-07-24");
    expect(specialDays).toHaveLength(3);
    expect(specialDays.every((day) => day.isException && day.blocks.length === 1 && day.blocks[0].title === "가족 여행")).toBe(true);
    expect(days.find((day) => day.date === "2026-07-25")?.isException).toBe(false);
  });
});
