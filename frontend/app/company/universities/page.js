"use client";

import { useEffect, useMemo, useState, useCallback } from 'react';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import { Layout, Typography, Row, Col, Card, Input, List, Space, Select, DatePicker, InputNumber, Button, Table, Modal, Form, Tag, App } from 'antd';
import { API_BASE_URL } from '../../../config';

const { Title, Text } = Typography;

function CompanyUniversitiesPage(){
  const { message } = App.useApp();
  const [uniQ, setUniQ] = useState("");
  const [universities, setUniversities] = useState([]);
  const [loadingUnis, setLoadingUnis] = useState(false);
  const [selectedUni, setSelectedUni] = useState(null);

  const [programmes, setProgrammes] = useState([]);
  const [loadingProg, setLoadingProg] = useState(false);
  const [progLevel, setProgLevel] = useState();
  const [progFacultyQ, setProgFacultyQ] = useState("");
  const [progNameQ, setProgNameQ] = useState("");

  const [cands, setCands] = useState([]);
  const [loadingCands, setLoadingCands] = useState(false);
  const [startDate, setStartDate] = useState();
  const [endDate, setEndDate] = useState();
  const [loc1, setLoc1] = useState("");
  const [loc2, setLoc2] = useState("");
  const [loc3, setLoc3] = useState("");
  const [salaryMin, setSalaryMin] = useState();
  const [salaryMax, setSalaryMax] = useState();
  const [selectedProgramme, setSelectedProgramme] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm] = Form.useForm();
  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  const tokenHeaders = useCallback(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('jf_token') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  async function loadUnis(){
    try {
      setLoadingUnis(true);
      const params = new URLSearchParams();
      if (uniQ) params.set('q', uniQ);
      const r = await fetch(`${API_BASE_URL}/universities?${params.toString()}`, { headers: tokenHeaders() });
      const j = await r.json();
      setUniversities(j?.items || []);
    } catch (e) { message.error(e.message || 'Failed to load'); }
    finally { setLoadingUnis(false); }
  }

  async function loadProgrammes(uni){
    if (!uni) { setProgrammes([]); return; }
    try {
      setLoadingProg(true);
      const r = await fetch(`${API_BASE_URL}/programmes?university=${encodeURIComponent(uni)}`, { headers: tokenHeaders() });
      const j = await r.json();
      setProgrammes(j?.items || []);
    } catch (e) { message.error(e.message || 'Failed to load programmes'); }
    finally { setLoadingProg(false); }
  }

  async function loadCandidates(){
    // D205: Allow candidate filtering even without university selected
    // Candidate filters (dates, locations, salary) should work independently
    // Only require university/programme for programme-specific filtering
    try {
      setLoadingCands(true);
      const qs = new URLSearchParams();
      if (selectedUni) qs.set('university', selectedUni);
      if (selectedProgramme?.programme) qs.set('programme', selectedProgramme.programme);
      if (selectedProgramme?.faculty) qs.set('faculty', selectedProgramme.faculty);
      if (progLevel) qs.set('level', progLevel);
      if (startDate) qs.set('startDate', startDate.toISOString());
      if (endDate) qs.set('endDate', endDate.toISOString());
      const locs = [loc1, loc2, loc3].filter(Boolean);
      for (const l of locs) qs.append('locations', l);
      if (salaryMin != null) qs.set('salaryMin', String(salaryMin));
      if (salaryMax != null) qs.set('salaryMax', String(salaryMax));

      const r = await fetch(`${API_BASE_URL}/programme-candidates?${qs.toString()}`, { headers: tokenHeaders() });
      const j = await r.json();
      setCands(j?.items || []);
    } catch (e) { message.error(e.message || 'Failed to load candidates'); }
    finally { setLoadingCands(false); }
  }

  useEffect(() => { loadUnis(); }, []); // initial
  useEffect(() => { loadProgrammes(selectedUni); }, [selectedUni]);

  async function loadJobs() {
    try {
      setLoadingJobs(true);
      const token = localStorage.getItem('jf_token');
      const res = await fetch(`${API_BASE_URL}/job-listings?status=2&$sort[createdAt]=-1`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      const json = await res.json();
      const data = Array.isArray(json) ? json : (json?.data || []);
      setJobs(data);
    } catch (e) {
      message.error(e.message || 'Failed to load jobs');
    } finally {
      setLoadingJobs(false);
    }
  }

  useEffect(() => { loadJobs(); }, []); // Load jobs on mount

  const filteredProgrammes = useMemo(() => {
    let arr = programmes;
    if (progLevel) arr = arr.filter(p => (p.level||'').toLowerCase() === String(progLevel).toLowerCase());
    if (progFacultyQ) arr = arr.filter(p => (p.faculty||'').toLowerCase().includes(progFacultyQ.toLowerCase()));
    if (progNameQ) arr = arr.filter(p => (p.programme||'').toLowerCase().includes(progNameQ.toLowerCase()));
    return arr;
  }, [programmes, progLevel, progFacultyQ, progNameQ]);

  const candColumns = [
    { title: 'Name', key: 'name', render: (_, r) => `${r?.profile?.firstName||''} ${r?.profile?.lastName||''}`.trim() || r.email },
    { title: 'University', dataIndex: ['internProfile','university'], key: 'uni', render: (v)=> v||'-' },
    { title: 'Programme', key: 'prog', render: (_, r) => r?.internProfile?.educations?.[0]?.qualification || '-' },
    { title: 'Preferred dates', key: 'dates', render: (_, r) => {
      const p = r?.internProfile?.preferences||{}; const s=p.preferredStartDate?new Date(p.preferredStartDate).toLocaleDateString():'-'; const e=p.preferredEndDate?new Date(p.preferredEndDate).toLocaleDateString():'-';
      return `${s} → ${e}`;
    } },
    { title: 'Locations', key: 'loc', render: (_, r) => (r?.internProfile?.preferences?.locations||[]).map(l=> <Tag key={l}>{l}</Tag>) },
    { title: 'Salary', key: 'sal', render: (_, r) => {
      const s = r?.internProfile?.preferences?.salaryRange || {}; return (s.min!=null||s.max!=null)?`RM ${s.min||0}-${s.max||0}`:'-';
    } },
  ];

  async function sendInvites(){
    try {
      if (!selectedRowKeys.length) { message.info('Select candidates first'); return; }
      const v = await inviteForm.validateFields();
      const token = localStorage.getItem('jf_token');
      // D169: Fix send invitation - use null ID for bulk PATCH operation
      const res = await fetch(`${API_BASE_URL}/programme-candidates/null`, {
        method: 'PATCH',
        headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          userIds: selectedRowKeys, 
          type: 'profile_access', 
          jobListingId: v.jobListingId,
          message: v.message || undefined 
        })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to send invites');
      }
      const result = await res.json();
      const created = result?.created || [];
      
      if (created.length === 0) {
        message.info('All selected candidates already have pending invitations for this job');
      } else if (created.length < selectedRowKeys.length) {
        message.success(`${created.length} invitation(s) sent. ${selectedRowKeys.length - created.length} candidate(s) already have pending invitations for this job.`);
      } else {
        message.success('Invitations sent');
      }
      
      setInviteOpen(false); inviteForm.resetFields(); setSelectedRowKeys([]);
      // Reload candidates to reflect invitation status
      loadCandidates();
    } catch (e) { 
      if (e?.errorFields) return; 
      message.error(e.message || 'Failed to send invitations'); 
    }
  }

  return (
    <Layout>
      <Navbar />
      <Layout.Content style={{ padding: 24, minHeight: '80vh' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Title level={2} style={{ marginBottom: 16 }}>Universities & Programmes</Title>
          <Row gutter={[16,16]}>
            <Col xs={24} md={8}>
              <Card title="Universities" extra={<Button size="small" onClick={loadUnis}>Refresh</Button>}>
                <Space direction="vertical" style={{ width:'100%' }}>
                  <Input placeholder="Search university" value={uniQ} onChange={e=>setUniQ(e.target.value)} onPressEnter={loadUnis} allowClear />
                  <List loading={loadingUnis} dataSource={universities} rowKey={i=>i.name}
                    renderItem={(u)=>(
                      <List.Item onClick={()=>{ setSelectedUni(u.name); setSelectedProgramme(null); }} style={{ cursor:'pointer', background: selectedUni===u.name?'#fafafa':undefined }}>
                        <Space style={{ justifyContent:'space-between', width:'100%' }}>
                          <span>{u.name}</span>
                          <Tag>{u.count}</Tag>
                        </Space>
                      </List.Item>
                    )}
                  />
                </Space>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card title={selectedUni ? `Programmes at ${selectedUni}` : 'Programmes'} extra={<Button size="small" onClick={()=>loadProgrammes(selectedUni)} disabled={!selectedUni}>Refresh</Button>}>
                <Space direction="vertical" style={{ width:'100%' }} size="small">
                  {/* D205: Allow programme filters to work even without university selected */}
                  <Select placeholder="Programme level" allowClear value={progLevel} onChange={setProgLevel} options={[{value:'Diploma'},{value:'Degree'},{value:'Master'},{value:'PhD'}]} disabled={!selectedUni} />
                  <Input placeholder="Search faculty name" allowClear value={progFacultyQ} onChange={e=>setProgFacultyQ(e.target.value)} disabled={!selectedUni} />
                  <Input placeholder="Search programme name" allowClear value={progNameQ} onChange={e=>setProgNameQ(e.target.value)} disabled={!selectedUni} />
                  <List loading={loadingProg} dataSource={filteredProgrammes} rowKey={(p,idx)=>`${p.programme}-${p.faculty}-${idx}`}
                    renderItem={(p)=>(
                      <List.Item onClick={()=>{ setSelectedProgramme(p); }} style={{ cursor:'pointer', background: selectedProgramme&&selectedProgramme.programme===p.programme&&selectedProgramme.faculty===p.faculty?'#fafafa':undefined }}>
                        <div>
                          <div><Text strong>{p.programme||'-'}</Text></div>
                          <div><Text type="secondary">{p.faculty||'-'} {p.level?` • ${p.level}`:''}</Text></div>
                        </div>
                      </List.Item>
                    )}
                  />
                </Space>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card title="Candidate filters">
                <Space direction="vertical" style={{ width:'100%' }}>
                  {/* D205: Allow candidate filters to work even without university selected */}
                  <Space>
                    <DatePicker placeholder="Preferred start on/after" value={startDate} onChange={setStartDate} />
                    <DatePicker placeholder="Preferred end on/before" value={endDate} onChange={setEndDate} />
                  </Space>
                  <Space>
                    <Input placeholder="Preferred location 1" value={loc1} onChange={e=>setLoc1(e.target.value)} />
                    <Input placeholder="Preferred location 2" value={loc2} onChange={e=>setLoc2(e.target.value)} />
                    <Input placeholder="Preferred location 3" value={loc3} onChange={e=>setLoc3(e.target.value)} />
                  </Space>
                  <Space>
                    <InputNumber placeholder="Salary min" value={salaryMin} onChange={setSalaryMin} min={0} />
                    <InputNumber placeholder="Salary max" value={salaryMax} onChange={setSalaryMax} min={0} />
                  </Space>
                  <Space>
                    <Button type="primary" onClick={loadCandidates}>Search candidates</Button>
                    <Button onClick={()=>{ 
                      // D205: Reset all candidate filters
                      setStartDate(null); 
                      setEndDate(null); 
                      setLoc1(""); 
                      setLoc2(""); 
                      setLoc3(""); 
                      setSalaryMin(); 
                      setSalaryMax();
                      // Also reset programme filters
                      setProgLevel(null);
                      setProgFacultyQ("");
                      setProgNameQ("");
                      setSelectedProgramme(null);
                      // Clear candidates list
                      setCands([]);
                      setSelectedRowKeys([]);
                    }}>Reset</Button>
                  </Space>
                </Space>
              </Card>
            </Col>
          </Row>

          <Card style={{ marginTop: 16 }} title="Candidates" extra={<>
            <Button disabled={!selectedRowKeys.length} onClick={()=>setInviteOpen(true)}>Send invitation</Button>
          </>}>
            <Table rowKey={r=>r._id || r.id} columns={candColumns} dataSource={cands} loading={loadingCands}
              rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }} pagination={{ pageSize: 10 }} />
          </Card>
        </div>
      </Layout.Content>
      <Footer />

      <Modal title="Send invitation" open={inviteOpen} onCancel={()=>{ setInviteOpen(false); inviteForm.resetFields(); }} onOk={sendInvites} okText="Send">
        <Form form={inviteForm} layout="vertical">
          <Form.Item label="Job Position" name="jobListingId" rules={[{ required: true, message: 'Please select a job position' }]}>
            <Select placeholder="Select job position to invite for" loading={loadingJobs}>
              {jobs.map(job => {
                const locationStr = typeof job.location === 'object' 
                  ? `${job.location.city || ''}${job.location.city && job.location.state ? ', ' : ''}${job.location.state || ''}`.trim() || 'Location not specified'
                  : job.location || 'Location not specified';
                return (
                  <Select.Option key={job._id} value={job._id}>
                    {job.title} - {locationStr}
                  </Select.Option>
                );
              })}
            </Select>
          </Form.Item>
          <Form.Item label="Message (optional)" name="message">
            <Input.TextArea rows={3} placeholder="Add a personal message (optional)" />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}

export default function CompanyUniversitiesPageWrapper() {
  return (
    <App>
      <CompanyUniversitiesPage />
    </App>
  );
}

