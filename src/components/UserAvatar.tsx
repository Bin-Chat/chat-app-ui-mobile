import React, { useState } from 'react';
import { View, Text, Image } from 'react-native';
import { getVariantUrl } from '@/utils/imageUrl';

interface UserAvatarProps {
  user?: { fullName?: string; avatar?: string } | null;
  size?: number;
  variant?: 'thumb' | 'medium' | 'large';
  isOnline?: boolean;
}

export function UserAvatar({ user, size = 40, variant = 'thumb', isOnline }: UserAvatarProps) {
  const originalUrl = user?.avatar || null;
  const variantUrl = originalUrl ? getVariantUrl(originalUrl, variant) : null;

  // Start with the variant URL; on error fall back to original, then to initials
  const [imgUri, setImgUri] = useState<string | null>(variantUrl);
  const [showInitials, setShowInitials] = useState(false);

  // Reset when avatar changes
  React.useEffect(() => {
    setImgUri(variantUrl);
    setShowInitials(false);
  }, [variantUrl]);

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
      {!showInitials && imgUri ? (
        <Image
          source={{ uri: imgUri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
          onError={() => {
            // Variant failed → try original URL
            if (imgUri !== originalUrl && originalUrl) {
              setImgUri(originalUrl);
            } else {
              // Original also failed → show initials
              setShowInitials(true);
            }
          }}
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
