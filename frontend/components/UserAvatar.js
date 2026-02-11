"use client";
import { Avatar } from 'antd';
import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../config';

/**
 * Reusable avatar component with automatic fallback to initials
 * @param {string} name - User's full name for generating initials
 * @param {string} avatarUrl - Avatar URL (can be S3 key or full URL)
 * @param {number} size - Avatar size in pixels (default: 40)
 * @param {string} shape - Avatar shape: 'circle' or 'square' (default: 'circle')
 * @param {object} style - Additional inline styles
 */
export default function UserAvatar({ name = '', avatarUrl = '', size = 40, shape = 'circle', style = {} }) {
  const [signedUrl, setSignedUrl] = useState('');
  const [error, setError] = useState(false);

  // Fetch signed URL if avatarUrl is provided
  useEffect(() => {
    if (!avatarUrl) {
      setSignedUrl('');
      setError(false);
      return;
    }

    (async () => {
      try {
        setError(false);
        const res = await fetch(`${API_BASE_URL}/signed-url?url=${encodeURIComponent(avatarUrl)}`);
        if (res.ok) {
          const json = await res.json();
          setSignedUrl(json.signedUrl || '');
        } else {
          setError(true);
          setSignedUrl('');
        }
      } catch (e) {
        setError(true);
        setSignedUrl('');
      }
    })();
  }, [avatarUrl]);

  // Generate initials from name
  const getInitials = () => {
    if (!name) return '?';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) {
      // Use first letter of first and last name
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    } else if (parts.length === 1) {
      // Use first letter only
      return parts[0][0].toUpperCase();
    }
    return '?';
  };

  // If we have a valid signed URL and no error, show the image
  if (signedUrl && !error) {
    return (
      <Avatar
        size={size}
        shape={shape}
        src={signedUrl}
        style={style}
        onError={() => {
          setError(true);
          return true;
        }}
      >
        {getInitials()}
      </Avatar>
    );
  }

  // Otherwise show initials with colored background
  return (
    <Avatar
      size={size}
      shape={shape}
      style={{
        backgroundColor: '#1890ff',
        ...style
      }}
    >
      {getInitials()}
    </Avatar>
  );
}
