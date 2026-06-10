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
          gta_license_number: string | null
          gta_license_expiry: string | null
          vat_registration_number: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          address?: string | null
          gta_license_number?: string | null
          gta_license_expiry?: string | null
          vat_registration_number?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          address?: string | null
          gta_license_number?: string | null
          gta_license_expiry?: string | null
          vat_registration_number?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          hotel_id: string | null
          role: 'owner' | 'manager' | 'technician'
          name: string
          email: string
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
          type: 'standard' | 'deluxe' | 'suite' | null
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
          type?: 'standard' | 'deluxe' | 'suite' | null
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
          type?: 'standard' | 'deluxe' | 'suite' | null
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
            foreignKeyName: 'rooms_hotel_id_fkey'
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
          token: string
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
          token?: string
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
          token?: string
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
      invoices: {
        Row: {
          id: string
          hotel_id: string
          reservation_id: string | null
          guest_id: string | null
          guest_name: string
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
    }
    Views: Record<string, never>
    Functions: {
      auth_hotel_id: { Args: Record<string, never>; Returns: string }
      auth_role: { Args: Record<string, never>; Returns: string }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
