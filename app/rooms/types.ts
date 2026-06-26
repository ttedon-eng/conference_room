export type RoomRow = {
  id: string;
  name: string;
  room_number: string;
  capacity: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
};
