# API Layer & Async Operations

Runnable versions of everything below live in `examples/api-layer/`.

## API client

One client module per backend. Centralize base URL, auth headers, error normalization. No `fetch()` calls scattered through components.

```ts
// shared/api/client.ts
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...authHeaders(), ...init?.headers },
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.json() as Promise<T>;
}
```

### Cross-cutting concerns as decorators

Abort support, logging, auth refresh, and error normalization are the same on every verb. Wrap the transport once rather than repeating the concern in each endpoint (`examples/api-layer/api-client.js`):

```js
const api = (client) => ({
  get: (url, config = {}) => withLogger(withAbort(client.get)(url, config)),
  post: (url, body, config = {}) => withLogger(withAbort(client.post)(url, body, config)),
});
```

Each decorator is independently testable and the endpoint modules stay one line each. Export the predicates the transport owns (`didAbort`, `isApiError`) so callers never import the HTTP library to classify an error - swapping the library then touches one file.

### Endpoint modules

One module per domain resource, URLs in a local `URLS` const, response unwrapping done there (`examples/api-layer/endpoint-module.js`). Components import `searchMeals(query)`, never a URL string. The unwrapping belongs here too - a component that reaches into `res.data.meals` has coupled itself to the envelope.

## Modeling request states

Avoid `{ data, isLoading, error }` ad-hoc per call. Use a discriminated union or a small hook that returns one.

```ts
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };
```

Renders become exhaustive:
```tsx
switch (state.status) {
  case 'idle':    return null;
  case 'loading': return <Spinner />;
  case 'error':   return <ErrorBanner error={state.error} />;
  case 'success': return <List items={state.data} />;
}
```

### One status, derived booleans

If the union is more ceremony than a screen needs, keep a single status enum and derive the booleans from it - never store `isLoading` and `isError` as separate state, where `{ isLoading: true, isError: true }` is representable (`examples/api-layer/use-api-status.js`).

```js
const { status, isIdle, isPending, isSuccess, isError } = useApiStatus();
```

`useApi(fn)` composes that with the call itself and returns `{ data, error, exec, ...flags }` (`examples/api-layer/use-api.js`). Reach for it for imperative, user-triggered calls - a button that submits or refetches. For declarative server state that a screen reads on mount, use React Query instead.

### Errors as values

`withAsync` converts a rejection into a returned `{ response, error }` so call sites branch instead of nesting `try`/`catch` (`examples/api-layer/with-async.js`). Use it where a handler must sequence several fallible calls and react per step.

### Never flash a spinner

A loader that appears and disappears in 80ms reads as a glitch. Gate it behind a delay, so only genuinely slow requests get one (`examples/api-layer/lazy-loader.jsx`):

```jsx
<LazyLoader show={isPending} delay={500} fallback="Fetch users">Loading...</LazyLoader>
```

The mirror-image rule applies to a loader that did appear: hold it for a short minimum so it does not flicker out mid-frame.

## Abort on unmount / dep change

Every effect that fetches must abort.

```ts
useEffect(() => {
  const ctrl = new AbortController();
  api<User>(`/users/${id}`, { signal: ctrl.signal })
    .then((data) => setState({ status: 'success', data }))
    .catch((e) => { if (e.name !== 'AbortError') setState({ status: 'error', error: e }); });
  return () => ctrl.abort();
}, [id]);
```

### Abort the previous request, not just on unmount

Search-as-you-type has a second failure mode: a slow response for `"ca"` landing after a fast one for `"carrot"` and overwriting it. Cancel the in-flight request on every new one, keeping the canceller in a ref (`examples/api-layer/App.usage.jsx`):

```js
abortRef.current.abort?.();
await searchMeals(query, { abort: (cancel) => (abortRef.current.abort = cancel) });
```

An aborted request is not a failure. Classify it with `didAbort(error)` before showing an error state, or the user sees an error banner for every keystroke.

## Retries, timeouts, dedupe

Hand-rolling these is where bugs live. Prefer React Query / SWR once you need any of: dedupe, background refetch, retry, cache invalidation.
