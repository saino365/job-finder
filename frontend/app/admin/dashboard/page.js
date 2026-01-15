"use client";
import { useEffect, useState } from 'react';
import { Layout, Row, Col, Card, Statistic, Typography, Space, Button, message, Tag } from 'antd';

import { API_BASE_URL } from '../../../config';

import dynamic from 'next/dynamic';
const AdminTablesSection = dynamic(() => import('../../../components/admin/AdminTablesSection'), { ssr: false, loading: () => <div /> });

const { Title } = Typography;

export default function AdminDashboardPage() {
  const [counts, setCounts] = useState({ jobListings: { counts: {} }, companies: { counts: {} }, users: { counts: {} } });
  const [overview2, setOverview2] = useState({ applicationsByStatus: {}, employmentsByStatus: {}, timesheets: {}, pendingDecisions: {} });
  const [pendingJobs, setPendingJobs] = useState([]);
  const [pendingCompanies, setPendingCompanies] = useState([]);
  const [expiringJobs, setExpiringJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);
  
  // D129: Auto-refresh dashboard every 30 seconds to update status counts
  useEffect(() => {
    const interval = setInterval(() => {
      load();
    }, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  async function load() {
    try {
      setLoading(true);
      const token = localStorage.getItem('jf_token');
      if (!token) { message.error('Please sign in as admin'); window.location.href = '/login'; return; }
      const headers = { 'Authorization': `Bearer ${token}` };

      const [ovrRes, ovr2Res, pJobsRes, pCoRes, expJobsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/monitoring/overview`, { headers }),
        fetch(`${API_BASE_URL}/admin-dashboard`, { headers }),
        fetch(`${API_BASE_URL}/admin/monitoring?type=pending_jobs`, { headers }),
        fetch(`${API_BASE_URL}/admin/monitoring?type=pending_companies`, { headers }),
        fetch(`${API_BASE_URL}/admin/monitoring?type=expiring_jobs`, { headers })
      ]);

      const overview = await ovrRes.json();
      const overview2 = await ovr2Res.json();
      const pJobs = await pJobsRes.json();
      const pCompanies = await pCoRes.json();
      const expJobs = await expJobsRes.json();

      setCounts(overview || {});
      setOverview2(overview2 || {});
      setPendingJobs(Array.isArray(pJobs) ? pJobs : (pJobs?.data || []));
      setPendingCompanies(Array.isArray(pCompanies) ? pCompanies : (pCompanies?.data || []));
      setExpiringJobs(Array.isArray(expJobs) ? expJobs : (expJobs?.data || []));
    } catch (e) {
      message.error(e.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  const jl = counts.jobListings?.counts || {}; // { draft, pending, active, closed, total }
  const co = counts.companies?.counts || {}; // { pending, approved, rejected, total }
  const us = counts.users?.counts || {}; // { students, companies, admins }

  const jobsColumns = [
    { title: 'Title', dataIndex: 'title', key: 'title' },
    { title: 'Company', key: 'company', render: (_, r) => r.company?.name || r.companyName || '-' },
    { title: 'Submitted', dataIndex: 'submittedAt', key: 'submittedAt', render: (d) => d ? new Date(d).toLocaleString() : '-' },
  ];
  const companiesColumns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Registration No.', dataIndex: 'registrationNumber', key: 'registrationNumber' },
    { title: 'Submitted', dataIndex: 'submittedAt', key: 'submittedAt', render: (d) => d ? new Date(d).toLocaleDateString() : '-' },
  ];
  const expiringColumns = [
    { title: 'Title', dataIndex: 'title', key: 'title' },
    { title: 'Company', key: 'company', render: (_, r) => r.company?.name || r.companyName || '-' },
    { title: 'Expires', dataIndex: 'expiresAt', key: 'expiresAt', render: (d) => d ? new Date(d).toLocaleString() : '-' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (s) => <Tag color={s===2?'green':s===1?'orange':s===3?'red':'default'}>{s===2?'Active':s===1?'Pending':s===3?'Past':'Draft'}</Tag> },
  ];

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={2} style={{ margin: 0 }}>Admin Dashboard</Title>
          <Button onClick={load}>Refresh</Button>
        </div>

        {/* Top stats */}
        <Row gutter={[16,16]}>
          <Col xs={24} sm={12} md={6}><Card loading={loading}><Statistic title="Jobs (Active)" value={jl.active ?? 0} /></Card></Col>
          <Col xs={24} sm={12} md={6}><Card loading={loading}><Statistic title="Jobs (Pending)" value={jl.pending ?? 0} /></Card></Col>
          <Col xs={24} sm={12} md={6}><Card loading={loading}><Statistic title="Companies (Pending)" value={co.pending ?? 0} /></Card></Col>
          <Col xs={24} sm={12} md={6}><Card loading={loading}><Statistic title="Users (Companies)" value={us.companies ?? 0} /></Card></Col>
        </Row>

        {/* Applications & Employments */}
        <Row gutter={[16,16]}>
          <Col xs={24} md={12}>
            <Card title="Applications (by status)" loading={loading}>
              <Space wrap>
                {Object.entries(overview2.applicationsByStatus || {}).map(([k,v]) => (
                  <Tag key={k} color="blue">{k}: {v}</Tag>
                ))}
              </Space>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title="Employments (by status)" loading={loading}>
              <Space wrap>
                {Object.entries(overview2.employmentsByStatus || {}).map(([k,v]) => (
                  <Tag key={k} color="green">{k}: {v}</Tag>
                ))}
              </Space>
            </Card>
          </Col>
        </Row>

        {/* Listings & Companies (lazy-loaded tables) */}
        <AdminTablesSection
          pendingJobs={pendingJobs}
          expiringJobs={expiringJobs}
          pendingCompanies={pendingCompanies}
          loading={loading}
        />
      </Space>
    </div>
  );
}

