"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { DndContext, DragEndEvent, DragOverlay, DragOverEvent, DragStartEvent, KeyboardSensor, PointerSensor, TouchSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { findAlternativeSlot, findFixedEventConflicts, findSlotOnDay, generateSchedule, validateManualScheduleBlock, validatePlan } from "@/lib/scheduler";
import { downloadSchedulePdf, downloadSchedulePptx, ExportScope, exportFilename } from "@/lib/exporters";
import { buildVacationWeeks, VacationWeek } from "@/lib/vacation";
import { trackAnalytics } from "@/lib/analytics";
import ExportPages from "@/components/ExportPages";
import {
  ActivityPreference,
  DAY_KEYS,
  DAY_LABELS,
  DayKey,
  ExceptionEvent,
  FixedEvent,
  PlannerState,
  ScheduleBlock,
  SCHOOL_GRADE_OPTIONS,
  SCHOOL_LEVEL_LABELS,
  SchoolGrade,
  SchoolLevel,
  TimePreference,
  schoolGradeLabel,
  schoolLevelOf,
  studentNoun,
} from "@/lib/types";

const STORAGE_KEY = "vacation-one-slot:v1";

const DEFAULT_ACTIVITIES_BY_LEVEL: Record<SchoolLevel, ActivityPreference[]> = {
  elementary: [
    { id: "math", category: "study", name: "수학 한 쪽", icon: "✏️", frequency: 3, preference: "morning", mustHave: false, selected: false, durationMinutes: 60 },
    { id: "reading", category: "reading", name: "재미있는 책", icon: "📚", frequency: 4, preference: "any", mustHave: false, selected: false, durationMinutes: 60 },
    { id: "bike", category: "exercise", name: "자전거 타기", icon: "🚲", frequency: 2, preference: "afternoon", mustHave: false, selected: false, durationMinutes: 90 },
    { id: "drawing", category: "creative", name: "그림 그리기", icon: "🎨", frequency: 2, preference: "afternoon", mustHave: false, selected: false, durationMinutes: 60 },
    { id: "outside", category: "outdoor", name: "밖에서 놀기", icon: "🌳", frequency: 3, preference: "afternoon", mustHave: false, selected: false, durationMinutes: 90 },
    { id: "game", category: "play", name: "게임 시간", icon: "🎮", frequency: 2, preference: "afternoon", mustHave: false, selected: false, durationMinutes: 60 },
    { id: "music", category: "creative", name: "악기 연주", icon: "🎵", frequency: 2, preference: "any", mustHave: false, selected: false, durationMinutes: 60 },
    { id: "nothing", category: "rest", name: "아무것도 안 하기", icon: "☁️", frequency: 2, preference: "any", mustHave: false, selected: false, durationMinutes: 60 },
  ],
  middle: [
    { id: "math-review", category: "study", name: "수학 복습", icon: "✏️", frequency: 3, preference: "morning", mustHave: false, selected: false, durationMinutes: 60 },
    { id: "english", category: "study", name: "영어 단어·듣기", icon: "🔤", frequency: 3, preference: "morning", mustHave: false, selected: false, durationMinutes: 60 },
    { id: "interest-reading", category: "reading", name: "관심 분야 독서", icon: "📚", frequency: 2, preference: "any", mustHave: false, selected: false, durationMinutes: 60 },
    { id: "workout", category: "exercise", name: "운동·산책", icon: "🏃", frequency: 3, preference: "afternoon", mustHave: false, selected: false, durationMinutes: 60 },
    { id: "hobby-project", category: "creative", name: "취미 프로젝트", icon: "🎨", frequency: 2, preference: "afternoon", mustHave: false, selected: false, durationMinutes: 120 },
    { id: "friends", category: "outdoor", name: "친구 만나기", icon: "🌳", frequency: 1, preference: "afternoon", mustHave: false, selected: false, durationMinutes: 120 },
    { id: "game-content", category: "play", name: "게임·영상", icon: "🎮", frequency: 2, preference: "afternoon", mustHave: false, selected: false, durationMinutes: 60 },
    { id: "full-rest", category: "rest", name: "온전히 쉬기", icon: "☁️", frequency: 2, preference: "any", mustHave: false, selected: false, durationMinutes: 60 },
  ],
  high: [
    { id: "math-problems", category: "study", name: "수학 문제 풀이", icon: "✏️", frequency: 4, preference: "morning", mustHave: false, selected: false, durationMinutes: 90 },
    { id: "english-study", category: "study", name: "영어 학습", icon: "🔤", frequency: 4, preference: "morning", mustHave: false, selected: false, durationMinutes: 60 },
    { id: "korean-reading", category: "reading", name: "국어·비문학 읽기", icon: "📚", frequency: 3, preference: "morning", mustHave: false, selected: false, durationMinutes: 60 },
    { id: "fitness", category: "exercise", name: "운동·스트레칭", icon: "🏃", frequency: 3, preference: "afternoon", mustHave: false, selected: false, durationMinutes: 60 },
    { id: "personal-project", category: "creative", name: "개인 프로젝트", icon: "💡", frequency: 2, preference: "afternoon", mustHave: false, selected: false, durationMinutes: 120 },
    { id: "friends-outing", category: "outdoor", name: "친구·외출", icon: "🌳", frequency: 1, preference: "afternoon", mustHave: false, selected: false, durationMinutes: 120 },
    { id: "game-media", category: "play", name: "게임·콘텐츠", icon: "🎮", frequency: 2, preference: "afternoon", mustHave: false, selected: false, durationMinutes: 60 },
    { id: "recovery", category: "rest", name: "회복 시간", icon: "☁️", frequency: 3, preference: "any", mustHave: false, selected: false, durationMinutes: 60 },
  ],
};

function defaultActivities(level: SchoolLevel): ActivityPreference[] {
  return DEFAULT_ACTIVITIES_BY_LEVEL[level].map((activity) => ({ ...activity }));
}

const INITIAL_STATE: PlannerState = {
  step: 0,
  plan: {
    startDate: "",
    endDate: "",
    nickname: "",
    schoolLevel: undefined,
    grade: "3",
    lifeHours: { weekdayWake: "08:00", weekdaySleep: "21:30", weekendWake: "09:00", weekendSleep: "22:00" },
  },
  fixedEvents: [],
  exceptions: [],
  activities: defaultActivities("elementary"),
  result: null,
};

type SavedException = Partial<ExceptionEvent> & { date?: string };
type SavedPlannerState = Omit<Partial<PlannerState>, "exceptions"> & { exceptions?: SavedException[] };

function normalizeSavedState(value: unknown): PlannerState {
  if (!value || typeof value !== "object") return INITIAL_STATE;
  const saved = value as SavedPlannerState;
  const exceptions = (saved.exceptions ?? []).map((item, index) => {
    const startDate = item.startDate || item.date || "";
    return {
      id: item.id || `exception-migrated-${index}`,
      startDate,
      endDate: item.endDate || startDate,
      title: item.title || "특별 일정",
      start: item.start || "09:00",
      end: item.end || "18:00",
    };
  }).filter((item) => item.startDate && item.endDate);
  const savedLevel = saved.plan?.schoolLevel;
  const schoolLevel: SchoolLevel = savedLevel === "middle" || savedLevel === "high" || savedLevel === "elementary" ? savedLevel : "elementary";
  const savedGrade = saved.plan?.grade;
  const grade = savedGrade && SCHOOL_GRADE_OPTIONS[schoolLevel].includes(savedGrade) ? savedGrade : schoolLevel === "elementary" ? "3" : "1";
  const activities = saved.activities ?? defaultActivities(schoolLevel);
  const savedResult = saved.result ?? null;
  const resultHasEveryRequiredActivity = !savedResult || activities
    .filter((activity) => activity.selected && activity.mustHave)
    .every((activity) => DAY_KEYS.flatMap((day) => savedResult.blocks[day] ?? [])
      .filter((block) => block.sourceId === activity.id).length >= activity.frequency);
  const result = resultHasEveryRequiredActivity ? savedResult : null;
  return {
    ...INITIAL_STATE,
    ...saved,
    plan: {
      ...INITIAL_STATE.plan,
      ...saved.plan,
      schoolLevel,
      grade,
      lifeHours: { ...INITIAL_STATE.plan.lifeHours, ...saved.plan?.lifeHours },
    },
    fixedEvents: saved.fixedEvents ?? [],
    exceptions,
    activities,
    result,
    step: !result && saved.step === 4 ? 3 : saved.step ?? INITIAL_STATE.step,
  };
}

