"use client";
import { useEffect, useMemo, useState } from 'react';
import { Layout, Card, Table, Space, Typography, Button, Tag, Tabs, Modal, Form, InputNumber, Input, App, Descriptions, Upload, message as antdMessage } from 'antd';
import { UploadOutlined, FilePdfOutlined } from '@ant-design/icons';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { API_BASE_URL } from '../../config';

const { Title, Text } = Typography;

const statusText = (s) => {
  return {0:'Applied',1:'Shortlisted',2:'Interview',3:'Active offer',4:'Hired',5:'Rejected',6:'Withdrawn',7:'Not Attending',8:'Accepted - Pending Review'}[s] || String(s);
};

const tabs = [
  { key: 'applied', label: 'Applied', statuses: [0] },
  { key: 'shortlisted', label: 'Short-listed', statuses: [1,2] },
  { key: 'offer', label: 'Active offer', statuses: [3, 8] },
  { key: 'hired', label: 'Hired', statuses: [4], employmentStatuses: [0, 1, 2, 3] }, // Exclude terminated (4)
  { key: 'terminated', label: 'Terminated', statuses: [4], employmentStatuses: [4] }, // Only terminated
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
  const [signedOfferFile, setSignedOfferFile] = useState(null);
  const [uploadingSignedOffer, setUploadingSignedOffer] = useState(false);
  const [declineForm] = Form.useForm();
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declining, setDeclining] = useState(false);


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
    const tab = tabs.find(t => t.key === activeKey);
    if (!tab) return [];
    
    const statusFilter = tab.statuses || [];
    const empStatusFilter = tab.employmentStatuses;
    
    return items.filter(i => {
      // Check if application status matches
      if (!statusFilter.includes(i.status)) return false;
      
      // If tab has employment status filter, apply it
      if (empStatusFilter !== undefined && i.status === 4) {
        // For hired applications, check employment status
        // If employment status is not loaded, exclude from filtered results
        if (i.employmentStatus === undefined) return false;
        return empStatusFilter.includes(i.employmentStatus);
      }
      
      return true;
    });
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
      if (!signedOfferFile) {
        message.error('Please upload the signed offer letter before accepting');
        return;
      }

      setUploadingSignedOffer(true);
      const token = localStorage.getItem('jf_token');
      
      // Upload signed offer letter using the upload service
      const formData = new FormData();
      formData.append('signedOfferLetter', signedOfferFile);
      
      const uploadRes = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      
      if (!uploadRes.ok) {
        throw new Error('Failed to upload signed offer letter');
      }
      
      const uploadData = await uploadRes.json();
      const signedOfferKey = uploadData?.files?.signedOfferLetter?.[0]?.key;
      
      if (!signedOfferKey) {
        throw new Error('Failed to get signed offer letter key');
      }
      
      // Then accept the offer with the signed offer letter key
      await fetch(`${API_BASE_URL}/applications/${id}`, { 
        method: 'PATCH', 
        headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, 
        body: JSON.stringify({ 
          action: 'acceptOffer',
          signedOfferLetterKey: signedOfferKey
        }) 
      });
      
      message.success('Offer accepted! Waiting for company to finalize the hire.');
      setOfferOpen(false); 
      setOfferRecord(null); 
      setOfferLetterUrl(null);
      setSignedOfferFile(null);
      // Reload the applications list instead of redirecting
      load();
    } catch (e) { 
      message.error(e.message || 'Failed to accept offer'); 
    } finally {
      setUploadingSignedOffer(false);
    }
  }

  async function declineOffer(){
    try {
      setDeclining(true);
      const v = await declineForm.validateFields();
      const token = localStorage.getItem('jf_token');
      const res = await fetch(`${API_BASE_URL}/applications/${offerRecord._id}`, { method: 'PATCH', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'declineOffer', reason: v.reason || '' }) });

      if (!res.ok) {
        let errorMessage = 'Failed to decline offer';
        try {
          const errorData = await res.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          const errorText = await res.text();
          if (errorText) errorMessage = errorText;
        }
        throw new Error(errorMessage);
      }

      message.success('Offer declined');
      setDeclineOpen(false);
      setOfferOpen(false);
      setOfferRecord(null);
      setOfferLetterUrl(null);
      declineForm.resetFields();
      load();
    } catch (e) {
      if (e?.errorFields) return;
      message.error(e.message || 'Failed to decline offer');
    } finally {
      setDeclining(false);
    }
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
    { 
      title: 'Application status', 
      dataIndex: 'status', 
      render: (s, r) => {
        const statusLabel = statusText(s);
        const statusColorMap = { 0: 'blue', 1: 'cyan', 2: 'purple', 3: 'gold', 4: 'green', 5: 'red', 6: 'default', 7: 'default', 8: 'green' };
        
        const color = statusColorMap[s];
        const statusTag = <Tag color={color}>{statusLabel}</Tag>;
        
        // For hired applications (status 4), show employment status if available
        // But DON'T show "Hired" tag if employment is terminated
        if (s === 4 && r.employmentStatus !== undefined) {
          const empColorMap = { 0: 'blue', 1: 'green', 2: 'orange', 3: 'default', 4: 'red' };
          
          // If terminated, only show Terminated tag, not Hired
          if (r.employmentStatus === 4) {
            return <Tag color={empColorMap[4]}>Terminated</Tag>;
          }
          
          // For other employment statuses (Upcoming, Ongoing, Closure, Completed), just show "Hired"
          return statusTag;
        }
        
        // For withdrawn (6), show reason if available (student's own reason)
        // For rejected (5), DON'T show reason to students (company's reason)
        if (s === 6 && r.rejection?.reason) {
          return (
            <Space direction="vertical" size="small">
              {statusTag}
              <Text type="secondary" style={{ fontSize: 12 }}>
                {r.rejection.reason.length > 50 
                  ? r.rejection.reason.substring(0, 50) + '...' 
                  : r.rejection.reason}
              </Text>
            </Space>
          );
        }
        
        return statusTag;
      } 
    },
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
      // D134: Disable withdraw button for hired status (status 4) - status closure should not be under Hired
      // For hired applications (status 4), check employment status
      // Don't allow withdraw if employment is in CLOSURE (2), COMPLETED (3), or TERMINATED (4)
      const isHiredWithAdvancedEmployment = r.status === 4 && r.employmentStatus >= 2;
      // D134: Disable withdraw for hired status (status 4) regardless of employment status
      const canWithdraw = [0,1,2,3].includes(r.status) && !isHiredWithAdvancedEmployment;
      const canExtend = r.status === 0 && !r.extendedOnce;

      return (
        <Space onClick={(e) => e.stopPropagation()}>
          {r.status === 3 && <Button size="small" type="primary" onClick={()=>openOffer(r)}>View offer</Button>}
          {r.status === 8 && <Tag color="green">Waiting for company review</Tag>}
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

      <Modal 
        title={<Typography.Title level={4} style={{ margin: 0 }}>Offer Details</Typography.Title>} 
        open={offerOpen} 
        onCancel={()=>{ 
          setOfferOpen(false); 
          setOfferRecord(null); 
          setOfferLetterUrl(null); 
          setSignedOfferFile(null);
        }} 
        footer={null}
        width={600}
      >
        {offerRecord ? (
          <Space direction="vertical" size="large" style={{ width:'100%' }}>
            <Card size="small" style={{ background: '#f5f5f5' }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label={<Typography.Text strong>Company</Typography.Text>}>
                  {offerRecord.company?.name || offerRecord.companyName || '-'}
                </Descriptions.Item>
                <Descriptions.Item label={<Typography.Text strong>Position</Typography.Text>}>
                  {offerRecord.offer?.title || '-'}
                </Descriptions.Item>
                <Descriptions.Item label={<Typography.Text strong>Start Date</Typography.Text>}>
                  {offerRecord.offer?.startDate ? new Date(offerRecord.offer.startDate).toLocaleDateString() : '-'}
                </Descriptions.Item>
                <Descriptions.Item label={<Typography.Text strong>End Date</Typography.Text>}>
                  {offerRecord.offer?.endDate ? new Date(offerRecord.offer.endDate).toLocaleDateString() : '-'}
                </Descriptions.Item>
                <Descriptions.Item label={<Typography.Text strong>Offer Valid Until</Typography.Text>}>
                  <Typography.Text type={offerRecord.offer?.validUntil && new Date(offerRecord.offer.validUntil) < new Date() ? 'danger' : undefined}>
                    {offerRecord.offer?.validUntil ? new Date(offerRecord.offer.validUntil).toLocaleDateString() : '-'}
                  </Typography.Text>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {offerRecord.offer?.notes && (
              <Card size="small" title={<Typography.Text strong>Additional Notes</Typography.Text>}>
                <Typography.Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                  {offerRecord.offer.notes}
                </Typography.Paragraph>
              </Card>
            )}

            <Card size="small" title={<Typography.Text strong>Offer Letter</Typography.Text>}>
              {offerLetterUrl ? (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Typography.Link href={offerLetterUrl} target="_blank" rel="noreferrer" style={{ fontSize: 16 }}>
                    📄 View Offer Letter
                  </Typography.Link>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Please review the offer letter before accepting
                  </Typography.Text>
                </Space>
              ) : offerRecord.offer?.letterKey ? (
                <Typography.Text type="secondary">Loading offer letter...</Typography.Text>
              ) : (
                <Typography.Text type="danger">No offer letter available</Typography.Text>
              )}
            </Card>

            <Card 
              size="small" 
              title={<Typography.Text strong>Upload Signed Offer Letter</Typography.Text>}
              style={{ borderColor: !signedOfferFile ? '#ff4d4f' : '#52c41a' }}
            >
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Please download the offer letter above, sign it, and upload the signed copy here before accepting.
                </Typography.Text>
                <Upload
                  accept=".pdf,.doc,.docx"
                  maxCount={1}
                  beforeUpload={(file) => {
                    const isValidType = file.type === 'application/pdf' || 
                                       file.type === 'application/msword' || 
                                       file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                    if (!isValidType) {
                      antdMessage.error('You can only upload PDF or Word documents');
                      return Upload.LIST_IGNORE;
                    }
                    const isLt10M = file.size / 1024 / 1024 < 10;
                    if (!isLt10M) {
                      antdMessage.error('File must be smaller than 10MB');
                      return Upload.LIST_IGNORE;
                    }
                    setSignedOfferFile(file);
                    return false; // Prevent auto upload
                  }}
                  onRemove={() => {
                    setSignedOfferFile(null);
                  }}
                  fileList={signedOfferFile ? [{
                    uid: '-1',
                    name: signedOfferFile.name,
                    status: 'done',
                  }] : []}
                >
                  <Button icon={<UploadOutlined />} disabled={!!signedOfferFile}>
                    {signedOfferFile ? 'File Selected' : 'Select Signed Offer Letter'}
                  </Button>
                </Upload>
                {signedOfferFile && (
                  <Space>
                    <FilePdfOutlined style={{ fontSize: 20, color: '#52c41a' }} />
                    <Typography.Text type="success">
                      Ready to submit: {signedOfferFile.name}
                    </Typography.Text>
                  </Space>
                )}
              </Space>
            </Card>

            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button 
                size="large"
                onClick={()=>{
                  declineForm.resetFields();
                  setDeclineOpen(true);
                }}
              >
                Decline
              </Button>
              <Button 
                type="primary" 
                size="large"
                disabled={!offerLetterUrl || !signedOfferFile}
                loading={uploadingSignedOffer}
                onClick={()=>acceptOffer(offerRecord._id)}
                title={!offerLetterUrl ? 'Offer letter must be available' : !signedOfferFile ? 'Please upload signed offer letter' : ''}
              >
                Accept Offer
              </Button>
            </Space>
          </Space>
        ) : null}
      </Modal>

      <Modal
        title="Decline offer"
        open={declineOpen}
        onCancel={()=>{ setDeclineOpen(false); declineForm.resetFields(); }}
        onOk={declineOffer}
        okText="Decline offer"
        okButtonProps={{ danger: true, loading: declining }}
        confirmLoading={declining}
      >
        <Typography.Paragraph>
          Are you sure you want to decline this offer? This action cannot be undone.
        </Typography.Paragraph>
        <Form form={declineForm} layout="vertical">
          <Form.Item label="Reason (optional)" name="reason">
            <Input.TextArea rows={3} placeholder="Why are you declining this offer?" />
          </Form.Item>
        </Form>
      </Modal>

      </Layout>
    </App>
  );
}

