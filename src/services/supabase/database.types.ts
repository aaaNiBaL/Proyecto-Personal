export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type Relationship = {
  foreignKeyName: string
  columns: string[]
  isOneToOne: boolean
  referencedRelation: string
  referencedColumns: string[]
}

type Table<
  Row,
  Insert,
  Update = Partial<Insert>,
  Relationships extends Relationship[] = Relationship[],
> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: Relationships
}

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        {
          user_id: string
          username: string
          display_name: string
          bio: string
          is_public: boolean
          show_favorites: boolean
          show_achievements: boolean
          notify_contributions: boolean
          notify_news: boolean
          created_at: string
          updated_at: string
        },
        {
          user_id: string
          username?: string
          display_name?: string
          bio?: string
          is_public?: boolean
          show_favorites?: boolean
          show_achievements?: boolean
          notify_contributions?: boolean
          notify_news?: boolean
          created_at?: string
          updated_at?: string
        },
        {
          username?: string
          display_name?: string
          bio?: string
          is_public?: boolean
          show_favorites?: boolean
          show_achievements?: boolean
          notify_contributions?: boolean
          notify_news?: boolean
          updated_at?: string
        }
      >
      manga: Table<
        {
          id: string
          canonical_title: string
          synopsis: string | null
          publication_status: string
          start_year: number | null
          visibility: string
          created_at: string
          updated_at: string
        },
        never,
        never
      >
      library_entries: Table<
        {
          id: string
          user_id: string
          manga_id: string
          reading_status: 'to_read' | 'reading' | 'paused' | 'completed' | 'dropped'
          last_chapter: string | null
          private_notes: string | null
          personal_rating: number | null
          started_on: string | null
          finished_on: string | null
          created_at: string
          updated_at: string
        },
        {
          id?: string
          user_id: string
          manga_id: string
          reading_status?: 'to_read' | 'reading' | 'paused' | 'completed' | 'dropped'
          last_chapter?: string | null
          private_notes?: string | null
          personal_rating?: number | null
          started_on?: string | null
          finished_on?: string | null
          created_at?: string
          updated_at?: string
        },
        {
          reading_status?: 'to_read' | 'reading' | 'paused' | 'completed' | 'dropped'
          last_chapter?: string | null
          private_notes?: string | null
          personal_rating?: number | null
          started_on?: string | null
          finished_on?: string | null
          updated_at?: string
        },
        [{
          foreignKeyName: 'library_entries_manga_id_fkey'
          columns: ['manga_id']
          isOneToOne: false
          referencedRelation: 'manga'
          referencedColumns: ['id']
        }]
      >
      manga_favorites: Table<
        {
          user_id: string
          manga_id: string
          created_at: string
        },
        {
          user_id: string
          manga_id: string
          created_at?: string
        },
        never,
        [{
          foreignKeyName: 'manga_favorites_manga_id_fkey'
          columns: ['manga_id']
          isOneToOne: false
          referencedRelation: 'manga'
          referencedColumns: ['id']
        }]
      >
      achievements: Table<
        {
          id: string
          slug: string
          title: string
          description: string
          criteria_type: 'library_count' | 'reading_count' | 'completed_count' | 'chapter_count'
          threshold: number
          sort_order: number
        },
        never,
        never
      >
      user_achievements: Table<
        {
          user_id: string
          achievement_id: string
          unlocked_at: string
        },
        never,
        never,
        [{
          foreignKeyName: 'user_achievements_achievement_id_fkey'
          columns: ['achievement_id']
          isOneToOne: false
          referencedRelation: 'achievements'
          referencedColumns: ['id']
        }]
      >
      personal_links: Table<
        {
          id: string
          library_entry_id: string
          label: string
          url: string
          created_at: string
        },
        {
          id?: string
          library_entry_id: string
          label: string
          url: string
          created_at?: string
        },
        { label?: string; url?: string },
        [{
          foreignKeyName: 'personal_links_library_entry_id_fkey'
          columns: ['library_entry_id']
          isOneToOne: false
          referencedRelation: 'library_entries'
          referencedColumns: ['id']
        }]
      >
      catalog_contributions: Table<
        {
          id: string
          manga_id: string
          author_id: string
          contribution_type: 'metadata' | 'alias'
          proposed_changes: Json
          source_url: string
          note: string | null
          status: 'pending' | 'approved' | 'rejected'
          reviewer_id: string | null
          review_note: string | null
          reviewed_at: string | null
          created_at: string
        },
        never,
        never
      >
      catalog_revisions: Table<
        {
          id: string
          manga_id: string
          contribution_id: string
          actor_id: string
          field_key: string
          previous_value: Json | null
          new_value: Json | null
          created_at: string
        },
        never,
        never
      >
      manga_reviews: Table<
        {
          id: string
          manga_id: string
          author_id: string
          rating: number
          review_text: string | null
          contains_spoilers: boolean
          created_at: string
          updated_at: string
        },
        {
          id?: string
          manga_id: string
          author_id: string
          rating: number
          review_text?: string | null
          contains_spoilers?: boolean
          created_at?: string
          updated_at?: string
        },
        {
          rating?: number
          review_text?: string | null
          contains_spoilers?: boolean
          updated_at?: string
        },
        [{
          foreignKeyName: 'manga_reviews_manga_id_fkey'
          columns: ['manga_id']
          isOneToOne: false
          referencedRelation: 'manga'
          referencedColumns: ['id']
        }]
      >
      manga_lists: Table<
        {
          id: string
          user_id: string
          title: string
          description: string
          is_public: boolean
          created_at: string
          updated_at: string
        },
        {
          id?: string
          user_id: string
          title: string
          description?: string
          is_public?: boolean
          created_at?: string
          updated_at?: string
        },
        {
          title?: string
          description?: string
          is_public?: boolean
          updated_at?: string
        }
      >
      manga_list_items: Table<
        {
          list_id: string
          manga_id: string
          created_at: string
        },
        {
          list_id: string
          manga_id: string
          created_at?: string
        },
        never,
        [{
          foreignKeyName: 'manga_list_items_list_id_fkey'
          columns: ['list_id']
          isOneToOne: false
          referencedRelation: 'manga_lists'
          referencedColumns: ['id']
        }, {
          foreignKeyName: 'manga_list_items_manga_id_fkey'
          columns: ['manga_id']
          isOneToOne: false
          referencedRelation: 'manga'
          referencedColumns: ['id']
        }]
      >
      community_reports: Table<
        {
          id: string
          reporter_id: string
          target_type: 'review' | 'profile' | 'list' | 'comment'
          target_id: string
          reason: 'spam' | 'harassment' | 'spoilers' | 'inappropriate' | 'other'
          details: string
          status: 'pending' | 'resolved' | 'dismissed'
          moderator_id: string | null
          moderator_note: string | null
          created_at: string
          reviewed_at: string | null
        },
        never,
        never
      >
      community_comments: Table<
        {
          id: string
          manga_id: string | null
          review_id: string | null
          author_id: string
          comment_text: string
          created_at: string
        },
        never,
        never,
        [{
          foreignKeyName: 'community_comments_manga_id_fkey'
          columns: ['manga_id']
          isOneToOne: false
          referencedRelation: 'manga'
          referencedColumns: ['id']
        }, {
          foreignKeyName: 'community_comments_review_id_fkey'
          columns: ['review_id']
          isOneToOne: false
          referencedRelation: 'manga_reviews'
          referencedColumns: ['id']
        }]
      >
    }
    Views: {}
    Functions: {
      search_manga: {
        Args: {
          search_query?: string | null
          filter_status?: string | null
          filter_year?: number | null
          filter_genre?: string | null
          result_limit?: number
          result_offset?: number
        }
        Returns: {
          id: string
          canonical_title: string
          original_title: string | null
          publication_status: string
          start_year: number | null
          aliases: string[]
          genres: string[]
          creators: string[]
          match_title: string | null
        }[]
      }
      list_catalog_genres: {
        Args: Record<string, never>
        Returns: { slug: string; name: string }[]
      }
      get_manga_detail: {
        Args: { manga_id: string }
        Returns: Json
      }
      is_catalog_editor: {
        Args: Record<string, never>
        Returns: boolean
      }
      is_catalog_moderator: {
        Args: Record<string, never>
        Returns: boolean
      }
      submit_catalog_contribution: {
        Args: {
          target_manga_id: string
          requested_type: string
          changes: Json
          reference_url: string
          contributor_note?: string | null
        }
        Returns: string
      }
      review_catalog_contribution: {
        Args: {
          target_contribution_id: string
          decision: string
          moderator_note?: string | null
        }
        Returns: undefined
      }
      list_pending_catalog_contributions: {
        Args: Record<string, never>
        Returns: {
          id: string
          manga_id: string
          manga_title: string
          author_id: string
          contribution_type: string
          proposed_changes: Json
          source_url: string
          note: string | null
          created_at: string
        }[]
      }
      get_manga_reviews: {
        Args: { target_manga_id: string }
        Returns: Json
      }
      get_popular_manga: {
        Args: { result_limit?: number }
        Returns: {
          id: string
          canonical_title: string
          average_rating: number
          rating_count: number
        }[]
      }
      get_public_profile: {
        Args: { target_username: string }
        Returns: Json
      }
      add_manga_to_list: {
        Args: { target_list_id: string; target_manga_id: string }
        Returns: undefined
      }
      get_public_manga_list: {
        Args: { target_list_id: string }
        Returns: Json
      }
      submit_community_report: {
        Args: {
          target_type: string
          target_id: string
          reason: string
          details?: string
        }
        Returns: string
      }
      list_pending_community_reports: {
        Args: Record<string, never>
        Returns: {
          id: string
          target_type: string
          target_id: string
          target_title: string | null
          target_excerpt: string | null
          target_path: string | null
          reporter_username: string
          reason: string
          details: string
          created_at: string
        }[]
      }
      review_community_report: {
        Args: {
          target_report_id: string
          decision: string
          moderator_note?: string | null
        }
        Returns: undefined
      }
      create_community_comment: {
        Args: {
          comment_target_type: string
          comment_target_id: string
          comment_body: string
        }
        Returns: string
      }
      get_community_comments: {
        Args: {
          comment_target_type: string
          comment_target_id: string
        }
        Returns: Json
      }
    }
    Enums: {}
    CompositeTypes: {}
  }
}
