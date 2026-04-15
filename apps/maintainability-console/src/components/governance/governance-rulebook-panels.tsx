import type { GovernanceRulebookOverview } from "@shared/maintainability.types";
import { formatInteger, formatPercent } from "../../lib/maintainability-format.utils";

type GovernanceRulebookPanelsProps = {
  data: GovernanceRulebookOverview;
};

export function GovernanceRulebookPanels({ data }: GovernanceRulebookPanelsProps): JSX.Element {
  const completenessPercent = data.totalCount > 0 ? (data.completeCount / data.totalCount) * 100 : 0;

  return (
    <>
      <section className="panel-grid">
        <section className="panel">
          <header className="panel__header">
            <div>
              <div className="panel__eyebrow">Rulebook Pulse</div>
              <h2 className="panel__title">规则总览</h2>
              <p className="panel__subtitle">
                把 AGENTS.md 里的治理契约直接映射成可浏览数据，避免规则只存在于长文档里。
              </p>
            </div>
          </header>

          <div className="governance-summary">
            <div className="governance-summary__grid">
              <article className="governance-summary__card governance-summary__card--rose">
                <div className="governance-summary__label">治理规则</div>
                <div className="governance-summary__value">{formatInteger(data.totalCount)}</div>
                <div className="governance-summary__hint">来自 {data.sourcePath}</div>
              </article>

              <article className="governance-summary__card governance-summary__card--ocean">
                <div className="governance-summary__label">项目规则</div>
                <div className="governance-summary__value">
                  {formatInteger(
                    data.sectionSummaries.find((section) => section.section === "project-rulebook")?.count ?? 0
                  )}
                </div>
                <div className="governance-summary__hint">Project Rulebook 专属约束</div>
              </article>

              <article className="governance-summary__card governance-summary__card--mint">
                <div className="governance-summary__label">责任人</div>
                <div className="governance-summary__value">{formatInteger(data.ownerSummaries.length)}</div>
                <div className="governance-summary__hint">当前规则 owner 去重后数量</div>
              </article>

              <article className="governance-summary__card governance-summary__card--amber">
                <div className="governance-summary__label">模板完整度</div>
                <div className="governance-summary__value">{formatPercent(completenessPercent)}</div>
                <div className="governance-summary__hint">
                  {formatInteger(data.completeCount)} / {formatInteger(data.totalCount)} 条规则字段完整
                </div>
              </article>
            </div>

            <div className="governance-summary__meta">
              {data.sectionSummaries.map((section) => (
                <div key={section.section} className="governance-summary__meta-card">
                  <div className="governance-summary__meta-title">{section.label}</div>
                  <div className="governance-summary__meta-value">{formatInteger(section.count)} 条</div>
                  <div className="governance-summary__meta-hint">
                    完整 {formatInteger(section.completeCount)} / {formatInteger(section.count)}
                  </div>
                </div>
              ))}
            </div>

            <div className="governance-summary__owners">
              {data.ownerSummaries.map((owner) => (
                <div key={owner.owner} className="governance-summary__owner-card">
                  <div className="governance-summary__owner-name">{owner.owner}</div>
                  <div className="governance-summary__owner-count">{formatInteger(owner.count)} 条</div>
                  <div className="governance-summary__owner-hint">
                    通用 {formatInteger(owner.generalRuleCount)} / 项目 {formatInteger(owner.projectRuleCount)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </section>

      <section className="panel-grid">
        <section className="panel">
          <header className="panel__header">
            <div>
              <div className="panel__eyebrow">Rulebook Dictionary</div>
              <h2 className="panel__title">规则字典</h2>
              <p className="panel__subtitle">
                按 Rulebook / Project Rulebook 分区浏览，点开就能看到约束、执行方式、示例和反例。
              </p>
            </div>
          </header>

          <div className="rule-dictionary">
            {data.sectionSummaries.map((section) => {
              const rules = data.rules.filter((rule) => rule.section === section.section);
              return (
                <section key={section.section} className="rule-dictionary__section">
                  <header className="rule-dictionary__section-header">
                    <div>
                      <h3>{section.label}</h3>
                      <p>{rules.length} 条规则，直接镜像自 AGENTS.md 对应章节。</p>
                    </div>
                    <span className="rule-dictionary__section-chip">
                      完整字段 {section.completeCount} / {section.count}
                    </span>
                  </header>

                  <div className="rule-dictionary__rule-grid">
                    {rules.map((rule) => (
                      <details key={`${rule.section}-${rule.name}`} className="rule-card">
                        <summary className="rule-card__summary">
                          <div className="rule-card__summary-main">
                            <div className="rule-card__chips">
                              <span className="rule-card__chip">{rule.sectionLabel}</span>
                              <span className="rule-card__chip rule-card__chip--owner">{rule.owner}</span>
                            </div>
                            <div className="rule-card__name">{rule.name}</div>
                            <p className="rule-card__constraint">{rule.constraint}</p>
                          </div>
                          <span className="rule-card__toggle">展开详情</span>
                        </summary>

                        <div className="rule-card__body">
                          <article className="rule-card__detail-block">
                            <h4>执行方式</h4>
                            <p>{rule.execution}</p>
                          </article>

                          <article className="rule-card__detail-block">
                            <h4>示例</h4>
                            <p>{rule.example}</p>
                          </article>

                          <article className="rule-card__detail-block">
                            <h4>反例</h4>
                            <p>{rule.counterExample}</p>
                          </article>
                        </div>
                      </details>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </section>
      </section>
    </>
  );
}
