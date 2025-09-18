import React from 'react';
import { Text, ViewStyle } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

// Type for icon variants
export type IconVariant = 'outline' | 'filled' | 'sharp';

// Common icon names based on what's available in Ionicons
export type IconName = 
  | 'arrow-up' | 'arrow-down' | 'arrow-back' | 'arrow-forward'
  | 'person' | 'wallet' | 'card' | 'lock-closed' | 'settings' | 'settings-outline'
  | 'notifications' | 'chatbubble' | 'heart' | 'star'
  | 'add' | 'remove' | 'close' | 'checkmark'
  | 'search' | 'home' | 'calendar' | 'camera'
  | 'image' | 'document' | 'download' | 'cloud-upload'
  | 'menu' | 'ellipsis-horizontal' | 'ellipsis-vertical'
  | 'eye' | 'eye-off' | 'refresh' | 'sync' | 'share'
  | 'chevron-down' | 'chevron-right' | 'chevron-forward'
  | 'warning' | 'ballot' | 'bulb' | 'moon' | 'help-circle'
  | 'send' | 'card-outline' | 'arrow-up-right'
  | 'arrow-down-left' | 'shield' | 'sparkles' | 'link'
  | 'cog' | 'receipt' | 'time' | 'location' | 'people'
  | 'thumbs-up' | 'thumbs-down' | 'copy';

interface IconProps {
  name: IconName;
  variant?: IconVariant;
  size?: number;
  color?: string;
  style?: ViewStyle;
}


// Ionicons mappings for better icon support
const IONICON_NAMES: Record<string, { outline: string; filled: string; sharp?: string }> = {
  'home': { outline: 'home-outline', filled: 'home' },
  'person': { outline: 'person-outline', filled: 'person' },
  'wallet': { outline: 'wallet-outline', filled: 'wallet' },
  'settings': { outline: 'settings-outline', filled: 'settings' },
  'settings-outline': { outline: 'settings-outline', filled: 'settings' },
  'search': { outline: 'search-outline', filled: 'search' },
  'notifications': { outline: 'notifications-outline', filled: 'notifications' },
  'send': { outline: 'send-outline', filled: 'send' },
  'ballot': { outline: 'list-outline', filled: 'list' },
  'ellipsis-horizontal': { outline: 'ellipsis-horizontal-outline', filled: 'ellipsis-horizontal' },
  'warning': { outline: 'warning-outline', filled: 'warning' },
  'chevron-right': { outline: 'chevron-forward-outline', filled: 'chevron-forward' },
  'chevron-down': { outline: 'chevron-down-outline', filled: 'chevron-down' },
  'arrow-up': { outline: 'arrow-up-outline', filled: 'arrow-up' },
  'arrow-down': { outline: 'arrow-down-outline', filled: 'arrow-down' },
  'arrow-back': { outline: 'arrow-back-outline', filled: 'arrow-back' },
  'arrow-forward': { outline: 'arrow-forward-outline', filled: 'arrow-forward' },
  'lock-closed': { outline: 'lock-closed-outline', filled: 'lock-closed' },
  'chatbubble': { outline: 'chatbubble-outline', filled: 'chatbubble' },
  'heart': { outline: 'heart-outline', filled: 'heart' },
  'star': { outline: 'star-outline', filled: 'star' },
  'add': { outline: 'add-outline', filled: 'add' },
  'remove': { outline: 'remove-outline', filled: 'remove' },
  'close': { outline: 'close-outline', filled: 'close' },
  'checkmark': { outline: 'checkmark-outline', filled: 'checkmark' },
  'calendar': { outline: 'calendar-outline', filled: 'calendar' },
  'camera': { outline: 'camera-outline', filled: 'camera' },
  'image': { outline: 'image-outline', filled: 'image' },
  'document': { outline: 'document-outline', filled: 'document' },
  'download': { outline: 'download-outline', filled: 'download' },
  'cloud-upload': { outline: 'cloud-upload-outline', filled: 'cloud-upload' },
  'menu': { outline: 'menu-outline', filled: 'menu' },
  'eye': { outline: 'eye-outline', filled: 'eye' },
  'eye-off': { outline: 'eye-off-outline', filled: 'eye-off' },
  'refresh': { outline: 'refresh-outline', filled: 'refresh' },
  'sync': { outline: 'sync-outline', filled: 'sync' },
  'share': { outline: 'share-outline', filled: 'share' },
  'help-circle': { outline: 'help-circle-outline', filled: 'help-circle' },
  'moon': { outline: 'moon-outline', filled: 'moon' },
  'bulb': { outline: 'bulb-outline', filled: 'bulb' },
  'link': { outline: 'link-outline', filled: 'link' },
  'shield': { outline: 'shield-outline', filled: 'shield' },
  'sparkles': { outline: 'sparkles-outline', filled: 'sparkles' },
  'cog': { outline: 'cog-outline', filled: 'cog' },
  'people': { outline: 'people-outline', filled: 'people' },
  'thumbs-up': { outline: 'thumbs-up-outline', filled: 'thumbs-up' },
  'thumbs-down': { outline: 'thumbs-down-outline', filled: 'thumbs-down' },
  'copy': { outline: 'copy-outline', filled: 'copy' }
};

