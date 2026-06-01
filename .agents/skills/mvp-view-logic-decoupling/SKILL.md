---
name: mvp-view-logic-decoupling
description: Design or refactor frontend modules to a decoupled MVP architecture with Zustand stores, Zustand persist, manager classes, and a global presenter. Use when requests mention MVP, presenter-manager-store, view-logic decoupling, frontend state ownership, local UI state becoming shared, page refresh state restoration, localStorage/sessionStorage persistence, Zustand persist, reducing prop drilling, business component cohesion, self-contained business containers, business orchestration layers, multi-component state/action coordination, complex React hook/component state machines, streaming/data-flow coordination, or RxJS evaluation.
---

# MVP View-Logic Decoupling

## Overview

Apply a strict Presenter-Manager-Store structure that keeps UI components free of business logic and centralizes cross-module behavior. The frontend presenter should mirror the backend `NextclawKernel` composition-root pattern: it wires long-lived managers as peer owners and expresses stable dependencies between them.

## State/Data Flow Ownership

- Complex business logic, state machines, streaming flows, and cross-event ordering belong in manager/store/presenter, primarily manager.
- Hooks and components should connect React to the owner: subscribe to stores or queries, call manager/presenter methods, and keep only lightweight local UI state.
- Frontend state that must survive navigation, reload, cross-component reuse, or future manager orchestration should live in a Zustand store, not only in component/provider local state.
- Persisted frontend state should use Zustand `persist` middleware as the primary contract. Do not add ad hoc `localStorage` / `sessionStorage` read-write helpers in providers or components unless the state is truly outside a Zustand-owned domain.
- Pair each persisted Zustand store with a manager/presenter action owner: the store owns state shape, persistence, validation, and atomic setters; the manager/presenter owns business transitions and intent-level methods.
- When flows need cancellation, buffering, fan-in/fan-out, terminal event handling, retry control, or ordering guarantees, consider an explicit data-flow tool such as RxJS after confirming plain manager/store ownership is insufficient.
- Do not introduce RxJS for simple local state, one-off effects, or view-only interaction details.

## Target Architecture

1. Put module state in singleton Zustand stores under `stores/`.
2. Add one manager class per store or stable business capability under `managers/`.
3. Use manager methods to expose actions and non-subscribed read helpers.
4. Create one app-level presenter that owns long-lived manager instances and global capabilities; only split into a few top-level presenters when product surfaces are truly isolated or the root is genuinely too large.
5. Provide the app-level presenter via React Context and expose it with `usePresenter` / `useAppPresenter`.
6. Let business components call presenter/managers directly and subscribe to stores directly.

## Component Boundaries

- `UI components`
  - Keep pure and reusable.
  - Accept only view-related props.
  - Avoid business rules and side effects.
- `Business components`
  - Consume presenter for global actions and cross-module communication.
  - Subscribe to store state via selectors.
  - Organize by domain.
- `Business orchestration layer`
  - Compose lower-level business modules.
  - Keep high-level flow readable in one place.
- `Feature implementation modules`
  - Implement isolated business capabilities per feature.

## Business Component Cohesion

- 业务组件应在最贴近业务语义的位置自行订阅 store、读取 presenter、派生 view props，并只把收敛后的展示数据传给纯 UI 组件。
- 页面级或布局级父组件只负责区域组合、挂载条件和布局模式，不应成为为所有子组件装配 snapshot 字段、计数、派生状态和 presenter action 的参数中转站。
- 当同一组业务状态或动作需要跨两层以上传递时，优先新增或收敛到业务 container，让该 container 直接连接 presenter/store，而不是继续向下传参。
- 不要为了“看起来可复用”把业务组件改成宽 props API；真正可复用的是纯 UI 组件，业务组件的可维护性来自明确 owner 和内聚的数据/动作访问。

## Effect Boundary

- Use `useEffect` only for external-system synchronization:
  - DOM and browser APIs
  - event listeners and subscription lifecycles
  - runtime resource setup / teardown
- Do not use `useEffect` to mirror query results into stores or local state.
- Do not use `useEffect` to trigger business actions after render.
- If an effect is resetting multiple business states, first move that transition into a manager method or presenter flow.

## Mandatory Rules

