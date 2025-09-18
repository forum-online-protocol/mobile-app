import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
// import Icon from './Icon';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'white' | 'black';
  showText?: boolean;
}

const Logo: React.FC<LogoProps> = ({ 
  size = 'medium', 
  color = 'black',
  showText = true 
}) => {
  const sizes = {
    small: { icon: 24, text: 20 },
    medium: { icon: 32, text: 28 },
    large: { icon: 48, text: 40 },
  };

  const colors = {
    primary: { icon: '#1D9BF0', text: '#000000' },
    white: { icon: '#FFFFFF', text: '#17559e' },
    black: { icon: '#0F1419', text: '#000000' },
  };

  const currentSize = sizes[size];
  const currentColor = colors[color];

  return (
    <View style={styles.container}>
      <Image 
        source={require('../assets/logo.png')}
        style={{
          width: currentSize.icon,
          height: currentSize.icon,
          resizeMode: 'contain'
        }}
      />
      {showText && (
        <Text style={[
          styles.text,
          { 
            fontSize: currentSize.text,
            color: currentColor.text,
          }
        ]}>
          Forum
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    fontWeight: '800',
    marginLeft: 12,
  },
});

export default Logo;