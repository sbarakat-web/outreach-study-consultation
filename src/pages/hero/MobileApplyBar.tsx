import { ArrowRight } from "lucide-react";

/** Compact, safe-area-aware CTA for native-scrolling phone and tablet layouts. */
export function MobileApplyBar() {
  return (
    <aside className="mobile-apply-bar fixed inset-x-0 bottom-0 z-50 px-[max(1rem,env(safe-area-inset-left))] pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3 lg:hidden">
      <a
        href="/#apply"
        className="mx-auto flex min-h-12 max-w-md items-center justify-center gap-2 rounded-full bg-brand px-6 text-base font-extrabold text-white shadow-[0_10px_35px_rgba(20,18,58,.35)] transition active:scale-[.98]"
      >
        Apply Now
        <ArrowRight aria-hidden className="h-5 w-5 rtl:rotate-180" />
      </a>
    </aside>
  );
}