1. Use arrow functions for all manager and presenter methods.
2. Manager files export manager classes, not singleton instances; long-lived manager instances belong in presenter fields.
3. Managers are peer business owners under the presenter. A manager may depend on another manager, but it must not create, own, or lifecycle-manage another manager.
4. Stable manager-to-manager dependencies are allowed and should be expressed directly through constructor injection wired by the presenter; do not introduce ports/factories/callback wrappers just to hide a stable frontend business dependency.
5. Do not create a feature-level presenter for every domain; presenter is app-level or one of a very small number of top-level product-surface owners. Do not add local `presenters/` directories under feature/app submodules such as navigation, panels, settings, or sidebars unless the product surface is genuinely top-level and explicitly approved as a presenter owner.
6. Do not use `bindXxxManager`, `installXxx`, `setXxxManager`, `afterXxx` callbacks, handler props, or local port objects to do second-stage wiring between stable managers.
7. A stable manager dependency should be typed as the manager itself. If only one method is needed, that usually still means direct manager dependency; callback/function injection is reserved for real external events, reusable library hooks, or intentionally pluggable boundaries.
8. Avoid `this`-binding ambiguity by using class fields with arrow methods.
9. Prefer direct presenter/store access over deep business prop drilling.
10. Remove duplicate data/action plumbing when presenter already provides the capability.
11. Keep layout components from assembling broad child prop bags; move business data/action selection into the nearest business container.
12. Keep business-oriented `useEffect` logic out of business components; prefer manager/presenter action ownership.
13. Keep complex state-flow and data-flow logic out of hooks/components; move it to manager/store/presenter before adding more React effects or local state.
14. Use Zustand `persist` for reload-restorable frontend state, including view mode, active tab, selected panel, open/closed surface state, lightweight URL-like view state, and similar product-continuity state.
15. Keep persisted store payloads small, versioned, and validated during rehydrate; never persist non-serializable view objects, React nodes, manager instances, or broad server/query snapshots.

## Implementation Workflow

1. Identify domains and split state into independent stores.
2. Create each store as singleton Zustand state + actions.
3. If the state should survive refresh or app restart, add Zustand `persist` in the store and define the persisted subset, version, merge/rehydrate validation, and storage key before wiring UI.
4. Create one manager class per store or stable business capability.
5. Add arrow-function methods; use constructors only for stable manager/infra dependencies that the owner cannot create itself.
6. Instantiate managers as fields on the app-level presenter, wiring stable manager dependencies there in one pass. Do not follow with `bind` / `install` / `set` calls to patch the graph after construction.
7. Add Context Provider + `usePresenter`/`useAppPresenter` hook when the owner is consumed from React.
8. Refactor business components to use presenter/stores directly.
9. Split broad page components into layout shells plus business containers when the parent is only forwarding snapshot fields or presenter actions.
10. Shrink remaining effects to external sync only.
11. Move remaining pure display parts into UI components.
12. Delete unnecessary business prop forwarding.

## Minimal TypeScript Skeleton

```ts
// stores/todo.store.ts
import { create } from "zustand";

type TodoState = {
  items: string[];
  add: (item: string) => void;
};

export const useTodoStore = create<TodoState>((set) => ({
  items: [],
  add: (item) => set((state) => ({ items: [...state.items, item] })),
}));
```

```ts
// managers/todo.manager.ts
import { useTodoStore } from "../stores/todo.store";

export class TodoManager {
  addItem = (item: string) => {
    useTodoStore.getState().add(item);
  };

  getItemsSnapshot = () => {
    return useTodoStore.getState().items;
  };
}
```

```ts
// presenter/app.presenter.ts
import { TodoManager } from "../managers/todo.manager";

export class AppPresenter {
  todoManager = new TodoManager();

  notifyGlobal = (message: string) => {
    console.log("global event", message);
  };
}

export const appPresenter = new AppPresenter();
```

当 manager 之间存在稳定业务依赖时，按 kernel composition-root 模式由 presenter 统一装配。manager 之间是平级协作者，不是上下级从属；依赖应该直接表达为另一个 manager，而不是包装成 callback 或二阶段 bind：

```ts
// managers/panel-app-bridge.manager.ts
export class PanelAppBridgeManager {
  constructor(private readonly authorizationManager: ServiceActionAuthorizationManager) {}

  requestGrant = async () => {
    return await this.authorizationManager.requestAuthorization(...);
  };
}

// app/presenters/app.presenter.ts
export class AppPresenter {
  serviceActionAuthorizationManager = new ServiceActionAuthorizationManager();
  panelAppBridgeManager = new PanelAppBridgeManager(this.serviceActionAuthorizationManager);
}
```

不要把同一个关系写成下面这种形式：

