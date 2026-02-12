export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      coach_student_invites: {
        Row: {
          accepted_at: string | null
          coach_id: string
          created_at: string
          expires_at: string
          id: string
          link_id: string | null
          revoked_at: string | null
          status: string
          student_email: string
          student_user_id: string | null
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          coach_id: string
          created_at?: string
          expires_at: string
          id?: string
          link_id?: string | null
          revoked_at?: string | null
          status?: string
          student_email: string
          student_user_id?: string | null
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          coach_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          link_id?: string | null
          revoked_at?: string | null
          status?: string
          student_email?: string
          student_user_id?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_student_invites_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coach_student_invites_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "coach_student_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_student_invites_student_user_id_fkey"
            columns: ["student_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      coach_student_links: {
        Row: {
          activated_at: string | null
          coach_id: string
          created_at: string
          end_reason: string | null
          ended_at: string | null
          ended_by: string | null
          history_visible_after_end: boolean
          id: string
          status: string
          student_can_unlink: boolean
          student_id: string
        }
        Insert: {
          activated_at?: string | null
          coach_id: string
          created_at?: string
          end_reason?: string | null
          ended_at?: string | null
          ended_by?: string | null
          history_visible_after_end?: boolean
          id?: string
          status?: string
          student_can_unlink?: boolean
          student_id: string
        }
        Update: {
          activated_at?: string | null
          coach_id?: string
          created_at?: string
          end_reason?: string | null
          ended_at?: string | null
          ended_by?: string | null
          history_visible_after_end?: boolean
          id?: string
          status?: string
          student_can_unlink?: boolean
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_student_links_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coach_student_links_ended_by_fkey"
            columns: ["ended_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coach_student_links_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      coach_student_unlink_requests: {
        Row: {
          created_at: string
          id: string
          link_id: string
          message: string | null
          requested_by: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          link_id: string
          message?: string | null
          requested_by: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          link_id?: string
          message?: string | null
          requested_by?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_student_unlink_requests_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "coach_student_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_student_unlink_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coach_student_unlink_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          first_name: string | null
          full_name: string | null
          gym_name: string | null
          last_name: string | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          first_name?: string | null
          full_name?: string | null
          gym_name?: string | null
          last_name?: string | null
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          first_name?: string | null
          full_name?: string | null
          gym_name?: string | null
          last_name?: string | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      session_items: {
        Row: {
          created_at: string
          done_at: string | null
          id: string
          is_done: boolean
          notes_snapshot: string | null
          order_index: number
          reps: string | null
          rest_seconds: number | null
          sets: number | null
          session_id: string
          title_snapshot: string
          user_id: string
          video_url: string | null
          weight: number | null
          workout_item_id: string | null
        }
        Insert: {
          created_at?: string
          done_at?: string | null
          id?: string
          is_done?: boolean
          notes_snapshot?: string | null
          order_index: number
          reps?: string | null
          rest_seconds?: number | null
          sets?: number | null
          session_id: string
          title_snapshot: string
          user_id: string
          video_url?: string | null
          weight?: number | null
          workout_item_id?: string | null
        }
        Update: {
          created_at?: string
          done_at?: string | null
          id?: string
          is_done?: boolean
          notes_snapshot?: string | null
          order_index?: number
          reps?: string | null
          rest_seconds?: number | null
          sets?: number | null
          session_id?: string
          title_snapshot?: string
          user_id?: string
          video_url?: string | null
          weight?: number | null
          workout_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_items_workout_item_id_fkey"
            columns: ["workout_item_id"]
            isOneToOne: false
            referencedRelation: "workout_items"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_items: {
        Row: {
          created_at: string
          default_reps: string | null
          default_sets: number | null
          default_weight: number | null
          id: string
          notes: string | null
          order_index: number
          rest_seconds: number | null
          title: string
          updated_at: string
          user_id: string
          video_url: string | null
          workout_id: string
        }
        Insert: {
          created_at?: string
          default_reps?: string | null
          default_sets?: number | null
          default_weight?: number | null
          id?: string
          notes?: string | null
          order_index: number
          rest_seconds?: number | null
          title: string
          updated_at?: string
          user_id: string
          video_url?: string | null
          workout_id: string
        }
        Update: {
          created_at?: string
          default_reps?: string | null
          default_sets?: number | null
          default_weight?: number | null
          id?: string
          notes?: string | null
          order_index?: number
          rest_seconds?: number | null
          title?: string
          updated_at?: string
          user_id?: string
          video_url?: string | null
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_items_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sessions: {
        Row: {
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          started_at: string
          status: string
          user_id: string
          workout_focus_snapshot: string | null
          workout_id: string | null
          workout_name_snapshot: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          started_at?: string
          status?: string
          user_id: string
          workout_focus_snapshot?: string | null
          workout_id?: string | null
          workout_name_snapshot: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          started_at?: string
          status?: string
          user_id?: string
          workout_focus_snapshot?: string | null
          workout_id?: string | null
          workout_name_snapshot?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sessions_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          created_at: string
          focus: string | null
          id: string
          is_archived: boolean | null
          name: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          focus?: string | null
          id?: string
          is_archived?: boolean | null
          name: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          focus?: string | null
          id?: string
          is_archived?: boolean | null
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_coach_invite: {
        Args: {
          token_input: string
        }
        Returns: string
      }
      create_coach_invite: {
        Args: {
          expires_in_hours?: number
          student_email_input: string
        }
        Returns: {
          expires_at: string
          invite_id: string
          student_email: string
          token: string
        }[]
      }
      request_student_unlink: {
        Args: {
          link_id_input: string
          message_input?: string | null
        }
        Returns: string
      }
      resolve_unlink_request: {
        Args: {
          approve_input: boolean
          request_id_input: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
