---
name: fe-react-patterns
description: React and TypeScript design patterns - component API shape (compound components, layout/list components, container components, partial application, recursive components), state management, custom hooks, performance and memoization discipline, design-system primitives, and advanced TypeScript for components and hooks. Invoke when designing or reviewing a React component API, when a component is accumulating configuration props, when refactoring hooks or re-render hotspots, when picking a state-management approach, or when the user asks for "the pattern" for a component.
---

# React Patterns

Two layers of material:

- `references/*.md` - pattern catalogue: intent, when-to-apply signals, rules.
- `examples/<pattern>/` - minimal runnable `.jsx`. These are the spec for the shape. Read them before writing the component.

Apply patterns using the target repo's own conventions. Never paste an example verbatim.

## Pattern selection by symptom

| Symptom | Pattern | Read |
|---|---|---|
| Primitive keeps growing props to describe its own content (`title`, `meta`, `headerAction`, `footer`, `contentClassName`) | Compound components | [more-patterns.md](references/more-patterns.md), `examples/compound-components/` |
| Same list chrome (spacing, numbering, separators) repeated with different row content | Layout / list components | [layout-components.md](references/layout-components.md), `examples/layout-components/` |
| Presentational component fetches its own data, so it can't be tested or reused | Container components | [container-components.md](references/container-components.md), `examples/container-components/` |
| Several components differ only by a fixed prop value | Partial application / composition | [functional-patterns.md](references/functional-patterns.md), `examples/functional-programming/` |
| Rendering arbitrarily nested data | Recursive component | `examples/functional-programming/recursive.jsx` |
| Unclear where the source of truth for an input/modal/popover lives | Controlled vs uncontrolled | [controlled-uncontrolled.md](references/controlled-uncontrolled.md) |
| Two components share stateful logic that does not render | Custom hooks | [custom-hooks.md](references/custom-hooks.md) |
| Cross-cutting concern needs wrap-time injection (auth gating, mutation wrappers) | HOCs - last resort, prefer hooks | [hocs.md](references/hocs.md) |
| Deep or reducer-shaped state updates | State management | [state-management.md](references/state-management.md) |
| Hand-rolled loaders, cache keys, invalidation | React Query | [react-query.md](references/react-query.md) |
| Re-render hotspots, bundle size, long lists | Performance | [performance.md](references/performance.md) |
| Building or extending a shared primitive | Design system | [design-system.md](references/design-system.md) |
| Typing hooks, reducers, context, generic or polymorphic components | Advanced TypeScript | [typescript.md](references/typescript.md) |
| Portals, error boundaries, `key` semantics, refs, hydration mismatches | Advanced concepts | [advanced-concepts.md](references/advanced-concepts.md) |
| Element props, context splitting to avoid re-renders | Clean code | [clean-code.md](references/clean-code.md) |
| Where domain logic lives, route components, encapsulation boundaries | Architecture | [architecture.md](references/architecture.md) |
| API client abstraction, modeling loading/error/success, aborting requests, spinner flash on fast responses | API layer | [api-layer.md](references/api-layer.md), `examples/api-layer/` |

## Decision rules (apply in order)

1. **Smallest change wins.** If a local refactor solves it, do not introduce a pattern.
2. **Prove the problem before applying memoization or HOCs.** Profile first. Identity-based optimizations only help if a downstream consumer compares by identity.
3. **Prefer composition over configuration.** A component taking 7 boolean props is a signal to expose slots or children instead.
4. **Co-locate state with its only consumer.** Lift only when a second consumer appears, not preemptively.
5. **Type at the boundary, infer in the middle.** Annotate exported component props and hook returns; let TS infer internals.
6. **Do not invent abstractions for hypothetical future requirements.**

## Compound components

Root owns the surface and the state, publishes both via context; sub-components attached as statics (`Pane.Header`, `Pane.Body`). Callers compose the content; the primitive decides nothing about what goes inside.

```jsx
<Pane collapsible defaultOpen>
  <Pane.Header>
    <Pane.Title>Details</Pane.Title>
    <Pane.Action><Button /></Pane.Action>
  </Pane.Header>
  <Pane.Body>{grid}</Pane.Body>
</Pane>
```

