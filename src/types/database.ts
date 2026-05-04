type ProfilesRow = {
  id: string;
  name: string;
  stress_level: number;
  sleep_hours: number | null;
  updated_at: string;
};

type DomainsRow = {
  id: string;
  name: string;
  owner_id: string | null;
  weight: number;
  agent: "logistica" | "economia" | "armonia";
  last_transfer_at: string | null;
  grace_hours: number;
};

type EventsLogRow = {
  id: string;
  user_id: string;
  domain_id: string | null;
  type: string;
  raw_input: string;
  created_at: string;
};

type DailyMetricsRow = {
  date: string;
  user_a_stress: number | null;
  user_b_stress: number | null;
  night_recovery_score: number | null;
  survival_mode: boolean;
};

type KoreNotesRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string | null;
  audio_url: string | null;
  status: "unread" | "read" | "archived";
  priority: "low" | "medium" | "high";
  created_at: string;
};

type ExpensesRow = {
  id: string;
  payer_id: string;
  amount: number;
  category: string;
  description: string;
  is_shared: boolean;
  source: "voice" | "manual" | "auto";
  created_at: string;
};

type HealthRecordsRow = {
  id: string;
  patient_id: string;
  type: "appointment" | "medication" | "note";
  description: string;
  date_time: string | null;
  next_dose_at: string | null;
  status: "pending" | "completed" | "active";
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfilesRow;
        Insert: Omit<ProfilesRow, "updated_at"> & { updated_at?: string };
        Update: Partial<ProfilesRow>;
        Relationships: [];
      };
      domains: {
        Row: DomainsRow;
        Insert: Omit<DomainsRow, "id" | "last_transfer_at"> & {
          id?: string;
          last_transfer_at?: string | null;
        };
        Update: Partial<DomainsRow>;
        Relationships: [];
      };
      events_log: {
        Row: EventsLogRow;
        Insert: Omit<EventsLogRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<EventsLogRow>;
        Relationships: [];
      };
      daily_metrics: {
        Row: DailyMetricsRow;
        Insert: DailyMetricsRow;
        Update: Partial<DailyMetricsRow>;
        Relationships: [];
      };
      kore_notes: {
        Row: KoreNotesRow;
        Insert: Omit<KoreNotesRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<KoreNotesRow>;
        Relationships: [];
      };
      expenses: {
        Row: ExpensesRow;
        Insert: Omit<ExpensesRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<ExpensesRow>;
        Relationships: [];
      };
      health_records: {
        Row: HealthRecordsRow;
        Insert: Omit<HealthRecordsRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<HealthRecordsRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
