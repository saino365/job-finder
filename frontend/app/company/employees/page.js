"use client";

import { useEffect, useState, useCallback } from 'react';
import { Layout, Typography, Card, Table, Tag, Space, Button, Drawer, message, Avatar, List, Modal, Form, Input, DatePicker } from 'antd';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import UserAvatar from '../../../components/UserAvatar';
import { API_BASE_URL } from '../../../config';
import dynamic from 'next/dynamic';
import dayjs from 'dayjs';

const { Title } = Typography;

const EmployeeDetails = dynamic(() => import('../../../components/company/EmployeeDetails'), { ssr: false, loading: () => <div /> });

const statusTag = (s) => {
  const map = { 1: { c: 'green', t: 'Hired' }, 2: { c: 'purple', t: 'Closure' }, 3: { c: 'green', t: 'Completed' }, 4: { c: 'red', t: 'Terminated' } };
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

  // Action modals for current employees
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendForm] = Form.useForm();
  const [extendTarget, setExtendTarget] = useState(null);

  const [ecInitiateOpen, setEcInitiateOpen] = useState(false);
  const [ecInitiateForm] = Form.useForm();
  const [ecInitiateTarget, setEcInitiateTarget] = useState(null);

  const [terminateOpen, setTerminateOpen] = useState(false);
  const [terminateForm] = Form.useForm();
  const [terminateTarget, setTerminateTarget] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('jf_token');
      if (!token) { message.info('Please sign in'); window.location.href = '/login'; return; }
      const headers = { Authorization: `Bearer ${token}` };
      // Fetch all employment records with sorting by createdAt descending and no pagination limit
      const res = await fetch(`${API_BASE_URL}/employment-records?$sort[createdAt]=-1&$limit=1000`, { headers });
      if (!res.ok) throw new Error('Failed to load employees');
      const j = await res.json();
      const allRecords = Array.isArray(j?.data) ? j.data : (Array.isArray(j) ? j : []);
      // Show all employment records - the backend already filters by company
      // No need to filter by application status since employment records are only created for hired applications
      setItems(allRecords);
      // load pending reqs (company scoped by service find hook)
      const [ecR, tR] = await Promise.all([
        fetch(`${API_BASE_URL}/early-completions?status=0&$sort[createdAt]=-1&$limit=1000`, { headers }),
        fetch(`${API_BASE_URL}/internship-terminations?status=0&$sort[createdAt]=-1&$limit=1000`, { headers })
      ]);
      const ecJson = ecR.ok ? await ecR.json() : { data: [] };
      const termJson = tR.ok ? await tR.json() : { data: [] };
      const ec = Array.isArray(ecJson?.data) ? ecJson.data : (Array.isArray(ecJson) ? ecJson : []);
      const term = Array.isArray(termJson?.data) ? termJson.data : (Array.isArray(termJson) ? termJson : []);
      setPending({ ec, term });

      // Pre-fetch labels (employee name + position + avatar) for pending requests
      const ids = Array.from(new Set([
        ...ec.map(r => String(r.employmentId)),
        ...term.map(r => String(r.employmentId))
      ].filter(Boolean)));
      const labelEntries = await Promise.all(ids.map(async (id) => {
        try {
          const r = await fetch(`${API_BASE_URL}/employment-detail/${id}`, { headers });
          if (!r.ok) return [id, { text: `Employment: ${id}`, name: `Employment: ${id}`, avatar: null }];
          const d = await r.json();
          const emp = d?.employment || {};
          const job = d?.job || {};
          
          // Try to get name from application form first, then user profile
          const personalInfo = d?.application?.form?.personalInfo;
          const userProfile = d?.user?.profile || {};
          
          let name = '';
          let avatar = null;
          
          if (personalInfo) {
            const parts = [
              personalInfo.firstName || '',
              personalInfo.middleName || '',
              personalInfo.lastName || ''
            ].filter(Boolean);
            name = parts.join(' ').trim();
            avatar = personalInfo.avatar || null;
          }
          
          if (!name) {
            name = `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim();
            avatar = userProfile.avatar || null;
          }
          
          if (!name) {
            name = d?.user?.email || String(emp.userId || '');
          }
          
          const title = job.title || 'Intern';
          return [id, { text: `${name} – ${title}`, name, avatar }];
        } catch {
          return [id, { text: `Employment: ${id}`, name: `Employment: ${id}`, avatar: null }];
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
            if (!r.ok) return [item._id, { name: String(item.userId), job: String(item.jobListingId), avatar: null }];
            const d = await r.json();
            
            // Try to get name from application form first, then user profile
            const personalInfo = d?.application?.form?.personalInfo;
            const userProfile = d?.user?.profile || {};
            
            let name = '';
            let avatar = null;
            
            if (personalInfo) {
              // Use firstName + middleName + lastName from application form
              const parts = [
                personalInfo.firstName || '',
                personalInfo.middleName || '',
                personalInfo.lastName || ''
              ].filter(Boolean);
              name = parts.join(' ').trim();
              avatar = personalInfo.avatar || null;
            }
            
            // Fallback to user profile if no name from application
            if (!name) {
              name = `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim();
              avatar = userProfile.avatar || null;
            }
            
            // Final fallback to email or userId
            if (!name) {
              name = d?.user?.email || String(item.userId);
            }
            
            const jobTitle = d?.job?.title || String(item.jobListingId);
            return [item._id, { name, job: jobTitle, avatar }];
          } catch {
            return [item._id, { name: String(item.userId), job: String(item.jobListingId), avatar: null }];
          }
        }));
        setEmployeeLabels(Object.fromEntries(labelEntries));
      } catch {}
    })();
  }, [items]);

  const columns = [
    { 
      title: 'Candidate', 
      key: 'candidate', 
      render: (_, r) => {
        const label = employeeLabels[r._id];
        return (
          <Space>
            <UserAvatar 
              name={label?.name || String(r.userId)} 
              avatarUrl={label?.avatar || ''} 
              size={32} 
            />
            <span>{label?.name || String(r.userId)}</span>
          </Space>
        );
      }
    },
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

  // Handler for extending employment
  const handleExtend = async () => {
    try {
      const values = await extendForm.validateFields();
      const token = localStorage.getItem('jf_token');
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      const res = await fetch(`${API_BASE_URL}/internship-extensions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          employmentId: extendTarget._id,
          newEndDate: values.newEndDate.toDate(),
          reason: values.reason
        })
      });
      if (!res.ok) throw new Error('Failed to create extension');
      message.success('Extension created successfully');
      setExtendOpen(false);
      extendForm.resetFields();
      setExtendTarget(null);
      load();
    } catch (e) {
      if (e?.errorFields) return;
      message.error(e.message || 'Failed to extend employment');
    }
  };

  // Handler for initiating early completion
  const handleEarlyCompletion = async () => {
    try {
      const values = await ecInitiateForm.validateFields();
      const token = localStorage.getItem('jf_token');
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      const res = await fetch(`${API_BASE_URL}/early-completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          employmentId: ecInitiateTarget._id,
          reason: values.reason,
          proposedCompletionDate: values.proposedCompletionDate ? values.proposedCompletionDate.toDate() : null
        })
      });
      if (!res.ok) throw new Error('Failed to create early completion request');
      message.success('Early completion request created');
      setEcInitiateOpen(false);
      ecInitiateForm.resetFields();
      setEcInitiateTarget(null);
      load();
    } catch (e) {
      if (e?.errorFields) return;
      message.error(e.message || 'Failed to create early completion');
    }
  };

  // Handler for initiating termination
  const handleTerminate = async () => {
    try {
      const values = await terminateForm.validateFields();
      const token = localStorage.getItem('jf_token');
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      const res = await fetch(`${API_BASE_URL}/internship-terminations`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          employmentId: terminateTarget._id,
          initiatedBy: 'company',
          reason: values.reason,
          remark: values.remark,
          proposedLastDay: values.proposedLastDay ? values.proposedLastDay.toDate() : null
        })
      });
      if (!res.ok) throw new Error('Failed to create termination request');
      message.success('Termination request created');
      setTerminateOpen(false);
      terminateForm.resetFields();
      setTerminateTarget(null);
      load();
    } catch (e) {
      if (e?.errorFields) return;
      message.error(e.message || 'Failed to create termination');
    }
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

            {/* Current Employees - HIRED only */}
            <Card title="Current Employees" extra={<Button size="small" onClick={load}>Refresh</Button>}>
              <Table
                rowKey={r => r._id || r.id}
                columns={[
                  { 
                    title: 'Candidate', 
                    key: 'candidate', 
                    render: (_, r) => {
                      const label = employeeLabels[r._id];
                      return (
                        <Space>
                          <UserAvatar 
                            name={label?.name || String(r.userId)} 
                            avatarUrl={label?.avatar || ''} 
                            size={32} 
                          />
                          <span>{label?.name || String(r.userId)}</span>
                        </Space>
                      );
                    }
                  },
                  { title: 'Job', key: 'job', render: (_, r) => employeeLabels[r._id]?.job || String(r.jobListingId) },
                  { title: 'Start', dataIndex: 'startDate', key: 'startDate', render: (d) => d ? new Date(d).toLocaleDateString() : '-' },
                  { title: 'End', dataIndex: 'endDate', key: 'endDate', render: (d) => d ? new Date(d).toLocaleDateString() : '-' },
                  { title: 'Status', dataIndex: 'status', key: 'status', render: statusTag },
                  { 
                    title: 'Actions', 
                    key: 'actions', 
                    render: (_, r) => (
                      <Space>
                        <Button size="small" onClick={() => { setViewing(r); setOpen(true); }}>View</Button>
                        {r.status === 1 && (
                          <>
                            <Button size="small" type="primary" onClick={() => { setExtendTarget(r); setExtendOpen(true); }}>Extend</Button>
                            <Button size="small" onClick={() => { setEcInitiateTarget(r); setEcInitiateOpen(true); }}>Early Completion</Button>
                            <Button size="small" danger onClick={() => { setTerminateTarget(r); setTerminateOpen(true); }}>Terminate</Button>
                          </>
                        )}
                      </Space>
                    ) 
                  }
                ]}
                dataSource={items.filter(item => item.status === 1)} // HIRED only
                loading={loading}
                pagination={{ pageSize: 10 }}
                locale={{ emptyText: 'No current employees' }}
              />
            </Card>

            {/* Pending requests panel */}
            <Card title="Pending requests" extra={<Button size="small" onClick={load}>Refresh</Button>}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <List
                  header={<b>Early completions</b>}
                  size="small"
                  dataSource={pending.ec}
                  locale={{ emptyText: 'No pending early completions' }}
                  renderItem={(r)=>{
                    const label = pendingLabels[String(r.employmentId)];
                    return (
                      <List.Item
                        actions={[
                          <Button key="a" size="small" type="primary" onClick={()=>takeAction('ec', r._id, true)}>Approve</Button>,
                          <Button key="r" size="small" danger onClick={()=>{ setRejectTarget({ kind:'ec', id:r._id }); setRejectOpen(true); }}>Reject</Button>
                        ]}
                      >
                        <Space>
                          <Tag color="blue">EC</Tag>
                          {label ? (
                            <Space>
                              <UserAvatar 
                                name={label.name} 
                                avatarUrl={label.avatar || ''} 
                                size={32} 
                              />
                              <span>{label.text}</span>
                            </Space>
                          ) : (
                            <span>{`Employment: ${String(r.employmentId)}`}</span>
                          )}
                          {r.reason ? <span>• {r.reason}</span> : null}
                        </Space>
                      </List.Item>
                    );
                  }}
                />
                <List
                  header={<b>Terminations</b>}
                  size="small"
                  dataSource={pending.term}
                  locale={{ emptyText: 'No pending terminations' }}
                  renderItem={(r)=>{
                    const label = pendingLabels[String(r.employmentId)];
                    return (
                      <List.Item
                        actions={[
                          <Button key="a" size="small" type="primary" onClick={()=>takeAction('term', r._id, true)}>Approve</Button>,
                          <Button key="r" size="small" danger onClick={()=>{ setRejectTarget({ kind:'term', id:r._id }); setRejectOpen(true); }}>Reject</Button>
                        ]}
                      >
                        <Space>
                          <Tag color="red">TERM</Tag>
                          {label ? (
                            <Space>
                              <UserAvatar 
                                name={label.name} 
                                avatarUrl={label.avatar || ''} 
                                size={32} 
                              />
                              <span>{label.text}</span>
                            </Space>
                          ) : (
                            <span>{`Employment: ${String(r.employmentId)}`}</span>
                          )}
                          {r.reason ? <span>• {r.reason}</span> : null}
                        </Space>
                      </List.Item>
                    );
                  }}
                />
              </Space>
            </Card>

            {/* All Employees - HIRED, CLOSURE, and TERMINATED */}
            <Card title="All Employees">
              <Table 
                rowKey={r => r._id || r.id} 
                columns={columns} 
                dataSource={items} // All employment records
                loading={loading} 
                pagination={{ pageSize: 10 }} 
              />
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

      {/* Extend Employment Modal */}
      <Modal
        title="Extend Employment"
        open={extendOpen}
        onCancel={() => { setExtendOpen(false); extendForm.resetFields(); setExtendTarget(null); }}
        onOk={handleExtend}
        okText="Extend"
      >
        <Form form={extendForm} layout="vertical">
          <Form.Item
            label="New End Date"
            name="newEndDate"
            rules={[{ required: true, message: 'Please select new end date' }]}
          >
            <DatePicker
              style={{ width: '100%' }}
              disabledDate={(current) => {
                if (!extendTarget?.endDate) return false;
                return current && current <= dayjs(extendTarget.endDate);
              }}
            />
          </Form.Item>
          <Form.Item
            label="Reason for Extension"
            name="reason"
            rules={[{ required: true, message: 'Please provide a reason' }]}
          >
            <Input.TextArea rows={3} placeholder="Explain why the employment is being extended..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Early Completion Modal */}
      <Modal
        title="Initiate Early Completion"
        open={ecInitiateOpen}
        onCancel={() => { setEcInitiateOpen(false); ecInitiateForm.resetFields(); setEcInitiateTarget(null); }}
        onOk={handleEarlyCompletion}
        okText="Create Request"
      >
        <Form form={ecInitiateForm} layout="vertical">
          <Form.Item
            label="Reason for Early Completion"
            name="reason"
            rules={[{ required: true, message: 'Please provide a reason' }]}
          >
            <Input.TextArea rows={4} placeholder="Explain why the employment should complete early..." />
          </Form.Item>
          <Form.Item
            label="Proposed Completion Date"
            name="proposedCompletionDate"
          >
            <DatePicker
              style={{ width: '100%' }}
              disabledDate={(current) => {
                if (!ecInitiateTarget?.endDate) return current && current < dayjs().startOf('day');
                return current && (current < dayjs().startOf('day') || current >= dayjs(ecInitiateTarget.endDate));
              }}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Terminate Employment Modal */}
      <Modal
        title="Terminate Employment"
        open={terminateOpen}
        onCancel={() => { setTerminateOpen(false); terminateForm.resetFields(); setTerminateTarget(null); }}
        onOk={handleTerminate}
        okText="Create Termination"
        okButtonProps={{ danger: true }}
      >
        <Form form={terminateForm} layout="vertical">
          <Form.Item
            label="Reason for Termination"
            name="reason"
            rules={[{ required: true, message: 'Please provide a reason' }]}
          >
            <Input.TextArea rows={4} placeholder="Explain why the employment is being terminated..." />
          </Form.Item>
          <Form.Item
            label="Additional Remarks"
            name="remark"
          >
            <Input.TextArea rows={3} placeholder="Any additional information..." />
          </Form.Item>
          <Form.Item
            label="Proposed Last Day"
            name="proposedLastDay"
            rules={[{ required: true, message: 'Please select proposed last day' }]}
          >
            <DatePicker
              style={{ width: '100%' }}
              disabledDate={(current) => current && current < dayjs().startOf('day')}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}

