import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { FeedbackResponse, ItemSortMode, ItemsResponse } from "@shared/public-roadmap-feedback-portal.types";
import { usePortalPresenter } from "../../../app/portal-presenter.service";
import { Panel } from "../../../shared/components/panel";
import { portalApiService, portalQueryKeys } from "../../../services/portal-api.service";
import { useCommunityFeedbackStore } from "../../../stores/community-feedback.store";
import { FeedbackThreadCard } from "./feedback-thread-card";

type CommunityFeedbackSectionProps = {
  data: FeedbackResponse | undefined;
  itemOptions: ItemsResponse | undefined;
  isPending: boolean;
  error: unknown;
  sortMode: ItemSortMode;
  onRetry: () => void;
};

export function CommunityFeedbackSection(props: CommunityFeedbackSectionProps): JSX.Element {
  const presenter = usePortalPresenter();
  const queryClient = useQueryClient();
  const feedbackDraft = useCommunityFeedbackStore((state) => state.snapshot.feedbackDraft);

  const createFeedbackMutation = useMutation({
    mutationFn: async () => await portalApiService.createFeedback(presenter.communityFeedbackManager.buildCreateFeedbackInput()),
    onSuccess: async () => {
      presenter.communityFeedbackManager.resetFeedbackDraft();
      await queryClient.invalidateQueries({ queryKey: portalQueryKeys.all() });
    }
  });

  return (
    <Panel id="community" className="community-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Community</p>
          <h2>社区建议与反馈</h2>
        </div>
        <span className="panel-badge">
          {props.data?.summary.totalFeedback ?? 0} 个公开建议
        </span>
      </div>

      <div className="community-panel__layout">
        <section className="community-panel__form">
          <h3>提交一个建议</h3>
          <p>用户不用进入你的内部 Linear，也可以在这里提需求、补充背景、表达支持。</p>
          <label>
            标题
            <input
              value={feedbackDraft.title}
              onChange={(event) => presenter.communityFeedbackManager.setFeedbackTitle(event.target.value)}
              placeholder="例如：希望能订阅某个事项的进展"
            />
          </label>
          <label>
            需求类型
            <select
              value={feedbackDraft.category}
              onChange={(event) => presenter.communityFeedbackManager.setFeedbackCategory(event.target.value as typeof feedbackDraft.category)}
            >
              <option value="feature">Feature</option>
              <option value="improvement">Improvement</option>
              <option value="bug">Bug</option>
              <option value="research">Research</option>
            </select>
          </label>
          <label>
            关联官方事项
            <select
              value={feedbackDraft.linkedItemId}
              onChange={(event) => presenter.communityFeedbackManager.setFeedbackLinkedItemId(event.target.value)}
            >
              <option value="">暂不关联</option>
              {(props.itemOptions?.items ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            称呼
            <input
              value={feedbackDraft.authorLabel}
              onChange={(event) => presenter.communityFeedbackManager.setFeedbackAuthorLabel(event.target.value)}
              placeholder="匿名用户"
            />
          </label>
          <label>
            详细描述
            <textarea
              value={feedbackDraft.description}
              onChange={(event) => presenter.communityFeedbackManager.setFeedbackDescription(event.target.value)}
              rows={5}
              placeholder="为什么你关心这个能力？理想中的体验是什么？"
            />
          </label>
          <button
            type="button"
            className="community-panel__submit"
            onClick={() => void createFeedbackMutation.mutate()}
            disabled={createFeedbackMutation.isPending}
          >
            {createFeedbackMutation.isPending ? "提交中…" : "提交公开建议"}
          </button>
        </section>

        <section className="community-panel__threads">
          <div className="community-panel__toolbar">
            <div>
              <strong>社区声音</strong>
              <p>
                Open / Reviewing 会显示还在讨论中的需求，Linked 表示已经和某个官方事项形成关联。
              </p>
            </div>
            <label>
              排序
              <select
                value={props.sortMode}
                onChange={(event) => presenter.communityFeedbackManager.setFeedbackSortMode(event.target.value as ItemSortMode)}
              >
                <option value="hot">热度优先</option>
                <option value="recent">最近更新</option>
              </select>
            </label>
          </div>

          {props.isPending ? (
            <div className="loading-block">正在加载社区反馈…</div>
          ) : null}

          {props.error ? (
            <div className="error-block">
              <strong>社区反馈加载失败</strong>
              <p>{props.error instanceof Error ? props.error.message : "Unknown feedback error."}</p>
              <button type="button" onClick={props.onRetry}>重试</button>
            </div>
          ) : null}

          {!props.isPending && !props.error ? (
            <div className="community-panel__thread-list">
              {(props.data?.items ?? []).map((thread) => (
                <FeedbackThreadCard key={thread.feedback.id} thread={thread} />
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </Panel>
  );
}
