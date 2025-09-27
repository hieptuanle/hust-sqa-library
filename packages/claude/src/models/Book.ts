export interface Book {
  id: string;
  title: string;
  author: string;
  publication_year: number;
  added_by?: number;
  created_at?: Date;
}