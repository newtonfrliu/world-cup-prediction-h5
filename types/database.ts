export type Database = {
  public: {
    Tables: {
      players: {
        Row: {
          id: string;
          nickname: string;
          country: string;
          region: string;
          coins: number;
          last_login_reward_date: string | null;
          avatar_id: string | null;
          referred_by: string | null;
          equipped_card_id: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          nickname: string;
          country: string;
          region: string;
          coins?: number;
          last_login_reward_date?: string | null;
          avatar_id?: string | null;
          referred_by?: string | null;
          equipped_card_id?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          nickname?: string;
          country?: string;
          region?: string;
          coins?: number;
          last_login_reward_date?: string | null;
          avatar_id?: string | null;
          referred_by?: string | null;
          equipped_card_id?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      matches: {
        Row: {
          id: string;
          home_team: string;
          away_team: string;
          start_time: string;
          odds_home: number;
          odds_draw: number;
          odds_away: number;
          stage: string | null;
          venue: string | null;
          result: "home_win" | "draw" | "away_win" | null;
          status: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          home_team: string;
          away_team: string;
          start_time: string;
          odds_home: number;
          odds_draw: number;
          odds_away: number;
          stage?: string | null;
          venue?: string | null;
          result?: "home_win" | "draw" | "away_win" | null;
          status?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          home_team?: string;
          away_team?: string;
          start_time?: string;
          odds_home?: number;
          odds_draw?: number;
          odds_away?: number;
          stage?: string | null;
          venue?: string | null;
          result?: "home_win" | "draw" | "away_win" | null;
          status?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      predictions: {
        Row: {
          id: string;
          player_id: string;
          match_id: string;
          prediction: "home_win" | "draw" | "away_win";
          odds_at_prediction: number;
          stake: number;
          payout: number;
          status: string | null;
          settled_at: string | null;
          points: number | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          player_id: string;
          match_id: string;
          prediction: "home_win" | "draw" | "away_win";
          odds_at_prediction: number;
          stake?: number;
          payout?: number;
          status?: string | null;
          settled_at?: string | null;
          points?: number | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          player_id?: string;
          match_id?: string;
          prediction?: "home_win" | "draw" | "away_win";
          odds_at_prediction?: number;
          stake?: number;
          payout?: number;
          status?: string | null;
          settled_at?: string | null;
          points?: number | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      system_settings: {
        Row: {
          key: string;
          value: string;
          updated_at: string | null;
        };
        Insert: {
          key: string;
          value: string;
          updated_at?: string | null;
        };
        Update: {
          key?: string;
          value?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      coin_transactions: {
        Row: {
          id: string;
          player_id: string;
          amount: number;
          type: string;
          related_id: string | null;
          related_player_id: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          player_id: string;
          amount: number;
          type: string;
          related_id?: string | null;
          related_player_id?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          player_id?: string;
          amount?: number;
          type?: string;
          related_id?: string | null;
          related_player_id?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      player_cards: {
        Row: {
          id: string;
          team: string;
          player_name: string;
          player_name_en: string | null;
          position: string | null;
          shirt_number: number | null;
          rarity: string;
          price: number;
          star_level: number;
          roster_source: string | null;
          roster_version: string | null;
          card_image: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          team: string;
          player_name: string;
          player_name_en?: string | null;
          position?: string | null;
          shirt_number?: number | null;
          rarity?: string;
          price?: number;
          star_level?: number;
          roster_source?: string | null;
          roster_version?: string | null;
          card_image?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          team?: string;
          player_name?: string;
          player_name_en?: string | null;
          position?: string | null;
          shirt_number?: number | null;
          rarity?: string;
          price?: number;
          star_level?: number;
          roster_source?: string | null;
          roster_version?: string | null;
          card_image?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      user_cards: {
        Row: {
          id: string;
          player_id: string;
          card_id: string;
          acquired_at: string | null;
        };
        Insert: {
          id?: string;
          player_id: string;
          card_id: string;
          acquired_at?: string | null;
        };
        Update: {
          id?: string;
          player_id?: string;
          card_id?: string;
          acquired_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      leaderboard: {
        Row: {
          nickname: string;
          country: string;
          region: string;
          total_points: number;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
