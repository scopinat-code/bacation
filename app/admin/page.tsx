import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, adminAuthConfigured, verifyAdminSession } from "@/lib/admin-auth";
import { getAnalyticsSummary } from "@/lib/analytics-db";
import QnaAdminPanel from "./QnaAdminPanel";
import styles from "./admin.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "이용 현황 | 방학한칸",
  robots: { index: false, follow: false },
};

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const authenticated = verifyAdminSession(cookieStore.get(ADMIN_COOKIE)?.value);

  if (!authenticated) {
    const configured = adminAuthConfigured();
    return <main className={styles.page}><section className={styles.login}>
      <div className={styles.brand}><span className={styles.mark}>한칸</span><div><h1>관리자 로그인</h1><p>방학한칸 이용 현황은 관리자만 볼 수 있어요.</p></div></div>
      {!configured && <p className={styles.error}>배포 환경에 ADMIN_PASSWORD와 ADMIN_SESSION_SECRET을 먼저 설정해 주세요.</p>}
      {params.error === "invalid" && <p className={styles.error}>비밀번호가 맞지 않습니다.</p>}
      {params.error === "rate-limit" && <p className={styles.error}>로그인을 여러 번 시도했습니다. 잠시 후 다시 시도해 주세요.</p>}
      {params.error === "config" && <p className={styles.error}>관리자 환경변수 설정을 확인해 주세요.</p>}
      <form action="/admin/login" method="post">
        <label>관리자 비밀번호<input type="password" name="password" required autoComplete="current-password" /></label>
        <button type="submit" disabled={!configured}>이용 현황 보기</button>
      </form>
    </section></main>;
  }

  let summary;
  try {
    summary = await getAnalyticsSummary();
  } catch (error) {
    console.error("Failed to load admin analytics", error);
    return <main className={styles.page}><div className={styles.shell}><div className={styles.notice}>통계 DB를 불러오지 못했습니다. DATABASE_URL과 DB 스키마를 확인해 주세요.</div></div></main>;
  }

  const maxDaily = Math.max(1, ...summary.daily.map((day) => day.visitors));

  return <main className={styles.page}><div className={styles.shell}>
    <header className={styles.header}><div className={styles.brand}><span className={styles.mark}>한칸</span><div><h1>방학한칸 이용 현황</h1><p>익명 브라우저 기준 · 한국 시간으로 집계</p></div></div><form action="/admin/logout" method="post"><button className={styles.logout}>로그아웃</button></form></header>
    <section className={styles.cards}>
      <article className={styles.card}><span>전체 방문자</span><strong>{summary.totalVisitors.toLocaleString()}</strong></article>
      <article className={styles.card}><span>오늘 방문자</span><strong>{summary.todayVisitors.toLocaleString()}</strong></article>
      <article className={styles.card}><span>최근 7일</span><strong>{summary.weekVisitors.toLocaleString()}</strong></article>
      <article className={styles.card}><span>최근 30일</span><strong>{summary.monthVisitors.toLocaleString()}</strong></article>
    </section>
    <section className={styles.section}><h2>시간표 만들기 흐름</h2><div className={styles.funnel}>
      <article><span>계획 만들기 시작</span><strong>{summary.plannerStarted.toLocaleString()}명</strong></article>
      <article><span>시간표 완성</span><strong>{summary.scheduleCompleted.toLocaleString()}명</strong></article>
      <article><span>시작 → 완성률</span><strong>{summary.completionRate}%</strong></article>
    </div></section>
    <section className={styles.section}><h2>최근 14일 방문자</h2><div className={styles.chart}>
      {summary.daily.map((day) => <div className={styles.barItem} key={day.label}><b>{day.visitors}</b><div className={styles.bar} style={{ height: `${Math.max(2, (day.visitors / maxDaily) * 88)}%` }} title={`${day.label} 방문 ${day.visitors}명 · 완성 ${day.completions}명`} /><small>{day.label}</small></div>)}
    </div></section>
    <section className={styles.section}>
      <div className={styles.sectionHeading}><div><h2>채널별 유입</h2><p>홍보 링크 뒤에 <code>?ref=naver_cafe</code>처럼 붙이면 해당 이름으로 집계됩니다. <code>utm_source</code>도 사용할 수 있어요.</p></div></div>
      {summary.channels.length ? <div className={styles.channelTableWrap}><table className={styles.channelTable}>
        <thead><tr><th>채널</th><th>방문자</th><th>세션</th><th>시작</th><th>완성</th><th>완성률</th><th>저장·인쇄</th></tr></thead>
        <tbody>{summary.channels.map((channel) => <tr key={channel.channel}>
          <th><code>{channel.channel}</code></th>
          <td>{channel.visitors.toLocaleString()}</td>
          <td>{channel.sessions.toLocaleString()}</td>
          <td>{channel.starts.toLocaleString()}</td>
          <td>{channel.completions.toLocaleString()}</td>
          <td>{channel.completionRate}%</td>
          <td>{channel.exports.toLocaleString()}</td>
        </tr>)}</tbody>
      </table></div> : <div className={styles.channelEmpty}>아직 집계된 유입 채널이 없습니다.</div>}
    </section>
    <section className={styles.section}><h2>파일 이용</h2><div className={styles.downloads}>
      <span>전체 세션 {summary.totalSessions.toLocaleString()}</span><span>PNG {summary.pngDownloads.toLocaleString()}회</span><span>PDF {summary.pdfDownloads.toLocaleString()}회</span><span>PPTX {summary.pptxDownloads.toLocaleString()}회</span><span>인쇄 {summary.prints.toLocaleString()}회</span>
    </div></section>
    <QnaAdminPanel />
  </div></main>;
}
