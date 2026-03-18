import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from '../Icon';
import { useTheme } from '../../contexts/ThemeContext';
import { radii, spacing, typography } from '../../styles/tokens';

type ScreenStateType = 'loading' | 'empty' | 'error';

interface ScreenStateProps {
  type: ScreenStateType;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onActionPress?: () => void;
}

const ScreenState: React.FC<ScreenStateProps> = ({
  type,
  title,
  subtitle,
  actionLabel,
  onActionPress,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const renderLeading = () => {
    if (type === 'loading') {
      return <ActivityIndicator size="large" color={theme.primary} />;
    }

    if (type === 'error') {
      return <Icon name="warning" size={22} color={theme.error} variant="filled" />;
    }

    return <Icon name="document" size={22} color={theme.textTertiary} variant="outline" />;
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>{renderLeading()}</View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {actionLabel && onActionPress ? (
        <TouchableOpacity style={styles.actionButton} onPress={onActionPress}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface,
    marginBottom: spacing.m,
  },
  title: {
    ...typography.headline,
    color: theme.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  actionButton: {
    marginTop: spacing.l,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.s,
    borderRadius: radii.pill,
    backgroundColor: theme.primary,
  },
  actionText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

export default ScreenState;

