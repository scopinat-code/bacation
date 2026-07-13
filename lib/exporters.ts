import { DAY_KEYS, DAY_LABELS, DayKey, PlannerState, ScheduleBlock } from "./types";
import { buildVacationWeeks, VacationDay } from "./vacation";

export type ExportScope = "weekly" | "vacation";

const COLORS = {
  ink: "1F2925",
  paper: "FFF8E8",
  coral: "FF6B51",
  yellow: "FFD85B",
  mint: "9FE3BD",
  sky: "87D8EF",
  white: "FFFDF8",
};

const CATEGORY_COLORS: Record<string, string> = {
  study: "FFE184",
  reading: "9ADCF1",
  exercise: "A6E5BD",
  creative: "FFC3B8",
  outdoor: "B9E99E",
  play: "C9C0F6",
  rest: "D8E4E2",
  fixed: "FFE0D9",
  manual: "FFD0E8",
};

function safeName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").trim() || "우리집";
}

export async function downloadSchedulePdf(nodes: HTMLElement[], filename: string) {
  if (!nodes.length) throw new Error("PDF로 만들 일정 페이지를 찾지 못했어요.");
  const [{ jsPDF }, { toPng }] = await Promise.all([import("jspdf"), import("html-to-image")]);
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  for (let index = 0; index < nodes.length; index += 1) {
    if (index > 0) pdf.addPage("a4", "landscape");
    const node = nodes[index];
    const dataUrl = await toPng(node, { backgroundColor: "#fff8e8", cacheBust: true, pixelRatio: 1.65, width: node.scrollWidth, height: node.scrollHeight });
    const imageRatio = node.scrollWidth / node.scrollHeight;
    const availableWidth = pageWidth - 10;
    const availableHeight = pageHeight - 10;
    let width = availableWidth;
    let height = width / imageRatio;
    if (height > availableHeight) {
      height = availableHeight;
      width = height * imageRatio;
    }
    pdf.addImage(dataUrl, "PNG", (pageWidth - width) / 2, (pageHeight - height) / 2, width, height, undefined, "FAST");
  }
  pdf.save(filename);
}

function periodText(block: ScheduleBlock) {
  if (block.kind === "fixed" || block.kind === "manual") return `${block.start}-${block.end}`;
  return block.period === "morning" ? "오전" : "오후";
}

type SlideDay = { title: string; subtitle?: string; blocks: ScheduleBlock[]; dimmed?: boolean };