const STEPS_BY_LEVEL: Record<SchoolLevel, string[]> = {
  elementary: ["시작", "기본정보", "부모 일정", "아이 선택", "함께 조정"],
  middle: ["시작", "기본정보", "가족 일정", "활동 선택", "직접 조정"],
  high: ["시작", "기본정보", "가족 일정", "계획 선택", "직접 조정"],
};
const PREFERENCE_LABEL: Record<TimePreference, string> = { morning: "오전", afternoon: "오후", any: "아무 때나" };
const BALANCE_GROUPS: Array<{ id: string; label: string; icon: string; categories: ActivityPreference["category"][] }> = [
  { id: "learn", label: "공부·독서", icon: "📚", categories: ["study", "reading"] },
  { id: "move", label: "움직임", icon: "🏃", categories: ["exercise", "outdoor"] },
  { id: "hobby", label: "취미·놀이", icon: "🎨", categories: ["creative", "play"] },
  { id: "rest", label: "휴식", icon: "☁️", categories: ["rest"] },
];

function durationOptions(level: SchoolLevel): number[] {
  if (level === "middle") return [60, 120, 180];
  if (level === "high") return [30, 60, 90, 120, 150, 180];
  return [30, 60, 90, 120];
}

function durationLabel(minutes: number) {
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}시간 ${rest}분` : `${hours}시간`;
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function suggestedVacationDates() {
  const start = new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + 28);
  const format = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return { startDate: format(start), endDate: format(end) };
}

function addCalendarDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function exceptionDayCount(event: Pick<ExceptionEvent, "startDate" | "endDate">) {
  const start = new Date(`${event.startDate}T12:00:00`).getTime();
  const end = new Date(`${event.endDate}T12:00:00`).getTime();
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1);
}

function exceptionDateLabel(event: Pick<ExceptionEvent, "startDate" | "endDate">) {
  const compact = (value: string) => value.slice(5).replace("-", "/");
  return event.startDate === event.endDate ? compact(event.startDate) : `${compact(event.startDate)}–${compact(event.endDate)}`;
}

export default function PlannerApp() {
  const [state, setState] = useState<PlannerState>(INITIAL_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [toast, setToast] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [busy, setBusy] = useState(false);
  const scheduleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setState(normalizeSavedState(JSON.parse(saved)));
    } catch {
      setToast("저장된 계획을 불러오지 못했어요. 새 계획으로 시작할게요.");
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      setToast("브라우저에 자동 저장하지 못했어요. 완성 후 바로 인쇄해 주세요.");
    }
  }, [state, hydrated]);

  useEffect(() => {
    if (hydrated) trackAnalytics("page_view");
  }, [hydrated]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const conflicts = useMemo(() => findFixedEventConflicts(state.fixedEvents), [state.fixedEvents]);
  const hasPlanContent = Boolean(
    state.plan.startDate
    || state.plan.endDate
    || state.plan.nickname
    || state.fixedEvents.length
    || state.exceptions.length
    || state.activities.some((activity) => activity.selected)
    || state.result,
  );

  const setStep = (step: number) => setState((current) => ({ ...current, step }));

  const startForSchoolLevel = (schoolLevel: SchoolLevel) => {
    if (hasPlanContent && schoolLevelOf(state.plan) === schoolLevel) {
      setStep(state.result ? 4 : 1);
      setToast("저장해 둔 계획을 이어서 열었어요.");
      return;
    }
    if (
      hasPlanContent
      && !window.confirm("다른 학교급으로 새 계획을 시작하면 지금 저장한 계획이 지워져요. 새로 시작할까요?")
    ) return;

    trackAnalytics("planner_started");
    setState({
      ...INITIAL_STATE,
      step: 1,
      plan: {
        ...INITIAL_STATE.plan,
        schoolLevel,
        grade: schoolLevel === "elementary" ? "3" : "1",
        lifeHours: { ...INITIAL_STATE.plan.lifeHours },
      },
      fixedEvents: [],
      exceptions: [],
      activities: defaultActivities(schoolLevel),
      result: null,
    });
  };

  const generate = () => {
    try {
      const result = generateSchedule(state.plan, state.fixedEvents, state.activities);
      setState((current) => ({ ...current, result, step: 4 }));
      trackAnalytics("schedule_completed");
      setGenerationError("");
      setToast("우리 방학 시간표를 만들었어요!");
    } catch (error) {
      const message = error instanceof Error ? error.message.split("\n")[0] : "시간표를 만들지 못했어요.";
      setGenerationError(message);
      setToast(message);
    }
  };

  const resetAll = () => {
    if (!window.confirm("지금까지 만든 계획을 모두 지울까요? 이 작업은 되돌릴 수 없어요.")) return;
    window.localStorage.removeItem(STORAGE_KEY);
    setState(INITIAL_STATE);
    setToast("저장된 계획을 모두 지웠어요.");
  };

  const downloadPng = async () => {
    if (!scheduleRef.current) return;
    setBusy(true);
    const node = scheduleRef.current;
    try {
      const { toPng } = await import("html-to-image");
      node.classList.add("is-exporting");
      await document.fonts.ready;
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));
      const dataUrl = await toPng(node, {
        backgroundColor: "#fff8e8",
        cacheBust: true,
        height: node.scrollHeight,
        pixelRatio: 2,
        width: node.scrollWidth,
      });
      const link = document.createElement("a");
      link.download = `${state.plan.nickname || "우리집"}-방학-시간표.png`;
      link.href = dataUrl;
      link.click();
      trackAnalytics("png_download", "weekly");
      setToast("PNG 시간표를 저장했어요.");
    } catch {
      setToast("PNG 저장이 어려워요. 인쇄 버튼으로 PDF를 저장해 주세요.");
    } finally {
      node.classList.remove("is-exporting");
      setBusy(false);
    }
  };

  const updateBlock = (block: ScheduleBlock, action: "lock" | "delete" | "move") => {
    if (!state.result || block.kind === "fixed") return;
    if (action === "delete" && block.mustHave) return setToast(`${schoolLevelOf(state.plan) === "elementary" ? "‘꼭 넣어줘!’" : "‘반드시 포함’"} 활동은 뺄 수 없어요. 3단계에서 체크를 해제해 주세요.`);
    const result = structuredClone(state.result);
    if (action === "lock") {
      const target = result.blocks[block.day].find((item) => item.id === block.id);
      if (target) target.locked = !target.locked;
    } else if (action === "delete") {
      result.blocks[block.day] = result.blocks[block.day].filter((item) => item.id !== block.id);
    } else {
      if (block.locked) return setToast("먼저 자물쇠를 풀어주세요.");
      const alternative = findAlternativeSlot(state.plan, result, block);
      if (!alternative) return setToast("옮길 수 있는 빈 시간을 찾지 못했어요.");
      result.blocks[block.day] = result.blocks[block.day].filter((item) => item.id !== block.id);
      result.blocks[alternative.day].push({ ...block, day: alternative.day, start: alternative.start, end: alternative.end, reason: "직접 ‘다른 시간’을 골라 옮긴 활동이에요." });
      result.blocks[alternative.day].sort((a, b) => a.start.localeCompare(b.start));
    }
    setState((current) => ({ ...current, result }));
    setToast(action === "move" ? "다른 빈 시간으로 옮겼어요." : action === "delete" ? "시간표에서 뺐어요." : block.locked ? "자물쇠를 풀었어요." : "이 시간을 잠갔어요.");
  };

  const dropBlockOnDay = (block: ScheduleBlock, targetDay: DayKey, targetPeriod: "morning" | "afternoon") => {
    if (!state.result || block.kind === "fixed" || block.locked) return setToast("고정되거나 잠긴 블록은 먼저 자물쇠를 풀어주세요.");
    const result = structuredClone(state.result);
    const slot = findSlotOnDay(state.plan, result, block, targetDay, targetPeriod);
    if (!slot) return setToast(`${DAY_LABELS[targetDay]}요일 ${targetPeriod === "morning" ? "오전" : "오후"}에는 옮길 빈 시간이 없어요.`);
    result.blocks[block.day] = result.blocks[block.day].filter((item) => item.id !== block.id);
    result.blocks[targetDay].push({ ...block, day: targetDay, period: targetPeriod, start: slot.start, end: slot.end, reason: "캘린더에서 직접 끌어 옮긴 활동이에요." });
    result.blocks[targetDay].sort((a, b) => a.start.localeCompare(b.start));
    setState((current) => ({ ...current, result }));
    setToast(`${block.title}을 ${DAY_LABELS[targetDay]}요일 ${targetPeriod === "morning" ? "오전" : "오후"} ${slot.start}로 옮겼어요.`);
  };

  const addManualBlock = (day: DayKey, title: string, start: string, end: string): string | null => {
    if (!state.result) return "먼저 시간표를 만들어 주세요.";
    if (!title.trim()) return "일정 이름을 입력해 주세요.";
    const error = validateManualScheduleBlock(state.plan, state.fixedEvents, state.result, day, start, end);
    if (error) return error;
    const result = structuredClone(state.result);
    const id = uid("manual");
    result.blocks[day].push({
      id,
      sourceId: id,
      day,
      title: title.trim(),
      icon: "➕",
      category: "manual",
      start,
      end,
      period: start < "12:00" ? "morning" : "afternoon",
      kind: "manual",
      reason: schoolLevelOf(state.plan) === "elementary" ? "부모님이 마지막 단계에서 직접 추가한 일정이에요." : "학생이 마지막 단계에서 직접 추가한 일정이에요.",
      locked: false,
      mustHave: false,
    });
    result.blocks[day].sort((a, b) => a.start.localeCompare(b.start));
    setState((current) => ({ ...current, result }));
    setToast(`${DAY_LABELS[day]}요일 ${start}에 ‘${title.trim()}’ 일정을 추가했어요.`);
    return null;
  };

  if (!hydrated) return <main className="loading-screen" aria-live="polite"><span>방학 계획을 펼치는 중...</span></main>;

  return (
    <main className="app-shell">
      <Header step={state.step} plan={state.plan} onStep={setStep} hasResult={Boolean(state.result)} />
      {state.step === 0 && <Landing selectedLevel={state.plan.schoolLevel} hasSaved={hasPlanContent} onStart={startForSchoolLevel} onResume={() => setStep(state.result ? 4 : 1)} />}
      {state.step === 1 && <Basics state={state} setState={setState} onNext={() => {
        const errors = validatePlan(state.plan);
        if (errors.length) return setToast(errors[0]);
        setStep(2);
      }} />}
      {state.step === 2 && <ParentSchedule state={state} setState={setState} conflicts={conflicts} onBack={() => setStep(1)} onNext={() => conflicts.length ? setToast("겹치는 고정 일정을 먼저 고쳐주세요.") : setStep(3)} />}
      {state.step === 3 && <ChildActivities state={state} setState={setState} generationError={generationError} onBack={() => setStep(2)} onGenerate={generate} />}
      {state.step === 4 && state.result && <Results state={state} scheduleRef={scheduleRef} onBack={() => setStep(3)} onRegenerate={generate} onBlockAction={updateBlock} onBlockDrop={dropBlockOnDay} onManualAdd={addManualBlock} onDownload={downloadPng} onPrint={() => { trackAnalytics("print"); window.print(); }} onNotify={setToast} busy={busy} />}
      <footer className="site-footer no-print">
        <div>
          <strong>방학한칸</strong>
          <span>계획은 이 기기의 브라우저에만 저장돼요.</span>
          <span>서비스 문의사항 : <a href="mailto:scopinat@gmail.com">scopinat@gmail.com</a></span>
        </div>
        <button className="text-button danger-text" onClick={resetAll}>모두 지우기</button>
      </footer>
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}

function Header({ step, plan, onStep, hasResult }: { step: number; plan: PlannerState["plan"]; onStep: (step: number) => void; hasResult: boolean }) {
  const steps = STEPS_BY_LEVEL[schoolLevelOf(plan)];
  return (
    <header className="topbar no-print">
      <button className="brand" onClick={() => onStep(0)} aria-label="방학한칸 홈"><span className="brand-mark">한칸</span><span>방학한칸</span></button>
      <div className="topbar-nav">
        {step > 0 && <nav className="progress" aria-label="계획 만들기 진행 상황">
          {steps.slice(1).map((label, index) => {
            const number = index + 1;
            const enabled = number <= step || (number === 4 && hasResult);
            return <button key={label} disabled={!enabled} className={number === step ? "active" : number < step ? "done" : ""} onClick={() => enabled && onStep(number)}><span>{number < step ? "✓" : number}</span><em>{label}</em></button>;
          })}
        </nav>}
        <a className="topbar-qna" href="/qna"><span aria-hidden="true">💬</span> Q&amp;A</a>
      </div>
    </header>
  );
}

function Landing({ selectedLevel, hasSaved, onStart, onResume }: { selectedLevel?: SchoolLevel; hasSaved: boolean; onStart: (level: SchoolLevel) => void; onResume: () => void }) {
  return (
    <section className="landing page-enter">
      <div className="hero-copy">
        <span className="eyebrow">초등학생부터 고등학생까지 맞춤 방학 계획</span>
        <h1>빈틈까지 우리답게,<br /><mark>방학 한 칸씩</mark> 맞춰봐요.</h1>
        <p>학교급에 맞는 활동과 시간 단위로 공부, 운동, 취미, 휴식이 균형 잡힌 방학 시간표를 만들어요.</p>
        <div className="school-level-start" aria-label="학교급 선택">
          <b>누가 시간표를 만드나요?</b>
          <div>{(["elementary", "middle", "high"] as SchoolLevel[]).map((level) => <button key={level} className={selectedLevel === level ? "primary-button" : "secondary-button"} onClick={() => onStart(level)}><span>{level === "elementary" ? "🌱" : level === "middle" ? "📘" : "🎯"}</span>{SCHOOL_LEVEL_LABELS[level]} <small>{level === "elementary" ? "오전·오후" : level === "middle" ? "1시간 단위" : "30분 단위"}</small></button>)}</div>
        </div>
        <div className="hero-actions">
          {hasSaved && <button className="secondary-button" onClick={onResume}>저장한 {selectedLevel ? SCHOOL_LEVEL_LABELS[selectedLevel] : "방학"} 계획 이어서 보기</button>}
        </div>
        <ul className="trust-list"><li>회원가입 없음</li><li>자동 임시저장</li><li>PNG·PDF 출력</li></ul>
      </div>
      <div className="hero-visual" aria-label="완성된 시간표 예시">
        <div className="sun-doodle">☀</div>
        <div className="sample-sheet">
          <div className="sample-header"><span>나의 방학</span><b>균형 있게, 나답게!</b></div>
          <div className="sample-days">
            <SampleDay day="월" items={["📚 읽기", "📌 고정 일정", "☁️ 빈 시간"]} />
            <SampleDay day="수" items={["✏️ 공부", "🏃 운동", "☁️ 빈 시간"]} />
            <SampleDay day="토" items={["🎨 취미", "🎮 게임", "🍉 가족 시간"]} />
          </div>
          <div className="sample-note">“공부도 휴식도, 내가 고른 균형으로!”</div>
        </div>
        <div className="sticker sticker-one">5분 완성</div><div className="sticker sticker-two">여유도 계획!</div>
      </div>
      <div className="how-it-works">
        <article><span>1</span><div><b>학교급에 맞게</b><p>생활 리듬과 시간 단위를 정해요.</p></div></article>
        <article><span>2</span><div><b>학생이 직접</b><p>공부·운동·취미·휴식을 골라요.</p></div></article>
        <article><span>3</span><div><b>필요하면 가족과</b><p>고정 일정을 맞추고 완성해요.</p></div></article>
      </div>
    </section>
  );
}

function SampleDay({ day, items }: { day: string; items: string[] }) {
  return <div className="sample-day"><b>{day}</b>{items.map((item) => <span key={item}>{item}</span>)}</div>;
}

function PageIntro({ kicker, title, description }: { kicker: string; title: string; description: string }) {
  return <div className="page-intro"><span className="eyebrow">{kicker}</span><h1>{title}</h1><p>{description}</p></div>;
}

function Basics({ state, setState, onNext }: { state: PlannerState; setState: React.Dispatch<React.SetStateAction<PlannerState>>; onNext: () => void }) {
  const level = schoolLevelOf(state.plan);
  const isElementary = level === "elementary";
  const updatePlan = (patch: Partial<PlannerState["plan"]>) => setState((current) => ({ ...current, plan: { ...current.plan, ...patch } }));
  const updateHours = (key: keyof PlannerState["plan"]["lifeHours"], value: string) => updatePlan({ lifeHours: { ...state.plan.lifeHours, [key]: value } });
  const changeSchoolLevel = (schoolLevel: SchoolLevel) => setState((current) => ({
    ...current,
    plan: { ...current.plan, schoolLevel, grade: schoolLevel === "elementary" ? "3" : "1" },
    activities: defaultActivities(schoolLevel),
    result: null,
  }));
  return (
    <section className="wizard-page page-enter">
      <PageIntro kicker="1 · 우리 방학 알아보기" title="먼저, 방학의 테두리를 그려요." description={isElementary ? "아이의 실명이나 학교는 필요 없어요. 계획에 표시할 별명만 알려주세요." : "실명이나 학교 정보는 필요 없어요. 내 방학 기간과 생활 리듬부터 정해보세요."} />
      <div className="form-card accent-yellow">
        <button type="button" className="quick-date" onClick={() => updatePlan(suggestedVacationDates())}>☀️ 오늘부터 4주 방학으로 채우기</button>
        <div className="field-grid two">
          <label><span>학교급</span><select value={level} onChange={(e) => changeSchoolLevel(e.target.value as SchoolLevel)}>{(["elementary", "middle", "high"] as SchoolLevel[]).map((item) => <option key={item} value={item}>{SCHOOL_LEVEL_LABELS[item]}</option>)}</select></label>
          <label><span>학년</span><select value={state.plan.grade} onChange={(e) => updatePlan({ grade: e.target.value as SchoolGrade })}>{SCHOOL_GRADE_OPTIONS[level].map((grade) => <option key={grade} value={grade}>{SCHOOL_LEVEL_LABELS[level].replace("학생", "학교")} {grade}학년</option>)}</select></label>
          <label><span>방학 시작일</span><input type="date" value={state.plan.startDate} onChange={(e) => updatePlan({ startDate: e.target.value })} /></label>
          <label><span>방학 종료일</span><input type="date" value={state.plan.endDate} min={state.plan.startDate} onChange={(e) => updatePlan({ endDate: e.target.value })} /></label>
          <label><span>시간표에 쓸 별명 <small>선택</small></span><input type="text" maxLength={12} placeholder={isElementary ? "예: 도토리" : "예: 민준"} value={state.plan.nickname} onChange={(e) => updatePlan({ nickname: e.target.value })} /></label>
        </div>
      </div>
      <div className="form-card">
        <div className="section-heading"><span className="round-icon sky">⏰</span><div><h2>보통 몇 시에 일어나고 자나요?</h2><p>활동은 이 시간 안에서만 배치하며, 시각은 10분 단위로 고를 수 있어요.</p></div></div>
        <div className="time-row"><strong>평일</strong><label>일어나기 <input type="time" step="600" value={state.plan.lifeHours.weekdayWake} onChange={(e) => updateHours("weekdayWake", e.target.value)} /></label><span>—</span><label>잠자기 <input type="time" step="600" value={state.plan.lifeHours.weekdaySleep} onChange={(e) => updateHours("weekdaySleep", e.target.value)} /></label></div>
        <div className="time-row"><strong>주말</strong><label>일어나기 <input type="time" step="600" value={state.plan.lifeHours.weekendWake} onChange={(e) => updateHours("weekendWake", e.target.value)} /></label><span>—</span><label>잠자기 <input type="time" step="600" value={state.plan.lifeHours.weekendSleep} onChange={(e) => updateHours("weekendSleep", e.target.value)} /></label></div>
      </div>
      <div className="wizard-actions"><span /><button className="primary-button" onClick={onNext}>{isElementary ? "부모 일정 넣기" : "가족 일정 확인하기 (선택)"} →</button></div>
    </section>
  );
}

function ParentSchedule({ state, setState, conflicts, onBack, onNext }: { state: PlannerState; setState: React.Dispatch<React.SetStateAction<PlannerState>>; conflicts: string[]; onBack: () => void; onNext: () => void }) {
  const isElementary = schoolLevelOf(state.plan) === "elementary";
  const [draft, setDraft] = useState<Omit<FixedEvent, "id">>({ title: "", days: ["mon"], start: "14:00", end: "15:00", bufferMinutes: 20 });
  const [exception, setException] = useState<Omit<ExceptionEvent, "id">>({ startDate: "", endDate: "", title: "", start: "09:00", end: "18:00" });
  const addFixed = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim() || !draft.days.length || draft.start >= draft.end) return;
    setState((current) => ({ ...current, fixedEvents: [...current.fixedEvents, { ...draft, title: draft.title.trim(), id: uid("fixed") }] }));
    setDraft((current) => ({ ...current, title: "" }));
  };
  const addException = (e: FormEvent) => {
    e.preventDefault();
    if (!exception.startDate || !exception.endDate || exception.endDate < exception.startDate || !exception.title.trim() || exception.start >= exception.end) return;
    setState((current) => ({ ...current, exceptions: [...current.exceptions, { ...exception, title: exception.title.trim(), id: uid("exception") }] }));
    setException((current) => ({ ...current, title: "", startDate: "", endDate: "" }));
  };
  const setQuickDuration = (days: number) => {
    const startDate = exception.startDate || state.plan.startDate;
    if (!startDate) return;
    const endDate = addCalendarDays(startDate, days - 1);
    setException((current) => ({ ...current, startDate, endDate: endDate > state.plan.endDate ? state.plan.endDate : endDate }));
  };
  const toggleDay = (day: DayKey) => setDraft((current) => ({ ...current, days: current.days.includes(day) ? current.days.filter((item) => item !== day) : [...current.days, day] }));
  return (
    <section className="wizard-page wide page-enter">
      <PageIntro kicker={isElementary ? "2 · 부모님 차례" : "2 · 선택 단계 · 가족 일정 받기"} title={isElementary ? "움직일 수 없는 시간만 잠가주세요." : "가족과 먼저 맞춰야 할 시간만 확인해요."} description={isElementary ? "학원, 식사, 가족 일정처럼 꼭 지켜야 하는 것만 넣어요. 나머지는 아이가 고를 거예요." : "가족 행사, 학원, 병원처럼 바꿀 수 없는 일정이 있다면 입력하세요. 없다면 바로 건너뛰어도 됩니다."} />
      <div className="split-layout">
        <form className="form-card accent-coral" onSubmit={addFixed}>
          <div className="section-heading"><span className="round-icon coral">📌</span><div><h2>반복 고정 일정</h2><p>여러 요일을 한 번에 고를 수 있어요.</p></div></div>
          <label><span>일정 이름</span><input required type="text" placeholder="예: 수영 학원" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
          <fieldset><legend>요일</legend><div className="day-picker">{DAY_KEYS.map((day) => <button type="button" aria-pressed={draft.days.includes(day)} className={draft.days.includes(day) ? "selected" : ""} key={day} onClick={() => toggleDay(day)}>{DAY_LABELS[day]}</button>)}</div></fieldset>
          <div className="field-grid three"><label><span>시작</span><input type="time" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} /></label><label><span>끝</span><input type="time" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} /></label><label><span>앞뒤 여유</span><select value={draft.bufferMinutes} onChange={(e) => setDraft({ ...draft, bufferMinutes: Number(e.target.value) })}><option value="0">없음</option><option value="10">10분</option><option value="20">20분</option><option value="30">30분</option><option value="60">60분</option></select></label></div>
          <button className="secondary-button full" type="submit">+ 고정 일정 추가</button>
        </form>
        <div className="list-panel">
          <h2>{isElementary ? "지금 잠긴 일정" : "확인한 고정 일정"} <span>{state.fixedEvents.length}</span></h2>
          {!state.fixedEvents.length && <EmptyMessage icon="🗓️" text="아직 고정 일정이 없어요. 없다면 그대로 넘어가도 좋아요." />}
          {state.fixedEvents.map((event) => <article className="event-row" key={event.id}><div className="event-time">{event.start}<small>{event.end}까지</small></div><div><b>{event.title}</b><p>{event.days.map((day) => DAY_LABELS[day]).join("·")}요일 · 앞뒤 {event.bufferMinutes}분 여유</p></div><button aria-label={`${event.title} 삭제`} onClick={() => setState((current) => ({ ...current, fixedEvents: current.fixedEvents.filter((item) => item.id !== event.id) }))}>×</button></article>)}
          {conflicts.map((conflict) => <div className="inline-alert error" key={conflict}>⚠️ {conflict}</div>)}
        </div>
      </div>
      <div className="form-card exception-card">
        <div className="section-heading"><span className="round-icon mint">🧳</span><div><h2>특별한 기간이 있나요?</h2><p>여행, 캠프, 체험학습 기간을 한 번만 입력하면 모든 날짜에 반영해요. 선택 사항이에요.</p></div></div>
        <form className="exception-form range-form" onSubmit={addException}>
          <label className="grow"><span>무엇을 하나요?</span><input type="text" placeholder="예: 제주도 가족 여행" value={exception.title} onChange={(e) => setException({ ...exception, title: e.target.value })} /></label>
          <div className="date-range-fields"><label><span>시작일</span><input type="date" min={state.plan.startDate} max={state.plan.endDate} value={exception.startDate} onChange={(e) => setException({ ...exception, startDate: e.target.value, endDate: !exception.endDate || exception.endDate < e.target.value ? e.target.value : exception.endDate })} /></label><span className="date-range-arrow">→</span><label><span>종료일</span><input type="date" min={exception.startDate || state.plan.startDate} max={state.plan.endDate} value={exception.endDate} onChange={(e) => setException({ ...exception, endDate: e.target.value })} /></label></div>
          <div className="duration-presets" aria-label="기간 빠른 선택"><span>빠른 선택</span>{[1, 2, 3].map((days) => <button type="button" key={days} className={exception.startDate && exception.endDate && exceptionDayCount({ startDate: exception.startDate, endDate: exception.endDate }) === days ? "active" : ""} onClick={() => setQuickDuration(days)}>{days}일</button>)}</div>
          <details className="exception-time"><summary>하루 시간 설정 <small>{exception.start}–{exception.end}</small></summary><div><label><span>시작</span><input type="time" value={exception.start} onChange={(e) => setException({ ...exception, start: e.target.value })} /></label><label><span>끝</span><input type="time" value={exception.end} onChange={(e) => setException({ ...exception, end: e.target.value })} /></label></div></details>
          <button className="small-add" type="submit">기간 일정 추가</button>
        </form>
        {!!state.exceptions.length && <div className="exception-chips">{state.exceptions.map((item) => <span key={item.id}><b>{exceptionDateLabel(item)}</b> {item.title}<small>{exceptionDayCount(item)}일</small><button aria-label={`${item.title} 삭제`} onClick={() => setState((current) => ({ ...current, exceptions: current.exceptions.filter((event) => event.id !== item.id) }))}>×</button></span>)}</div>}
      </div>
      <div className="wizard-actions"><button className="text-button" onClick={onBack}>← 이전</button><button className="primary-button" onClick={onNext}>{isElementary ? "아이에게 넘겨주기" : state.fixedEvents.length || state.exceptions.length ? "내 활동 고르기" : "건너뛰고 내 계획 세우기"} →</button></div>
    </section>
  );
}

function ChildActivities({ state, setState, generationError, onBack, onGenerate }: { state: PlannerState; setState: React.Dispatch<React.SetStateAction<PlannerState>>; generationError: string; onBack: () => void; onGenerate: () => void }) {
  const level = schoolLevelOf(state.plan);
  const isElementary = level === "elementary";
  const [customName, setCustomName] = useState("");
  const update = (id: string, patch: Partial<ActivityPreference>) => setState((current) => ({ ...current, activities: current.activities.map((activity) => activity.id === id ? { ...activity, ...patch } : activity) }));
  const addCustom = () => {
    if (!customName.trim()) return;
    setState((current) => ({ ...current, activities: [...current.activities, { id: uid("custom"), category: isElementary ? "play" : "creative", name: customName.trim(), icon: "⭐", frequency: 1, preference: "any", mustHave: false, selected: true, durationMinutes: 60 }] }));
    setCustomName("");
  };
  const selectedCount = state.activities.filter((activity) => activity.selected).length;
  const selectedCategories = new Set(state.activities.filter((activity) => activity.selected).map((activity) => activity.category));
  const balanceState = BALANCE_GROUPS.map((group) => ({
    ...group,
    selected: group.categories.some((category) => selectedCategories.has(category)),
  }));
  const balanced = balanceState.every((group) => group.selected);
  return (
    <section className="wizard-page wide child-page page-enter">
      <PageIntro kicker={isElementary ? "3 · 이제 아이 차례!" : "3 · 내가 만드는 균형 계획"} title={isElementary ? `${state.plan.nickname || "친구"}야, 방학에 뭘 하고 싶어?` : `${state.plan.nickname || "학생"}님의 방학에 필요한 활동을 골라보세요.`} description={isElementary ? "마음에 드는 카드를 눌러 골라봐. 너무 많이 골라도 괜찮아. 넣지 못한 건 솔직하게 알려줄게." : `공부·운동·취미·휴식을 고르게 선택하고, ${level === "middle" ? "1시간" : "30분"} 단위에 맞는 활동 시간을 정하세요.`} />
      <div className="selection-count"><div><span>선택한 활동 <b>{selectedCount}</b>개</span><p>{balanced ? "균형 준비 완료! 이제 시간표를 만들 수 있어요." : "네 가지 영역에서 하나 이상 골라 균형을 맞춰주세요."}</p></div><div className="balance-checklist" aria-label="균형 영역 선택 현황">{balanceState.map((group) => <span className={group.selected ? "done" : ""} key={group.id}>{group.selected ? "✓" : group.icon} {group.label}</span>)}</div></div>
      {generationError && <div className="inline-alert error generation-error" role="alert">⚠️ {generationError}</div>}
      <div className="activity-grid">
        {state.activities.map((activity) => <article key={activity.id} className={`activity-card category-${activity.category} ${activity.selected ? "selected" : ""}`}>
          <button className="activity-main" aria-pressed={activity.selected} onClick={() => update(activity.id, { selected: !activity.selected })}><span className="activity-icon">{activity.icon}</span><b>{activity.name}</b><i>{activity.selected ? isElementary ? "✓ 골랐어!" : "✓ 선택됨" : isElementary ? "+ 고르기" : "+ 선택"}</i></button>
          {activity.selected && <div className="activity-options">
            <label><span>일주일에</span><select value={activity.frequency} onChange={(e) => update(activity.id, { frequency: Number(e.target.value) })}>{[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n}번</option>)}</select></label>
            <label><span>한 번에</span><select value={activity.durationMinutes} onChange={(e) => update(activity.id, { durationMinutes: Number(e.target.value) })}>{durationOptions(level).map((minutes) => <option key={minutes} value={minutes}>{durationLabel(minutes)}</option>)}</select></label>
            <div><span>언제가 좋아?</span><div className="segmented">{(["morning", "afternoon", "any"] as TimePreference[]).map((value) => <button key={value} className={activity.preference === value ? "active" : ""} onClick={() => update(activity.id, { preference: value })}>{PREFERENCE_LABEL[value]}</button>)}</div></div>
            <label className="must-toggle"><input type="checkbox" checked={activity.mustHave} onChange={(e) => update(activity.id, { mustHave: e.target.checked })} /><span>{isElementary ? "⭐ 꼭 넣어줘!" : "⭐ 반드시 포함"}</span><small>선택한 횟수를 전부 넣어요.</small></label>
          </div>}
        </article>)}
        <article className="activity-card custom-card"><div className="activity-main"><span className="activity-icon">💭</span><b>{isElementary ? "내가 하고 싶은 것" : "나만의 활동"}</b><div className="custom-input"><input aria-label="직접 추가할 활동" maxLength={16} placeholder={isElementary ? "직접 써 보기" : "예: 자격증 공부"} value={customName} onChange={(e) => setCustomName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCustom()} /><button onClick={addCustom}>추가</button></div></div></article>
      </div>
      <div className="wizard-actions"><button className="text-button" onClick={onBack}>← {isElementary ? "부모님 화면" : "가족 일정"}</button><button className="primary-button sparkle" disabled={!balanced} onClick={onGenerate}>✨ {isElementary ? "우리" : "내"} 시간표 만들기</button></div>
    </section>
  );
}

type DropPeriod = "morning" | "afternoon";
type DropSlot = { day: DayKey; start: string; end: string };

function parseDropTarget(value: string): { day: DayKey; period: DropPeriod } | null {
  const [prefix, day, period] = value.split(":");
  if (prefix !== "slot" || !DAY_KEYS.includes(day as DayKey) || (period !== "morning" && period !== "afternoon")) return null;
  return { day: day as DayKey, period };
}

function Results({ state, scheduleRef, onBack, onRegenerate, onBlockAction, onBlockDrop, onManualAdd, onDownload, onPrint, onNotify, busy }: { state: PlannerState; scheduleRef: React.RefObject<HTMLDivElement | null>; onBack: () => void; onRegenerate: () => void; onBlockAction: (block: ScheduleBlock, action: "lock" | "delete" | "move") => void; onBlockDrop: (block: ScheduleBlock, day: DayKey, period: DropPeriod) => void; onManualAdd: (day: DayKey, title: string, start: string, end: string) => string | null; onDownload: () => void; onPrint: () => void; onNotify: (message: string) => void; busy: boolean }) {
  const result = state.result!;
  const level = schoolLevelOf(state.plan);
  const isElementary = level === "elementary";
  const owner = state.plan.nickname || (isElementary ? "우리 가족" : "나");
  const [viewMode, setViewMode] = useState<ExportScope>("weekly");
  const [exportScope, setExportScope] = useState<ExportScope>("weekly");
  const [fileBusy, setFileBusy] = useState<"pdf" | "pptx" | null>(null);
  const [activeBlock, setActiveBlock] = useState<ScheduleBlock | null>(null);
  const [overDropId, setOverDropId] = useState<string | null>(null);
  const [manualDay, setManualDay] = useState<DayKey | null>(null);
  const weeks = useMemo(() => buildVacationWeeks(state.plan, result, state.exceptions), [state.plan, result, state.exceptions]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );
  const totalActivities = DAY_KEYS.flatMap((day) => result.blocks[day]).filter((block) => block.kind === "activity").length;
  const dropSlots = useMemo(() => {
    const slots = new Map<string, DropSlot | null>();
    if (!activeBlock) return slots;
    for (const day of DAY_KEYS) {
      for (const period of ["morning", "afternoon"] as DropPeriod[]) {
        slots.set(`slot:${day}:${period}`, findSlotOnDay(state.plan, result, activeBlock, day, period));
      }
    }
    return slots;
  }, [activeBlock, result, state.plan]);

  const changeView = (scope: ExportScope) => {
    setViewMode(scope);
    setExportScope(scope);
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    const block = DAY_KEYS.flatMap((day) => result.blocks[day]).find((item) => item.id === String(active.id)) ?? null;
    setActiveBlock(block);
  };

  const handleDragOver = ({ over }: DragOverEvent) => {
    const id = over ? String(over.id) : null;
    setOverDropId(id && parseDropTarget(id) ? id : null);
  };

  const clearDrag = () => {
    setActiveBlock(null);
    setOverDropId(null);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const id = over ? String(over.id) : "";
    const target = parseDropTarget(id);
    const block = activeBlock ?? DAY_KEYS.flatMap((day) => result.blocks[day]).find((item) => item.id === String(active.id));
    const slot = dropSlots.get(id);
    clearDrag();
    if (!target || !block || !slot) return;
    onBlockDrop(block, target.day, target.period);
  };

  const exportPdf = async () => {
    setFileBusy("pdf");
    try {
      await document.fonts.ready;
      const nodes = Array.from(document.querySelectorAll<HTMLElement>(`[data-pdf-scope="${exportScope}"]`));
      await downloadSchedulePdf(nodes, exportFilename(state, exportScope, "pdf"));
      trackAnalytics("pdf_download", exportScope);
      onNotify(`${exportScope === "weekly" ? "주간" : "방학 전체"} PDF를 저장했어요.`);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "PDF 파일을 만들지 못했어요.");
    } finally {
      setFileBusy(null);
    }
  };

  const exportPptx = async () => {
    setFileBusy("pptx");
    try {
      await downloadSchedulePptx(state, exportScope);
      trackAnalytics("pptx_download", exportScope);
      onNotify("수정 가능한 PPTX를 저장했어요.");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "PPTX 파일을 만들지 못했어요.");
    } finally {
      setFileBusy(null);
    }
  };

  const regenerate = () => {
    const hasManualBlocks = DAY_KEYS.some((day) => result.blocks[day].some((block) => block.kind === "manual"));
    if (hasManualBlocks && !window.confirm("직접 추가한 일정도 사라집니다. 처음부터 다시 배치할까요?")) return;
    onRegenerate();
  };

  return (
    <section className="results-page page-enter">
      <div className="result-top no-print"><div><span className="eyebrow">4 · {isElementary ? "함께 보고 맞추기" : "직접 보고 조정하기"}</span><h1>{isElementary ? "짜잔! 우리 가족의 방학 리듬이에요." : "내 생활에 맞는 방학 시간표가 완성됐어요."}</h1><p>Google Calendar처럼 활동 블록 전체를 잡고 원하는 요일과 시간대로 옮겨보세요. {level === "middle" ? "활동은 1시간 단위로 배치돼요." : level === "high" ? "활동은 30분 단위로 정밀하게 배치돼요." : "오전·오후의 여유를 보며 조정할 수 있어요."}</p></div><div className="export-actions"><button className="secondary-button" onClick={onPrint}>🖨️ 바로 인쇄</button><button className="secondary-button" disabled={busy} onClick={onDownload}>{busy ? "이미지 만드는 중..." : "↓ 주간 PNG"}</button></div></div>
      {result.warnings.length > 0 && <div className="warning-stack no-print">{result.warnings.map((warning) => <article className={warning.tone} key={warning.id}><span>{warning.tone === "warning" ? "⚠️" : "🌿"}</span><div><b>{warning.title}</b><p>{warning.description}</p></div></article>)}</div>}
      <div className="schedule-view-toggle no-print" aria-label="일정 보기 방식"><button className={viewMode === "weekly" ? "active" : ""} onClick={() => changeView("weekly")}>반복 주간 일정</button><button className={viewMode === "vacation" ? "active" : ""} onClick={() => changeView("vacation")}>방학기간 전체 일정 <span>{weeks.length}주</span></button></div>
      {viewMode === "weekly" ? <div className="schedule-export" ref={scheduleRef}>
        <div className="print-title"><div><span>방학한칸</span><h2>{state.plan.nickname ? `${state.plan.nickname}의` : isElementary ? "우리 가족" : "나의"} 방학 시간표</h2><p>{state.plan.startDate.replaceAll("-", ".")} — {state.plan.endDate.replaceAll("-", ".")} · {schoolGradeLabel(state.plan)}</p></div><div className="print-motto">균형 있게,<br />나답게!</div></div>
        <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragCancel={clearDrag} onDragEnd={handleDragEnd}>
          <div className={`calendar-drag-guide no-print ${activeBlock ? "active" : ""}`} aria-live="polite">{activeBlock ? <><span className="drag-pulse">↕</span><div><b>{activeBlock.icon} {activeBlock.title} 이동 중</b><p>{overDropId && dropSlots.get(overDropId) ? `${DAY_LABELS[parseDropTarget(overDropId)!.day]}요일 ${parseDropTarget(overDropId)!.period === "morning" ? "오전" : "오후"} ${dropSlots.get(overDropId)!.start}에 놓을 수 있어요.` : "원하는 요일의 오전 또는 오후 구역에 놓으세요."}</p></div><kbd>ESC 취소</kbd></> : <><span>☝️</span><div><b>블록 어디든 잡아서 옮겨보세요</b><p>드래그하면 놓을 수 있는 오전·오후와 실제 배치 시각을 미리 보여드려요.</p></div></>}</div>
          <div className={`week-grid calendar-grid ${activeBlock ? "drag-session" : ""}`}>{DAY_KEYS.map((day) => <DayColumn key={day} day={day} blocks={result.blocks[day]} activeBlock={activeBlock} dropSlots={dropSlots} overDropId={overDropId} onAdd={() => setManualDay(day)} onAction={onBlockAction} />)}</div>
          <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(.2,.8,.2,1)" }}>{activeBlock ? <CalendarDragOverlay block={activeBlock} targetId={overDropId} slot={overDropId ? dropSlots.get(overDropId) : null} /> : null}</DragOverlay>
        </DndContext>
        <div className="result-bottom">
          <article className="free-note"><span>☁️</span><div><b>빈 시간도 계획이에요</b><p>{isElementary ? "심심하면 새로운 놀이가 떠오를 수 있어요. 하루를 꼭 가득 채우지 않아도 괜찮아요." : "회복하거나 그날의 컨디션에 맞춰 선택할 시간을 남겨두세요. 모든 시간을 채울 필요는 없습니다."}</p></div></article>
          <article className="summary-note"><b>이번 주 한눈에</b><span>선택한 활동 <strong>{totalActivities}</strong>칸</span><span>특별한 기간 <strong>{state.exceptions.length}</strong>개</span></article>
        </div>
        {!!state.exceptions.length && <div className="special-days"><h3>🧳 이번 방학의 특별한 기간</h3><div>{state.exceptions.map((event) => <article key={event.id}><b>{exceptionDateLabel(event)}</b><span>{event.title}</span><small>{exceptionDayCount(event)}일 · {event.start}–{event.end}</small></article>)}</div></div>}
        <p className="print-footnote">{isElementary ? "부모님이 정한 시간 📌 · 아이가 고른 활동 ⭐ · 방학한칸에서 함께 만들었어요." : `가족과 확인한 고정 일정 📌 · ${studentNoun(state.plan)}이 선택한 활동 ⭐ · 균형 있게 직접 만들었어요.`}</p>
      </div> : <VacationCalendar weeks={weeks} owner={owner} precise={!isElementary} />}
      {manualDay && <ManualScheduleDialog key={manualDay} day={manualDay} onAdd={onManualAdd} onClose={() => setManualDay(null)} />}
      <div className="edit-helper no-print"><div><b>요일과 시간대를 직접 정하세요</b><p>블록을 옮기거나 요일 옆의 +를 눌러 {isElementary ? "부모님이" : "학생이"} 일정을 직접 추가할 수 있어요.</p></div><button className="secondary-button" onClick={regenerate}>↻ 처음부터 다시 배치</button></div>
      <div className="file-export-panel no-print"><div><span className="round-icon sky">↓</span><div><h2>어떤 일정으로 파일을 만들까요?</h2><p>PDF는 인쇄에 맞게, PPTX는 텍스트와 블록을 PowerPoint에서 수정할 수 있게 만들어요.</p></div></div><div className="export-scope"><button className={exportScope === "weekly" ? "active" : ""} onClick={() => setExportScope("weekly")}><b>주간 일정</b><small>반복하는 한 주</small></button><button className={exportScope === "vacation" ? "active" : ""} onClick={() => setExportScope("vacation")}><b>방학 전체</b><small>{weeks.length}주 · 특별 일정 반영</small></button></div><div className="file-buttons"><button className="secondary-button" disabled={Boolean(fileBusy)} onClick={exportPdf}>{fileBusy === "pdf" ? "PDF 만드는 중..." : "PDF 다운로드"}</button><button className="primary-button" disabled={Boolean(fileBusy)} onClick={exportPptx}>{fileBusy === "pptx" ? "PPTX 만드는 중..." : "편집 가능한 PPTX"}</button></div></div>
      <ExportPages state={state} />
      <div className="wizard-actions no-print"><button className="text-button" onClick={onBack}>← {isElementary ? "아이 선택" : "활동 선택"} 고치기</button><button className="primary-button" onClick={exportPdf}>선택한 일정 PDF 저장</button></div>
    </section>
  );
}

function blockDropPeriod(block: ScheduleBlock): DropPeriod {
  if (block.period !== "fixed") return block.period;
  return block.start < "12:00" ? "morning" : "afternoon";
}

function DayColumn({ day, blocks, activeBlock, dropSlots, overDropId, onAdd, onAction }: { day: DayKey; blocks: ScheduleBlock[]; activeBlock: ScheduleBlock | null; dropSlots: Map<string, DropSlot | null>; overDropId: string | null; onAdd: () => void; onAction: (block: ScheduleBlock, action: "lock" | "delete" | "move") => void }) {
  return <article className={`day-column ${day === "sat" || day === "sun" ? "weekend" : ""}`}><header><div className="day-name"><span>{DAY_LABELS[day]}</span><small>요일</small></div><button type="button" className="day-add-button no-print" aria-label={`${DAY_LABELS[day]}요일 일정 추가`} onClick={onAdd}>+</button></header><div className="day-blocks">{(["morning", "afternoon"] as DropPeriod[]).map((period) => {
    const id = `slot:${day}:${period}`;
    return <PeriodDropZone key={id} id={id} period={period} blocks={blocks.filter((block) => blockDropPeriod(block) === period)} activeBlock={activeBlock} slot={dropSlots.get(id)} isCurrentTarget={overDropId === id} onAction={onAction} />;
  })}</div></article>;
}

function PeriodDropZone({ id, period, blocks, activeBlock, slot, isCurrentTarget, onAction }: { id: string; period: DropPeriod; blocks: ScheduleBlock[]; activeBlock: ScheduleBlock | null; slot: DropSlot | null | undefined; isCurrentTarget: boolean; onAction: (block: ScheduleBlock, action: "lock" | "delete" | "move") => void }) {
  const { isOver, setNodeRef } = useDroppable({ id, disabled: Boolean(activeBlock && !slot) });
  const dragging = Boolean(activeBlock);
  const available = !dragging || Boolean(slot);
  return <section ref={setNodeRef} className={`period-drop-zone ${period} ${dragging ? "drag-ready" : ""} ${isOver || isCurrentTarget ? "drop-target" : ""} ${!available ? "drop-unavailable" : ""}`}>
    <header><b>{period === "morning" ? "오전" : "오후"}</b>{dragging && <span>{available ? isOver || isCurrentTarget ? `${slot!.start}–${slot!.end}에 놓기` : "여기로 이동" : "빈 시간 없음"}</span>}</header>
    {isCurrentTarget && available && <div className="drop-preview"><span>+</span><b>{activeBlock!.title}</b><small>{slot!.start}–{slot!.end}</small></div>}
    <div className="period-blocks">{blocks.map((block) => <DraggableScheduleBlock key={block.id} block={block} onAction={onAction} />)}{!blocks.length && !dragging && <div className="empty-period"><span>＋</span><small>비어 있어요</small></div>}</div>
  </section>;
}

function DraggableScheduleBlock({ block, onAction }: { block: ScheduleBlock; onAction: (block: ScheduleBlock, action: "lock" | "delete" | "move") => void }) {
  const canDrag = block.kind !== "fixed" && !block.locked;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: block.id, disabled: !canDrag });
  return <div ref={setNodeRef} className={`schedule-block ${block.kind} category-${block.category} ${canDrag ? "draggable" : ""} ${isDragging ? "dragging" : ""}`} {...(canDrag ? listeners : {})} {...(canDrag ? attributes : {})} aria-label={canDrag ? `${block.title}, ${block.start}부터 ${block.end}까지. 잡아서 이동` : undefined}>
    {canDrag && <span className="block-grip no-print" aria-hidden="true">⠿</span>}
    <div className="block-time"><span>{block.period === "fixed" ? `${block.start}–${block.end}` : `${block.start}–${block.end}`}</span>{block.locked && <i title="잠긴 활동">🔒</i>}</div><div className="block-title"><span>{block.icon}</span><b>{block.title}</b></div><p>{block.reason}</p>
    {block.kind !== "fixed" && <div className="block-controls no-print" onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}><button title={block.locked ? "잠금 풀기" : "잠그기"} onClick={() => onAction(block, "lock")}>{block.locked ? "🔓" : "🔒"}</button><button disabled={block.locked} onClick={() => onAction(block, "move")}>다른 시간</button><button disabled={block.locked || Boolean(block.mustHave)} title={block.mustHave ? "‘꼭 넣어줘!’ 체크를 해제해야 뺄 수 있어요" : "빼기"} onClick={() => onAction(block, "delete")}>×</button></div>}
  </div>;
}

function ManualScheduleDialog({ day, onAdd, onClose }: { day: DayKey; onAdd: (day: DayKey, title: string, start: string, end: string) => string | null; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("11:00");
  const [error, setError] = useState("");
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const submittedTitle = String(form.get("title") ?? title);
    const submittedStart = String(form.get("start") ?? start);
    const submittedEnd = String(form.get("end") ?? end);
    const nextError = onAdd(day, submittedTitle, submittedStart, submittedEnd);
    if (nextError) return setError(nextError);
    onClose();
  };
  return <div className="manual-dialog-backdrop no-print" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="manual-event-dialog" role="dialog" aria-modal="true" aria-labelledby="manual-dialog-title">
    <header><div><span>{DAY_LABELS[day]}요일</span><h2 id="manual-dialog-title">새 일정 카드 만들기</h2></div><button type="button" aria-label="일정 추가 창 닫기" onClick={onClose}>×</button></header>
    <p>매주 {DAY_LABELS[day]}요일에 반복되는 일정으로 추가돼요.</p>
    <form onSubmit={submit}><label><span>일정 이름</span><input name="title" autoFocus required maxLength={20} placeholder="예: 수영 준비물 챙기기" value={title} onChange={(event) => { setTitle(event.target.value); setError(""); }} /></label><div className="manual-time-fields"><label><span>시작</span><input name="start" type="time" step="600" value={start} onChange={(event) => { setStart(event.target.value); setError(""); }} /></label><span>→</span><label><span>종료</span><input name="end" type="time" step="600" value={end} onChange={(event) => { setEnd(event.target.value); setError(""); }} /></label></div>{error && <div className="manual-form-error" role="alert">⚠️ {error}</div>}<div className="manual-dialog-actions"><button type="button" className="text-button" onClick={onClose}>취소</button><button type="submit" className="primary-button">일정 추가</button></div></form>
  </section></div>;
}

function CalendarDragOverlay({ block, targetId, slot }: { block: ScheduleBlock; targetId: string | null; slot: DropSlot | null | undefined }) {
  const target = targetId ? parseDropTarget(targetId) : null;
  return <div className={`calendar-drag-overlay category-${block.category}`}><div><span className="overlay-icon">{block.icon}</span><div><b>{block.title}</b><small>{target && slot ? `${DAY_LABELS[target.day]}요일 · ${target.period === "morning" ? "오전" : "오후"} ${slot.start}–${slot.end}` : "놓을 시간을 찾는 중"}</small></div></div><span className="overlay-grip">⠿</span></div>;
}

function VacationCalendar({ weeks, owner, precise }: { weeks: VacationWeek[]; owner: string; precise: boolean }) {
  return <div className="vacation-calendar"><div className="vacation-calendar-title"><div><span>방학기간 전체 일정</span><h2>{owner}의 방학을 날짜별로 펼쳤어요.</h2></div><b>{weeks.length}주</b></div>{weeks.map((week, index) => <section key={week.id} className="vacation-week"><header><strong>{index + 1}주차</strong><span>{week.label}</span></header><div className="vacation-days">{week.days.map((day) => <article key={`${day.day}-${day.date ?? "outside"}`} className={`${!day.date ? "outside" : ""} ${day.isException ? "exception" : ""}`}><h3>{day.date ? <><b>{Number(day.date.slice(8))}</b><span>{DAY_LABELS[day.day]}요일</span></> : <span>방학 전·후</span>}</h3><div>{day.blocks.map((block) => <p key={block.id} className={`category-${block.category}`}><small>{block.kind === "fixed" || block.kind === "manual" || precise ? `${block.start}-${block.end}` : block.period === "morning" ? "오전" : "오후"}</small><b>{block.icon} {block.title}</b></p>)}{day.date && !day.blocks.length && <em>☁️ 여유로운 날</em>}</div></article>)}</div></section>)}</div>;
}

function EmptyMessage({ icon, text }: { icon: string; text: string }) {
  return <div className="empty-message"><span>{icon}</span><p>{text}</p></div>;
}