// Fallback emoji icons for missing icons
const EMOJI_FALLBACK: Record<string, string> = {
  'home': '🏠',
  'person': '👤', 
  'settings': '⚙️',
  'settings-outline': '⚙️',
  'wallet': '👛',
  'search': '🔍',
  'notifications': '🔔',
  'send': '📤',
  'ballot': '📋',
  'ellipsis-horizontal': '•••',
  'warning': '⚠️',
  'chevron-right': '›',
  'chevron-down': '⌄',
  'arrow-up': '↑',
  'arrow-down': '↓',
  'arrow-back': '←',
  'arrow-forward': '→',
  'lock-closed': '🔒',
  'chatbubble': '💬',
  'heart': '❤️',
  'star': '⭐',
  'add': '+',
  'remove': '−',
  'close': '✕',
  'checkmark': '✓',
  'calendar': '📅',
  'camera': '📷',
  'image': '🖼️',
  'document': '📄',
  'download': '⬇️',
  'cloud-upload': '☁️',
  'menu': '☰',
  'eye': '👁️',
  'eye-off': '🙈',
  'refresh': '🔄',
  'sync': '🔄',
  'share': '📤',
  'help-circle': '❓',
  'moon': '🌙',
  'bulb': '💡',
  'link': '🔗',
  'shield': '🛡️',
  'sparkles': '✨',
  'cog': '⚙️',
  'receipt': '🧾',
  'time': '⏰',
  'location': '📍',
  'people': '👥',
  'thumbs-up': '👍',
  'thumbs-down': '👎',
  'copy': '📋'
};

// (Removed SVG icon map and image loading to avoid requiring .svg without transformer)

// Helper function to get emoji fallback
const getEmojiContent = (name: IconName): string => {
  return EMOJI_FALLBACK[name] || '●';
};

export const Icon: React.FC<IconProps> = ({ 
  name, 
  variant = 'outline',
  size = 24, 
  color = '#000000',
  style 
}) => {
  // Try to use Ionicons first, fallback to emoji
  const ioniconMapping = IONICON_NAMES[name];
  
  if (ioniconMapping) {
    const iconName = variant === 'filled' ? ioniconMapping.filled : ioniconMapping.outline;
    
    try {
      return (
        <Ionicons
          name={iconName}
          size={size}
          color={color}
          style={style}
        />
      );
    } catch (error) {
      // If Ionicon fails, fallback to emoji
      console.warn(`Failed to load Ionicon: ${iconName}, using emoji fallback`);
    }
  }
  
  // Fallback to emoji
  const emoji = getEmojiContent(name);
  
  return (
    <Text 
      style={[
        { 
          fontSize: size, 
          color: color,
          textAlign: 'center',
          lineHeight: size + 2,
        }, 
        style
      ]}
    >
      {emoji}
    </Text>
  );
};

export default Icon;