import {Post} from '../types/Post';

const API_BASE_URL = 'https://forum-api-production-42de.up.railway.app';

export const fetchPosts = async (): Promise<Post[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/posts/feed`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.posts && Array.isArray(data.posts)) {
      return data.posts.map(transformPost);
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching posts:', error);
    return [];
  }
};

const transformPost = (apiPost: any): Post => {
  return {
    id: apiPost.id,
    content: apiPost.content,
    author: apiPost.author?.displayName || apiPost.author?.username,
    username: apiPost.author?.username,
    createdAt: apiPost.timestamp,
    likes: apiPost.likes,
    replies: apiPost.replies,
    reposts: apiPost.reposts,
    avatar: apiPost.author?.avatar,
  };
};