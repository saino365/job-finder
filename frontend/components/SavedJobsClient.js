"use client";
import { useEffect, useState } from 'react';
import { List, Card, Typography, Tag, Space, Button, Skeleton, Empty, App } from 'antd';
import Link from 'next/link';
import { apiAuth, apiGet } from '../lib/api';

const { Title, Paragraph, Text } = Typography;

export default function SavedJobsClient() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]); // [{ job, savedAt }]
  const { message } = App.useApp();

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        // D201: Check if user is authenticated before loading
        const token = typeof window !== 'undefined' ? localStorage.getItem('jf_token') : null;
        if (!token) {
          if (mounted) {
            setItems([]);
            setLoading(false);
          }
          return;
        }
        // 1) Load saved job records for current user
        const savedRaw = await apiAuth('/saved-jobs', { method: 'GET' });
        const savedList = Array.isArray(savedRaw?.data) ? savedRaw.data : (Array.isArray(savedRaw) ? savedRaw : []);
        // 2) Fetch job details for each record
        const jobs = await Promise.all(savedList.map(async rec => {
          try { const job = await apiGet(`/job-listings/${rec.jobListingId}`); return { job, savedAt: rec.createdAt, savedId: rec._id || rec.id }; }
          catch { return null; }
        }));
        if (!mounted) return;
        setItems(jobs.filter(Boolean));
      } catch (e) {
        // D201: Handle authentication errors gracefully (e.g., after logout)
        if (mounted) {
          if (e.message?.includes('Not signed in') || e.message?.includes('401') || e.message?.includes('403')) {
            setItems([]);
            // Don't show error message if user is not authenticated (they might have logged out)
          } else {
            message.error('Failed to load saved jobs.');
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [message]);

  async function handleUnsave(jobId, savedId) {
    try {
      if (savedId) {
        await apiAuth(`/saved-jobs/${savedId}`, { method: 'DELETE' });
      } else {
        const res = await apiAuth(`/saved-jobs?jobListingId=${jobId}`, { method: 'GET' });
        const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        if (list?.[0]?._id) await apiAuth(`/saved-jobs/${list[0]._id}`, { method: 'DELETE' });
      }
      setItems(prev => prev.filter(it => it.job?._id !== jobId));
      message.success('Removed from Saved');
    } catch (_) {
      message.error('Failed to remove. Please try again.');
    }
  }

  if (loading) {
    return <Card><Skeleton active /></Card>;
  }

  if (!items.length) {
    return (
      <Card>
        <Empty description="No saved jobs yet" />
      </Card>
    );
  }

  return (
    <Card>
      <List
        itemLayout="vertical"
        dataSource={items}
        renderItem={(it) => (
          <List.Item key={it.job._id}
            extra={<Button onClick={() => handleUnsave(it.job._id, it.savedId)}>Unsave</Button>}>
            <div>
              <Title level={5} style={{ margin: 0, marginBottom: 8 }}>
                <Link href={`/jobs/${it.job._id}`} style={{ color: '#1677ff' }}>{it.job.title}</Link>
              </Title>
              {it.job.description && (
                <Paragraph ellipsis={{ rows: 2 }}>{it.job.description}</Paragraph>
              )}
              <Space wrap>
                {it.job.location?.city || it.job.location?.state ? (
                  <Tag>{[it.job.location?.city, it.job.location?.state].filter(Boolean).join(', ')}</Tag>
                ) : null}
                {it.job.salaryRange && (it.job.salaryRange.min || it.job.salaryRange.max) && (
                  <Tag color="gold">RM {it.job.salaryRange.min ?? 0}{it.job.salaryRange.max ? ` - RM ${it.job.salaryRange.max}` : ''}</Tag>
                )}
                {it.savedAt && <Text type="secondary">Saved {new Date(it.savedAt).toLocaleDateString()}</Text>}
              </Space>
            </div>
          </List.Item>
        )}
      />
    </Card>
  );
}

