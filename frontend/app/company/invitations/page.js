"use client";
import { useEffect, useMemo, useState } from 'react';
import { Layout, Card, Table, Space, Typography, Tag, Tabs, App } from 'antd';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import { API_BASE_URL } from '../../../config';
import Link from 'next/link';

const { Title } = Typography;

const InviteStatus = { 0: 'Pending', 1: 'Accepted', 2: 'Declined', 3: 'Expired' };
const InviteStatusColor = { 0: 'blue', 1: 'green', 2: 'red', 3: 'default' };

const tabs = [
  { key: 'all', label: 'All Invitations', statuses: [0, 1, 2, 3] },
  { key: 'pending', label: 'Pending', statuses: [0] },
  { key: 'accepted', label: 'Accepted', statuses: [1] },
  { key: 'declined', label: 'Declined', statuses: [2] }
];

function CompanyInvitationsContent() {
  const { message: messageApi } = App.useApp();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeKey, setActiveKey] = useState('all');
  const [userNames, setUserNames] = useState({});
  const [jobTitles, setJobTitles] = useState({});

  async function load() {
    try {
      setLoading(true);
      const token = localStorage.getItem('jf_token');
      if (!token) { window.location.href = '/login'; return; }
      
      const res = await fetch(`${API_BASE_URL}/invites?$sort[createdAt]=-1&$limit=100`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      const json = await res.json();
      const data = Array.isArray(json) ? json : (json?.data || []);
      setItems(data);
      
      // Fetch user names for all invites
      const userIds = [...new Set(data.map(inv => inv.userId).filter(Boolean))];
      const names = {};
      await Promise.all(userIds.map(async (userId) => {
        try {
          const userRes = await fetch(`${API_BASE_URL}/users/${userId}`, { 
            headers: { Authorization: `Bearer ${token}` } 
          });
          if (userRes.ok) {
            const user = await userRes.json();
            const firstName = user?.profile?.firstName || '';
            const lastName = user?.profile?.lastName || '';
            const fullName = `${firstName} ${lastName}`.trim();
            names[userId] = fullName || user.email || 'Student';
          }
        } catch (e) {
          console.error(`Failed to fetch user ${userId}:`, e);
        }
      }));
      setUserNames(names);
      
      // Fetch job titles for all invites with jobListingId
      const jobIds = [...new Set(data.map(inv => inv.jobListingId).filter(Boolean))];
      const jobs = {};
      await Promise.all(jobIds.map(async (jobId) => {
        try {
          const jobRes = await fetch(`${API_BASE_URL}/job-listings/${jobId}`, { 
            headers: { Authorization: `Bearer ${token}` } 
          });
          if (jobRes.ok) {
            const job = await jobRes.json();
            jobs[jobId] = job.title || 'Job';
          }
        } catch (e) {
          console.error(`Failed to fetch job ${jobId}:`, e);
        }
      }));
      setJobTitles(jobs);
    } catch (e) { 
      messageApi.error(e.message || 'Failed to load invitations'); 
    } finally { 
      setLoading(false); 
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const tab = tabs.find(t => t.key === activeKey);
    if (!tab) return [];
    return items.filter(i => tab.statuses.includes(i.status));
  }, [items, activeKey]);

  const columns = [
    { 
      title: 'Student', 
      key: 'student', 
      render: (_, r) => (
        <Link href={`/profile/${r.userId}`}>
          {userNames[r.userId] || String(r.userId)}
        </Link>
      )
    },
    { 
      title: 'Job Position', 
      key: 'job',
      render: (_, r) => {
        if (r.jobListingId) {
          return (
            <Link href={`/company/jobs/${r.jobListingId}`}>
              {jobTitles[r.jobListingId] || 'View Job'}
            </Link>
          );
        }
        return <Typography.Text type="secondary">-</Typography.Text>;
      }
    },
    { 
      title: 'Type', 
      dataIndex: 'type',
      render: (type) => type === 'profile_access' ? 'Profile Access' : type
    },
    { 
      title: 'Invitation date', 
      dataIndex: 'createdAt', 
      render: (d) => d ? new Date(d).toLocaleString() : '-' 
    },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      render: (s) => <Tag color={InviteStatusColor[s]}>{InviteStatus[s] || s}</Tag> 
    },
    { 
      title: 'Response date', 
      dataIndex: 'respondedAt', 
      render: (d) => d ? new Date(d).toLocaleString() : '-' 
    },
    {
      title: 'Decline reason',
      dataIndex: 'reason',
      render: (reason, record) => {
        if (record.status === 2 && reason) {
          return (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {reason.length > 50 ? reason.substring(0, 50) + '...' : reason}
            </Typography.Text>
          );
        }
        return '-';
      }
    },
    {
      title: 'Message',
      dataIndex: 'message',
      render: (msg) => {
        if (!msg) return '-';
        return (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {msg.length > 50 ? msg.substring(0, 50) + '...' : msg}
          </Typography.Text>
        );
      }
    }
  ];

  return (
    <Layout>
      <Navbar />
      <Layout.Content style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Title level={2} style={{ margin: 0 }}>Sent Invitations</Title>
          <Card>
            <Tabs activeKey={activeKey} onChange={setActiveKey} items={tabs} />
            <Table 
              rowKey="_id" 
              columns={columns} 
              dataSource={filtered} 
              loading={loading} 
              pagination={{ pageSize: 20 }} 
            />
          </Card>
        </Space>
      </Layout.Content>
      <Footer />
    </Layout>
  );
}

export default function CompanyInvitationsPage() {
  return (
    <App>
      <CompanyInvitationsContent />
    </App>
  );
}
