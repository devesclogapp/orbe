export type Json = | string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type Database = { public: { Tables: Record<string, { Row: any, Insert: any, Update: any }>, Views: Record<string, { Row: any, Insert: any, Update: any }>, Functions: Record<string, any>, Enums: Record<string, any> } };
