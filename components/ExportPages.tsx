import { DAY_KEYS, DAY_LABELS, PlannerState, ScheduleBlock, schoolGradeLabel, schoolLevelOf, studentNoun } from "@/lib/types";
import { buildVacationWeeks, VacationDay } from "@/lib/vacation";

function Block({ block, precise }: { block: ScheduleBlock; precise: boolean }) {
  return <div className={`pdf-block category-${block.category}`}><small>{block.kind === "fixed" || block.kind === "manual" || precise ? `${block.start}-${block.end}` : block.period === "morning" ? "오전" : "오후"}</small><b>{block.icon} {block.title}</b></div>;
}

function Page({ title, subtitle, days, scope, precise, footer }: { title: string; subtitle: string; days: VacationDay[]; scope: "weekly" | "vacation"; precise: boolean; footer: string }) {
  return <div className="pdf-export-page" data-pdf-scope={scope}>
    <header><div><span>방학한칸</span><h2>{title}</h2><p>{subtitle}</p></div><strong>균형 있게,<br />나답게!</strong></header>
    <div className="pdf-week-grid">{days.map((day) => <article className={!day.date && scope === "vacation" ? "outside" : ""} key={`${day.day}-${day.date ?? "outside"}`}><h3>{day.date ? `${DAY_LABELS[day.day]} · ${Number(day.date.slice(8))}일` : `${DAY_LABELS[day.day]}요일`}</h3><div>{day.blocks.length ? day.blocks.map((block) => <Block key={block.id} block={block} precise={precise} />) : day.date || scope === "weekly" ? <p className="pdf-empty">☁️ 여유로운 하루</p> : null}</div></article>)}</div>
    <footer>{footer}</footer>
  </div>;
}

export default function ExportPages({ state }: { state: PlannerState }) {
  if (!state.result) return null;
  const weeklyDays: VacationDay[] = DAY_KEYS.map((day) => ({ date: null, day, label: DAY_LABELS[day], blocks: state.result!.blocks[day], isException: false }));
  const weeks = buildVacationWeeks(state.plan, state.result, state.exceptions);
  const level = schoolLevelOf(state.plan);
  const precise = level !== "elementary";
  const subtitle = `${state.plan.startDate.replaceAll("-", ".")} - ${state.plan.endDate.replaceAll("-", ".")} · ${schoolGradeLabel(state.plan)}`;
  const owner = state.plan.nickname || (level === "elementary" ? "우리 가족" : "나");
  const footer = level === "elementary" ? "📌 부모님이 정한 일정 · ⭐ 아이가 고른 활동 · 빈 시간도 계획이에요." : `📌 가족과 확인한 일정 · ⭐ ${studentNoun(state.plan)}이 고른 활동 · 회복 시간도 계획이에요.`;
  return <div className="export-pages-offscreen" aria-hidden="true" inert>
    <Page scope="weekly" title={`${owner}의 주간 시간표`} subtitle={subtitle} days={weeklyDays} precise={precise} footer={footer} />
    {weeks.map((week, index) => <Page key={week.id} scope="vacation" title={`${index + 1}주차 · ${week.label}`} subtitle={`${owner}의 방학 전체 일정`} days={week.days} precise={precise} footer={footer} />)}
  </div>;
}
