import type { ChangeLogEntry, LeaderboardMethodology } from "@shared/competitive-leaderboard.types";
import { Panel } from "./panel";

type MethodologyPanelProps = {
  methodology: LeaderboardMethodology;
  disclosures: string[];
  changeLog: ChangeLogEntry[];
};

export function MethodologyPanel({
  methodology,
  disclosures,
  changeLog
}: MethodologyPanelProps): JSX.Element {
  return (
    <Panel
      eyebrow="Methodology"
      title="可信度来自方法论，而不只是分数"
      subtitle="先公开边界、纳入标准、排除规则和计分公式，再谈谁更强。"
    >
      <div className="methodology-grid">
        <article className="methodology-card">
          <h3>定义</h3>
          <p>{methodology.definition}</p>
        </article>
        <article className="methodology-card">
          <h3>纳入规则</h3>
          <ul>
            {methodology.inclusionRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </article>
        <article className="methodology-card">
          <h3>分层规则</h3>
          <ul>
            {methodology.tierRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </article>
        <article className="methodology-card">
          <h3>计分公式</h3>
          <ul>
            {methodology.scoringFormula.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <article className="methodology-card">
          <h3>排除规则</h3>
          <ul>
            {methodology.exclusions.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </article>
        <article className="methodology-card">
          <h3>已审查但排除</h3>
          <ul>
            {methodology.reviewedExclusions.map((item) => (
              <li key={item.name}>
                <strong>{item.name}</strong>：{item.reason}
                {" "}
                <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                  {item.sourceTitle}
                </a>
              </li>
            ))}
          </ul>
        </article>
        <article className="methodology-card">
          <h3>额外说明</h3>
          <ul>
            {methodology.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </article>
      </div>

      <div className="methodology-footer">
        <article className="methodology-card">
          <h3>Disclosure</h3>
          <ul>
            {disclosures.map((disclosure) => (
              <li key={disclosure}>{disclosure}</li>
            ))}
          </ul>
        </article>
        <article className="methodology-card">
          <h3>Changelog</h3>
          <ul>
            {changeLog.map((entry) => (
              <li key={`${entry.date}-${entry.summary}`}>
                <strong>{entry.date}</strong> · {entry.summary}
              </li>
            ))}
          </ul>
        </article>
      </div>
    </Panel>
  );
}