Rules:

- Sub-components read the root context and throw a named error when rendered outside it. No silent no-op.
- Behavior branches (collapsible vs static, loading vs loaded) live inside the primitive and are read from context - caller JSX stays identical either way.
- When a sub-component must render outside an interactive wrapper (e.g. an action button that would otherwise nest inside a trigger `<button>`), partition children by `child.type === SubComponent` in the parent sub-component. Nested interactive elements are invalid DOM and swallow clicks.
- Context value is derived, not duplicated - never mirror an open/selected prop into extra state.

## Layout / list components

The list owns the chrome and takes the row component as a prop; rows own their own markup and know nothing about the container.

```jsx
<RegularList items={authors} sourceName="author" ItemComponent={SmallAuthorListItem} />
<NumberedList items={books} sourceName="book" ItemComponent={LargeBookListItem} />
```

Rules:

- Pass a component (`ItemComponent`), not a render callback, when the row is a stable component - it keeps the item's own memoization and DevTools name.
- `sourceName` maps the item onto the row's prop name; skip it when rows read from context instead.
- A descriptor array (`{ key, Component }[]`) is the same pattern for heterogeneous children - it lets callers declare sections as data.

## Container components

The container fetches; the children render. The `examples/container-components/` files inject via `React.Children.map` + `cloneElement`; prefer a **context** in TypeScript codebases - `cloneElement` loses type safety on the injected props and breaks the moment a child is wrapped.

```jsx
<ResourceLoader resourceUrl="/users/1" resourceName="user">
  <UserInfo />
</ResourceLoader>
```

Rules:

- One container per drawer/page/section owns every fetch for that scope; panes and rows fetch nothing.
- Render nothing until the entity resolves - that removes the null guard from every child and makes the injected value non-nullable.
- The container is the only place that reads route params or outlet context; children take data from the hook.

## Partial application and composition

Specialize by pre-applying props, not by copying a wrapper component per variant.

```jsx
export const partial = (Component, partialProps) => (props) => <Component {...partialProps} {...props} />;

export const SmallButton = partial(Button, { size: 'small' });
export const LargeRedButton = partial(Button, { size: 'large', color: 'crimson' });
```

Rules:

- Caller props must win over the pre-applied ones (spread `props` last).
- Set `displayName` on the returned component so DevTools and error boundaries stay readable.
- In TypeScript, type it `FunctionComponent<Omit<P, K>>` so `displayName` assignment is legal and the pre-applied props disappear from the public type.
- Composition (`SmallButton` wrapping `Button`) is the same idea written by hand - use it when the variant also adds markup, `partial` when it only fixes props.

## Recursive components

A component that renders itself for nested data, with the scalar case as the base case (`examples/functional-programming/recursive.jsx`). Always key the recursive children, and cap depth or trust the data shape - unbounded recursion on a cyclic graph hangs the render.

## Anti-patterns to flag during review

- Prop-soup primitives: config props describing content the caller could have composed.
- Presentational components reaching into router, outlet, or query hooks.
- A wrapper component whose whole body is `<Base {...props} fixed="value" />` - use `partial`.
- Copying the list container to change row markup, or copying the row to change container chrome.
- `useCallback` / `useMemo` wrapping values that no memoized consumer reads.
- Context whose value object is reconstructed every render, forcing all consumers to re-render. Split the context or memoize the value.
- HOC chains 3+ deep - usually a custom hook would be clearer.
- Effects that exist only to sync derived state - derive in render instead.
- Controlled inputs whose owner never reads the value - should be uncontrolled.
- Props that are actually configuration of an internal child - pass the child as `children` or an element prop.
- `any` in TypeScript. Reach for generics, `unknown`, or discriminated unions instead.
- Separate `isLoading` / `isError` state fields, where both can be true at once. Derive them from one status.
- Fetching that ignores the previous in-flight request, so a slow early response overwrites a fast later one.
- An unconditional spinner on a request that usually resolves in under 100ms.

## Planning template

For a non-trivial refactor, fill in [template.md](template.md) before writing code. A worked example is in [examples/sample.md](examples/sample.md).
