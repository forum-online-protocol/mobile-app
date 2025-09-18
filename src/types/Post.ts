export interface Post {
  id: string;
  title?: string;
  content: string;
  author?: string;
  username?: string;
  createdAt: string;
  updatedAt?: string;
  likes?: number;
  replies?: number;
  reposts?: number;
  avatar?: string;
}