function addScheduleSlide(pptx: any, title: string, subtitle: string, days: SlideDay[]) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.paper };
  slide.addText(title, { x: 0.45, y: 0.25, w: 8.9, h: 0.55, fontFace: "Malgun Gothic", fontSize: 25, bold: true, color: COLORS.ink, margin: 0, breakLine: false, fit: "shrink" });
  slide.addText(subtitle, { x: 9.15, y: 0.34, w: 3.7, h: 0.3, fontFace: "Malgun Gothic", fontSize: 11, color: "66736D", align: "right", margin: 0 });
  slide.addShape(pptx.ShapeType.line, { x: 0.45, y: 0.9, w: 12.4, h: 0, line: { color: COLORS.ink, width: 1.2 } });

  const columnX = 0.42;
  const columnY = 1.08;
  const gap = 0.07;
  const columnWidth = (12.48 - gap * 6) / 7;
  const columnHeight = 5.92;
  days.forEach((day, index) => {
    const x = columnX + index * (columnWidth + gap);
    const headerFill = index >= 5 ? COLORS.mint : COLORS.yellow;
    slide.addShape(pptx.ShapeType.roundRect, { x, y: columnY, w: columnWidth, h: columnHeight, rectRadius: 0.06, fill: { color: day.dimmed ? "F0EEE7" : COLORS.white }, line: { color: COLORS.ink, width: 1.1 } });
    slide.addShape(pptx.ShapeType.rect, { x: x + 0.01, y: columnY + 0.01, w: columnWidth - 0.02, h: 0.56, fill: { color: day.dimmed ? "DADDD9" : headerFill }, line: { color: day.dimmed ? "DADDD9" : headerFill } });
    slide.addText(day.title, { x: x + 0.05, y: columnY + 0.1, w: columnWidth - 0.1, h: 0.25, fontFace: "Malgun Gothic", fontSize: 17, bold: true, align: "center", color: COLORS.ink, margin: 0, fit: "shrink" });
    if (day.subtitle) slide.addText(day.subtitle, { x: x + 0.05, y: columnY + 0.34, w: columnWidth - 0.1, h: 0.14, fontFace: "Malgun Gothic", fontSize: 8, align: "center", color: "66736D", margin: 0 });

    if (!day.blocks.length && !day.dimmed) {
      slide.addText("☁\n여유로운 하루", { x: x + 0.15, y: columnY + 2.45, w: columnWidth - 0.3, h: 0.75, fontFace: "Malgun Gothic", fontSize: 14, bold: true, color: "7B8882", align: "center", valign: "mid", margin: 0 });
      return;
    }
    const available = columnHeight - 0.78;
    const cardGap = 0.08;
    const cardHeight = Math.max(0.49, Math.min(0.92, (available - cardGap * Math.max(0, day.blocks.length - 1)) / Math.max(1, day.blocks.length)));
    day.blocks.forEach((block, blockIndex) => {
      const y = columnY + 0.68 + blockIndex * (cardHeight + cardGap);
      slide.addShape(pptx.ShapeType.roundRect, { x: x + 0.08, y, w: columnWidth - 0.16, h: cardHeight, rectRadius: 0.04, fill: { color: CATEGORY_COLORS[block.category] ?? COLORS.white }, line: { color: COLORS.ink, width: 0.75, dash: block.kind === "fixed" ? "dash" : "solid" } });
      slide.addText(`${block.icon} ${block.title}`, { x: x + 0.17, y: y + 0.12, w: columnWidth - 0.34, h: Math.max(0.18, cardHeight - 0.27), fontFace: "Malgun Gothic", fontSize: 12, bold: true, color: COLORS.ink, margin: 0, fit: "shrink", valign: "mid" });
      slide.addText(periodText(block), { x: x + 0.17, y: y + 0.03, w: columnWidth - 0.34, h: 0.13, fontFace: "Malgun Gothic", fontSize: 7.5, bold: true, color: "66736D", margin: 0, fit: "shrink" });
    });
  });
  slide.addText("방학한칸 · 부모의 고정 일정과 아이의 선택을 함께 담았어요.", { x: 0.45, y: 7.18, w: 12.4, h: 0.16, fontFace: "Malgun Gothic", fontSize: 8, color: "78857F", align: "center", margin: 0 });
}

