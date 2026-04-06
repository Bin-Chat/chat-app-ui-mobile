import React from 'react';
import { View, Text, Image } from 'react-native';
import { getVariantUrl } from '@/utils/imageUrl';

interface UserAvatarProps {
  user?: { fullName?: string; avatar?: string } | null;
  size?: number;
  variant?: 'thumb' | 'medium' | 'large';
  isOnline?: boolean;
}

export function UserAvatar({ user, size = 40, variant = 'thumb', isOnline }: UserAvatarProps) {
  const avatarUrl = user?.avatar ? getVariantUrl(user.avatar, variant) : null;
  const initials = user?.fullName
    ? user.fullName
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?';

  const fontSize = Math.max(size * 0.38, 10);
  const dotSize = Math.max(size * 0.28, 8);

  return (
    <View style={{ width: size, height: size }}>
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: '#0068FF',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize, fontWeight: '600' }}>{initials}</Text>
        </View>
      )}
      {isOnline && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: '#22c55e',
            borderWidth: 2,
            borderColor: '#fff',
          }}
        />
      )}
    </View>
  );
}
