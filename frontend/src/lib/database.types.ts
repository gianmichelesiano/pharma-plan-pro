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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      absences: {
        Row: {
          created_at: string
          employee_id: string
          end_date: string
          id: string
          note: string | null
          start_date: string
          status: Database["public"]["Enums"]["absence_status"]
          training_course_id: string | null
          type: Database["public"]["Enums"]["absence_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          end_date: string
          id?: string
          note?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["absence_status"]
          training_course_id?: string | null
          type: Database["public"]["Enums"]["absence_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          end_date?: string
          id?: string
          note?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["absence_status"]
          training_course_id?: string | null
          type?: Database["public"]["Enums"]["absence_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "absences_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_training_course_fk"
            columns: ["training_course_id"]
            isOneToOne: false
            referencedRelation: "training_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      coverage_rules: {
        Row: {
          id: string
          min_required: number
          note: string | null
          role: Database["public"]["Enums"]["employee_role"]
          time_window: string
          weekday: number
        }
        Insert: {
          id?: string
          min_required: number
          note?: string | null
          role: Database["public"]["Enums"]["employee_role"]
          time_window?: string
          weekday: number
        }
        Update: {
          id?: string
          min_required?: number
          note?: string | null
          role?: Database["public"]["Enums"]["employee_role"]
          time_window?: string
          weekday?: number
        }
        Relationships: []
      }
      daily_note_participants: {
        Row: {
          daily_note_id: string
          employee_id: string
          id: string
        }
        Insert: {
          daily_note_id: string
          employee_id: string
          id?: string
        }
        Update: {
          daily_note_id?: string
          employee_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_note_participants_daily_note_id_fkey"
            columns: ["daily_note_id"]
            isOneToOne: false
            referencedRelation: "daily_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_note_participants_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_notes: {
        Row: {
          created_at: string
          end_time: string | null
          id: string
          meeting_type: string | null
          note_date: string
          start_time: string | null
          text: string
          title: string | null
        }
        Insert: {
          created_at?: string
          end_time?: string | null
          id?: string
          meeting_type?: string | null
          note_date: string
          start_time?: string | null
          text: string
          title?: string | null
        }
        Update: {
          created_at?: string
          end_time?: string | null
          id?: string
          meeting_type?: string | null
          note_date?: string
          start_time?: string | null
          text?: string
          title?: string | null
        }
        Relationships: []
      }
      employees: {
        Row: {
          access_level: Database["public"]["Enums"]["access_level"]
          active: boolean
          approved: boolean
          created_at: string
          display_code: string
          email: string | null
          employment_status: Database["public"]["Enums"]["employment_status"]
          first_name: string
          hired_at: string | null
          id: string
          last_name: string
          left_at: string | null
          phone: string | null
          role: Database["public"]["Enums"]["employee_role"]
          updated_at: string
          weekly_hours_pct: number | null
        }
        Insert: {
          access_level?: Database["public"]["Enums"]["access_level"]
          active?: boolean
          approved?: boolean
          created_at?: string
          display_code: string
          email?: string | null
          employment_status?: Database["public"]["Enums"]["employment_status"]
          first_name: string
          hired_at?: string | null
          id?: string
          last_name: string
          left_at?: string | null
          phone?: string | null
          role: Database["public"]["Enums"]["employee_role"]
          updated_at?: string
          weekly_hours_pct?: number | null
        }
        Update: {
          access_level?: Database["public"]["Enums"]["access_level"]
          active?: boolean
          approved?: boolean
          created_at?: string
          display_code?: string
          email?: string | null
          employment_status?: Database["public"]["Enums"]["employment_status"]
          first_name?: string
          hired_at?: string | null
          id?: string
          last_name?: string
          left_at?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["employee_role"]
          updated_at?: string
          weekly_hours_pct?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          admin: boolean
          approved: boolean
          created_at: string
          email: string | null
          id: string
        }
        Insert: {
          admin?: boolean
          approved?: boolean
          created_at?: string
          email?: string | null
          id: string
        }
        Update: {
          admin?: boolean
          approved?: boolean
          created_at?: string
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      shifts: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          note: string | null
          shift_date: string
          source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          note?: string | null
          shift_date: string
          source?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          note?: string | null
          shift_date?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      training_courses: {
        Row: {
          code: string
          created_at: string
          end_date: string | null
          end_time: string | null
          id: string
          location: string | null
          note: string | null
          start_date: string
          start_time: string | null
          title: string
        }
        Insert: {
          code: string
          created_at?: string
          end_date?: string | null
          end_time?: string | null
          id?: string
          location?: string | null
          note?: string | null
          start_date: string
          start_time?: string | null
          title: string
        }
        Update: {
          code?: string
          created_at?: string
          end_date?: string | null
          end_time?: string | null
          id?: string
          location?: string | null
          note?: string | null
          start_date?: string
          start_time?: string | null
          title?: string
        }
        Relationships: []
      }
      training_participants: {
        Row: {
          confirmed: boolean
          employee_id: string
          id: string
          training_course_id: string
        }
        Insert: {
          confirmed?: boolean
          employee_id: string
          id?: string
          training_course_id: string
        }
        Update: {
          confirmed?: boolean
          employee_id?: string
          id?: string
          training_course_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_participants_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_participants_training_course_id_fkey"
            columns: ["training_course_id"]
            isOneToOne: false
            referencedRelation: "training_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_patterns: {
        Row: {
          active: boolean
          created_at: string
          employee_id: string
          id: string
          weekday: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          employee_id: string
          id?: string
          weekday: number
        }
        Update: {
          active?: boolean
          created_at?: string
          employee_id?: string
          id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "weekly_patterns_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_coverage_issues: {
        Args: { p_end: string; p_start: string }
        Returns: {
          assigned: number
          employee_id: string
          issue_date: string
          kind: string
          required: number
          role: Database["public"]["Enums"]["employee_role"]
          severity: string
        }[]
      }
    }
    Enums: {
      absence_status: "requested" | "approved" | "rejected"
      absence_type:
        | "VACATION"
        | "UNAVAILABLE"
        | "SICK"
        | "SCHOOL"
        | "TRAINING"
        | "HR_MEETING"
      access_level: "user" | "admin" | "super_admin"
      employee_role:
        | "pharmacist"
        | "pha"
        | "apprentice_pha"
        | "driver"
        | "auxiliary"
      employment_status: "active" | "planned" | "terminated"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      absence_status: ["requested", "approved", "rejected"],
      absence_type: [
        "VACATION",
        "UNAVAILABLE",
        "SICK",
        "SCHOOL",
        "TRAINING",
        "HR_MEETING",
      ],
      access_level: ["user", "admin", "super_admin"],
      employee_role: [
        "pharmacist",
        "pha",
        "apprentice_pha",
        "driver",
        "auxiliary",
      ],
      employment_status: ["active", "planned", "terminated"],
    },
  },
} as const
