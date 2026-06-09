export type Database = {
  public: {
    Tables: {
      players: {
        Row: {
          id: string;
          nickname: string;
          country: string;
          region: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          nickname: string;
          country: string;
          region: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          nickname?: string;
          country?: string;
          region?: string;
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
          points: number | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          player_id: string;
          match_id: string;
          prediction: "home_win" | "draw" | "away_win";
          odds_at_prediction: number;
          points?: number | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          player_id?: string;
          match_id?: string;
          prediction?: "home_win" | "draw" | "away_win";
          odds_at_prediction?: number;
          points?: number | null;
          created_at?: string | null;
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
