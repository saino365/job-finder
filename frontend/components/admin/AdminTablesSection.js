"use client";

import { Card, Table, Row, Col, Tag } from "antd";

export default function AdminTablesSection({ pendingJobs = [], expiringJobs = [], pendingCompanies = [], loading }) {
  const jobsColumns = [
    { title: 'Title', dataIndex: 'title', key: 'title' },
    { title: 'Company', key: 'company', render: (_, r) => r.company?.name || r.companyName || '-' },
    { title: 'Submitted', dataIndex: 'submittedAt', key: 'submittedAt', render: (d) => d ? new Date(d).toLocaleString() : '-' },
  ];
  const expiringColumns = [
    { title: 'Title', dataIndex: 'title', key: 'title' },
    { title: 'Company', key: 'company', render: (_, r) => r.company?.name || r.companyName || '-' },
    { title: 'Expires', dataIndex: 'expiresAt', key: 'expiresAt', render: (d) => d ? new Date(d).toLocaleString() : '-' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (s) => <Tag color={s===2?'green':s===1?'orange':s===3?'red':'default'}>{s===2?'Active':s===1?'Pending':s===3?'Past':'Draft'}</Tag> },
  ];
  const companiesColumns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Registration No.', dataIndex: 'registrationNumber', key: 'registrationNumber' },
    { title: 'Submitted', dataIndex: 'submittedAt', key: 'submittedAt', render: (d) => d ? new Date(d).toLocaleDateString() : '-' },
  ];

  return (
    <Row gutter={[16,16]}>
      <Col xs={24} md={12}>
        <Card title="Pending Job Listings" extra={<a href="/admin/monitoring?type=pending_jobs" onClick={(e)=>{e.preventDefault(); window.location.href='/admin/monitoring?type=pending_jobs';}}>View</a>}>
          <Table size="small" rowKey="_id" columns={jobsColumns} dataSource={pendingJobs.slice(0,10)} pagination={false} loading={loading} />
        </Card>
      </Col>
      <Col xs={24} md={12}>
        <Card title="Expiring Jobs ( 7 days)" extra={<a href="/admin/renewals" onClick={(e)=>{e.preventDefault(); window.location.href='/admin/renewals';}}>Renewals</a>}>
          <Table size="small" rowKey="_id" columns={expiringColumns} dataSource={expiringJobs.slice(0,10)} pagination={false} loading={loading} />
        </Card>
      </Col>
      <Col xs={24}>
        <Card title="Companies Pending Verification" extra={<a href="/admin/companies" onClick={(e)=>{e.preventDefault(); window.location.href='/admin/companies';}}>Manage Companies</a>}>
          <Table size="small" rowKey="_id" columns={companiesColumns} dataSource={pendingCompanies.slice(0,10)} pagination={false} loading={loading} />
        </Card>
      </Col>
    </Row>
  );
}

