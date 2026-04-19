import { QueryClient, QueryClientProvider } from "@tanstack/preact-query";
import { type ComponentType, h } from "preact";

/** Shared across every island so two islands on the same page hit the same cache. */
export const queryClient = new QueryClient();

/**
 * HOC: wraps an island component so `useQuery` inside it has a provider.
 * Uses `h()` instead of JSX spread - Preact's JSX types reject generic-prop
 * spreads because the prop object isn't known to include `IntrinsicAttributes`.
 */
export function withQueryClientProvider<P>(
  Component: ComponentType<P>,
): ComponentType<P> {
  const Wrapped: ComponentType<P> = (props) =>
    h(QueryClientProvider, { client: queryClient }, h(Component, props));
  Wrapped.displayName = `WithQueryClientProvider(${
    Component.displayName ?? Component.name ?? "Component"
  })`;
  return Wrapped;
}
