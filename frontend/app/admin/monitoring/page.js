"use client";

import { useEffect, useMemo, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Table, Card, Space, Segmented, Typography, Tag, Button, message, DatePicker, Modal, Form, Input, Drawer } from 'antd';
import { CheckOutlined, CloseOutlined, EyeOutlined } from '@ant-design/icons';
import { API_BASE_URL } from '../../../config';

const { Title, Text } = Typography;

function MonitoringClient() {
  const search = useSearchParams();
  const router = useRouter();
  const type = search?.get('type') || 'pending_pre_approval';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [range, setRange] = useState([]); // [startDayjs, endDayjs]
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectingJob, setRejectingJob] = useState(null);
  const [rejectForm] = Form.useForm();
  const [viewDrawerOpen, setViewDrawerOpen] = useState(false);
  const [viewingJob, setViewingJob] = useState(null);
  const [approvingJobs, setApprovingJobs] = useState(new Set());

  useEffect(() => { setPage(1); load(); }, [type, q, page, pageSize, JSON.stringify(range?.map?.(d=>d?.toISOString?.()||''))]);

  async function load() {
    try {
      setLoading(true);
      const token = localStorage.getItem('jf_token');
      if (!token) { message.error('Please sign in as admin'); window.location.href = '/login'; return; }
      const params = new URLSearchParams();
      params.set('type', type);
      if (q) params.set('q', q);
      params.set('$limit', String(pageSize));
      params.set('$skip', String((page - 1) * pageSize));
      if (Array.isArray(range) && range[0] && range[1]) {
        params.set('start', range[0].startOf('day').toISOString());
        params.set('end', range[1].endOf('day').toISOString());
      }
      const res = await fetch(`${API_BASE_URL}/admin/monitoring?${params.toString()}`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data?.data || []);
      setItems(list);
      const totalHeader = res.headers.get('x-total-count') || res.headers.get('x-total');
      setTotal(Number(data?.total || totalHeader || list.length));
    } catch (e) {
      message.error(e.message || 'Failed to load');
      setItems([]);
    } finally { setLoading(false); }
  }

  function setType(v) {
    const qs = new URLSearchParams(search?.toString() || '');
    qs.set('type', v);
    router.replace(`/admin/monitoring?${qs.toString()}`);
  }

  async function approvePreApproval(jobId) {
    try {
      setApprovingJobs(prev => new Set([...prev, jobId]));
      const token = localStorage.getItem('jf_token');
      const res = await fetch(`${API_BASE_URL}/job-listings/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ approve: true })
      });
      if (!res.ok) throw new Error('Failed to approve job listing');
      message.success('Job listing approved and activated');
      load();
    } catch (e) {
      message.error(e.message || 'Failed to approve');
    } finally {
      setApprovingJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(jobId);
        return newSet;
      });
    }
  }

  async function rejectPreApproval(jobId, reason) {
    try {
      const token = localStorage.getItem('jf_token');
      const res = await fetch(`${API_BASE_URL}/job-listings/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ reject: true, rejectionReason: reason })
      });
      if (!res.ok) throw new Error('Failed to reject job listing');
      message.success('Job listing rejected');
      load();
    } catch (e) {
      message.error(e.message || 'Failed to reject');
    }
  }

  async function approveFinalApproval(jobId) {
    try {
      setApprovingJobs(prev => new Set([...prev, jobId]));
      const token = localStorage.getItem('jf_token');
      const res = await fetch(`${API_BASE_URL}/job-listings/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ approve: true })
      });
      if (!res.ok) throw new Error('Failed to approve');
      message.success('Job listing approved and activated');
      load();
    } catch (e) {
      message.error(e.message || 'Failed to approve');
    } finally {
      setApprovingJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(jobId);
        return newSet;
      });
    }
  }

  async function rejectFinalApproval(jobId, reason) {
    try {
      const token = localStorage.getItem('jf_token');
      const res = await fetch(`${API_BASE_URL}/job-listings/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ reject: true, rejectionReason: reason })
      });
      if (!res.ok) throw new Error('Failed to reject');
      message.success('Final approval rejected');
      load();
    } catch (e) {
      message.error(e.message || 'Failed to reject');
    }
  }

  function openRejectModal(job, isPreApproval) {
    setRejectingJob({ ...job, isPreApproval });
    setRejectModalOpen(true);
  }

  async function handleReject() {
    try {
      const values = await rejectForm.validateFields();
      if (rejectingJob.isPreApproval) {
        await rejectPreApproval(rejectingJob._id, values.rejectionReason);
      } else {
        await rejectFinalApproval(rejectingJob._id, values.rejectionReason);
      }
      setRejectModalOpen(false);
      rejectForm.resetFields();
      setRejectingJob(null);
    } catch (e) {
      if (e.errorFields) return; // Validation error
      message.error(e.message || 'Failed to reject');
    }
  }

  // D180: Ensure company name is displayed properly
  const baseCols = [
    { title: 'Title', dataIndex: 'title', key: 'title' },
    { 
      title: 'Company', 
      key: 'company', 
      render: (_, r) => {
        // D180: Check multiple possible field names for company name
        const companyName = r.company?.name || r.companyName || (r.companyId && typeof r.companyId === 'object' ? r.companyId.name : null) || '-';
        return companyName;
      }
    },
  ];

  const expiringColumns = [
    ...baseCols,
    // D180: Add internship period column
    { 
      title: 'Internship Period', 
      key: 'internshipPeriod', 
      render: (_, r) => {
        // Check multiple possible field names for internship dates
        const start = r.internshipStart || r.internshipDates?.start || r.project?.startDate;
        const end = r.internshipEnd || r.internshipDates?.end || r.project?.endDate;
        if (start && end) {
          return `${new Date(start).toLocaleDateString()} - ${new Date(end).toLocaleDateString()}`;
        }
        return '-';
      }
    },
    { title: 'Expires', dataIndex: 'expiresAt', key: 'expiresAt', render: (d) => d ? new Date(d).toLocaleString() : '-' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (s) => {
      if (s === 0) return <Tag>Draft</Tag>;
      if (s === 1) return <Tag color="orange">Pending Final Approval</Tag>;
      if (s === 2) return <Tag color="green">Active</Tag>;
      if (s === 3) return <Tag color="red">Closed</Tag>;
      if (s === 4) return <Tag color="blue">Pending Pre-Approval</Tag>;
      if (s === 5) return <Tag color="cyan">Pre-Approved</Tag>;
      return <Tag>Unknown</Tag>;
    }},
  ];

  const pendingPreApprovalColumns = [
    ...baseCols,
    // D180: Add internship period column
    { 
      title: 'Internship Period', 
      key: 'internshipPeriod', 
      render: (_, r) => {
        const start = r.internshipStart || r.internshipDates?.start || r.project?.startDate;
        const end = r.internshipEnd || r.internshipDates?.end || r.project?.endDate;
        if (start && end) {
          return `${new Date(start).toLocaleDateString()} - ${new Date(end).toLocaleDateString()}`;
        }
        return '-';
      }
    },
    { title: 'Submitted', dataIndex: 'submittedAt', key: 'submittedAt', render: (d) => d ? new Date(d).toLocaleString() : '-' },
    { title: 'Actions', key: 'actions', render: (_, record) => {
      // Show status for processed items
      if (record.status === 2) { // ACTIVE (approved)
        return (
          <Space>
            <Button size="small" icon={<EyeOutlined />} onClick={() => { setViewingJob(record); setViewDrawerOpen(true); }}>View</Button>
            <Tag color="green">Approved</Tag>
          </Space>
        );
      }
      if (record.status === 0 && record.rejectionReason) { // DRAFT with rejection reason
        return (
          <Space>
            <Button size="small" icon={<EyeOutlined />} onClick={() => { setViewingJob(record); setViewDrawerOpen(true); }}>View</Button>
            <Tag color="red">Rejected</Tag>
            <span style={{ fontSize: '12px', color: '#666' }}>({record.rejectionReason})</span>
          </Space>
        );
      }
      // Show buttons for pending items (status === 1)
      return (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => { setViewingJob(record); setViewDrawerOpen(true); }}>View</Button>
          <Button type="primary" size="small" icon={<CheckOutlined />} loading={approvingJobs.has(record._id)} onClick={() => approvePreApproval(record._id)}>Approve</Button>
          <Button danger size="small" icon={<CloseOutlined />} onClick={() => openRejectModal(record, true)}>Reject</Button>
        </Space>
      );
    }}
  ];

  const pendingFinalApprovalColumns = [
    ...baseCols,
    // D180: Add internship period column
    { 
      title: 'Internship Period', 
      key: 'internshipPeriod', 
      render: (_, r) => {
        const start = r.internshipStart || r.internshipDates?.start || r.project?.startDate;
        const end = r.internshipEnd || r.internshipDates?.end || r.project?.endDate;
        if (start && end) {
          return `${new Date(start).toLocaleDateString()} - ${new Date(end).toLocaleDateString()}`;
        }
        return '-';
      }
    },
    { title: 'Submitted', dataIndex: 'finalSubmittedAt', key: 'finalSubmittedAt', render: (d) => d ? new Date(d).toLocaleString() : '-' },
    { title: 'Pre-Approved', dataIndex: 'preApprovedAt', key: 'preApprovedAt', render: (d) => d ? new Date(d).toLocaleString() : '-' },
    { title: 'Actions', key: 'actions', render: (_, record) => {
      // Show status for processed items
      if (record.status === 2) { // ACTIVE (approved)
        return (
          <Space>
            <Button size="small" icon={<EyeOutlined />} onClick={() => { setViewingJob(record); setViewDrawerOpen(true); }}>View</Button>
            <Tag color="green">Approved</Tag>
          </Space>
        );
      }
      if (record.status === 5 && record.rejectionReason) { // PRE_APPROVED with rejection reason (rejected from final approval)
        return (
          <Space>
            <Button size="small" icon={<EyeOutlined />} onClick={() => { setViewingJob(record); setViewDrawerOpen(true); }}>View</Button>
            <Tag color="red">Rejected</Tag>
            <span style={{ fontSize: '12px', color: '#666' }}>({record.rejectionReason})</span>
          </Space>
        );
      }
      // Show buttons for pending items
      return (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => { setViewingJob(record); setViewDrawerOpen(true); }}>View</Button>
          <Button type="primary" size="small" icon={<CheckOutlined />} loading={approvingJobs.has(record._id)} onClick={() => approveFinalApproval(record._id)}>Approve</Button>
          <Button danger size="small" icon={<CloseOutlined />} onClick={() => openRejectModal(record, false)}>Reject</Button>
        </Space>
      );
    }}
  ];

  const pendingCompanyColumns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Registration No.', dataIndex: 'registrationNumber', key: 'registrationNumber' },
    { title: 'Submitted', dataIndex: 'submittedAt', key: 'submittedAt', render: (d) => d ? new Date(d).toLocaleDateString() : '-' },
  ];

  const columns = useMemo(() => {
    if (type === 'pending_companies') return pendingCompanyColumns;
    if (type === 'expiring_jobs') return expiringColumns;
    if (type === 'renewal_requests') return [
      ...baseCols,
      { title: 'Expires', dataIndex: 'expiresAt', key: 'expiresAt', render: (d) => d ? new Date(d).toLocaleString() : '-' },
      { title: 'Requested', dataIndex: 'renewalRequestedAt', key: 'renewalRequestedAt', render: (d) => d ? new Date(d).toLocaleString() : '-' },
    ];
    if (type === 'pending_pre_approval') return pendingPreApprovalColumns;
    if (type === 'pending_final_approval') return pendingFinalApprovalColumns;
    return pendingPreApprovalColumns; // default
  }, [type]);

  function toCSV(t, rows){
    const esc = (v)=>`"${String(v??'').replace(/"/g,'""')}"`;
    let headers = [];
    let mapRow = (r)=>[];
    if (t==='pending_companies') { headers=['Name','Registration','Submitted']; mapRow=(r)=>[r.name,r.registrationNumber,r.submittedAt?new Date(r.submittedAt).toISOString():'' ]; }
    else if (t==='expiring_jobs') { headers=['Title','Company','Expires','Status']; mapRow=(r)=>[r.title,r.company?.name||r.companyName||'', r.expiresAt?new Date(r.expiresAt).toISOString():'', r.status]; }
    else if (t==='renewal_requests') { headers=['Title','Company','Expires','Requested']; mapRow=(r)=>[r.title,r.company?.name||r.companyName||'', r.expiresAt?new Date(r.expiresAt).toISOString():'', r.renewalRequestedAt?new Date(r.renewalRequestedAt).toISOString():'' ]; }
    else { headers=['Title','Company','Submitted']; mapRow=(r)=>[r.title,r.company?.name||r.companyName||'', r.submittedAt?new Date(r.submittedAt).toISOString():'' ]; }
    const lines=[headers.join(',')];
    rows.forEach(r=>{ lines.push(mapRow(r).map(esc).join(',')); });
    return lines.join('\n');
  }

  return (
    <div>
      <Title level={2}>Monitoring</Title>
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Segmented
            options={[
              { label: 'Pending Pre-Approval', value: 'pending_pre_approval' },
              { label: 'Pending Final Approval', value: 'pending_final_approval' },
              { label: 'Pending Companies', value: 'pending_companies' },
              { label: 'Expiring Jobs', value: 'expiring_jobs' },
              { label: 'Renewal Requests', value: 'renewal_requests' },
            ]}
            value={type}
            onChange={setType}
          />
          <input placeholder="Search title/company" value={q} onChange={(e)=>setQ(e.target.value)} style={{ padding:6, border:'1px solid #ddd', borderRadius:6, minWidth:240 }} />
          <DatePicker.RangePicker value={range} onChange={setRange} allowClear />
          <Button onClick={load}>Refresh</Button>
          <Button onClick={async ()=>{
            try {
              const token = localStorage.getItem('jf_token');
              const p = new URLSearchParams();
              p.set('type', type);
              if (q) p.set('q', q);
              if (Array.isArray(range) && range[0] && range[1]) {
                p.set('start', range[0].startOf('day').toISOString());
                p.set('end', range[1].endOf('day').toISOString());
              }
              p.set('$limit','1000'); p.set('$skip','0');
              const r = await fetch(`${API_BASE_URL}/admin/monitoring?${p.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
              const j = await r.json();
              const list = Array.isArray(j) ? j : (j?.data || []);
              const csv = toCSV(type, list);
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `monitoring-${type}-${new Date().toISOString().slice(0,10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            } catch (e) { message.error(e.message || 'Export failed'); }
          }}>Export CSV</Button>
        </Space>
      </Card>

      <Card>
        <Table
          rowKey={r => r._id || r.id}
          loading={loading}
          columns={columns}
          dataSource={items}
          pagination={{ current: page, pageSize, total, showSizeChanger: true, onChange: (p, s) => { setPage(p); setPageSize(s); } }}
        />
      </Card>

      {/* Rejection Modal */}
      <Modal
        title={`Reject ${rejectingJob?.isPreApproval ? 'Pre-Approval' : 'Final Approval'}`}
        open={rejectModalOpen}
        onCancel={() => {
          setRejectModalOpen(false);
          rejectForm.resetFields();
          setRejectingJob(null);
        }}
        onOk={handleReject}
        okText="Reject"
        okButtonProps={{ danger: true }}
      >
        <Form form={rejectForm} layout="vertical">
          <Form.Item
            label="Rejection Reason"
            name="rejectionReason"
            rules={[{ required: true, message: 'Please provide a rejection reason' }]}
          >
            <Input.TextArea rows={4} placeholder="Explain why this job listing is rejected" />
          </Form.Item>
        </Form>
      </Modal>

      {/* View Drawer */}
      <Drawer
        title="Job Listing Details"
        open={viewDrawerOpen}
        onClose={() => {
          setViewDrawerOpen(false);
          setViewingJob(null);
        }}
        width={600}
      >
        {viewingJob && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div>
              <Text strong>Title:</Text>
              <div>{viewingJob.title}</div>
            </div>
            <div>
              <Text strong>Company:</Text>
              <div>{viewingJob.company?.name || viewingJob.companyName || '-'}</div>
            </div>
            <div>
              <Text strong>Description:</Text>
              <div>{viewingJob.description || '-'}</div>
            </div>
            <div>
              <Text strong>Position:</Text>
              <div>{viewingJob.position || '-'}</div>
            </div>
            <div>
              <Text strong>Profession:</Text>
              <div>{viewingJob.profession || '-'}</div>
            </div>
            <div>
              <Text strong>Location:</Text>
              <div>
                {(() => {
                  const loc = viewingJob.location;
                  if (!loc) return '-';
                  if (typeof loc === 'string') return loc;
                  const city = loc.city || '';
                  const state = loc.state || '';
                  const parts = [city, state].filter(Boolean);
                  return parts.length ? parts.join(', ') : '-';
                })()}
              </div>
            </div>
            <div>
              <Text strong>Salary Range:</Text>
              <div>
                {viewingJob.salaryRange?.min && viewingJob.salaryRange?.max
                  ? `RM ${viewingJob.salaryRange.min} - RM ${viewingJob.salaryRange.max}`
                  : '-'}
              </div>
            </div>
            <div>
              <Text strong>Internship Period:</Text>
              <div>
                {viewingJob.internshipDates?.start && viewingJob.internshipDates?.end
                  ? `${new Date(viewingJob.internshipDates.start).toLocaleDateString()} - ${new Date(viewingJob.internshipDates.end).toLocaleDateString()}`
                  : '-'}
              </div>
            </div>
            <div>
              <Text strong>Status:</Text>
              <div>
                {viewingJob.status === 0 && <Tag>Draft</Tag>}
                {viewingJob.status === 1 && <Tag color="orange">Pending Final Approval</Tag>}
                {viewingJob.status === 2 && <Tag color="green">Active</Tag>}
                {viewingJob.status === 3 && <Tag color="red">Closed</Tag>}
                {viewingJob.status === 4 && <Tag color="blue">Pending Pre-Approval</Tag>}
                {viewingJob.status === 5 && <Tag color="cyan">Pre-Approved</Tag>}
              </div>
            </div>
            <div>
              <Text strong>Submitted At:</Text>
              <div>{viewingJob.submittedAt ? new Date(viewingJob.submittedAt).toLocaleString() : '-'}</div>
            </div>
            {viewingJob.preApprovedAt && (
              <div>
                <Text strong>Pre-Approved At:</Text>
                <div>{new Date(viewingJob.preApprovedAt).toLocaleString()}</div>
              </div>
            )}
            {viewingJob.finalSubmittedAt && (
              <div>
                <Text strong>Final Submitted At:</Text>
                <div>{new Date(viewingJob.finalSubmittedAt).toLocaleString()}</div>
              </div>
            )}
          </Space>
        )}
      </Drawer>
    </div>
  );
}

export default function AdminMonitoringPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading...</div>}>
      <MonitoringClient />
    </Suspense>
  );
}

