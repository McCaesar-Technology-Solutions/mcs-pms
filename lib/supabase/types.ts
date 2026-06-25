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
          guest_portal_slug: string | null
          vat_mode: string
          profile_image_path: string | null
          notification_sms_prefs: Json
          notification_email_prefs: Json
          notification_from_email: string | null
          guest_rules_version: number
          guest_portal_wifi_ssid: string | null
          guest_portal_wifi_password: string | null
          guest_portal_parking: string | null
          guest_portal_emergency_phone: string | null
          guest_portal_check_out_time: string | null
          guest_portal_welcome: string | null
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
          guest_portal_slug?: string | null
          vat_mode?: string
          profile_image_path?: string | null
          notification_sms_prefs?: Json
          notification_email_prefs?: Json
          notification_from_email?: string | null
          guest_rules_version?: number
          guest_portal_wifi_ssid?: string | null
          guest_portal_wifi_password?: string | null
          guest_portal_parking?: string | null
          guest_portal_emergency_phone?: string | null
          guest_portal_check_out_time?: string | null
          guest_portal_welcome?: string | null
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
          guest_portal_slug?: string | null
          vat_mode?: string
          profile_image_path?: string | null
          notification_sms_prefs?: Json
          notification_email_prefs?: Json
          notification_from_email?: string | null
          guest_rules_version?: number
          guest_portal_wifi_ssid?: string | null
          guest_portal_wifi_password?: string | null
          guest_portal_parking?: string | null
          guest_portal_emergency_phone?: string | null
          guest_portal_check_out_time?: string | null
          guest_portal_welcome?: string | null
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
          role: 'owner' | 'manager' | 'technician' | 'receptionist'
          name: string
          email: string
          phone: string | null
          specialty: string | null
          mfa_sms_enabled: boolean | null
          mfa_enabled: boolean
          mfa_method: 'sms' | 'email' | 'totp' | null
          mfa_totp_secret: string | null
          mfa_totp_pending_secret: string | null
          invited_by: string | null
          is_active: boolean | null
          created_at: string | null
        }
        Insert: {
          id: string
          hotel_id?: string | null
          role: 'owner' | 'manager' | 'technician' | 'receptionist'
          name: string
          email: string
          phone?: string | null
          specialty?: string | null
          mfa_sms_enabled?: boolean | null
          mfa_enabled?: boolean
          mfa_method?: 'sms' | 'email' | 'totp' | null
          mfa_totp_secret?: string | null
          mfa_totp_pending_secret?: string | null
          invited_by?: string | null
          is_active?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          hotel_id?: string | null
          role?: 'owner' | 'manager' | 'technician' | 'receptionist'
          name?: string
          email?: string
          phone?: string | null
          specialty?: string | null
          mfa_sms_enabled?: boolean | null
          mfa_enabled?: boolean
          mfa_method?: 'sms' | 'email' | 'totp' | null
          mfa_totp_secret?: string | null
          mfa_totp_pending_secret?: string | null
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
          monthly_rate: number | null
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
          monthly_rate?: number | null
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
          monthly_rate?: number | null
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
          default_monthly_rate: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          hotel_id: string
          name: string
          default_nightly_rate?: number
          default_monthly_rate?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          hotel_id?: string
          name?: string
          default_nightly_rate?: number
          default_monthly_rate?: number | null
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
      hotel_guest_rules: {
        Row: {
          id: string
          hotel_id: string
          rule_text: string
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          hotel_id: string
          rule_text: string
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          hotel_id?: string
          rule_text?: string
          sort_order?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'hotel_guest_rules_hotel_id_fkey'
            columns: ['hotel_id']
            isOneToOne: false
            referencedRelation: 'hotels'
            referencedColumns: ['id']
          },
        ]
      }
      hotel_local_guide: {
        Row: {
          id: string
          hotel_id: string
          title: string
          body: string
          sort_order: number
          created_at: string | null
        }
        Insert: {
          id?: string
          hotel_id: string
          title: string
          body: string
          sort_order?: number
          created_at?: string | null
        }
        Update: {
          id?: string
          hotel_id?: string
          title?: string
          body?: string
          sort_order?: number
          created_at?: string | null
        }
        Relationships: []
      }
      guest_requests: {
        Row: {
          id: string
          hotel_id: string
          guest_id: string
          room_id: string | null
          request_type: 'housekeeping' | 'late_checkout' | 'extension' | 'self_checkout'
          note: string | null
          status: 'pending' | 'acknowledged' | 'completed' | 'declined'
          requested_date: string | null
          requested_time: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          hotel_id: string
          guest_id: string
          room_id?: string | null
          request_type: 'housekeeping' | 'late_checkout' | 'extension' | 'self_checkout'
          note?: string | null
          status?: 'pending' | 'acknowledged' | 'completed' | 'declined'
          requested_date?: string | null
          requested_time?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          hotel_id?: string
          guest_id?: string
          room_id?: string | null
          request_type?: 'housekeeping' | 'late_checkout' | 'extension' | 'self_checkout'
          note?: string | null
          status?: 'pending' | 'acknowledged' | 'completed' | 'declined'
          requested_date?: string | null
          requested_time?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      guest_feedback: {
        Row: {
          id: string
          hotel_id: string
          guest_id: string
          complaint_id: string | null
          rating: number
          comment: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          hotel_id: string
          guest_id: string
          complaint_id?: string | null
          rating: number
          comment?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          hotel_id?: string
          guest_id?: string
          complaint_id?: string | null
          rating?: number
          comment?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      complaint_messages: {
        Row: {
          id: string
          complaint_id: string
          author_role: 'guest' | 'staff'
          author_id: string | null
          body: string
          created_at: string | null
        }
        Insert: {
          id?: string
          complaint_id: string
          author_role: 'guest' | 'staff'
          author_id?: string | null
          body: string
          created_at?: string | null
        }
        Update: {
          id?: string
          complaint_id?: string
          author_role?: 'guest' | 'staff'
          author_id?: string | null
          body?: string
          created_at?: string | null
        }
        Relationships: []
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
          guest_rules_accepted_version: number | null
          do_not_disturb: boolean
          guest_photo_path: string | null
          guest_photo_mime: string | null
          pre_arrival_eta: string | null
          pre_arrival_notes: string | null
          pre_arrival_id_path: string | null
          pre_arrival_id_mime: string | null
          pre_arrival_submitted_at: string | null
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
          guest_rules_accepted_version?: number | null
          do_not_disturb?: boolean
          guest_photo_path?: string | null
          guest_photo_mime?: string | null
          pre_arrival_eta?: string | null
          pre_arrival_notes?: string | null
          pre_arrival_id_path?: string | null
          pre_arrival_id_mime?: string | null
          pre_arrival_submitted_at?: string | null
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
          guest_rules_accepted_version?: number | null
          do_not_disturb?: boolean
          guest_photo_path?: string | null
          guest_photo_mime?: string | null
          pre_arrival_eta?: string | null
          pre_arrival_notes?: string | null
          pre_arrival_id_path?: string | null
          pre_arrival_id_mime?: string | null
          pre_arrival_submitted_at?: string | null
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
          status: 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show' | null
          channel: 'airbnb' | 'booking_com' | 'direct' | 'walk_in' | 'other' | null
          rate_type: 'nightly' | 'monthly' | null
          nightly_rate: number | null
          monthly_rate: number | null
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
          status?: 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show' | null
          channel?: 'airbnb' | 'booking_com' | 'direct' | 'walk_in' | 'other' | null
          rate_type?: 'nightly' | 'monthly' | null
          nightly_rate?: number | null
          monthly_rate?: number | null
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
          status?: 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show' | null
          channel?: 'airbnb' | 'booking_com' | 'direct' | 'walk_in' | 'other' | null
          rate_type?: 'nightly' | 'monthly' | null
          nightly_rate?: number | null
          monthly_rate?: number | null
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
          approval_stage: 'estimate' | 'completion' | null
          estimate_approved_at: string | null
          scheduled_visit_at: string | null
          scheduled_visit_by: 'guest' | 'manager' | 'owner' | 'technician' | null
          guest_completion_approved_at: string | null
          rejection_note: string | null
          submitted_at: string | null
          resolved_at: string | null
          sla_due_at: string | null
          guest_photo_path: string | null
          guest_photo_mime: string | null
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
          approval_stage?: 'estimate' | 'completion' | null
          estimate_approved_at?: string | null
          scheduled_visit_at?: string | null
          scheduled_visit_by?: 'guest' | 'manager' | 'owner' | 'technician' | null
          guest_completion_approved_at?: string | null
          rejection_note?: string | null
          submitted_at?: string | null
          resolved_at?: string | null
          sla_due_at?: string | null
          guest_photo_path?: string | null
          guest_photo_mime?: string | null
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
          approval_stage?: 'estimate' | 'completion' | null
          estimate_approved_at?: string | null
          scheduled_visit_at?: string | null
          scheduled_visit_by?: 'guest' | 'manager' | 'owner' | 'technician' | null
          guest_completion_approved_at?: string | null
          rejection_note?: string | null
          submitted_at?: string | null
          resolved_at?: string | null
          sla_due_at?: string | null
          guest_photo_path?: string | null
          guest_photo_mime?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'complaints_hotel_id_fkey'
            columns: ['hotel_id']
            isOneToOne: false
            referencedRelation: 'hotels'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'complaints_room_id_fkey'
            columns: ['room_id']
            isOneToOne: false
            referencedRelation: 'rooms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'complaints_guest_id_fkey'
            columns: ['guest_id']
            isOneToOne: false
            referencedRelation: 'guests'
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
            | 'estimate_approved'
            | 'visit_scheduled'
            | 'guest_completion_approved'
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
            | 'estimate_approved'
            | 'visit_scheduled'
            | 'guest_completion_approved'
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
            | 'estimate_approved'
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
          invoice_file_path: string | null
          invoice_file_name: string | null
          invoice_file_mime: string | null
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
          invoice_file_path?: string | null
          invoice_file_name?: string | null
          invoice_file_mime?: string | null
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
          invoice_file_path?: string | null
          invoice_file_name?: string | null
          invoice_file_mime?: string | null
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
          {
            foreignKeyName: 'invoices_reservation_id_fkey'
            columns: ['reservation_id']
            isOneToOne: false
            referencedRelation: 'reservations'
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
          phone: string | null
          role: 'manager' | 'technician' | 'receptionist'
          invited_by: string | null
          token: string
          accepted: boolean | null
          created_at: string | null
          expires_at: string | null
        }
        Insert: {
          id?: string
          hotel_id: string
          email: string
          phone?: string | null
          role: 'manager' | 'technician' | 'receptionist'
          invited_by?: string | null
          token?: string
          accepted?: boolean | null
          created_at?: string | null
          expires_at?: string | null
        }
        Update: {
          id?: string
          hotel_id?: string
          email?: string
          phone?: string | null
          role?: 'manager' | 'technician' | 'receptionist'
          invited_by?: string | null
          token?: string
          accepted?: boolean | null
          created_at?: string | null
          expires_at?: string | null
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
      mfa_otp_challenges: {
        Row: {
          id: string
          user_id: string
          code_hash: string
          expires_at: string
          consumed_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          code_hash: string
          expires_at: string
          consumed_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          code_hash?: string
          expires_at?: string
          consumed_at?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'mfa_otp_challenges_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      mfa_verified_sessions: {
        Row: {
          id: string
          user_id: string
          session_key: string
          verified_at: string
          expires_at: string
        }
        Insert: {
          id?: string
          user_id: string
          session_key: string
          verified_at?: string
          expires_at: string
        }
        Update: {
          id?: string
          user_id?: string
          session_key?: string
          verified_at?: string
          expires_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'mfa_verified_sessions_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      audit_log: {
        Row: {
          id: string
          hotel_id: string
          actor_id: string | null
          actor_name: string | null
          entity_type: string
          entity_id: string | null
          action: string
          summary: string
          details: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          hotel_id: string
          actor_id?: string | null
          actor_name?: string | null
          entity_type: string
          entity_id?: string | null
          action: string
          summary: string
          details?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          hotel_id?: string
          actor_id?: string | null
          actor_name?: string | null
          entity_type?: string
          entity_id?: string | null
          action?: string
          summary?: string
          details?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'audit_log_hotel_id_fkey'
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
          recipient_phone: string | null
          recipient_email: string | null
          channel: 'sms' | 'whatsapp' | 'email'
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
          recipient_phone?: string | null
          recipient_email?: string | null
          channel: 'sms' | 'whatsapp' | 'email'
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
          recipient_phone?: string | null
          recipient_email?: string | null
          channel?: 'sms' | 'whatsapp' | 'email'
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
      action_rate_limits: {
        Row: { id: string; rate_key: string; created_at: string | null }
        Insert: { id?: string; rate_key: string; created_at?: string | null }
        Update: { id?: string; rate_key?: string; created_at?: string | null }
        Relationships: []
      }
      guest_charges: {
        Row: {
          id: string
          hotel_id: string
          guest_id: string
          reservation_id: string | null
          description: string
          amount: number
          charge_type: 'room' | 'incidental' | 'tax' | 'deposit' | 'adjustment'
          posted_by: string | null
          invoice_id: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          hotel_id: string
          guest_id: string
          reservation_id?: string | null
          description: string
          amount: number
          charge_type?: 'room' | 'incidental' | 'tax' | 'deposit' | 'adjustment'
          posted_by?: string | null
          invoice_id?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          hotel_id?: string
          guest_id?: string
          reservation_id?: string | null
          description?: string
          amount?: number
          charge_type?: 'room' | 'incidental' | 'tax' | 'deposit' | 'adjustment'
          posted_by?: string | null
          invoice_id?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      night_audits: {
        Row: {
          id: string
          hotel_id: string
          business_date: string
          closed_by: string | null
          rooms_occupied: number
          rooms_available: number
          arrivals: number
          departures: number
          revenue_posted: number
          notes: string | null
          closed_at: string | null
        }
        Insert: {
          id?: string
          hotel_id: string
          business_date: string
          closed_by?: string | null
          rooms_occupied?: number
          rooms_available?: number
          arrivals?: number
          departures?: number
          revenue_posted?: number
          notes?: string | null
          closed_at?: string | null
        }
        Update: {
          id?: string
          hotel_id?: string
          business_date?: string
          closed_by?: string | null
          rooms_occupied?: number
          rooms_available?: number
          arrivals?: number
          departures?: number
          revenue_posted?: number
          notes?: string | null
          closed_at?: string | null
        }
        Relationships: []
      }
      payment_records: {
        Row: {
          id: string
          hotel_id: string
          invoice_id: string | null
          guest_id: string | null
          provider: 'paystack' | 'hubtel' | 'manual'
          provider_reference: string | null
          amount: number
          currency: string
          status: 'pending' | 'success' | 'failed' | 'refunded'
          metadata: Json | null
          idempotency_key: string | null
          created_at: string | null
          completed_at: string | null
        }
        Insert: {
          id?: string
          hotel_id: string
          invoice_id?: string | null
          guest_id?: string | null
          provider: 'paystack' | 'hubtel' | 'manual'
          provider_reference?: string | null
          amount: number
          currency?: string
          status?: 'pending' | 'success' | 'failed' | 'refunded'
          metadata?: Json | null
          idempotency_key?: string | null
          created_at?: string | null
          completed_at?: string | null
        }
        Update: {
          id?: string
          hotel_id?: string
          invoice_id?: string | null
          guest_id?: string | null
          provider?: 'paystack' | 'hubtel' | 'manual'
          provider_reference?: string | null
          amount?: number
          currency?: string
          status?: 'pending' | 'success' | 'failed' | 'refunded'
          metadata?: Json | null
          idempotency_key?: string | null
          created_at?: string | null
          completed_at?: string | null
        }
        Relationships: []
      }
      notification_outbox: {
        Row: {
          id: string
          hotel_id: string | null
          channel: 'sms' | 'email' | 'whatsapp'
          recipient: string
          template_key: string
          payload: Json
          idempotency_key: string | null
          status: 'pending' | 'processing' | 'sent' | 'failed' | 'dead'
          attempts: number
          max_attempts: number
          next_retry_at: string | null
          last_error: string | null
          provider_id: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          hotel_id?: string | null
          channel: 'sms' | 'email' | 'whatsapp'
          recipient: string
          template_key: string
          payload: Json
          idempotency_key?: string | null
          status?: 'pending' | 'processing' | 'sent' | 'failed' | 'dead'
          attempts?: number
          max_attempts?: number
          next_retry_at?: string | null
          last_error?: string | null
          provider_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          hotel_id?: string | null
          channel?: 'sms' | 'email' | 'whatsapp'
          recipient?: string
          template_key?: string
          payload?: Json
          idempotency_key?: string | null
          status?: 'pending' | 'processing' | 'sent' | 'failed' | 'dead'
          attempts?: number
          max_attempts?: number
          next_retry_at?: string | null
          last_error?: string | null
          provider_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
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
