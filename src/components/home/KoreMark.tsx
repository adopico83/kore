type KoreMarkProps = {
  size?: number;
};

/** Dos círculos solapados: teal #4CC9A0, lavanda #9B8FE8 y punto blanco. */
export function KoreMark({ size = 36 }: KoreMarkProps) {
  const height = Math.round(size * 0.62);
  return (
    <svg width={size} height={height} viewBox="0 0 120 74" fill="none" aria-hidden>
      <circle cx="44" cy="37" r="26" stroke="#4CC9A0" strokeWidth="2.4" />
      <circle cx="76" cy="37" r="26" stroke="#9B8FE8" strokeWidth="2.4" />
      <circle cx="60" cy="37" r="11" fill="white" opacity="0.06" />
      <circle cx="60" cy="37" r="4.5" fill="white" />
    </svg>
  );
}
