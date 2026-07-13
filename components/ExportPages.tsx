import { DAY_KEYS, DAY_LABELS, PlannerState, ScheduleBlock } from "@/lib/types";
import { buildVacationWeeks, VacationDay } from "@/lib/vacation";

function Block({ block }: { block: ScheduleBlock }) {
  return <div className={`pdf-block category-${block.category}`}><small>{block.kind === "fixed" || block.kind === "manual" ? `${block.start}-${block.end}` : block.period === "morning" ? "오전" : "오후"}</small><b>{block.icon} {block.title}</b></div>;
}

function Page({ title, subtitle, days, scope }: { title: string; subtitle: string; days: VacationDay[]; scope: "weekly" | "vacation" }) {
  return <div className="pdf-export-page" data-pdf-scope={scope}>
    <header><div><span>방학한칸</span><h2>{title}</h2><p>{subtitle}</p></div><strong>느슨하게,<br />신나게!</strong></header>
    <div className="pdf-week-grid">{days.map((day) => <article className={!day.date && scope === "vacation" ? "outside" : ""} key={`${day.day}-${day.date ?? "outside"}`}><h3>{day.date ? `${DAY_LABELS[day.day]} · ${Number(day.date.slice(8))}일` : `${DAY_LABELS[day.day]}요일`}</h3><div>{day.blocks.length ? day.blocks.map((block) => <Block key={block.id} block={block} />) : day.date || scope === "weekly" ? <p className="pdf-empty">☁️ 여유로운 하루</p> : null}</div></article>)}</div>
    <footer>📌 부모님이 정한 일정 · ⭐ 아이가 고른 활동 · 빈 시간도 계획이에요.</footer>
  </div>;
}

export default function ExportPages({ state }: { state: PlannerState }) {
  if (!state.result) return null;
  const weeklyDays: VacationDay[] = DAY_KEYS.map((day) => ({ date: null, day, label: DAY_LABELS[day], blocks: state.result!.blocks[day], isException: false }));
  const weeks = buildVacationWeeks(state.plan, state.result, state.exceptions);
  const subtitle = `${state.plan.startDate.replaceAll("-", ".")} - ${state.plan.endDate.replaceAll("-", ".")} · 초등 ${state.plan.grade}학년`;
  return <div className="export-pages-offscreen" aria-hidden="true" inert>
    <Page scope="weekly" title={`${state.plan.nickname || "우리 가족"}의 주간 시간표`} subtitle={subtitle} days={weeklyDays} />
    {weeks.map((week, index) => <Page key={week.id} scope="vacation" title={`${index + 1}주차 · ${week.label}`} subtitle={`${state.plan.nickname || "우리 가족"}의 방학 전체 일정`} days={week.days} />)}
  </div>;
}
