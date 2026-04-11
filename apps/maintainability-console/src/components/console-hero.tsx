import type {
  MaintainabilityOverview,
  MaintainabilityProfile
} from "@shared/maintainability.types";
import { formatDateTime, formatShortHash } from "../lib/maintainability-format.utils";

const PROFILE_COPY: Record<MaintainabilityProfile, { label: string; description: string }> = {
  source: {
    label: "Source",
    description: "源码口径，只统计默认源码目录，适合看真实产品代码体积。"
  },
  "repo-volume": {
    label: "Repo Volume",
    description: "仓库体积口径，会把脚本、配置和更多工程代码一起算进去。"
  }
};

type ConsoleHeroProps = {
  profile: MaintainabilityProfile;
  data: MaintainabilityOverview | undefined;
  isRefreshing: boolean;
  isPending: boolean;
  onProfileChange: (profile: MaintainabilityProfile) => void;
  onRefresh: () => void;
};

export function ConsoleHero({
  profile,
  data,
  isRefreshing,
  isPending,
  onProfileChange,
  onRefresh
}: ConsoleHeroProps): JSX.Element {
  return (
    <header className="hero">
      <div className="hero__copy">
        <div className="hero__eyebrow">Local Maintainability Workbench</div>
        <h1>Maintainability Console</h1>
        <p className="hero__summary">
          面向本地研发的项目大盘，直接看全仓代码量、模块体积、目录压力和维护性热点，不用再在脚本输出里来回切。
        </p>
        <div className="hero__meta">
          <span className="hero__meta-pill">当前口径：{PROFILE_COPY[profile].description}</span>
          {data ? (
            <span className="hero__meta-pill">
              最新扫描：{formatDateTime(data.generatedAt)} · {formatShortHash(data.git.sha)}
            </span>
          ) : null}
          {isRefreshing ? <span className="hero__meta-pill hero__meta-pill--live">扫描中</span> : null}
        </div>
      </div>

      <div className="hero__controls">
        <div className="profile-switch" role="group" aria-label="metrics profile">
          {(Object.keys(PROFILE_COPY) as MaintainabilityProfile[]).map((nextProfile) => (
            <button
              key={nextProfile}
              type="button"
              className={`profile-switch__button${profile === nextProfile ? " profile-switch__button--active" : ""}`}
              aria-pressed={profile === nextProfile}
              onClick={() => onProfileChange(nextProfile)}
            >
              {PROFILE_COPY[nextProfile].label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="hero__refresh-button"
          onClick={onRefresh}
          disabled={isPending || isRefreshing}
        >
          {isRefreshing ? "刷新中..." : "刷新数据"}
        </button>
      </div>
    </header>
  );
}