function addCoverSlide(pptx: any, state: PlannerState, scope: ExportScope, pageCount: number) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.paper };
  slide.addShape(pptx.ShapeType.ellipse, { x: 10.45, y: 0.65, w: 1.7, h: 1.7, fill: { color: COLORS.yellow }, line: { color: COLORS.ink, width: 1.5 } });
  slide.addText("느슨하게,\n신나게!", { x: 10.72, y: 1.06, w: 1.16, h: 0.73, fontFace: "Malgun Gothic", fontSize: 17, bold: true, align: "center", valign: "mid", color: COLORS.ink, margin: 0 });
  slide.addText("방학한칸", { x: 0.72, y: 0.72, w: 2, h: 0.3, fontFace: "Malgun Gothic", fontSize: 16, bold: true, color: COLORS.coral, margin: 0 });
  slide.addText(`${state.plan.nickname || "우리 가족"}의\n여름방학 시간표`, { x: 0.72, y: 1.55, w: 8.8, h: 1.55, fontFace: "Malgun Gothic", fontSize: 38, bold: true, color: COLORS.ink, margin: 0, breakLine: false, fit: "shrink" });
  slide.addText(`${state.plan.startDate.replaceAll("-", ".")} - ${state.plan.endDate.replaceAll("-", ".")} · 초등 ${state.plan.grade}학년`, { x: 0.75, y: 3.38, w: 8.8, h: 0.35, fontFace: "Malgun Gothic", fontSize: 16, color: "66736D", margin: 0 });
  slide.addShape(pptx.ShapeType.roundRect, { x: 0.72, y: 4.45, w: 11.9, h: 1.6, rectRadius: 0.08, fill: { color: COLORS.white }, line: { color: COLORS.ink, width: 1.3 } });
  slide.addText(scope === "weekly" ? "매주 반복하는 생활 리듬" : `${pageCount}주 동안 이어지는 방학 전체 일정`, { x: 1.05, y: 4.82, w: 7.2, h: 0.42, fontFace: "Malgun Gothic", fontSize: 23, bold: true, color: COLORS.ink, margin: 0 });
  slide.addText("각 일정은 PowerPoint 안에서 직접 선택하고 수정할 수 있어요.", { x: 1.05, y: 5.34, w: 8.2, h: 0.28, fontFace: "Malgun Gothic", fontSize: 14, color: "66736D", margin: 0 });
  slide.addText("📌 고정 일정", { x: 9.15, y: 4.8, w: 1.4, h: 0.35, fontFace: "Malgun Gothic", fontSize: 14, bold: true, color: COLORS.ink, margin: 0 });
  slide.addText("⭐ 아이 활동", { x: 10.7, y: 4.8, w: 1.4, h: 0.35, fontFace: "Malgun Gothic", fontSize: 14, bold: true, color: COLORS.ink, margin: 0 });
}

function weeklyDays(state: PlannerState): SlideDay[] {
  return DAY_KEYS.map((day) => ({ title: `${DAY_LABELS[day]}요일`, blocks: state.result!.blocks[day] }));
}

function vacationSlideDays(days: VacationDay[]): SlideDay[] {
  return days.map((day) => ({
    title: day.date ? `${Number(day.date.slice(8))}일` : DAY_LABELS[day.day],
    subtitle: day.date ? `${DAY_LABELS[day.day]}요일${day.isException ? " · 특별 일정" : ""}` : "방학 기간 밖",
    blocks: day.blocks,
    dimmed: !day.date,
  }));
}

export async function downloadSchedulePptx(state: PlannerState, scope: ExportScope) {
  if (!state.result) throw new Error("먼저 시간표를 만들어 주세요.");
  const module = await import("pptxgenjs");
  const PptxGenJS = module.default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "방학한칸";
  pptx.subject = "여름방학 생활계획표";
  pptx.title = `${state.plan.nickname || "우리 가족"}의 여름방학 시간표`;
  pptx.company = "방학한칸";
  pptx.theme = { headFontFace: "Malgun Gothic", bodyFontFace: "Malgun Gothic" };
  const weeks = buildVacationWeeks(state.plan, state.result, state.exceptions);
  addCoverSlide(pptx, state, scope, scope === "weekly" ? 1 : weeks.length);
  if (scope === "weekly") {
    addScheduleSlide(pptx, "매주 반복하는 우리 가족 시간표", "고정 일정은 정확한 시각, 아이 활동은 오전·오후로 표시했어요.", weeklyDays(state));
  } else {
    weeks.forEach((week, index) => addScheduleSlide(pptx, `${index + 1}주차 · ${week.label}`, "특별 일정 기간은 반복 일정보다 먼저 보여요.", vacationSlideDays(week.days)));
  }
  const filename = `${safeName(state.plan.nickname)}-${scope === "weekly" ? "주간" : "방학전체"}-시간표.pptx`;
  await pptx.writeFile({ fileName: filename });
}

export function exportFilename(state: PlannerState, scope: ExportScope, extension: "pdf" | "pptx") {
  return `${safeName(state.plan.nickname)}-${scope === "weekly" ? "주간" : "방학전체"}-시간표.${extension}`;
}
