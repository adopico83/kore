export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_memory: {
        Row: {
          category: string | null
          created_at: string | null
          family_id: string | null
          id: string
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          family_id?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          family_id?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_memory_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_messages: {
        Row: {
          id: string
          family_id: string | null
          user_id: string | null
          conversation_id: string
          role: string
          content: string
          created_at: string | null
        }
        Insert: {
          id?: string
          family_id?: string | null
          user_id?: string | null
          conversation_id: string
          role: string
          content: string
          created_at?: string | null
        }
        Update: {
          id?: string
          family_id?: string | null
          user_id?: string | null
          conversation_id?: string
          role?: string
          content?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_messages_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          created_at: string | null
          created_by: string | null
          date: string
          family_id: string | null
          id: string
          time: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          date: string
          family_id?: string | null
          id?: string
          time?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          date?: string
          family_id?: string | null
          id?: string
          time?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaning_tasks: {
        Row: {
          assigned_to: string | null
          completed: boolean | null
          created_at: string | null
          family_id: string | null
          frequency: string | null
          id: string
          task: string
          zone: string
        }
        Insert: {
          assigned_to?: string | null
          completed?: boolean | null
          created_at?: string | null
          family_id?: string | null
          frequency?: string | null
          id?: string
          task: string
          zone: string
        }
        Update: {
          assigned_to?: string | null
          completed?: boolean | null
          created_at?: string | null
          family_id?: string | null
          frequency?: string | null
          id?: string
          task?: string
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaning_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_tasks_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string | null
          created_by: string | null
          family_id: string | null
          id: string
          title: string | null
          type: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          family_id?: string | null
          id?: string
          title?: string | null
          type?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          family_id?: string | null
          id?: string
          title?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_metrics: {
        Row: {
          date: string
          family_id: string | null
          night_recovery_score: number | null
          survival_mode: boolean | null
          user_a_stress: number | null
          user_b_stress: number | null
        }
        Insert: {
          date: string
          family_id?: string | null
          night_recovery_score?: number | null
          survival_mode?: boolean | null
          user_a_stress?: number | null
          user_b_stress?: number | null
        }
        Update: {
          date?: string
          family_id?: string | null
          night_recovery_score?: number | null
          survival_mode?: boolean | null
          user_a_stress?: number | null
          user_b_stress?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_metrics_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_history: {
        Row: {
          created_at: string | null
          created_by: string | null
          domain_id: string
          family_id: string | null
          id: string
          text: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          domain_id: string
          family_id?: string | null
          id?: string
          text: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          domain_id?: string
          family_id?: string | null
          id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "domain_history_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "domain_history_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "domain_history_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      domains: {
        Row: {
          agent: string | null
          family_id: string | null
          grace_hours: number | null
          id: string
          is_active: boolean | null
          last_transfer_at: string | null
          name: string
          owner_id: string | null
          priority_level: number | null
          weight: number
        }
        Insert: {
          agent?: string | null
          family_id?: string | null
          grace_hours?: number | null
          id?: string
          is_active?: boolean | null
          last_transfer_at?: string | null
          name: string
          owner_id?: string | null
          priority_level?: number | null
          weight: number
        }
        Update: {
          agent?: string | null
          family_id?: string | null
          grace_hours?: number | null
          id?: string
          is_active?: boolean | null
          last_transfer_at?: string | null
          name?: string
          owner_id?: string | null
          priority_level?: number | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "domains_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "domains_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events_log: {
        Row: {
          created_at: string | null
          domain_id: string | null
          family_id: string | null
          id: string
          raw_input: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          domain_id?: string | null
          family_id?: string | null
          id?: string
          raw_input: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          domain_id?: string | null
          family_id?: string | null
          id?: string
          raw_input?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_log_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_log_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string | null
          description: string
          family_id: string | null
          id: string
          is_shared: boolean | null
          payer_id: string
          source: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string | null
          description: string
          family_id?: string | null
          id?: string
          is_shared?: boolean | null
          payer_id: string
          source?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string | null
          description?: string
          family_id?: string | null
          id?: string
          is_shared?: boolean | null
          payer_id?: string
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          created_at: string | null
          id: string
          invite_code: string | null
          invite_expires_at: string | null
          metadata: Json | null
          name: string
          onboarding_step: string | null
          owner_id: string | null
          subscription_plan: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          invite_code?: string | null
          invite_expires_at?: string | null
          metadata?: Json | null
          name: string
          onboarding_step?: string | null
          owner_id?: string | null
          subscription_plan?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          invite_code?: string | null
          invite_expires_at?: string | null
          metadata?: Json | null
          name?: string
          onboarding_step?: string | null
          owner_id?: string | null
          subscription_plan?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "families_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      health_records: {
        Row: {
          created_at: string | null
          date_time: string | null
          description: string
          family_id: string | null
          id: string
          next_dose_at: string | null
          patient_id: string
          status: string | null
          type: string
        }
        Insert: {
          created_at?: string | null
          date_time?: string | null
          description: string
          family_id?: string | null
          id?: string
          next_dose_at?: string | null
          patient_id: string
          status?: string | null
          type: string
        }
        Update: {
          created_at?: string | null
          date_time?: string | null
          description?: string
          family_id?: string | null
          id?: string
          next_dose_at?: string | null
          patient_id?: string
          status?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_records_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kore_notes: {
        Row: {
          audio_url: string | null
          content: string | null
          created_at: string | null
          family_id: string | null
          id: string
          priority: string | null
          recipient_id: string
          sender_id: string
          status: string | null
        }
        Insert: {
          audio_url?: string | null
          content?: string | null
          created_at?: string | null
          family_id?: string | null
          id?: string
          priority?: string | null
          recipient_id: string
          sender_id: string
          status?: string | null
        }
        Update: {
          audio_url?: string | null
          content?: string | null
          created_at?: string | null
          family_id?: string | null
          id?: string
          priority?: string | null
          recipient_id?: string
          sender_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kore_notes_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kore_notes_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kore_notes_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kore_notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string
          slug: string
          type: string
          urgency: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          slug: string
          type: string
          urgency: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          slug?: string
          type?: string
          urgency?: string
        }
        Relationships: []
      }
      leisure_activities: {
        Row: {
          activity: string
          created_at: string | null
          date: string | null
          duration_minutes: number | null
          family_id: string | null
          id: string
          person: string
        }
        Insert: {
          activity: string
          created_at?: string | null
          date?: string | null
          duration_minutes?: number | null
          family_id?: string | null
          id?: string
          person: string
        }
        Update: {
          activity?: string
          created_at?: string | null
          date?: string | null
          duration_minutes?: number | null
          family_id?: string | null
          id?: string
          person?: string
        }
        Relationships: [
          {
            foreignKeyName: "leisure_activities_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          created_at: string | null
          day: string
          dish: string
          family_id: string | null
          id: string
          meal: string
          week_start: string
        }
        Insert: {
          created_at?: string | null
          day: string
          dish: string
          family_id?: string | null
          id?: string
          meal: string
          week_start: string
        }
        Update: {
          created_at?: string | null
          day?: string
          dish?: string
          family_id?: string | null
          id?: string
          meal?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          audio_url: string | null
          content: string | null
          conversation_id: string
          created_at: string | null
          family_id: string | null
          id: string
          role: string | null
        }
        Insert: {
          audio_url?: string | null
          content?: string | null
          conversation_id: string
          created_at?: string | null
          family_id?: string | null
          id?: string
          role?: string | null
        }
        Update: {
          audio_url?: string | null
          content?: string | null
          conversation_id?: string
          created_at?: string | null
          family_id?: string | null
          id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          family_id: string | null
          id: string
          name: string
          role: string | null
          sleep_hours: number | null
          stress_level: number | null
          updated_at: string | null
        }
        Insert: {
          family_id?: string | null
          id: string
          name: string
          role?: string | null
          sleep_hours?: number | null
          stress_level?: number | null
          updated_at?: string | null
        }
        Update: {
          family_id?: string | null
          id?: string
          name?: string
          role?: string | null
          sleep_hours?: number | null
          stress_level?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          id: string
          profile_id: string
          family_id: string
          subscription_data: Json
          device_type: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          profile_id: string
          family_id: string
          subscription_data: Json
          device_type?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          profile_id?: string
          family_id?: string
          subscription_data?: Json
          device_type?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      school_events: {
        Row: {
          calendar_event_id: string | null
          created_at: string | null
          date: string
          description: string | null
          family_id: string | null
          id: string
          time: string | null
          title: string
          type: string | null
        }
        Insert: {
          calendar_event_id?: string | null
          created_at?: string | null
          date: string
          description?: string | null
          family_id?: string | null
          id?: string
          time?: string | null
          title: string
          type?: string | null
        }
        Update: {
          calendar_event_id?: string | null
          created_at?: string | null
          date?: string
          description?: string | null
          family_id?: string | null
          id?: string
          time?: string | null
          title?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_events_calendar_event_id_fkey"
            columns: ["calendar_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_events_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      school_materials: {
        Row: {
          completed: boolean | null
          created_at: string | null
          family_id: string | null
          id: string
          item: string
          urgency: string | null
        }
        Insert: {
          completed?: boolean | null
          created_at?: string | null
          family_id?: string | null
          id?: string
          item: string
          urgency?: string | null
        }
        Update: {
          completed?: boolean | null
          created_at?: string | null
          family_id?: string | null
          id?: string
          item?: string
          urgency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_materials_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_items: {
        Row: {
          category: string | null
          completed: boolean | null
          created_at: string | null
          created_by: string | null
          family_id: string | null
          id: string
          name: string
          priority: string | null
          quantity: string | null
        }
        Insert: {
          category?: string | null
          completed?: boolean | null
          created_at?: string | null
          created_by?: string | null
          family_id?: string | null
          id?: string
          name: string
          priority?: string | null
          quantity?: string | null
        }
        Update: {
          category?: string | null
          completed?: boolean | null
          created_at?: string | null
          created_by?: string | null
          family_id?: string | null
          id?: string
          name?: string
          priority?: string | null
          quantity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shopping_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_items_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      sleep_logs: {
        Row: {
          family_id: string | null
          hours: number | null
          id: string
          logged_at: string | null
          person: string
          reason: string | null
          type: string
        }
        Insert: {
          family_id?: string | null
          hours?: number | null
          id?: string
          logged_at?: string | null
          person: string
          reason?: string | null
          type: string
        }
        Update: {
          family_id?: string | null
          hours?: number | null
          id?: string
          logged_at?: string | null
          person?: string
          reason?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sleep_logs_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_family_id: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
