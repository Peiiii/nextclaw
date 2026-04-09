---
name: mvp-view-logic-decoupling
description: Design or refactor frontend modules to a decoupled MVP architecture with Zustand stores, manager classes, and a global presenter. Use when requests mention MVP, presenter-manager-store, view-logic decoupling, reducing prop drilling, business orchestration layers, or multi-component state/action coordination.
---

# MVP View-Logic Decoupling

## Overview

Apply a strict Presenter-Manager-Store structure that keeps UI components free of business logic and centralizes cross-module behavior.

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
6. Keep business-oriented `useEffect` logic out of business components; prefer manager/presenter action ownership.

## Implementation Workflow

1. Identify domains and split state into independent stores.
2. Create each store as singleton Zustand state + actions.
3. Create one manager class per store.
4. Add arrow-function methods only; avoid constructor setup.
5. Create global presenter class and instantiate managers as class fields.
6. Add Context Provider + `usePresenter` hook.
7. Refactor business components to use presenter/stores directly.
8. Shrink remaining effects to external sync only.
9. Move remaining pure display parts into UI components.
10. Delete unnecessary business prop forwarding.

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

## Anti-Patterns

- Put business logic in UI components.
- Duplicate one capability in multiple managers.
- Pass action/state through several business layers when presenter direct access is possible.
- Mix orchestration logic into low-level feature modules.
- Use prototype methods (`foo() {}`) in manager/presenter classes.
- Use `useEffect` as a business patch point for state repair, query-to-store mirroring, or post-render action dispatch.
