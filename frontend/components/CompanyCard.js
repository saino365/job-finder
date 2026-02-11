"use client";
import { Card, Typography, Tag, Space, Avatar } from 'antd';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';

export default function CompanyCard({ company }) {
  const [logoSignedUrl, setLogoSignedUrl] = useState(null);
  const jobsCount = company.jobsCount ?? company.jobCount ?? company.internshipJobListingCount;

  // Generate signed URL for logo display
  useEffect(() => {
    async function loadLogo() {
      // Construct URL from logoKey if available, otherwise use logo/logoUrl
      let logoUrl = company.logo || company.logoUrl || company.imageUrl;
      if (!logoUrl && company.logoKey) {
        logoUrl = `${process.env.NEXT_PUBLIC_STORAGE_URL || 'https://ap-southeast-mys1.oss.ips1cloud.com/job-finder-bucket'}/${company.logoKey}`;
      }

      if (logoUrl) {
        try {
          const res = await fetch(`${API_BASE_URL}/signed-url?url=${encodeURIComponent(logoUrl)}`);
          if (res.ok) {
            const data = await res.json();
            setLogoSignedUrl(data.signedUrl);
          } else {
            setLogoSignedUrl(logoUrl); // Fallback to original URL
          }
        } catch (e) {
          setLogoSignedUrl(logoUrl); // Fallback to original URL
        }
      }
    }
    loadLogo();
  }, [company.logo, company.logoUrl, company.imageUrl, company.logoKey]);

  {/* D149: Ensure consistent company card height */}
  return (
    <Link href={`/companies/${company._id}`} style={{ display: 'block' }}>
      <Card
        hoverable
        title={company.name}
        style={{ height: '100%', minHeight: '200px', display: 'flex', flexDirection: 'column' }}
        styles={{ body: { padding: '16px', display: 'flex', flexDirection: 'column' } }}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Space align="start" size={12} style={{ width: '100%' }}>
            <Avatar
              src={logoSignedUrl}
              shape="square"
              size={48}
              style={{ backgroundColor: '#f0f0f0', flexShrink: 0 }}
            >
              {company.name?.charAt(0)?.toUpperCase()}
            </Avatar>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Typography.Text type="secondary" style={{ fontSize: '14px' }}>
                {company.industry || 'Industry'}
              </Typography.Text>
            </div>
          </Space>
          <Typography.Paragraph
            ellipsis={{ rows: 2 }}
            style={{ marginBottom: 0 }}
          >
            {company.description || '—'}
          </Typography.Paragraph>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {jobsCount != null && <Tag color="geekblue">{jobsCount} jobs</Tag>}
            {company.location && <Tag>{company.location}</Tag>}
          </div>
        </Space>
      </Card>
    </Link>
  );
}

