import { avatarRingFor } from "@/components/home/home-model";
import { KoreMark } from "@/components/home/KoreMark";

type HeaderAdult = {
  id: string;
  name: string;
};

type HomeHeaderProps = {
  familyName: string;
  adults: HeaderAdult[];
  onOpenProfile: (id: string) => void;
};

export function HomeHeader({ familyName, adults, onOpenProfile }: HomeHeaderProps) {
  const label = familyName.trim();

  return (
    <header className="fixed inset-x-0 top-0 z-30 border-b border-white/[0.07] bg-[#14161b]/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 md:px-8">
        <div className="flex min-w-0 items-center gap-2.5">
          <KoreMark />
          <div className="flex min-w-0 items-baseline gap-3">
            <p className="text-[1.65rem] font-bold leading-none tracking-tight text-[#e4e6ed]">Kore</p>
            {label ? (
              <p className="hidden truncate text-[11px] font-medium uppercase tracking-[0.2em] text-white/40 md:block">
                {label}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {adults.slice(0, 2).map((adult, index) => {
            const initial = adult.name.trim().charAt(0).toLocaleUpperCase("es") || "?";
            return (
              <button
                key={adult.id}
                type="button"
                aria-label={`Perfil de ${adult.name}`}
                onClick={() => onOpenProfile(adult.id)}
                className="flex h-10 w-10 items-center justify-center rounded-full border-2 bg-[#12151c] text-sm font-semibold text-white"
                style={{ borderColor: avatarRingFor(adult.name, index) }}
              >
                {initial}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
