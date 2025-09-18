import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {Post} from '../types/Post';
import {colors} from '../styles/globalStyles';

interface PostItemProps {
  post: Post;
}

const PostItem: React.FC<PostItemProps> = ({post}) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return 'now';
    } else if (diffInHours < 24) {
      return `${diffInHours}h`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d`;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {post.author ? post.author.charAt(0).toUpperCase() : 'U'}
          </Text>
        </View>
      </View>
      
      <View style={styles.contentContainer}>
        <View style={styles.header}>
          <Text style={styles.author}>{post.author || 'Unknown User'}</Text>
          <Text style={styles.username}>@{post.username || 'user'}</Text>
          <Text style={styles.timestamp}>· {formatDate(post.createdAt)}</Text>
        </View>
        
        {post.title && (
          <Text style={styles.title}>{post.title}</Text>
        )}
        
        <Text style={styles.content}>{post.content}</Text>
        
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionText}>💬 {post.replies || 0}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionText}>🔄 {post.reposts || 0}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionText}>❤️ {post.likes || 0}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionText}>📤</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.darkGray,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.blue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  contentContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  author: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 4,
  },
  username: {
    color: colors.gray,
    fontSize: 16,
    marginRight: 4,
  },
  timestamp: {
    color: colors.gray,
    fontSize: 16,
  },
  title: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  content: {
    color: colors.white,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    maxWidth: 300,
  },
  actionButton: {
    padding: 8,
  },
  actionText: {
    color: colors.gray,
    fontSize: 14,
  },
});

export default PostItem;