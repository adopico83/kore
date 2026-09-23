import { Home, Pin, Sparkles, User, Users } from "lucide-react";
import type { HomeTab } from "@/components/home/home-model";

type HomeTabBarProps = {
  tab: HomeTab;
  onChange: (tab: HomeTab) => void;
  onOpenAgent: () => void;
};

const TABS: { id: HomeTab; label: string; desktopLabel?: string; icon: typeof Home }[] = [
  { id: "inicio", label: "Inicio", desktopLabel: "Hoy", icon: Home },
  { id: "casa", label: "Casa", icon: Users },
  { id: "corcho", label: "Corcho", icon: Pin },
  { id: "yo", label: "Yo", icon: User },
];

export function HomeTabBar({ tab, onChange, onOpenAgent }: HomeTabBarProps) {
  const left = TABS.slice(0, 2);
  const right = TABS.slice(2);

  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.07] bg-[#14161b]/95 backdrop-blur-md"
    >
      <div className="relative mx-auto w-full max-w-6xl">
        <div
          role="tablist"
          className="flex items-end justify-between px-1 pt-1.5 pb-[max(0.45rem,env(safe-area-inset-bottom))] lg:px-10"
        >
          {left.map((item) => (
            <TabButton key={item.id} item={item} active={tab === item.id} onChange={onChange} />
          ))}
          <div className="hidden w-14 shrink-0 lg:block" aria-hidden />
          {right.map((item) => (
            <TabButton key={item.id} item={item} active={tab === item.id} onChange={onChange} />
          ))}
        </div>
        <button
          type="button"
          onClick={onOpenAgent}
          aria-label="Hablar con Kore"
          className="absolute top-0 left-1/2 hidden h-14 w-14 -translate-x-1/2 -translate-y-6 items-center justify-center rounded-full bg-[#4CC9A0] text-[#06281c] shadow-[0_8px_24px_rgba(76,201,160,0.28)] lg:flex"
        >
          <Sparkles className="h-6 w-6" strokeWidth={1.75} />
        </button>
      </div>
    </nav>
  );
}

function TabButton({
  item,
  active,
  onChange,
}: {
  item: (typeof TABS)[number];
  active: boolean;
  onChange: (tab: HomeTab) => void;
}) {
  const Icon = item.icon;
  const labelTone = active ? "text-[#4CC9A0]" : "text-white/45";
  const iconTone = !active && item.id === "corcho" ? "text-[#E05555]" : labelTone;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => onChange(item.id)}
      className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1 text-[11px] font-medium lg:text-sm ${labelTone}`}
    >
      <Icon className={`h-[18px] w-[18px] lg:hidden ${iconTone}`} strokeWidth={1.75} />
      <span className="lg:hidden">{item.label}</span>
      <span className="hidden lg:inline">{item.desktopLabel ?? item.label}</span>
    </button>
  );
}
