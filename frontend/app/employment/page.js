"use client";

import { useEffect, useState, useCallback, Suspense } from 'react';
import { Layout, Typography, Card, Row, Col, Tag, Space, Button, message, Divider, Modal, Form, Input, DatePicker, Alert, Spin, Popconfirm } from 'antd';
import { ArrowLeftOutlined, CalendarOutlined, EnvironmentOutlined, DollarOutlined, DownloadOutlined } from '@ant-design/icons';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { useSearchParams, useRouter } from 'next/navigation';
import { API_BASE_URL } from '../../config';
import dayjs from 'dayjs';
import Link from 'next/link';

const { Title, Text } = Typography;

function EmploymentPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const applicationId = searchParams.get('applicationId');

  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [ecOpen, setEcOpen] = useState(false);
  const [ecForm] = Form.useForm();
  const [terminationOpen, setTerminationOpen] = useState(false);
  const [terminationForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('jf_token');
      if (!token) { message.info('Please sign in'); window.location.href = '/login'; return; }

      // If applicationId is provided, find employment by applicationId
      if (applicationId) {
        const res = await fetch(`${API_BASE_URL}/employment-records?applicationId=${applicationId}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error('Failed to load employment');
        const j = await res.json();
        const list = Array.isArray(j?.data) ? j.data : (Array.isArray(j) ? j : []);
        if (list.length > 0) {
          // Fetch full details
          const detailRes = await fetch(`${API_BASE_URL}/employment-detail/${list[0]._id}`, { headers: { Authorization: `Bearer ${token}` } });
          if (detailRes.ok) {
            const detailData = await detailRes.json();
            setDetail(detailData);
          }
        } else {
          message.error('Employment record not found');
        }
      } else {
        // No applicationId, redirect to applications page
        message.info('Please select an employment from your applications');
        router.push('/applications');
      }
    } catch (e) { message.error(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, [applicationId, router]);

  useEffect(() => { load(); }, [load]);

  async function viewFile(key) {
    try {
      if (!key) return;
      const token = localStorage.getItem('jf_token');
      const r = await fetch(`${API_BASE_URL}/upload/${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json();
      const url = j.signedUrl || j.publicUrl;
      if (url) window.open(url, '_blank'); else message.error('Failed to resolve file');
    } catch (e) { message.error(e.message || 'Failed to open file'); }
  }

  async function submitEarlyCompletion() {
    try {
      setSubmitting(true);
      const values = await ecForm.validateFields();
      const token = localStorage.getItem('jf_token');
      await fetch(`${API_BASE_URL}/early-completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          employmentId: detail?.employment?._id,
          reason: values.reason,
          proposedCompletionDate: values.proposedCompletionDate ? values.proposedCompletionDate.toDate() : null
        })
      });
      message.success('Early completion request submitted');
      setEcOpen(false);
      ecForm.resetFields();
      await load();
    } catch (e) {
      if (e?.errorFields) return;
      message.error(e.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitTermination() {
    try {
      setSubmitting(true);
      const values = await terminationForm.validateFields();
      const token = localStorage.getItem('jf_token');
      await fetch(`${API_BASE_URL}/internship-terminations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          employmentId: detail?.employment?._id,
          initiatedBy: 'student',
          reason: values.reason,
          remark: values.remark,
          proposedLastDay: values.proposedLastDay ? values.proposedLastDay.toDate() : null
        })
      });
      message.success('Termination request submitted');
      setTerminationOpen(false);
      terminationForm.resetFields();
      await load();
    } catch (e) {
      if (e?.errorFields) return;
      message.error(e.message || 'Failed to submit termination request');
    } finally {
      setSubmitting(false);
    }
  }

  // D167: Fix cancel request function to handle termination requests
  async function cancelRequest(type, id) {
    try {
      const token = localStorage.getItem('jf_token');
      let endpoint;
      if (type === 'resignation' || type === 'termination') {
        endpoint = 'internship-terminations';
      } else {
        endpoint = 'early-completions';
      }
      const res = await fetch(`${API_BASE_URL}/${endpoint}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'cancel' })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to cancel request');
      }
      message.success('Request cancelled');
      await load();
    } catch (e) {
      message.error(e.message || 'Failed to cancel');
    }
  }



  if (loading) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Navbar />
        <Layout.Content style={{ padding: 24, maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <Spin size="large" />
        </Layout.Content>
        <Footer />
      </Layout>
    );
  }

  if (!detail) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Navbar />
        <Layout.Content style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
          <Alert type="warning" message="Employment record not found" showIcon />
        </Layout.Content>
        <Footer />
      </Layout>
    );
  }

  const emp = detail?.employment;
  const job = detail?.job;
  const app = detail?.application;
  const company = job?.company;
  const pendingEC = detail?.latestRequests?.earlyCompletion?.status === 0;
  // D167: Check for pending termination request
  const pendingTermination = detail?.latestRequests?.resignation?.status === 0 || detail?.termination?.status === 0;
  const onboardingDocs = detail?.onboarding?.docs || [];

  const statusMap = { 0: { color: 'gold', text: 'Upcoming' }, 1: { color: 'blue', text: 'Ongoing' }, 2: { color: 'purple', text: 'Closure' }, 3: { color: 'green', text: 'Completed' }, 4: { color: 'red', text: 'Terminated' } };
  const statusInfo = statusMap[emp?.status] || { color: 'default', text: String(emp?.status) };

  // Debug logging
  console.log('🔍 Employment Status:', emp?.status);
  console.log('🔍 Status Info:', statusInfo);
  console.log('🔍 Should show buttons?', emp?.status === 1);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Navbar />
      <Layout.Content style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
        <Row gutter={[24, 24]}>
          <Col xs={24}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/applications')} style={{ marginBottom: 16 }}>
              Back to Applications
            </Button>

            {/* Header Card */}
            <Card style={{ marginBottom: 24 }}>
              <Row gutter={[16, 16]} align="middle">
                <Col xs={24} md={18}>
                  <div>
                    <Title level={2} style={{ margin: 0, marginBottom: 8 }}>
                      {job?.title || 'Employment Details'}
                    </Title>

                    {company && (
                      <div style={{ marginBottom: 12 }}>
                        {company._id ? (
                          <Link href={`/companies/${company._id}`}>
                            <Text strong style={{ fontSize: 16 }}>{company.name}</Text>
                          </Link>
                        ) : (
                          <Text strong style={{ fontSize: 16 }}>{company.name}</Text>
                        )}
                      </div>
                    )}

                    <Space size="large" wrap>
                      {job?.location && (
                        <Text type="secondary">
                          <EnvironmentOutlined /> {job.location.city}{job.location.state && `, ${job.location.state}`}
                        </Text>
                      )}

                      {job?.salaryRange && (
                        <Text type="secondary">
                          <DollarOutlined /> RM {job.salaryRange.min} - RM {job.salaryRange.max}
                        </Text>
                      )}

                      {emp?.startDate && emp?.endDate && (
                        <Text type="secondary">
                          <CalendarOutlined /> {new Date(emp.startDate).toLocaleDateString()} - {new Date(emp.endDate).toLocaleDateString()}
                        </Text>
                      )}
                    </Space>
                  </div>
                </Col>

                <Col xs={24} md={6}>
                  <div style={{ textAlign: 'right' }}>
                    <Tag color={statusInfo.color} style={{ padding: '6px 16px', fontSize: 14 }}>
                      {statusInfo.text}
                    </Tag>
                  </div>
                </Col>
              </Row>
            </Card>

            {/* Pending Requests Alert */}
            {pendingEC && (
              <Alert
                type="info"
                showIcon
                message="Pending Request"
                description={
                  <div>
                    <Text>Early completion request pending approval</Text>
                    <div>
                      <Popconfirm
                        title="Cancel this early completion request?"
                        onConfirm={() => cancelRequest('early-completion', detail.latestRequests.earlyCompletion._id)}
                      >
                        <Button size="small" danger type="link">Cancel Request</Button>
                      </Popconfirm>
                    </div>
                  </div>
                }
              />
            )}
            
            {/* D167: Fix Cancel request for early termination button */}
            {pendingTermination && (
              <Alert
                type="info"
                showIcon
                message="Pending Request"
                description={
                  <div>
                    <Text>Termination request pending approval</Text>
                    <div>
                      <Popconfirm
                        title="Cancel this termination request?"
                        onConfirm={async () => {
                          try {
                            const token = localStorage.getItem('jf_token');
                            const terminationId = detail?.latestRequests?.resignation?._id || detail?.termination?._id;
                            if (!terminationId) {
                              message.error('Termination request ID not found');
                              return;
                            }
                            // D167: Fix cancel termination - use correct endpoint
                            await fetch(`${API_BASE_URL}/internship-terminations/${terminationId}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                              body: JSON.stringify({ action: 'cancel' })
                            });
                            message.success('Termination request cancelled');
                            await load();
                          } catch (e) {
                            message.error(e.message || 'Failed to cancel termination request');
                          }
                        }}
                      >
                        <Button size="small" danger type="link">Cancel request for early termination</Button>
                      </Popconfirm>
                    </div>
                  </div>
                }
              />
            )}

            {/* Main Content Card */}
            <Card>
              {/* Employment Information */}
              <div style={{ marginBottom: 32 }}>
                <Title level={4} style={{ marginBottom: 16 }}>Employment Information</Title>
                <Row gutter={[16, 16]}>
                  <Col xs={12} md={6}>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Start Date</Text>
                    <Text strong>{emp?.startDate ? new Date(emp.startDate).toLocaleDateString() : '-'}</Text>
                  </Col>
                  <Col xs={12} md={6}>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>End Date</Text>
                    <Text strong>{emp?.endDate ? new Date(emp.endDate).toLocaleDateString() : '-'}</Text>
                  </Col>
                  <Col xs={12} md={6}>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Duration</Text>
                    <Text strong>
                      {emp?.startDate && emp?.endDate
                        ? `${Math.ceil((new Date(emp.endDate) - new Date(emp.startDate)) / (1000 * 60 * 60 * 24))} days`
                        : '-'}
                    </Text>
                  </Col>
                  <Col xs={12} md={6}>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Timesheet Cadence</Text>
                    <Text strong>{emp?.cadence || 'Weekly'}</Text>
                  </Col>
                </Row>
              </div>

              {/* Application Details */}
              {app && (
                <div style={{ marginBottom: 32 }}>
                  <Title level={4} style={{ marginBottom: 16 }}>Application Details</Title>
                  <Row gutter={[16, 16]}>
                    <Col xs={12} md={6}>
                      <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Submitted</Text>
                      <Text strong>{app.submittedAt ? new Date(app.submittedAt).toLocaleDateString() : '-'}</Text>
                    </Col>
                    <Col xs={12} md={6}>
                      <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Accepted</Text>
                      <Text strong>{app.acceptedAt ? new Date(app.acceptedAt).toLocaleDateString() : '-'}</Text>
                    </Col>
                    {app.candidateStatement && (
                      <Col xs={24}>
                        <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>Candidate Statement</Text>
                        <Text>{app.candidateStatement}</Text>
                      </Col>
                    )}
                    <Col xs={24}>
                      <Space size="middle" wrap>
                        {app.pdfKey && (
                          <Button icon={<DownloadOutlined />} onClick={() => viewFile(app.pdfKey)}>
                            Application PDF
                          </Button>
                        )}
                        {app.offer?.letterKey && (
                          <Button icon={<DownloadOutlined />} onClick={() => viewFile(app.offer.letterKey)}>
                            Offer Letter
                          </Button>
                        )}
                      </Space>
                    </Col>
                  </Row>
                </div>
              )}

              {/* Onboarding Materials */}
              {job?.onboardingMaterials?.length > 0 && (
                <div style={{ marginBottom: 32 }}>
                  <Title level={4} style={{ marginBottom: 16 }}>Onboarding Materials</Title>
                  <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    {job.onboardingMaterials.map((material, idx) => (
                      <div key={idx} style={{
                        padding: 16,
                        border: '1px solid #d9d9d9',
                        borderRadius: 4,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div>
                          <Text strong style={{ display: 'block', marginBottom: 4 }}>
                            {material.label || material.type || `Material ${idx + 1}`}
                          </Text>
                          {material.description && (
                            <Text type="secondary">{material.description}</Text>
                          )}
                        </div>
                        {material.fileKey && (
                          <Button icon={<DownloadOutlined />} onClick={() => viewFile(material.fileKey)}>
                            Download
                          </Button>
                        )}
                      </div>
                    ))}
                  </Space>
                </div>
              )}

              {/* Required Documents from Company */}
              {onboardingDocs.length > 0 && (
                <div style={{ marginBottom: 32 }}>
                  <Title level={4} style={{ marginBottom: 16 }}>Required Documents</Title>
                  <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    {onboardingDocs.map((doc, idx) => (
                      <div key={idx} style={{
                        padding: 16,
                        border: '1px solid #d9d9d9',
                        borderRadius: 4,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div>
                          <div style={{ marginBottom: 4 }}>
                            <Text strong style={{ marginRight: 8 }}>{doc.type?.toUpperCase() || 'Document'}</Text>
                            {doc.verified ? (
                              <Tag color="success">Verified</Tag>
                            ) : (
                              <Tag color="warning">Pending Verification</Tag>
                            )}
                          </div>
                          {doc.uploadedAt && (
                            <Text type="secondary" style={{ fontSize: 13 }}>
                              Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                            </Text>
                          )}
                        </div>
                        {doc.fileKey && (
                          <Button icon={<DownloadOutlined />} onClick={() => viewFile(doc.fileKey)}>
                            Download
                          </Button>
                        )}
                      </div>
                    ))}
                  </Space>
                </div>
              )}

              {/* Action Buttons - Only show when employment is ONGOING (status === 1) */}
              {emp?.status === 1 && (
                <div>
                  <Divider />
                  <Space size="middle" wrap>
                    <Button
                      type="primary"
                      onClick={() => setEcOpen(true)}
                      disabled={pendingEC}
                      style={{
                        borderRadius: '25px',
                        background: 'linear-gradient(to right, #7d69ff, #917fff)',
                        border: 'none',
                        fontWeight: '600',
                        padding: '8px 25px',
                        height: 'auto',
                        fontSize: '16px',
                        boxShadow: '0 4px 20px rgba(125, 105, 255, 0.3)'
                      }}
                    >
                      Request Early Completion
                    </Button>
                    <Button
                      onClick={() => setTerminationOpen(true)}
                      disabled={pendingEC}
                      style={{
                        borderRadius: '25px',
                        background: '#fff',
                        border: 'none',
                        color: '#000',
                        fontWeight: '500',
                        padding: '8px 25px',
                        height: 'auto',
                        fontSize: '16px',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
                      }}
                    >
                      Request Termination
                    </Button>
                  </Space>
                </div>
              )}

              {emp?.status === 2 && ( // CLOSURE
                <div>
                  <Divider />
                  <Alert
                    type="info"
                    showIcon
                    message="Employment in Closure Phase"
                    description="Please ensure all required documents are verified. Your company will complete the final steps."
                  />
                </div>
              )}

              {emp?.status === 3 && ( // COMPLETED
                <div>
                  <Divider />
                  <Alert
                    type="success"
                    showIcon
                    message="Employment Completed"
                    description="Congratulations on completing your internship."
                  />
                </div>
              )}

              {emp?.status === 4 && ( // TERMINATED
                <div>
                  <Divider />
                  <Alert
                    type="error"
                    showIcon
                    message="Employment Terminated"
                    description="This employment has been terminated."
                  />
                </div>
              )}
            </Card>
          </Col>
        </Row>
      </Layout.Content>
      <Footer />

      {/* Early Completion Modal */}
      <Modal
        title="Request Early Completion"
        open={ecOpen}
        onCancel={() => { setEcOpen(false); ecForm.resetFields(); }}
        onOk={submitEarlyCompletion}
        confirmLoading={submitting}
        okText="Submit"
      >
        <Form form={ecForm} layout="vertical">
          <Form.Item
            label="Reason for Early Completion"
            name="reason"
            rules={[{ required: true, message: 'Please provide a reason' }]}
          >
            <Input.TextArea rows={4} placeholder="Please explain why you want to complete early..." />
          </Form.Item>
          <Form.Item
            label="Proposed Completion Date"
            name="proposedCompletionDate"
          >
            <DatePicker
              style={{ width: '100%' }}
              disabledDate={(current) => current && current < dayjs().startOf('day')}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Termination Modal */}
      <Modal
        title="Request Termination"
        open={terminationOpen}
        onCancel={() => { setTerminationOpen(false); terminationForm.resetFields(); }}
        onOk={submitTermination}
        confirmLoading={submitting}
        okText="Submit"
        okButtonProps={{ danger: true }}
      >
        <Form form={terminationForm} layout="vertical">
          <Form.Item
            label="Reason for Termination"
            name="reason"
            rules={[{ required: true, message: 'Please provide a reason' }]}
          >
            <Input.TextArea rows={4} placeholder="Please explain why you want to terminate..." />
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
            rules={[{ required: true, message: 'Please select your proposed last day' }]}
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

export default function MyEmploymentPage() {
  return (
    <Suspense fallback={<Spin size="large" style={{ display: 'flex', justifyContent: 'center', marginTop: '20vh' }} />}>
      <EmploymentPageContent />
    </Suspense>
  );
}

