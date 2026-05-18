---
name: mvp-view-logic-decoupling
description: Design or refactor frontend modules to a decoupled MVP architecture with Zustand stores, manager classes, and a global presenter. Use when requests mention MVP, presenter-manager-store, view-logic decoupling, reducing prop drilling, business component cohesion, self-contained business containers, business orchestration layers, multi-component state/action coordination, complex React hook/component state machines, streaming/data-flow coordination, or RxJS evaluation.
---

# MVP View-Logic Decoupling

## Overview

Apply a strict Presenter-Manager-Store structure that keeps UI components free of business logic and centralizes cross-module behavior.

## State/Data Flow Ownership

- Complex business logic, state machines, streaming flows, and cross-event ordering belong in manager/store/presenter, primarily manager.
- Hooks and components should connect React to the owner: subscribe to stores or queries, call manager/presenter methods, and keep only lightweight local UI state.
- When flows need cancellation, buffering, fan-in/fan-out, terminal event handling, retry control, or ordering guarantees, consider an explicit data-flow tool such as RxJS after confirming plain manager/store ownership is insufficient.
- Do not introduce RxJS for simple local state, one-off effects, or view-only interaction details.

## Target Architecture

1. Put module state in singleton Zustand stores under `stores/`.
2. Add one manager class per store under `managers/`.
3. Use manager methods to expose actions and non-subscribed read helpers.
4. Create one global presenter that owns all managers and global capabilities.
5. Provide presenter via React Context and expose it with `usePresenter`.
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
2. Do not define constructors in manager or presenter classes.
3. Avoid `this`-binding ambiguity by using class fields with arrow methods.
4. Prefer direct presenter/store access over deep business prop drilling.
5. Remove duplicate data/action plumbing when presenter already provides the capability.
6. Keep layout components from assembling broad child prop bags; move business data/action selection into the nearest business container.
7. Keep business-oriented `useEffect` logic out of business components; prefer manager/presenter action ownership.
8. Keep complex state-flow and data-flow logic out of hooks/components; move it to manager/store/presenter before adding more React effects or local state.

## Implementation Workflow

1. Identify domains and split state into independent stores.
2. Create each store as singleton Zustand state + actions.
3. Create one manager class per store.
4. Add arrow-function methods only; avoid constructor setup.
5. Create global presenter class and instantiate managers as class fields.
6. Add Context Provider + `usePresenter` hook.
7. Refactor business components to use presenter/stores directly.
8. Split broad page components into layout shells plus business containers when the parent is only forwarding snapshot fields or presenter actions.
9. Shrink remaining effects to external sync only.
10. Move remaining pure display parts into UI components.
11. Delete unnecessary business prop forwarding.

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
5. Verify manager/presenter classes do not declare constructors.
6. Verify cross-domain communication goes through presenter-level APIs.
7. Verify business components do not use `useEffect` to mirror query/store data or dispatch business actions.
8. Verify layout/page components do not collect wide snapshot/action prop bags for child business components.
9. Verify repeated props passed through two or more layers have been replaced by direct presenter/store access in the nearest business container.
10. Verify complex async, streaming, or cross-event flows have an explicit owner, and evaluate RxJS only when it simplifies that owner instead of spreading logic.

## Anti-Patterns

- Put business logic in UI components.
- Duplicate one capability in multiple managers.
- Pass action/state through several business layers when presenter direct access is possible.
- Let a page/layout component become a manual prop assembler for child business components.
- Create wide business component props APIs that mirror store snapshot fields or presenter methods.
- Mix orchestration logic into low-level feature modules.
- Use prototype methods (`foo() {}`) in manager/presenter classes.
- Use `useEffect` as a business patch point for state repair, query-to-store mirroring, or post-render action dispatch.
- Let hooks/components own long-lived business state machines, stream lifecycles, or cross-event coordination.
- Add RxJS as a shortcut around unclear ownership.
