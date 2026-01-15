"use client";

import { useEffect, useState, useCallback } from 'react';
import { Layout, Typography, Card, Table, Tag, Space, Button, Drawer, message, Avatar, List, Modal, Form, Input } from 'antd';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import { API_BASE_URL } from '../../../config';
import dynamic from 'next/dynamic';

const { Title } = Typography;

const EmployeeDetails = dynamic(() => import('../../../components/company/EmployeeDetails'), { ssr: false, loading: () => <div /> });

const statusTag = (s) => {
  const map = { 0: { c: 'gold', t: 'Upcoming' }, 1: { c: 'blue', t: 'Ongoing' }, 2: { c: 'purple', t: 'Closure' }, 3: { c: 'green', t: 'Completed' }, 4: { c: 'red', t: 'Terminated' } };
  const m = map[s] || { c: 'default', t: String(s) };
  return <Tag color={m.c}>{m.t}</Tag>;
};

export default function CompanyEmployeesPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [viewing, setViewing] = useState(null);
  const [open, setOpen] = useState(false);
  const [drawerUser, setDrawerUser] = useState(null);

  const [pending, setPending] = useState({ ec: [], term: [] });
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectForm] = Form.useForm();
  const [rejectTarget, setRejectTarget] = useState({ kind: null, id: null });
  const [pendingLabels, setPendingLabels] = useState({});

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('jf_token');
      if (!token) { message.info('Please sign in'); window.location.href = '/login'; return; }
      const headers = { Authorization: `Bearer ${token}` };
      const res = await fetch(`${API_BASE_URL}/employment-records`, { headers });
      if (!res.ok) throw new Error('Failed to load employees');
      const j = await res.json();
      const list = Array.isArray(j?.data) ? j.data : (Array.isArray(j) ? j : []);
      setItems(list);
      // load pending reqs (company scoped by service find hook)
      const [ecR, tR] = await Promise.all([
        fetch(`${API_BASE_URL}/early-completions?status=0`, { headers }),
        fetch(`${API_BASE_URL}/internship-terminations?status=0`, { headers })
      ]);
      const ecJson = ecR.ok ? await ecR.json() : { data: [] };
      const termJson = tR.ok ? await tR.json() : { data: [] };
      const ec = Array.isArray(ecJson?.data) ? ecJson.data : (Array.isArray(ecJson) ? ecJson : []);
      const term = Array.isArray(termJson?.data) ? termJson.data : (Array.isArray(termJson) ? termJson : []);
      setPending({ ec, term });

      // Pre-fetch labels (employee name + position) for pending requests
      const ids = Array.from(new Set([
        ...ec.map(r => String(r.employmentId)),
        ...term.map(r => String(r.employmentId))
      ].filter(Boolean)));
      const labelEntries = await Promise.all(ids.map(async (id) => {
        try {
          const r = await fetch(`${API_BASE_URL}/employment-detail/${id}`, { headers });
          if (!r.ok) return [id, `Employment: ${id}`];
          const d = await r.json();
          const emp = d?.employment || {};
          const job = d?.job || {};
          const userProfile = d?.user?.profile || {};
          const name = `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || d?.user?.email || String(emp.userId || '');
          const title = job.title || 'Intern';
          return [id, `${name} – ${title}`];
        } catch {
          return [id, `Employment: ${id}`];
        }
      }));
      setPendingLabels(Object.fromEntries(labelEntries));
    } catch (e) { message.error(e.message || 'Failed to load'); setItems([]); setPending({ ec: [], term: [] }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => { (async () => {
    if (!open || !viewing?.userId) return;
    try {
      const token = localStorage.getItem('jf_token');
      const headers = { Authorization: `Bearer ${token}` };
      const r = await fetch(`${API_BASE_URL}/users/${viewing.userId}`, { headers });
      if (r.ok) setDrawerUser(await r.json()); else setDrawerUser(null);
    } catch { setDrawerUser(null); }
  })(); }, [open, viewing?.userId]);

  const [employeeLabels, setEmployeeLabels] = useState({});

  // Load employee names and job titles
  useEffect(() => {
    (async () => {
      if (items.length === 0) return;
      try {
        const token = localStorage.getItem('jf_token');
        const headers = { Authorization: `Bearer ${token}` };
        const labelEntries = await Promise.all(items.map(async (item) => {
          try {
            const r = await fetch(`${API_BASE_URL}/employment-detail/${item._id}`, { headers });
            if (!r.ok) return [item._id, { name: String(item.userId), job: String(item.jobListingId) }];
            const d = await r.json();
            const userProfile = d?.user?.profile || {};
            const name = `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || d?.user?.email || String(item.userId);
            const jobTitle = d?.job?.title || String(item.jobListingId);
            return [item._id, { name, job: jobTitle }];
          } catch {
            return [item._id, { name: String(item.userId), job: String(item.jobListingId) }];
          }
        }));
        setEmployeeLabels(Object.fromEntries(labelEntries));
      } catch {}
    })();
  }, [items]);

  const columns = [
    { title: 'Candidate', key: 'candidate', render: (_, r) => employeeLabels[r._id]?.name || String(r.userId) },
    { title: 'Job', key: 'job', render: (_, r) => employeeLabels[r._id]?.job || String(r.jobListingId) },
    { title: 'Start', dataIndex: 'startDate', key: 'startDate', render: (d) => d ? new Date(d).toLocaleDateString() : '-' },
    { title: 'End', dataIndex: 'endDate', key: 'endDate', render: (d) => d ? new Date(d).toLocaleDateString() : '-' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: statusTag },
    { title: 'Actions', key: 'actions', render: (_, r) => (
      <Space>
        <Button size="small" onClick={() => { setViewing(r); setOpen(true); }}>View</Button>
      </Space>
    ) }
  ];

  const takeAction = async (kind, id, approve, remark) => {
    try {
      const token = localStorage.getItem('jf_token');
      const headers = { 'Content-Type':'application/json', Authorization: `Bearer ${token}` };
      const url = kind === 'ec' ? `${API_BASE_URL}/early-completions/${id}` : `${API_BASE_URL}/internship-terminations/${id}`;
      const r = await fetch(url, { method: 'PATCH', headers, body: JSON.stringify({ action: approve ? 'approve' : 'reject', decisionRemark: !approve ? remark : undefined }) });
      if (!r.ok) throw new Error('Action failed');
      message.success('Updated');
      setRejectOpen(false); rejectForm.resetFields(); setRejectTarget({ kind:null, id:null });
      load();
    } catch (e) { if (e?.errorFields) return; message.error(e.message || 'Failed'); }
  };

  const drawerTitleNode = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Avatar size={32} src={drawerUser?.profile?.avatar}>
        {(drawerUser?.profile?.firstName || drawerUser?.email || 'U').charAt(0)}
      </Avatar>
      <span>
        {drawerUser ? (
          <>
            {`${(drawerUser.profile?.firstName||'') + ' ' + (drawerUser.profile?.lastName||'')}`.trim() || drawerUser.email || viewing?.userId}
            {drawerUser.role ? ` (${drawerUser.role})` : ''}
          </>
        ) : 'Employment details'}
      </span>
    </div>
  );

  return (
    <Layout>
      <Navbar />
      <Layout.Content style={{ padding: 24, minHeight: '80vh' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Title level={2} style={{ margin: 0 }}>Employees</Title>

            {/* Pending requests panel */}
            <Card title="Pending requests" extra={<Button size="small" onClick={load}>Refresh</Button>}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <List
                  header={<b>Early completions</b>}
                  size="small"
                  dataSource={pending.ec}
                  locale={{ emptyText: 'No pending early completions' }}
                  renderItem={(r)=>(
                    <List.Item
                      actions={[
                        <Button key="a" size="small" type="primary" onClick={()=>takeAction('ec', r._id, true)}>Approve</Button>,
                        <Button key="r" size="small" danger onClick={()=>{ setRejectTarget({ kind:'ec', id:r._id }); setRejectOpen(true); }}>Reject</Button>
                      ]}
                    >
                      <Space>
                        <Tag color="blue">EC</Tag>
                        <span>{pendingLabels[String(r.employmentId)] || `Employment: ${String(r.employmentId)}`}</span>
                        {r.reason ? <span>• {r.reason}</span> : null}
                      </Space>
                    </List.Item>
                  )}
                />
                <List
                  header={<b>Terminations</b>}
                  size="small"
                  dataSource={pending.term}
                  locale={{ emptyText: 'No pending terminations' }}
                  renderItem={(r)=>(
                    <List.Item
                      actions={[
                        <Button key="a" size="small" type="primary" onClick={()=>takeAction('term', r._id, true)}>Approve</Button>,
                        <Button key="r" size="small" danger onClick={()=>{ setRejectTarget({ kind:'term', id:r._id }); setRejectOpen(true); }}>Reject</Button>
                      ]}
                    >
                      <Space>
                        <Tag color="red">TERM</Tag>
                        <span>{pendingLabels[String(r.employmentId)] || `Employment: ${String(r.employmentId)}`}</span>
                        {r.reason ? <span>• {r.reason}</span> : null}
                      </Space>
                    </List.Item>
                  )}
                />
              </Space>
            </Card>

            <Card>
              <Table rowKey={r => r._id || r.id} columns={columns} dataSource={items} loading={loading} pagination={{ pageSize: 10 }} />
            </Card>
          </Space>
        </div>
      </Layout.Content>
      <Footer />

      {/* D137: Fix Reject status update - ensure load() is called after reject */}
      <Modal title="Reject request" open={rejectOpen} onCancel={()=>{ setRejectOpen(false); rejectForm.resetFields(); setRejectTarget({ kind:null, id:null }); }} onOk={async()=>{
        try {
          const v = await rejectForm.validateFields();
          await takeAction(rejectTarget.kind, rejectTarget.id, false, v.remark);
          // D137: Ensure status is refreshed after reject
          await load();
        } catch (e) {
          if (e?.errorFields) return;
          message.error(e.message || 'Failed to reject');
        }
      }} okButtonProps={{ danger:true }} okText="Reject">
        <Form form={rejectForm} layout="vertical">
          <Form.Item label="Rejection remark" name="remark" rules={[{ required: true, message: 'Please enter a remark' }]}>
            <Input.TextArea rows={3} placeholder="Explain the rejection" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer title={drawerTitleNode} open={open} onClose={() => setOpen(false)} width={640}>
        {viewing ? <EmployeeDetails record={viewing} /> : null}
      </Drawer>
    </Layout>
  );
}

