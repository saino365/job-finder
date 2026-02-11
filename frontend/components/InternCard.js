import React from 'react';
import { Card, Avatar, Typography, Tag, Space } from 'antd';
import Link from 'next/link';
import UserAvatar from './UserAvatar';

const { Title, Text } = Typography;

export default function InternCard({ intern }) {
  // Handle different data structures
  const profile = intern?.profile || intern?.user?.profile || {};
  const userId = intern?._id || intern?.id || intern?.userId || intern?.user?._id;
  const name = `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim() || intern?.email || intern?.user?.email || 'Intern';
  
  // Try multiple paths for education data
  const edu = intern?.internProfile?.educations?.[0] || 
               intern?.education?.[0] || 
               intern?.educations?.[0] ||
               intern?.educationInfo || 
               {};
  
  const field = edu?.fieldOfStudy || edu?.qualification || edu?.field || edu?.major || '-';
  const university = edu?.university || edu?.institution || edu?.school || '-';
  
  // Try multiple paths for preferences
  const prefs = intern?.internProfile?.preferences || intern?.preferences || {};
  const s = prefs?.preferredStartDate ? new Date(prefs.preferredStartDate).toLocaleDateString() : '-';
  const e = prefs?.preferredEndDate ? new Date(prefs.preferredEndDate).toLocaleDateString() : '-';
  const locs = Array.isArray(prefs?.locations) ? prefs.locations.slice(0, 3) : 
               Array.isArray(prefs?.preferredLocations) ? prefs.preferredLocations.slice(0, 3) : [];
  const sal = prefs?.salaryRange || {};
  
  const avatarUrl = profile?.avatar || intern?.avatar || '';

  const cardContent = (
    <Space align="start" size="large">
      <UserAvatar name={name} avatarUrl={avatarUrl} size={56} />
      <div style={{ flex: 1 }}>
        <Title level={5} style={{ margin: 0 }}>{name}</Title>
        <Text type="secondary" style={{ display: 'block' }}>{field}</Text>
        {university !== '-' && (
          <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>{university}</Text>
        )}
        <div style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>{s} → {e}</Text>
        </div>
        {locs.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {locs.map((l, idx) => <Tag key={idx}>{l}</Tag>)}
          </div>
        )}
        {(sal.min != null || sal.max != null) && (
          <div style={{ marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              RM {sal.min || 0} - {sal.max || 0}
            </Text>
          </div>
        )}
      </div>
    </Space>
  );

  // If we have a userId, make the card clickable
  if (userId) {
    return (
      <Link href={`/profile/${userId}`} style={{ textDecoration: 'none' }}>
        <Card hoverable style={{ cursor: 'pointer' }}>
          {cardContent}
        </Card>
      </Link>
    );
  }

  // Otherwise just show the card without link
  return (
    <Card>
      {cardContent}
    </Card>
  );
}

