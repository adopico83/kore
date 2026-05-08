export type DomainCatalogEntry = {
  name: string;
  emoji: string;
  weight: number;
  line: string;
  agent?: string;
  isCritical: boolean;
  isActive: boolean;
};

export const BASE_DOMAINS = [
  {
    name: "Sueño",
    emoji: "😴",
    weight: 8,
    line: "#9B8FE8",
    agent: "armonia",
    isCritical: true,
    isActive: false,
  },
  {
    name: "Salud",
    emoji: "🏥",
    weight: 7,
    line: "#EF9F27",
    agent: "armonia",
    isCritical: true,
    isActive: false,
  },
  {
    name: "Compras",
    emoji: "🛒",
    weight: 8,
    line: "#4CC9A0",
    agent: "logistica",
    isCritical: true,
    isActive: false,
  },
  {
    name: "Menú",
    emoji: "🍽️",
    weight: 7,
    line: "#4CC9A0",
    agent: "logistica",
    isCritical: true,
    isActive: false,
  },
  {
    name: "Limpieza",
    emoji: "🧹",
    weight: 6,
    line: "#EF9F27",
    agent: "armonia",
    isCritical: false,
    isActive: false,
  },
  {
    name: "Colegio",
    emoji: "🎒",
    weight: 7,
    line: "#7F77DD",
    agent: "logistica",
    isCritical: false,
    isActive: false,
  },
  {
    name: "Economía",
    emoji: "💶",
    weight: 6,
    line: "#4CC9A0",
    agent: "logistica",
    isCritical: false,
    isActive: false,
  },
  {
    name: "Ocio",
    emoji: "🌿",
    weight: 5,
    line: "#4CC9A0",
    agent: "armonia",
    isCritical: false,
    isActive: false,
  },
  {
    name: "Mantenimiento",
    emoji: "🔧",
    weight: 4,
    line: "#E05555",
    agent: "logistica",
    isCritical: false,
    isActive: false,
  },
  {
    name: "Agenda",
    emoji: "📅",
    weight: 9,
    line: "#9B8FE8",
    agent: "logistica",
    isCritical: false,
    isActive: false,
  },
] as const satisfies readonly DomainCatalogEntry[];

export type DomainName = (typeof BASE_DOMAINS)[number]["name"];
