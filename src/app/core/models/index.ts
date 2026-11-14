export interface Profile {
  id: string;
  display_name: string;
  turn_order: number;
}

export interface Week {
  id: number;
  week_start: string;      // ISO yyyy-MM-dd (lunes)
  responsible_id: string;
}

export interface Play {
  id: number;
  week_id: number;
  draw_date: string;
  numbers: number[];
  stars: number[];
  price: number;
  created_by: string;
  created_at: string;
}

export interface Prize {
  id: number;
  play_id: number;
  category: string | null;
  amount: number;
  created_at: string;
}

export interface WeeklyBalance {
  week_id: number;
  week_start: string;
  responsible: string;
  plays_count: number;
  invested: number;
  won: number;
  balance: number;
}
