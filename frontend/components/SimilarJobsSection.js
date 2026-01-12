"use client";
import { useState, useEffect } from 'react';
import { Card, Typography, Button, Space, Tag, Row, Col, Skeleton } from 'antd';
import { ClockCircleOutlined, EnvironmentOutlined, DollarOutlined, EyeOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { API_BASE_URL } from '../config';

const { Title, Text } = Typography;

export default function SimilarJobsSection({ companyId }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchJobs() {
      try {
        setLoading(true);
        // Fetch jobs from the same company
        const response = await fetch(`${API_BASE_URL}/job-listings?companyId=${companyId}&$limit=4&status=1`);
        const data = await response.json();
        const jobsList = Array.isArray(data) ? data : (data?.data || []);
        setJobs(jobsList);
      } catch (error) {
        console.error('Error fetching jobs:', error);
        setJobs([]);
      } finally {
        setLoading(false);
      }
    }

    if (companyId) {
      fetchJobs();
    }
  }, [companyId]);

  if (loading) {
    return (
      <div>
        <Title level={4} style={{ margin: 0, marginBottom: 16 }}>Job Listings</Title>
        <Skeleton active />
      </div>
    );
  }

  if (!jobs.length) {
    return null;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Job Listings ({jobs.length})</Title>
        <Link href="/jobs">
          <Button type="link">View all</Button>
        </Link>
      </div>
      <Row gutter={[16, 16]}>
        {jobs.map((job) => (
          <Col xs={24} sm={12} lg={12} key={job._id}>
            <JobCard job={job} />
          </Col>
        ))}
      </Row>
    </div>
  );
}

function JobCard({ job }) {
  const formatSalary = (salaryRange) => {
    if (!salaryRange) return null;
    const { min, max } = salaryRange;
    if (min && max) return `RM ${min} - RM ${max}`;
    if (min) return `RM ${min}+`;
    if (max) return `Up to RM ${max}`;
    return null;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    return `${Math.ceil(diffDays / 30)} months ago`;
  };

  return (
    <Card
      hoverable
      style={{
        borderRadius: 12,
        border: '1px solid #f0f0f0',
        height: '100%',
        background: 'linear-gradient(135deg, #f8f9ff 0%, #fff 100%)',
        transition: 'all 0.3s ease'
      }}
      bodyStyle={{ padding: 16 }}
    >
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Link href={`/jobs/${job._id}`} style={{ textDecoration: 'none', color: 'inherit', flex: 1 }}>
          {/* Job Title */}
          <Title
            level={5}
            style={{
              margin: 0,
              marginBottom: 8,
              fontSize: '16px',
              fontWeight: 600,
              color: '#1a1a1a',
              lineHeight: 1.3
            }}
            ellipsis={{ rows: 2 }}
          >
            {job.title}
          </Title>

          {/* Company Name */}
          <Text
            type="secondary"
            style={{
              fontSize: '14px',
              marginBottom: 12,
              display: 'block'
            }}
          >
            {job.company?.name || 'Company'}
          </Text>

          {/* Job Details */}
          <Space direction="vertical" size="small" style={{ width: '100%', flex: 1 }}>
            {/* Location */}
            {(job.location?.city || job.location?.state) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <EnvironmentOutlined style={{ color: '#8c8c8c', fontSize: '12px' }} />
                <Text style={{ fontSize: '13px', color: '#666' }}>
                  {[job.location?.city, job.location?.state].filter(Boolean).join(', ')}
                </Text>
              </div>
            )}

            {/* Salary */}
            {formatSalary(job.salaryRange) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <DollarOutlined style={{ color: '#52c41a', fontSize: '12px' }} />
                <Text style={{ fontSize: '13px', color: '#52c41a', fontWeight: 500 }}>
                  {formatSalary(job.salaryRange)}
                </Text>
              </div>
            )}

            {/* Posted Date */}
            {job.createdAt && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ClockCircleOutlined style={{ color: '#8c8c8c', fontSize: '12px' }} />
                <Text style={{ fontSize: '13px', color: '#666' }}>
                  {formatDate(job.createdAt)}
                </Text>
              </div>
            )}
          </Space>
        </Link>

        {/* Apply Button */}
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
          <Link href={`/jobs/${job._id}/apply`} style={{ textDecoration: 'none' }}>
            <Button
              type="primary"
              size="small"
              icon={<EyeOutlined />}
              style={{
                width: '100%',
                borderRadius: 8,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                fontSize: '13px',
                fontWeight: 500
              }}
            >
              Apply Now
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}
