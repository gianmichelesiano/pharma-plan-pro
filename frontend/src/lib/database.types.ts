// HAND-WRITTEN PLACEHOLDER — regenerate with:
//   supabase gen types typescript --linked > frontend/src/lib/database.types.ts
// after running `supabase link --project-ref zwbuiccyxebgfwlguscl`.

export type Database = {
  public: {
    Tables: {
      // from 20260417_0002_employees.sql
      plan_employees: {
        Row: {
          id: string;
          display_code: string;
          first_name: string;
          last_name: string;
          email: string | null;
          role: Database["public"]["Enums"]["employee_role"];
          employment_status: Database["public"]["Enums"]["employment_status"];
          hired_at: string | null;
          left_at: string | null;
          weekly_hours_pct: number | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          display_code: string;
          first_name: string;
          last_name: string;
          email?: string | null;
          role: Database["public"]["Enums"]["employee_role"];
          employment_status?: Database["public"]["Enums"]["employment_status"];
          hired_at?: string | null;
          left_at?: string | null;
          weekly_hours_pct?: number | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_code?: string;
          first_name?: string;
          last_name?: string;
          email?: string | null;
          role?: Database["public"]["Enums"]["employee_role"];
          employment_status?: Database["public"]["Enums"]["employment_status"];
          hired_at?: string | null;
          left_at?: string | null;
          weekly_hours_pct?: number | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      // from 20260417_0003_weekly_patterns.sql
      plan_weekly_patterns: {
        Row: {
          id: string;
          employee_id: string;
          weekday: number;
          slot: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          weekday: number;
          slot: string;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          weekday?: number;
          slot?: string;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };

      // from 20260417_0004_shifts.sql
      plan_shifts: {
        Row: {
          id: string;
          employee_id: string;
          shift_date: string;
          shift_type: Database["public"]["Enums"]["shift_type"];
          start_time: string | null;
          end_time: string | null;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          shift_date: string;
          shift_type: Database["public"]["Enums"]["shift_type"];
          start_time?: string | null;
          end_time?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          shift_date?: string;
          shift_type?: Database["public"]["Enums"]["shift_type"];
          start_time?: string | null;
          end_time?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      // from 20260417_0005_absences.sql (+ FK added in 20260417_0006_training.sql)
      plan_absences: {
        Row: {
          id: string;
          employee_id: string;
          start_date: string;
          end_date: string;
          type: Database["public"]["Enums"]["absence_type"];
          status: Database["public"]["Enums"]["absence_status"];
          note: string | null;
          training_course_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          start_date: string;
          end_date: string;
          type: Database["public"]["Enums"]["absence_type"];
          status?: Database["public"]["Enums"]["absence_status"];
          note?: string | null;
          training_course_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          start_date?: string;
          end_date?: string;
          type?: Database["public"]["Enums"]["absence_type"];
          status?: Database["public"]["Enums"]["absence_status"];
          note?: string | null;
          training_course_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      // from 20260417_0006_training.sql
      plan_training_courses: {
        Row: {
          id: string;
          code: string;
          title: string;
          location: string | null;
          start_date: string;
          end_date: string | null;
          start_time: string | null;
          end_time: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          title: string;
          location?: string | null;
          start_date: string;
          end_date?: string | null;
          start_time?: string | null;
          end_time?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          title?: string;
          location?: string | null;
          start_date?: string;
          end_date?: string | null;
          start_time?: string | null;
          end_time?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };

      // from 20260417_0006_training.sql
      plan_training_participants: {
        Row: {
          id: string;
          training_course_id: string;
          employee_id: string;
          confirmed: boolean;
        };
        Insert: {
          id?: string;
          training_course_id: string;
          employee_id: string;
          confirmed?: boolean;
        };
        Update: {
          id?: string;
          training_course_id?: string;
          employee_id?: string;
          confirmed?: boolean;
        };
        Relationships: [];
      };

      // from 20260417_0007_daily_notes.sql
      plan_daily_notes: {
        Row: {
          id: string;
          note_date: string;
          title: string | null;
          text: string;
          meeting_type: string | null;
          start_time: string | null;
          end_time: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          note_date: string;
          title?: string | null;
          text: string;
          meeting_type?: string | null;
          start_time?: string | null;
          end_time?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          note_date?: string;
          title?: string | null;
          text?: string;
          meeting_type?: string | null;
          start_time?: string | null;
          end_time?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };

      // from 20260417_0007_daily_notes.sql
      plan_daily_note_participants: {
        Row: {
          id: string;
          daily_note_id: string;
          employee_id: string;
        };
        Insert: {
          id?: string;
          daily_note_id: string;
          employee_id: string;
        };
        Update: {
          id?: string;
          daily_note_id?: string;
          employee_id?: string;
        };
        Relationships: [];
      };

      // from 20260417_0008_coverage_rules.sql
      plan_coverage_rules: {
        Row: {
          id: string;
          weekday: number;
          slot: string;
          role: Database["public"]["Enums"]["employee_role"];
          min_required: number;
          time_window: string;
          note: string | null;
        };
        Insert: {
          id?: string;
          weekday: number;
          slot: string;
          role: Database["public"]["Enums"]["employee_role"];
          min_required: number;
          time_window?: string;
          note?: string | null;
        };
        Update: {
          id?: string;
          weekday?: number;
          slot?: string;
          role?: Database["public"]["Enums"]["employee_role"];
          min_required?: number;
          time_window?: string;
          note?: string | null;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      employee_role: "pharmacist" | "pha" | "apprentice_pha" | "driver" | "auxiliary";
      employment_status: "active" | "planned" | "terminated";
      shift_type: "FULL_DAY" | "MORNING" | "AFTERNOON";
      absence_type: "VACATION" | "UNAVAILABLE" | "SICK" | "SCHOOL" | "TRAINING" | "HR_MEETING";
      absence_status: "requested" | "approved" | "rejected";
    };
    CompositeTypes: { [_ in never]: never };
  };
};
