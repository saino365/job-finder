"use client";
import { useEffect, useMemo, useState } from 'react';
import { Layout, Card, Table, Space, Typography, Button, Tag, Tabs, Modal, Form, Input, App } from 'antd';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { API_BASE_URL } from '../../config';
import Link from 'next/link';

const { Title } = Typography;

const InviteStatus = { 0: 'Pending', 1: 'Accepted', 2: 'Declined', 3: 'Expired' };

const tabs = [
  { key: 'pending', label: 'Invitation', statuses: [0] },
  { key: 'accepted', label: 'Accepted', statuses: [1] },
  { key: 'declined', label: 'Declined', statuses: [2] }
];

function InvitationsPageContent(){
  const { message: messageApi } = App.useApp();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeKey, setActiveKey] = useState('pending');
  const [companyNames, setCompanyNames] = useState({});
  const [jobTitles, setJobTitles] = useState({});
  const [declineOpen, setDeclineOpen] = useState(false);
  const [currentInvite, setCurrentInvite] = useState(null);
  const [declineForm] = Form.useForm();
  const [declining, setDeclining] = useState(false);

  async function load(){
    try {
      setLoading(true);
      const token = localStorage.getItem('jf_token');
      if (!token) { window.location.href = '/login'; return; }
      const res = await fetch(`${API_BASE_URL}/invites?$sort[createdAt]=-1`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      const data = Array.isArray(json) ? json : (json?.data || []);
      setItems(data);
      
      // Fetch company names for all invites
      const companyIds = [...new Set(data.map(inv => inv.companyId).filter(Boolean))];
      const names = {};
      await Promise.all(companyIds.map(async (companyId) => {
        try {
          const compRes = await fetch(`${API_BASE_URL}/companies/${companyId}`, { headers: { Authorization: `Bearer ${token}` } });
          if (compRes.ok) {
            const company = await compRes.json();
            names[companyId] = company.name || 'Company';
          }
        } catch {}
      }));
      setCompanyNames(names);
      
      // Fetch job titles for all invites with jobListingId
      const jobIds = [...new Set(data.map(inv => inv.jobListingId).filter(Boolean))];
      const jobs = {};
      await Promise.all(jobIds.map(async (jobId) => {
        try {
          const jobRes = await fetch(`${API_BASE_URL}/job-listings/${jobId}`, { headers: { Authorization: `Bearer ${token}` } });
          if (jobRes.ok) {
            const job = await jobRes.json();
            jobs[jobId] = job.title || 'Job';
          }
        } catch {}
      }));
      setJobTitles(jobs);
    } catch (e) { messageApi.error(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const def = tabs.find(t => t.key === activeKey)?.statuses || [];
    return items.filter(i => def.includes(i.status));
  }, [items, activeKey]);

  async function declineInvite(){
    try {
      setDeclining(true);
      const values = await declineForm.validateFields();
      const token = localStorage.getItem('jf_token');
      await fetch(`${API_BASE_URL}/invites/${currentInvite._id}`, { 
        method: 'PATCH', 
        headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, 
        body: JSON.stringify({ status: 2, reason: values.reason }) 
      });
      messageApi.success('Invitation declined');
      setDeclineOpen(false);
      setCurrentInvite(null);
      declineForm.resetFields();
      load();
    } catch (e) { 
      if (e?.errorFields) return;
      messageApi.error(e.message || 'Failed to decline invitation'); 
    } finally {
      setDeclining(false);
    }
  }

  async function acceptInvite(invite) {
    try {
      const token = localStorage.getItem('jf_token');
      await fetch(`${API_BASE_URL}/invites/${invite._id}`, { 
        method: 'PATCH', 
        headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, 
        body: JSON.stringify({ status: 1 }) 
      });
      messageApi.success('Invitation accepted');
      load();
    } catch (e) { 
      messageApi.error(e.message || 'Failed to accept invitation'); 
    }
  }

  function openDeclineModal(invite) {
    setCurrentInvite(invite);
    setDeclineOpen(true);
    declineForm.resetFields();
  }

  const columns = [
    { title: 'Company', key: 'company', render: (_, r) => companyNames[r.companyId] || r.companyName || r.company?.name || String(r.companyId) },
    { 
      title: 'Job Position', 
      key: 'job',
      render: (_, r) => {
        if (r.jobListingId) {
          return (
            <Link href={`/jobs/${r.jobListingId}`}>
              {jobTitles[r.jobListingId] || 'View Job'}
            </Link>
          );
        }
        return <Typography.Text type="secondary">-</Typography.Text>;
      }
    },
    { title: 'Type', dataIndex: 'type', render: (type) => type === 'profile_access' ? 'Profile Access' : type },
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
    },
    { title: 'Invitation date', dataIndex: 'createdAt', render: (d) => d ? new Date(d).toLocaleString() : '-' },
    { title: 'Invitation status', dataIndex: 'status', render: (s) => <Tag>{InviteStatus[s] || s}</Tag> },
    { title: 'Actions', key: 'actions', render: (_, r) => (
      <Space>
        {r.status === 0 && (
          <>
            <Button onClick={()=>acceptInvite(r)} type="primary" size="small">Accept</Button>
            <Button onClick={()=>openDeclineModal(r)} danger size="small">Decline</Button>
          </>
        )}
        <Link href={`/companies/${r.companyId}`}><Button size="small">View company</Button></Link>
      </Space>
    ) }
  ];

  return (
    <Layout>
      <Navbar />
      <Layout.Content style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Title level={2} style={{ margin: 0 }}>Invitations</Title>
          <Card>
            <Tabs activeKey={activeKey} onChange={setActiveKey} items={tabs} />
            <Table rowKey="_id" columns={columns} dataSource={filtered} loading={loading} pagination={{ pageSize: 10 }} />
          </Card>
        </Space>
      </Layout.Content>
      <Footer />

      <Modal
        title="Decline invitation"
        open={declineOpen}
        onCancel={() => {
          setDeclineOpen(false);
          setCurrentInvite(null);
          declineForm.resetFields();
        }}
        onOk={declineInvite}
        okText="Decline"
        okButtonProps={{ danger: true, loading: declining }}
        confirmLoading={declining}
      >
        <Typography.Paragraph>
          Are you sure you want to decline this invitation from {currentInvite ? (companyNames[currentInvite.companyId] || 'this company') : 'this company'}?
        </Typography.Paragraph>
        <Form form={declineForm} layout="vertical">
          <Form.Item 
            label="Reason" 
            name="reason" 
            rules={[{ required: true, message: 'Please provide a reason for declining' }]}
          >
            <Input.TextArea rows={3} placeholder="Why are you declining this invitation?" />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}

export default function InvitationsPage() {
  return (
    <App>
      <InvitationsPageContent />
    </App>
  );
}

