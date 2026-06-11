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
      hotels: {
        Row: {
          id: string
          name: string
          address: string | null
          city: string | null
          region: string | null
          owner_id: string | null
          gta_license_number: string | null
          gta_license_expiry: string | null
          vat_registration_number: string | null
          invoice_prefix: string
          invoice_next_seq: number
          invoice_seq_year: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          address?: string | null
          city?: string | null
          region?: string | null
          owner_id?: string | null
          gta_license_number?: string | null
          gta_license_expiry?: string | null
          vat_registration_number?: string | null
          invoice_prefix?: string
          invoice_next_seq?: number
          invoice_seq_year?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          address?: string | null
          city?: string | null
          region?: string | null
          owner_id?: string | null
          gta_license_number?: string | null
          gta_license_expiry?: string | null
          vat_registration_number?: string | null
          invoice_prefix?: string
          invoice_next_seq?: number
          invoice_seq_year?: number | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'hotels_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          id: string
          hotel_id: string | null
          role: 'owner' | 'manager' | 'technician'
          name: string
          email: string
          phone: string | null
          specialty: string | null
          invited_by: string | null
          is_active: boolean | null
          created_at: string | null
        }
        Insert: {
          id: string
          hotel_id?: string | null
          role: 'owner' | 'manager' | 'technician'
          name: string
          email: string
          phone?: string | null
          specialty?: string | null
          invited_by?: string | null
          is_active?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          hotel_id?: string | null
          role?: 'owner' | 'manager' | 'technician'
          name?: string
          email?: string
          phone?: string | null
          specialty?: string | null
          invited_by?: string | null
          is_active?: boolean | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_hotel_id_fkey'
            columns: ['hotel_id']
            isOneToOne: false
            referencedRelation: 'hotels'
            referencedColumns: ['id']
          },
        ]
      }
      rooms: {
        Row: {
          id: string
          hotel_id: string
          number: string
          floor: number | null
          category_id: string | null
          nightly_rate: number | null
          status:
            | 'available'
            | 'occupied'
            | 'maintenance'
            | 'needs_inspection'
            | 'cleaning'
            | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          hotel_id: string
          number: string
          floor?: number | null
          category_id?: string | null
          nightly_rate?: number | null
          status?:
            | 'available'
            | 'occupied'
            | 'maintenance'
            | 'needs_inspection'
            | 'cleaning'
            | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          hotel_id?: string
          number?: string
          floor?: number | null
          category_id?: string | null
          nightly_rate?: number | null
          status?:
            | 'available'
            | 'occupied'
            | 'maintenance'
            | 'needs_inspection'
            | 'cleaning'
            | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'rooms_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'room_categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'rooms_hotel_id_fkey'
            columns: ['hotel_id']
            isOneToOne: false
            referencedRelation: 'hotels'
            referencedColumns: ['id']
          },
        ]
      }
      room_categories: {
        Row: {
          id: string
          hotel_id: string
          name: string
          default_nightly_rate: number
          created_at: string | null
        }
        Insert: {
          id?: string
          hotel_id: string
          name: string
          default_nightly_rate?: number
          created_at?: string | null
        }
        Update: {
          id?: string
          hotel_id?: string
          name?: string
          default_nightly_rate?: number
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'room_categories_hotel_id_fkey'
            columns: ['hotel_id']
            isOneToOne: false
            referencedRelation: 'hotels'
            referencedColumns: ['id']
          },
        ]
      }
      guests: {
        Row: {
          id: string
          hotel_id: string
          room_id: string | null
          name: string
          email: string | null
          phone: string | null
          ghana_card_number: string | null
          token: string | null
          token_expires_at: string | null
          check_in: string | null
          check_out: string | null
          enrolled_by: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          hotel_id: string
          room_id?: string | null
          name: string
          email?: string | null
          phone?: string | null
          ghana_card_number?: string | null
          token?: string | null
          token_expires_at?: string | null
          check_in?: string | null
          check_out?: string | null
          enrolled_by?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          hotel_id?: string
          room_id?: string | null
          name?: string
          email?: string | null
          phone?: string | null
          ghana_card_number?: string | null
          token?: string | null
          token_expires_at?: string | null
          check_in?: string | null
          check_out?: string | null
          enrolled_by?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'guests_hotel_id_fkey'
            columns: ['hotel_id']
            isOneToOne: false
            referencedRelation: 'hotels'
            referencedColumns: ['id']
          },
        ]
      }
      reservations: {
        Row: {
          id: string
          hotel_id: string
          room_id: string | null
          guest_id: string | null
          guest_name: string
          check_in: string
          check_out: string
          status: 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | null
          channel: 'airbnb' | 'booking_com' | 'direct' | 'walk_in' | 'other' | null
          nightly_rate: number | null
          total_amount: number | null
          created_by: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          hotel_id: string
          room_id?: string | null
          guest_id?: string | null
          guest_name: string
          check_in: string
          check_out: string
          status?: 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | null
          channel?: 'airbnb' | 'booking_com' | 'direct' | 'walk_in' | 'other' | null
          nightly_rate?: number | null
          total_amount?: number | null
          created_by?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          hotel_id?: string
          room_id?: string | null
          guest_id?: string | null
          guest_name?: string
          check_in?: string
          check_out?: string
          status?: 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | null
          channel?: 'airbnb' | 'booking_com' | 'direct' | 'walk_in' | 'other' | null
          nightly_rate?: number | null
          total_amount?: number | null
          created_by?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'reservations_hotel_id_fkey'
            columns: ['hotel_id']
            isOneToOne: false
            referencedRelation: 'hotels'
            referencedColumns: ['id']
          },
        ]
      }
      complaints: {
        Row: {
          id: string
          hotel_id: string
          room_id: string | null
          guest_id: string | null
          category:
            | 'plumbing'
            | 'electrical'
            | 'hvac'
            | 'furniture'
            | 'cleaning'
            | 'noise'
            | 'other'
          description: string
          priority: 'low' | 'medium' | 'high' | 'urgent' | null
          status:
            | 'open'
            | 'assigned'
            | 'in_progress'
            | 'pending_approval'
            | 'rejected'
            | 'resolved'
            | null
          assigned_to: string | null
          rejection_note: string | null
          submitted_at: string | null
          resolved_at: string | null
        }
        Insert: {
          id?: string
          hotel_id: string
          room_id?: string | null
          guest_id?: string | null
          category:
            | 'plumbing'
            | 'electrical'
            | 'hvac'
            | 'furniture'
            | 'cleaning'
            | 'noise'
            | 'other'
          description: string
          priority?: 'low' | 'medium' | 'high' | 'urgent' | null
          status?:
            | 'open'
            | 'assigned'
            | 'in_progress'
            | 'pending_approval'
            | 'rejected'
            | 'resolved'
            | null
          assigned_to?: string | null
          rejection_note?: string | null
          submitted_at?: string | null
          resolved_at?: string | null
        }
        Update: {
          id?: string
          hotel_id?: string
          room_id?: string | null
          guest_id?: string | null
          category?:
            | 'plumbing'
            | 'electrical'
            | 'hvac'
            | 'furniture'
            | 'cleaning'
            | 'noise'
            | 'other'
          description?: string
          priority?: 'low' | 'medium' | 'high' | 'urgent' | null
          status?:
            | 'open'
            | 'assigned'
            | 'in_progress'
            | 'pending_approval'
            | 'rejected'
            | 'resolved'
            | null
          assigned_to?: string | null
          rejection_note?: string | null
          submitted_at?: string | null
          resolved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'complaints_hotel_id_fkey'
            columns: ['hotel_id']
            isOneToOne: false
            referencedRelation: 'hotels'
            referencedColumns: ['id']
          },
        ]
      }
      complaint_events: {
        Row: {
          id: string
          complaint_id: string
          actor_id: string | null
          actor_role: string | null
          event_type:
            | 'submitted'
            | 'assigned'
            | 'started'
            | 'completion_requested'
            | 'rejected'
            | 'resolved'
            | 'estimate_submitted'
          note: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          complaint_id: string
          actor_id?: string | null
          actor_role?: string | null
          event_type:
            | 'submitted'
            | 'assigned'
            | 'started'
            | 'completion_requested'
            | 'rejected'
            | 'resolved'
            | 'estimate_submitted'
          note?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          complaint_id?: string
          actor_id?: string | null
          actor_role?: string | null
          event_type?:
            | 'submitted'
            | 'assigned'
            | 'started'
            | 'completion_requested'
            | 'rejected'
            | 'resolved'
            | 'estimate_submitted'
          note?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'complaint_events_complaint_id_fkey'
            columns: ['complaint_id']
            isOneToOne: false
            referencedRelation: 'complaints'
            referencedColumns: ['id']
          },
        ]
      }
      complaint_estimates: {
        Row: {
          id: string
          complaint_id: string
          hotel_id: string
          technician_id: string
          note: string | null
          labour_cost: number
          materials_total: number
          total_cost: number
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          complaint_id: string
          hotel_id: string
          technician_id: string
          note?: string | null
          labour_cost?: number
          materials_total?: number
          total_cost?: number
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          complaint_id?: string
          hotel_id?: string
          technician_id?: string
          note?: string | null
          labour_cost?: number
          materials_total?: number
          total_cost?: number
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'complaint_estimates_complaint_id_fkey'
            columns: ['complaint_id']
            isOneToOne: true
            referencedRelation: 'complaints'
            referencedColumns: ['id']
          },
        ]
      }
      complaint_estimate_items: {
        Row: {
          id: string
          estimate_id: string
          material_name: string
          quantity: number
          unit_cost: number
          line_total: number
          sort_order: number
        }
        Insert: {
          id?: string
          estimate_id: string
          material_name: string
          quantity?: number
          unit_cost?: number
          line_total?: number
          sort_order?: number
        }
        Update: {
          id?: string
          estimate_id?: string
          material_name?: string
          quantity?: number
          unit_cost?: number
          line_total?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: 'complaint_estimate_items_estimate_id_fkey'
            columns: ['estimate_id']
            isOneToOne: false
            referencedRelation: 'complaint_estimates'
            referencedColumns: ['id']
          },
        ]
      }
      invoices: {
        Row: {
          id: string
          hotel_id: string
          reservation_id: string | null
          guest_id: string | null
          guest_name: string
          invoice_number: string | null
          subtotal: number
          vat_amount: number | null
          nhil_amount: number | null
          getfund_amount: number | null
          covid_levy_amount: number | null
          elevy_amount: number | null
          total_amount: number
          payment_method:
            | 'mtn_momo'
            | 'telecel_cash'
            | 'airteltigo'
            | 'visa'
            | 'mastercard'
            | 'cash'
            | 'bank_transfer'
            | null
          payment_status: 'pending' | 'paid' | 'overdue' | 'refunded' | null
          issued_at: string | null
          due_at: string | null
          paid_at: string | null
        }
        Insert: {
          id?: string
          hotel_id: string
          reservation_id?: string | null
          guest_id?: string | null
          guest_name: string
          invoice_number: string | null
          subtotal: number
          vat_amount?: number | null
          nhil_amount?: number | null
          getfund_amount?: number | null
          covid_levy_amount?: number | null
          elevy_amount?: number | null
          total_amount: number
          payment_method?:
            | 'mtn_momo'
            | 'telecel_cash'
            | 'airteltigo'
            | 'visa'
            | 'mastercard'
            | 'cash'
            | 'bank_transfer'
            | null
          payment_status?: 'pending' | 'paid' | 'overdue' | 'refunded' | null
          issued_at?: string | null
          due_at?: string | null
          paid_at?: string | null
        }
        Update: {
          id?: string
          hotel_id?: string
          reservation_id?: string | null
          guest_id?: string | null
          guest_name?: string
          subtotal?: number
          vat_amount?: number | null
          nhil_amount?: number | null
          getfund_amount?: number | null
          covid_levy_amount?: number | null
          elevy_amount?: number | null
          total_amount?: number
          payment_method?:
            | 'mtn_momo'
            | 'telecel_cash'
            | 'airteltigo'
            | 'visa'
            | 'mastercard'
            | 'cash'
            | 'bank_transfer'
            | null
          payment_status?: 'pending' | 'paid' | 'overdue' | 'refunded' | null
          issued_at?: string | null
          due_at?: string | null
          paid_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'invoices_hotel_id_fkey'
            columns: ['hotel_id']
            isOneToOne: false
            referencedRelation: 'hotels'
            referencedColumns: ['id']
          },
        ]
      }
      housekeeping_tasks: {
        Row: {
          id: string
          hotel_id: string
          room_id: string | null
          task_type: 'clean' | 'inspect' | 'maintenance' | 'restock'
          status: 'todo' | 'in_progress' | 'done'
          priority: 'low' | 'medium' | 'high'
          assigned_to: string | null
          notes: string | null
          due_date: string | null
          created_by: string | null
          created_at: string | null
          completed_at: string | null
        }
        Insert: {
          id?: string
          hotel_id: string
          room_id?: string | null
          task_type: 'clean' | 'inspect' | 'maintenance' | 'restock'
          status?: 'todo' | 'in_progress' | 'done'
          priority?: 'low' | 'medium' | 'high'
          assigned_to?: string | null
          notes?: string | null
          due_date?: string | null
          created_by?: string | null
          created_at?: string | null
          completed_at?: string | null
        }
        Update: {
          id?: string
          hotel_id?: string
          room_id?: string | null
          task_type?: 'clean' | 'inspect' | 'maintenance' | 'restock'
          status?: 'todo' | 'in_progress' | 'done'
          priority?: 'low' | 'medium' | 'high'
          assigned_to?: string | null
          notes?: string | null
          due_date?: string | null
          created_by?: string | null
          created_at?: string | null
          completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'housekeeping_tasks_hotel_id_fkey'
            columns: ['hotel_id']
            isOneToOne: false
            referencedRelation: 'hotels'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'housekeeping_tasks_room_id_fkey'
            columns: ['room_id']
            isOneToOne: false
            referencedRelation: 'rooms'
            referencedColumns: ['id']
          },
        ]
      }
      staff_invites: {
        Row: {
          id: string
          hotel_id: string
          email: string
          role: 'manager' | 'technician'
          invited_by: string | null
          token: string
          accepted: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          hotel_id: string
          email: string
          role: 'manager' | 'technician'
          invited_by?: string | null
          token?: string
          accepted?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          hotel_id?: string
          email?: string
          role?: 'manager' | 'technician'
          invited_by?: string | null
          token?: string
          accepted?: boolean | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'staff_invites_hotel_id_fkey'
            columns: ['hotel_id']
            isOneToOne: false
            referencedRelation: 'hotels'
            referencedColumns: ['id']
          },
        ]
      }
      notification_log: {
        Row: {
          id: string
          hotel_id: string | null
          recipient_phone: string
          channel: 'sms' | 'whatsapp'
          template_key: string
          body: string
          provider: string | null
          provider_id: string | null
          status: 'sent' | 'failed' | 'skipped'
          error_message: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          hotel_id?: string | null
          recipient_phone: string
          channel: 'sms' | 'whatsapp'
          template_key: string
          body: string
          provider?: string | null
          provider_id?: string | null
          status?: 'sent' | 'failed' | 'skipped'
          error_message?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          hotel_id?: string | null
          recipient_phone?: string
          channel?: 'sms' | 'whatsapp'
          template_key?: string
          body?: string
          provider?: string | null
          provider_id?: string | null
          status?: 'sent' | 'failed' | 'skipped'
          error_message?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'notification_log_hotel_id_fkey'
            columns: ['hotel_id']
            isOneToOne: false
            referencedRelation: 'hotels'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      allocate_invoice_number: { Args: { p_hotel_id: string }; Returns: string }
      auth_hotel_id: { Args: Record<string, never>; Returns: string }
      auth_role: { Args: Record<string, never>; Returns: string }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
