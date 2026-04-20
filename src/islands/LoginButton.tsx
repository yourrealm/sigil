import { useSignal } from "@preact/signals";
import { Button } from "@/components/button.tsx";
import { PiGithubLogoDuotone, PiSpinnerGapDuotone } from "@preact-icons/pi";

interface Props {
  href: string;
}

export default function LoginButton({ href }: Props) {
  const loading = useSignal(false);
  const onClick = () => {
    if (loading.value) return;
    loading.value = true;
    globalThis.location.assign(href);
  };
  return (
    <Button
      class="w-full py-3.5 text-sm gap-2"
      disabled={loading.value}
      icon={loading.value
        ? <PiSpinnerGapDuotone class="text-xl animate-spin" />
        : <PiGithubLogoDuotone class="text-xl" />}
      onClick={onClick}
    >
      {loading.value ? "Redirecting to GitHub…" : "Sign in with GitHub"}
    </Button>
  );
}
