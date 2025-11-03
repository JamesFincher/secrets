/**
 * Database Types
 *
 * TypeScript types generated from Supabase schema.
 * These types will be auto-generated in production using `supabase gen types typescript`.
 *
 * For now, we define them manually based on our schema documentation.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          created_at: string
          updated_at: string
          owner_id: string
          settings: Json | null
        }
        Insert: {
          id?: string
          name: string
          slug: string
          created_at?: string
          updated_at?: string
          owner_id: string
          settings?: Json | null
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          created_at?: string
          updated_at?: string
          owner_id?: string
          settings?: Json | null
        }
      }
      organization_members: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          role: 'owner' | 'admin' | 'developer' | 'read_only'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          role: 'owner' | 'admin' | 'developer' | 'read_only'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string
          role?: 'owner' | 'admin' | 'developer' | 'read_only'
          created_at?: string
          updated_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          organization_id: string
          name: string
          description: string | null
          created_at: string
          updated_at: string
          created_by: string
          archived: boolean
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          description?: string | null
          created_at?: string
          updated_at?: string
          created_by: string
          archived?: boolean
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          description?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string
          archived?: boolean
        }
      }
      environments: {
        Row: {
          id: string
          project_id: string
          name: string
          slug: string
          description: string | null
          created_at: string
          updated_at: string
          sort_order: number
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          slug: string
          description?: string | null
          created_at?: string
          updated_at?: string
          sort_order?: number
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          slug?: string
          description?: string | null
          created_at?: string
          updated_at?: string
          sort_order?: number
        }
      }
      secrets: {
        Row: {
          id: string
          project_id: string
          environment_id: string
          key: string
          // Envelope encryption fields (matching migration schema)
          encrypted_value: string        // Base64-encoded ciphertext
          encrypted_dek: string           // Base64-encoded encrypted DEK
          secret_nonce: string            // Base64-encoded 12-byte nonce
          dek_nonce: string               // Base64-encoded 12-byte nonce
          auth_tag: string                // Base64-encoded 16-byte auth tag
          algorithm: string               // 'AES-256-GCM'
          // Metadata fields
          description: string | null
          service_name: string | null
          tags: string[]
          created_at: string
          updated_at: string
          created_by: string
          last_accessed_at: string | null
        }
        Insert: {
          id?: string
          project_id: string
          environment_id: string
          key: string
          // Envelope encryption fields
          encrypted_value: string
          encrypted_dek: string
          secret_nonce: string
          dek_nonce: string
          auth_tag: string
          algorithm?: string              // Default: 'AES-256-GCM'
          // Metadata fields
          description?: string | null
          service_name?: string | null
          tags?: string[]
          created_at?: string
          updated_at?: string
          created_by: string
          last_accessed_at?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          environment_id?: string
          key?: string
          // Envelope encryption fields
          encrypted_value?: string
          encrypted_dek?: string
          secret_nonce?: string
          dek_nonce?: string
          auth_tag?: string
          algorithm?: string
          // Metadata fields
          description?: string | null
          service_name?: string | null
          tags?: string[]
          created_at?: string
          updated_at?: string
          created_by?: string
          last_accessed_at?: string | null
        }
      }
      audit_logs: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          action: string
          resource_type: string
          resource_id: string
          metadata: Json | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          action: string
          resource_type: string
          resource_id: string
          metadata?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string
          action?: string
          resource_type?: string
          resource_id?: string
          metadata?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
      }
      user_preferences: {
        Row: {
          user_id: string
          master_password_verification: Json
          theme: string
          notifications_enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          master_password_verification: Json
          theme?: string
          notifications_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          master_password_verification?: Json
          theme?: string
          notifications_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      conversations: {
        Row: {
          id: string
          user_id: string
          organization_id: string
          title: string | null
          context: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          organization_id: string
          title?: string | null
          context?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          organization_id?: string
          title?: string | null
          context?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          role: 'user' | 'assistant' | 'system'
          content: string
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          role: 'user' | 'assistant' | 'system'
          content: string
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          role?: 'user' | 'assistant' | 'system'
          content?: string
          metadata?: Json | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      role: 'owner' | 'admin' | 'developer' | 'read_only'
      message_role: 'user' | 'assistant' | 'system'
    }
  }
}
