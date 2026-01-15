"use client";
import { useEffect, useMemo, useState } from 'react';
import { Layout, Card, Table, Space, Typography, Button, Tag, Tabs, Modal, Form, InputNumber, Input, App } from 'antd';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { API_BASE_URL } from '../../config';

const { Title, Text } = Typography;

const statusText = (s) => ({0:'Applied',1:'Shortlisted',2:'Interview',3:'Active offer',4:'Hired',5:'Rejected',6:'Withdrawn',7:'Not Attending'}[s] || String(s));
const employmentStatusText = (s) => ({0:'Upcoming',1:'Ongoing',2:'Closure',3:'Completed',4:'Terminated'}[s] || String(s));

const tabs = [
  { key: 'applied', label: 'Applied', statuses: [0] },
  { key: 'shortlisted', label: 'Short-listed', statuses: [1,2] },
  { key: 'offer', label: 'Active offer', statuses: [3] },
  { key: 'hired', label: 'Hired', statuses: [4] },
  { key: 'withdrawn', label: 'Withdraw', statuses: [6] },
  { key: 'rejected', label: 'Rejected', statuses: [5] }
];

export default function MyApplicationsPage(){
  const { message } = App.useApp();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeKey, setActiveKey] = useState('applied');
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendForm] = Form.useForm();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawForm] = Form.useForm();
  const [withdrawing, setWithdrawing] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [currentStatus, setCurrentStatus] = useState(null);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerRecord, setOfferRecord] = useState(null);
  const [offerLetterUrl, setOfferLetterUrl] = useState(null);
  const [declineForm] = Form.useForm();


  async function load(){
    try {
      setLoading(true);
      const token = localStorage.getItem('jf_token');
      if (!token) { window.location.href = '/login'; return; }
      const res = await fetch(`${API_BASE_URL}/applications?$sort[createdAt]=-1`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      const data = Array.isArray(json) ? json : (json?.data || []);

      // For hired applications (status 4), fetch employment records to check employment status
      const hiredApps = data.filter(app => app.status === 4);
      if (hiredApps.length > 0) {
        const empRes = await fetch(`${API_BASE_URL}/employment-records?$limit=100`, { headers: { Authorization: `Bearer ${token}` } });
        const empJson = await empRes.json();
        const employments = Array.isArray(empJson) ? empJson : (empJson?.data || []);

        // Map employment status to applications
        data.forEach(app => {
          if (app.status === 4) {
            const employment = employments.find(emp => String(emp.applicationId) === String(app._id));
            if (employment) {
              app.employmentStatus = employment.status;
            }
          }
        });
      }

      // Company data is now populated by backend, no need to fetch separately
      setItems(data);
    } catch (e) { message.error(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const def = tabs.find(t => t.key === activeKey)?.statuses || [];
    return items.filter(i => def.includes(i.status));
  }, [items, activeKey]);

  async function doWithdraw(id, status){
    try {
      setWithdrawing(true);
      const v = await withdrawForm.validateFields();
      const token = localStorage.getItem('jf_token');
      await fetch(`${API_BASE_URL}/applications/${id}`, { method: 'PATCH', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'withdraw', reason: v.reason }) });
      message.success('Application withdrawn');
      setWithdrawOpen(false); withdrawForm.resetFields();
      load();
    } catch (e) { if (e?.errorFields) return; message.error(e.message || 'Failed'); }
    finally { setWithdrawing(false); }
  }

  async function extendValidity(id){
    try {
      const v = await extendForm.validateFields();
      const days = Number(v.days || 7);
      const token = localStorage.getItem('jf_token');
      const res = await fetch(`${API_BASE_URL}/applications/${id}`, { method: 'PATCH', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'extendValidity', days }) });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to extend validity: ${res.status}`);
      }

      // D83: Show success notification and update display immediately
      const updatedApp = await res.json();
      message.success(`Validity extended by ${days} day${days > 1 ? 's' : ''}. New validity date: ${updatedApp.validityUntil ? new Date(updatedApp.validityUntil).toLocaleDateString() : 'N/A'}`);
      setExtendOpen(false);
      extendForm.resetFields();
      // D84: Refresh list to show updated validity date
      await load();
    } catch (e) {
      if (e?.errorFields) return;
      message.error(e.message || 'Failed to extend validity');
    }
  }

  async function viewPdf(r){
    try {
      const key = r.pdfKey;
      if (!key) { message.info('No PDF'); return; }
      const token = localStorage.getItem('jf_token');
      const u = await fetch(`${API_BASE_URL}/upload/${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await u.json();
      const url = j.signedUrl || j.publicUrl;
      if (url) window.open(url, '_blank'); else message.error('Failed to resolve PDF');
    } catch (e) { message.error(e.message || 'Failed to open PDF'); }
  }

  async function viewFile(key) {
    try {
      if (!key) { message.info('No file'); return; }
      const token = localStorage.getItem('jf_token');
      const res = await fetch(`${API_BASE_URL}/upload/${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const url = data.signedUrl || data.publicUrl;
      if (url) window.open(url, '_blank'); else message.error('Failed to resolve file');
    } catch (e) { message.error(e.message || 'Failed to open file'); }
  }

  function openOffer(record){
    setOfferRecord(record);
    setOfferOpen(true);
    setOfferLetterUrl(null);
    (async () => {
      try {
        const key = record?.offer?.letterKey;
        if (!key) return;
        const token = localStorage.getItem('jf_token');
        const r = await fetch(`${API_BASE_URL}/upload/${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${token}` } });
        if (r.ok) { const j = await r.json(); setOfferLetterUrl(j.signedUrl || j.publicUrl || null); }
      } catch {}
    })();
  }

  async function acceptOffer(id){
    try {
      const token = localStorage.getItem('jf_token');
      await fetch(`${API_BASE_URL}/applications/${id}`, { method: 'PATCH', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'acceptOffer' }) });
      message.success('Offer accepted');
      setOfferOpen(false); setOfferRecord(null); setOfferLetterUrl(null);
      // Redirect to employment page to proceed with onboarding/actions
      window.location.href = '/employment';
    } catch (e) { message.error(e.message || 'Failed'); }
  }

  async function declineOffer(id){
    try {
      const v = await declineForm.validateFields();
      const token = localStorage.getItem('jf_token');
      await fetch(`${API_BASE_URL}/applications/${id}`, { method: 'PATCH', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'declineOffer', reason: v.reason || '' }) });
      message.success('Offer declined');
      setOfferOpen(false); setOfferRecord(null); setOfferLetterUrl(null); declineForm.resetFields();
      load();
    } catch (e) { if (e?.errorFields) return; message.error(e.message || 'Failed'); }
  }

  function handleRowClick(record) {
    // If hired (status 4), navigate to employment page with application ID
    if (record.status === 4) {
      window.location.href = `/employment?applicationId=${record._id}`;
    }
  }

  const columns = [
    {
      title: 'Company',
      key: 'company',
      render: (_, r) => r.company?.name || r.companyName || <Text type="secondary">Company unavailable</Text>
    },
    { title: 'Application date', dataIndex: 'createdAt', render: (d) => d ? new Date(d).toLocaleString() : '-' },
    { title: 'Application status', dataIndex: 'status', render: (s, r) => {
      // D39: Show application status with proper color, and employment status for hired apps
      const statusLabel = statusText(s);
      const statusColorMap = { 0: 'blue', 1: 'cyan', 2: 'purple', 3: 'gold', 4: 'green', 5: 'red', 6: 'default', 7: 'default' };
      const statusTag = <Tag color={statusColorMap[s]}>{statusLabel}</Tag>;
      
      // For hired applications (status 4), also show employment status if available
      if (s === 4 && r.employmentStatus !== undefined) {
        const empStatusLabel = employmentStatusText(r.employmentStatus);
        const empColorMap = { 0: 'blue', 1: 'green', 2: 'orange', 3: 'default', 4: 'red' };
        return (
          <Space direction="vertical" size="small">
            {statusTag}
            <Tag color={empColorMap[r.employmentStatus]}>{empStatusLabel}</Tag>
          </Space>
        );
      }
      return statusTag;
    } },
    { title: 'Validity', key: 'validity', render: (_, r) => r.validityUntil ? new Date(r.validityUntil).toLocaleDateString() : '-' },
    { title: 'Last Update', key: 'last', render: (_, r) => r.updatedAt ? new Date(r.updatedAt).toLocaleString() : (r.history?.length ? new Date(r.history[r.history.length-1].at).toLocaleString() : '-') },
    { title: 'Submitted CV', key: 'cv', render: (_, r) => {
      // Check if resume is in attachments array (first attachment is usually the resume)
      const resumeKey = r.attachments?.[0];
      if (resumeKey) {
        return <Button size="small" onClick={(e)=>{e.stopPropagation(); viewFile(resumeKey);}}>View Resume</Button>;
      }
      return '-';
    }},
    { title: 'Action', key: 'action', render: (_, r) => {
      // For hired applications (status 4), check employment status
      // Don't allow withdraw if employment is in CLOSURE (2), COMPLETED (3), or TERMINATED (4)
      const isHiredWithAdvancedEmployment = r.status === 4 && r.employmentStatus >= 2;
      const canWithdraw = [0,1,2,3,4].includes(r.status) && !isHiredWithAdvancedEmployment;
      const canExtend = r.status === 0 && !r.extendedOnce;

      return (
        <Space onClick={(e) => e.stopPropagation()}>
          {r.status === 3 && <Button size="small" type="primary" onClick={()=>openOffer(r)}>View offer</Button>}
          {r.status === 4 && <Button size="small" type="primary" onClick={()=>handleRowClick(r)}>View Employment</Button>}
          {canExtend && <Button size="small" onClick={()=>{ setCurrentId(r._id); setExtendOpen(true); }}>Extend validity</Button>}
          {canWithdraw && <Button danger size="small" style={{ }} onClick={()=>{ setCurrentId(r._id); setCurrentStatus(r.status); setWithdrawOpen(true); }}>Withdraw</Button>}
        </Space>
      );
    } }
  ];

  return (
    <App>
      <Layout style={{ minHeight: '100vh' }}>
        <Navbar />
        <Layout.Content style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Title level={2} style={{ margin: 0 }}>My Applications</Title>
            <Card>
              <Tabs activeKey={activeKey} onChange={setActiveKey} items={tabs} />
              <Table
                rowKey="_id"
                columns={columns}
                dataSource={filtered}
                loading={loading}
                pagination={{ pageSize: 10 }}
                onRow={(record) => ({
                  onClick: () => handleRowClick(record),
                  style: record.status === 4 ? { cursor: 'pointer' } : {}
                })}
              />
            </Card>
          </Space>
        </Layout.Content>
        <Footer />

      <Modal
        title="Extend application validity"
        open={extendOpen}
        onCancel={()=> setExtendOpen(false)}
        onOk={()=>extendValidity(currentId)}
        okText="Extend"
      >
        <Form form={extendForm} layout="vertical" initialValues={{ days: 7 }}>
          <Form.Item label="Extend by (days)" name="days" rules={[{ required: true, message: 'Please input days' }, { type: 'number', min: 1, max: 30 }]}>
            <InputNumber min={1} max={30} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Withdraw application" open={withdrawOpen} onCancel={()=>{ setWithdrawOpen(false); withdrawForm.resetFields(); }} onOk={()=>doWithdraw(currentId, currentStatus)} okText="Withdraw" okButtonProps={{ danger: true }}>
        <Form form={withdrawForm} layout="vertical">
          {currentStatus === 4 && (
            <Typography.Paragraph type="warning">Caution: Withdrawing a hired application may impact your onboarding. (KF message placeholder)</Typography.Paragraph>
          )}
          <Form.Item label="Reason" name="reason" rules={[{ required: true, message: 'Please enter a reason' }]}>
            <Input.TextArea rows={3} placeholder="Why do you want to withdraw?" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Offer details" open={offerOpen} onCancel={()=>{ setOfferOpen(false); setOfferRecord(null); setOfferLetterUrl(null); }} footer={null}>
        {offerRecord ? (
          <Space direction="vertical" style={{ width:'100%' }}>
            <Typography.Paragraph><b>Company:</b> {offerRecord.company?.name || offerRecord.companyName || '-'}</Typography.Paragraph>
            <Typography.Paragraph><b>Title:</b> {offerRecord.offer?.title || '-'}</Typography.Paragraph>
            <Typography.Paragraph><b>Notes:</b> {offerRecord.offer?.notes || '-'}</Typography.Paragraph>
            <Typography.Paragraph><b>Offer valid until:</b> {offerRecord.offer?.validUntil ? new Date(offerRecord.offer.validUntil).toLocaleDateString() : '-'}</Typography.Paragraph>
            <Typography.Paragraph>
              <b>Letter of offer:</b> {offerLetterUrl ? <a href={offerLetterUrl} target="_blank" rel="noreferrer">View letter</a> : (offerRecord.offer?.letterKey ? 'Resolving…' : '-')}
            </Typography.Paragraph>
            <Space>
              <Button type="primary" onClick={()=>acceptOffer(offerRecord._id)}>Accept offer</Button>
              <Button danger onClick={()=>{ declineForm.resetFields(); Modal.confirm({
                title:'Decline offer?',
                content: (
                  <Form form={declineForm} layout="vertical">
                    <Form.Item label="Reason (optional)" name="reason">
                      <Input.TextArea rows={3} placeholder="Why are you declining?" />
                    </Form.Item>
                  </Form>
                ),
                okText:'Decline', okButtonProps:{ danger:true },
                onOk: () => declineOffer(offerRecord._id)
              }); }}>Decline</Button>
            </Space>
          </Space>
        ) : null}
      </Modal>

      </Layout>
    </App>
  );
}

