import { define } from "@/utils.ts";
import { GithubAuthProvider } from "@/lib/auth.tsx";

export default define.page(function ForgeLayout({ Component, state }) {
  return (
    <GithubAuthProvider value={state.auth}>
      <Component />
    </GithubAuthProvider>
  );
});
