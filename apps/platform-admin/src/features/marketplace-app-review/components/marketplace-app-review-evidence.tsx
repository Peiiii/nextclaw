import type {
  AdminMarketplaceAppSummaryView,
} from '@/api/types';
import type {
  AdminMarketplaceAppDetailView,
  MarketplaceAppManifestView,
} from '@/features/marketplace-app-review/types/marketplace-app-review.types';

export function MarketplaceStatusBadge(props: { status: AdminMarketplaceAppSummaryView['publishStatus'] }): JSX.Element {
  const className = props.status === 'published'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : props.status === 'rejected'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : 'border-amber-200 bg-amber-50 text-amber-700';
  const label = props.status === 'published' ? '已发布' : props.status === 'rejected' ? '已拒绝' : '待审核';
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}>{label}</span>;
}

export function DetailMetaItem(props: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-2xl border border-[#e4e0d7] bg-[#f9f8f5] p-4">
      <p className="text-xs text-[#8f8a7d]">{props.label}</p>
      <p className="mt-1 break-all text-sm text-[#1f1f1d]">{props.value}</p>
    </div>
  );
}

export function MarketplaceRuntimeReview(props: { item: AdminMarketplaceAppDetailView }): JSX.Element {
  const { item } = props;
  const listingEligibility = item.publicListing;
  const componentSummary = item.manifest.components?.map((component) =>
    `${component.kind}: ${component.path}`
  ).join('\n') || 'standalone';
  return (
    <div className="space-y-3 rounded-2xl border border-[#e4e0d7] bg-[#f9f8f5] p-4">
      <div>
        <p className="text-sm font-medium text-[#1f1f1d]">运行与上架资格</p>
        <p className="mt-1 text-xs leading-5 text-[#656561]">
          审核结论以提交包的 manifest、组件和权限声明为准。
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <RuntimeFact label="运行方式" value={formatRuntimeProfile(resolveRuntimeProfile(item.manifest))} />
        <RuntimeFact
          label="目录可见性"
          value={item.catalogVisibility === 'listed' ? '公开目录' : '未上架'}
        />
        <RuntimeFact
          label="公开资格"
          value={listingEligibility.eligible ? '可以公开上架' : '只能通过但不公开'}
        />
      </div>
      <p
        id="public-listing-eligibility"
        className={listingEligibility.eligible
          ? 'text-xs leading-5 text-emerald-700'
          : 'rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800'}
      >
        {formatPublicListingReason(listingEligibility.reason)}
      </p>
      <div className="grid gap-3 lg:grid-cols-2">
        <ManifestEvidence label="组件" value={componentSummary} />
        <ManifestEvidence label="权限" value={JSON.stringify(item.permissions, null, 2)} />
      </div>
    </div>
  );
}

function RuntimeFact(props: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <p className="text-xs text-[#8f8a7d]">{props.label}</p>
      <p className="mt-1 text-sm font-medium text-[#1f1f1d]">{props.value}</p>
    </div>
  );
}

function ManifestEvidence(props: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <p className="text-xs text-[#8f8a7d]">{props.label}</p>
      <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs leading-5 text-[#444]">
        {props.value}
      </pre>
    </div>
  );
}

function resolveRuntimeProfile(
  manifest: MarketplaceAppManifestView
): 'panel-only' | 'wasi' | 'native-process' {
  if (manifest.schemaVersion === 1) {
    return manifest.main?.kind === 'wasi-http-component' ? 'wasi' : 'panel-only';
  }
  const hasService = manifest.components?.some((component) => component.kind === 'service') ?? false;
  return manifest.runtime?.profile ?? (hasService ? 'native-process' : 'panel-only');
}

function formatPublicListingReason(
  reason: AdminMarketplaceAppDetailView['publicListing']['reason']
): string {
  if (reason === 'legacy-schema') {
    return '旧版 schema v1 App 可以审核通过并按 App ID 安装，但不会进入公开目录。';
  }
  if (reason === 'official-scope') {
    return '官方 App 可以在专项审核后进入公开目录。';
  }
  if (reason === 'community-native-process') {
    return '社区 Service App 以当前用户权限运行；完成高权限人工审核后可以公开上架，安装后默认停用，需用户显式启用。';
  }
  if (reason === 'invalid-runtime') {
    return '运行时声明与组件的真实执行合同不一致，不能审核公开。';
  }
  return '该社区 App 不包含 Service component，可以审核通过并进入公开目录。';
}

function formatRuntimeProfile(profile: 'panel-only' | 'wasi' | 'native-process'): string {
  if (profile === 'native-process') {
    return '宿主进程（当前用户权限）';
  }
  if (profile === 'wasi') {
    return 'WASI（宿主中介）';
  }
  return 'Panel-only（面板沙箱）';
}