```ts
export class AppPresenter {
  accountManager = new AccountManager({
    afterSignedIn: (status) => this.remoteAccessManager.resumeAfterSignIn(status),
  });
}
```

这里 `afterSignedIn` 把稳定 manager 协作伪装成事件回调，隐藏了 owner 拓扑，也容易引入初始化顺序问题。应让需要协作的一方直接依赖另一个 manager，或让被调用 manager 返回明确结果，由调用 manager 接着完成自己的流程。

不推荐在普通 feature `*.manager.ts` 文件末尾写 `export const xxxManager = new XxxManager()`；这会让 manager 自己承担装配职责，也让测试、替换和跨 manager 依赖关系变隐式。应用级 presenter 文件可以导出全局实例，例如 `appPresenter`，因为它本来就是装配根。

```tsx
// presenter/presenter-context.tsx
import { createContext, useContext, type PropsWithChildren } from "react";
import { appPresenter } from "./app.presenter";

const PresenterContext = createContext(appPresenter);

export const PresenterProvider = ({ children }: PropsWithChildren) => (
  <PresenterContext.Provider value={appPresenter}>{children}</PresenterContext.Provider>
);

export const usePresenter = () => useContext(PresenterContext);
```

```tsx
// business/TodoPanel.tsx
import { usePresenter } from "../presenter/presenter-context";
import { useTodoStore } from "../stores/todo.store";
import { TodoList } from "../ui/TodoList";

export const TodoPanel = () => {
  const presenter = usePresenter();
  const items = useTodoStore((s) => s.items);

  return (
    <TodoList
      items={items}
      onAdd={(v) => presenter.todoManager.addItem(v)}
    />
  );
};
```

## Refactor Checks

Run this check before finishing:

1. Verify UI components do not import presenter/manager/store.
2. Verify business components avoid unnecessary prop relays.
3. Verify every store has exactly one manager owner.
4. Verify manager/presenter methods are arrow functions.
5. Verify manager files do not export singleton manager instances.
6. Verify manager constructors, if present, only receive stable manager/infra dependencies and are wired by the app-level presenter.
7. Verify manager-to-manager dependencies are peer dependencies injected by the presenter, not manager-created subordinate managers.
8. Verify cross-domain communication goes through app-level presenter APIs or direct stable manager dependencies owned by that presenter.
9. Scan touched manager/presenter files for `bindXxx`, `installXxx`, `setXxxManager`, `afterXxx`, `onXxx` callback wrappers, and local port objects. If they connect stable internal managers, replace them with direct typed manager dependencies or result-returning manager methods.
10. Verify business components do not use `useEffect` to mirror query/store data or dispatch business actions.
11. Verify layout/page components do not collect wide snapshot/action prop bags for child business components.
12. Verify repeated props passed through two or more layers have been replaced by direct presenter/store access in the nearest business container.
13. Verify complex async, streaming, or cross-event flows have an explicit owner, and evaluate RxJS only when it simplifies that owner instead of spreading logic.
14. Verify reload-restorable frontend state uses Zustand `persist`, not provider/component ad hoc storage effects.
15. Verify persisted payloads are serializable, bounded, versioned, and sanitized on rehydrate.

## Anti-Patterns

- Put business logic in UI components.
- Duplicate one capability in multiple managers.
- Pass action/state through several business layers when presenter direct access is possible.
- Let a page/layout component become a manual prop assembler for child business components.
- Create wide business component props APIs that mirror store snapshot fields or presenter methods.
- Mix orchestration logic into low-level feature modules.
- Create one feature-level presenter per domain when the existing app-level presenter can wire the stable manager graph.
- Add a local presenter merely because a module has managers or UI state; use the app-level presenter for composition and keep module-specific orchestration in managers/stores/containers.
- Let a manager create or own another manager; peer manager dependencies must be wired by presenter.
- Hide stable manager collaboration behind callbacks, local ports, handler objects, or second-stage `bind`/`install` methods.
- Export singleton manager instances from `*.manager.ts` instead of wiring them from presenter/app-level owners.
- Use prototype methods (`foo() {}`) in manager/presenter classes.
- Use `useEffect` as a business patch point for state repair, query-to-store mirroring, or post-render action dispatch.
- Let hooks/components own long-lived business state machines, stream lifecycles, or cross-event coordination.
- Add RxJS as a shortcut around unclear ownership.
- Persist shared/reload-restorable frontend state with hand-written `localStorage` effects in providers/components when a Zustand store owner exists or should exist.
- Put business transition logic into Zustand action bodies when the domain already has, or should have, a manager/presenter owner.
