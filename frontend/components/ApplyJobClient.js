"use client";

import { useEffect, useMemo, useState } from 'react';
import { Card, Layout, Typography, Steps, Form, DatePicker, Input, Button, Space, Descriptions, List, Tag, App, message, Alert, Spin, Row, Col, Divider } from 'antd';
import { CalendarOutlined, UserOutlined, BookOutlined, FileTextOutlined, CheckCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import Navbar from './Navbar';
import Footer from './Footer';
import { API_BASE_URL } from '../config';

const { Title, Paragraph, Text } = Typography;

export default function ApplyJobClient({ jobId }) {
  const [job, setJob] = useState(null);
  const [profile, setProfile] = useState(null); // { profile, internProfile }
  const [userEmail, setUserEmail] = useState(''); // Email from root user object
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState(null); // Store validated form data
  const [form] = Form.useForm();
  const { message } = App.useApp();

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem('jf_token');
        if (!token) {
          window.location.href = `/login?next=/jobs/${jobId}/apply`;
          return;
        }

        const [jobRes, profRes, userRes] = await Promise.all([
          fetch(`${API_BASE_URL}/job-listings/${jobId}`),
          fetch(`${API_BASE_URL}/student/internship/me`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } })
        ]);

        // D118: Check if email is verified before allowing application
        // FIX: Read userRes.json() only ONCE and store it to avoid "body stream already read" error
        let userData = null;
        if (userRes.ok) {
          userData = await userRes.json(); // Read once and store
          if (!userData.isEmailVerified) {
            setError('Please verify your email address before applying for jobs. Check your inbox for the verification email.');
            return;
          }
        }

        if (!jobRes.ok) {
          throw new Error('Job not found or no longer available');
        }

        const jobData = await jobRes.json();
        setJob(jobData);

        if (profRes.ok) {
          setProfile(await profRes.json());
        } else {
          // Get more specific error message
          let errorMsg = 'Unable to load your profile';
          try {
            const errorData = await profRes.json();
            if (errorData.message) {
              errorMsg = errorData.message;
            }
          } catch (e) {
            // If JSON parsing fails, use default message
          }

          // Check if it's a role issue (403 Forbidden)
          if (profRes.status === 403) {
            errorMsg = 'Only student accounts can apply for internships. Please ensure you are logged in with a student account.';
          }

          setError(errorMsg);
          return;
        }

        // Get email from root user object - reuse the stored userData
        if (userData) {
          setUserEmail(userData.email || '');
        }

        // Default validity = +14 days
        const in14 = dayjs().add(14, 'day');
        form.setFieldsValue({
          validityUntil: in14,
        });
      } catch (err) {
        setError(err.message || 'Failed to load application data');
      } finally {
        setLoading(false);
      }
    })();
  }, [jobId, form]);

  async function submit() {
    try {
      // Use stored form data instead of re-validating
      const v = formData || {};
      console.log('📝 Using stored form data:', v);
      console.log('📝 candidateStatement from stored data:', v.candidateStatement);

      setSubmitting(true);
      const token = localStorage.getItem('jf_token');

      if (!token) {
        message.error('Please sign in to submit your application');
        window.location.href = `/login?next=/jobs/${jobId}/apply`;
        return;
      }

      const personalInfo = {
        ...(profile?.profile || {}),
        email: userEmail // Ensure email is included from root user object
      };
      const intern = profile?.internProfile || {};
      const internshipInfo = intern?.preferences || {};
      const courseInfo = Array.isArray(intern?.courses) ? intern.courses : [];
      const assignmentInfo = Array.isArray(intern?.assignments) ? intern.assignments : [];

      const candidateStatementValue = v.candidateStatement ? String(v.candidateStatement).trim() : '';
      console.log('📝 candidateStatement after processing:', candidateStatementValue);

      if (!candidateStatementValue) {
        message.error('Candidate statement is missing. Please go back and fill it in.');
        return;
      }

      const payload = {
        jobListingId: jobId,
        candidateStatement: candidateStatementValue,
        validityUntil: v.validityUntil ? new Date(v.validityUntil) : undefined,
        form: {
          personalInfo,
          internshipInfo,
          courseInfo,
          assignmentInfo
        }
      };

      console.log('📝 Full application payload:', JSON.stringify(payload, null, 2));
      console.log('📝 Candidate statement in payload:', payload.candidateStatement);
      console.log('📝 Payload has candidateStatement key?', 'candidateStatement' in payload);
      console.log('📝 candidateStatement length:', payload.candidateStatement?.length);

      const bodyString = JSON.stringify(payload);
      console.log('📝 JSON body string:', bodyString);
      console.log('📝 Body includes candidateStatement?', bodyString.includes('candidateStatement'));

      const res = await fetch(`${API_BASE_URL}/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: bodyString
      });

      if (!res.ok) {
        let errorMessage = 'Failed to submit application';
        try {
          const errorData = await res.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          const errorText = await res.text();
          if (errorText) errorMessage = errorText;
        }

        if (res.status === 409) {
          errorMessage = 'You have already applied for this position';
        } else if (res.status === 403) {
          errorMessage = 'You are not authorized to apply for this position';
        } else if (res.status === 404) {
          errorMessage = 'This job position is no longer available';
        }

        throw new Error(errorMessage);
      }

      message.success({
        content: 'Application submitted successfully! You will be redirected to your applications page.',
        duration: 3
      });

      // Redirect after a short delay to show the success message
      setTimeout(() => {
        window.location.href = '/applications';
      }, 1500);

    } catch (e) {
      if (e?.errorFields) return; // antd validation errors
      console.error('Application submission error:', e);
      message.error(e.message || 'Failed to submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function Summary() {
    const p = profile?.profile || {};
    const intern = profile?.internProfile || {};
    const pref = intern?.preferences || {};
    const formValues = form.getFieldsValue();

    return (
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* Application Details */}
        <Card size="small" title={<><FileTextOutlined /> Application Details</>}>
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Candidate Statement">
              <div style={{
                padding: 12,
                backgroundColor: '#f8f9fa',
                borderRadius: 6,
                border: '1px solid #e9ecef',
                whiteSpace: 'pre-wrap'
              }}>
                {formValues.candidateStatement || 'No statement provided'}
              </div>
            </Descriptions.Item>
            <Descriptions.Item label="Application Valid Until">
              <Text strong>
                {formValues.validityUntil
                  ? new Date(formValues.validityUntil).toLocaleDateString('en-MY', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })
                  : 'Not specified'
                }
              </Text>
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* Personal Information */}
        <Card size="small" title={<><UserOutlined /> Personal Information</>}>
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Full Name">
              <Text strong>{[p.firstName, p.lastName].filter(Boolean).join(' ') || 'Not provided'}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Email">
              <Text copyable>{userEmail || p.email || 'Not provided'}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Phone">
              <Text>{p.phone || 'Not provided'}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Location">
              <Text>
                {p.location?.city || p.location?.state || p.location?.country
                  ? [p.location?.city, p.location?.state, p.location?.country].filter(Boolean).join(', ')
                  : 'Not provided'}
              </Text>
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* Internship Preferences */}
        <Card size="small" title={<><CalendarOutlined /> Internship Preferences</>}>
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Preferred Duration">
              {pref.preferredStartDate || pref.startDate ? (
                <Text>
                  {new Date(pref.preferredStartDate || pref.startDate).toLocaleDateString()} - {' '}
                  {pref.preferredEndDate || pref.endDate
                    ? new Date(pref.preferredEndDate || pref.endDate).toLocaleDateString()
                    : 'Open-ended'
                  }
                </Text>
              ) : (
                <Text type="secondary">Not specified</Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Preferred Industries">
              {Array.isArray(pref.industries) && pref.industries.length > 0 ? (
                <Space wrap>
                  {pref.industries.map((industry, idx) => (
                    <Tag key={idx} color="blue">{industry}</Tag>
                  ))}
                </Space>
              ) : (
                <Text type="secondary">{pref.industry || 'Not specified'}</Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Preferred Locations">
              {Array.isArray(pref.locations) && pref.locations.length > 0 ? (
                <Space wrap>
                  {pref.locations.map((location, idx) => (
                    <Tag key={idx} color="green">{location}</Tag>
                  ))}
                </Space>
              ) : (
                <Text type="secondary">Not specified</Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Expected Salary Range">
              {pref.salaryRange ? (
                <Text strong>
                  RM {pref.salaryRange.min ?? 0}
                  {pref.salaryRange.max ? ` - RM ${pref.salaryRange.max}` : '+'}
                </Text>
              ) : (
                <Text type="secondary">Not specified</Text>
              )}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* Course Information */}
        {Array.isArray(intern.courses) && intern.courses.length > 0 && (
          <Card size="small" title={<><BookOutlined /> Course Information</>}>
            <List
              dataSource={intern.courses}
              renderItem={(c, idx) => (
                <List.Item key={idx}>
                  <List.Item.Meta
                    title={<Text strong>{c.courseName || c.name || c.courseId || 'Course'}</Text>}
                    description={c.courseDescription || c.description || 'No description provided'}
                  />
                </List.Item>
              )}
            />
          </Card>
        )}

        {/* Assignment Information */}
        {Array.isArray(intern.assignments) && intern.assignments.length > 0 && (
          <Card size="small" title={<><FileTextOutlined /> Assignment Information</>}>
            <List
              dataSource={intern.assignments}
              renderItem={(a, idx) => (
                <List.Item key={idx}>
                  <List.Item.Meta
                    title={<Text strong>{a.title || 'Assignment'}</Text>}
                    description={
                      <Space direction="vertical" size="small">
                        <Text><strong>Nature:</strong> {a.natureOfAssignment || a.nature || 'Not specified'}</Text>
                        {a.methodology && <Text><strong>Methodology:</strong> {a.methodology}</Text>}
                        {a.description && <Text type="secondary">{a.description}</Text>}
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        )}

        {/* D144: Fix incomplete profile check - use same logic as calculateProfileScore */}
        {(() => {
          // Calculate profile score using same logic as ProfilePageInner
          let score = 0;
          const checks = [
            { condition: p?.firstName && p?.lastName, points: 10 },
            { condition: p?.phone, points: 5 },
            { condition: p?.location?.city || p?.location?.state || p?.location?.country, points: 4 },
            { condition: intern?.university, points: 8 },
            { condition: intern?.major, points: 8 },
            { condition: intern?.gpa, points: 5 },
            { condition: intern?.graduationYear, points: 5 },
            { condition: intern?.resume, points: 15 },
            { condition: intern?.educations?.length > 0, points: 10 },
            { condition: intern?.workExperiences?.length > 0, points: 8 },
            { condition: intern?.skills?.length > 0, points: 8 },
            { condition: intern?.languages?.length > 0, points: 5 },
            { condition: intern?.certifications?.length > 0, points: 5 },
            { condition: intern?.interests?.length > 0, points: 4 },
            { condition: intern?.eventExperiences?.length > 0, points: 4 },
            { condition: intern?.preferences?.industries?.length > 0, points: 4 },
            { condition: intern?.preferences?.locations?.length > 0, points: 4 },
          ];
          checks.forEach(check => {
            if (check.condition) score += check.points;
          });
          
          // Only show incomplete message if score is less than 100
          return score < 100 && (
            <Alert
              message="Incomplete Profile"
              description="Some personal information is missing. Consider updating your profile to improve your application."
              type="warning"
              showIcon
            />
          );
        })()}
      </Space>
    );
  }

  if (loading) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Navbar />
        <Layout.Content style={{ padding: 24, maxWidth: 960, margin: '0 auto', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Spin size="large" />
        </Layout.Content>
        <Footer />
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Navbar />
        <Layout.Content style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
          <Alert
            message="Unable to Load Application"
            description={error}
            type="error"
            showIcon
            action={
              <Button size="small" onClick={() => window.history.back()}>
                Go Back
              </Button>
            }
          />
        </Layout.Content>
        <Footer />
      </Layout>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Navbar />
      <Layout.Content style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
        <Space direction="vertical" size="large" style={{ width: '100%', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)', border: '1px solid #d9d9d9', padding: '8vh', borderRadius: '10px', backgroundColor: 'white' }}>
          {/* Header */}
          <div>
            <Title level={2} style={{ margin: 0, marginBottom: 8 }}>
              Apply for {job?.title}
            </Title>
            {job?.company && (
              <Text type="secondary" style={{ fontSize: 16 }}>
                at {job.company.name}
              </Text>
            )}
          </div>

          {/* Progress Steps */}
          <Steps
            current={step}
            items={[
              { title: 'Application Details', icon: <FileTextOutlined /> },
              { title: 'Submit Application', icon: <CheckCircleOutlined /> }
            ]}
          />

          {/* Step 1: Application Details */}
          {step === 0 && (
            <Card>
              <Title level={4} style={{ marginBottom: 16 }}>
                <FileTextOutlined /> Application Details
              </Title>

              <Text type="secondary" style={{ fontStyle:'italic' }}>
                Your application will be reviewed by the company. Make sure to provide a compelling statement about why you&apos;re interested in this position.
              </Text>

              <Form layout="vertical" form={form} onFinish={async () => {
                try {
                  const values = await form.validateFields();
                  console.log('📝 Form validated, storing values:', values);
                  setFormData(values);
                  setStep(1);
                } catch (e) {
                  console.error('Form validation failed:', e);
                }
              }} style={{marginTop: '3vh'}}>
                <Form.Item
                  label="Candidate Statement"
                  name="candidateStatement"
                  rules={[
                    { required: true, message: 'Please write a brief statement' },
                    { min: 50, message: 'Please write at least 50 characters' },
                    { max: 1000, message: 'Please keep it under 1000 characters' }
                  ]}
                >
                  <Input.TextArea
                    rows={6}
                    placeholder="Example: I am excited about this internship opportunity because..."
                    showCount
                    maxLength={1000}
                  />
                </Form.Item>

                <Form.Item
                  label="Application Validity"
                  name="validityUntil"
                  rules={[{ required: true, message: 'Please select validity date' }]}
                  extra="The last date the company can respond to your application. After this date, the application will be automatically withdrawn."
                >
                  <DatePicker
                    style={{ width: '100%' }}
                    disabledDate={(current) => current && current.valueOf() < Date.now() + 24*60*60*1000}
                    placeholder="Select validity date"
                  />
                </Form.Item>

                <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
                  <Space>
                    <Button onClick={() => window.history.back()} style={{ background: '#fff', border: 'none', color: '#000', fontWeight: '500', borderRadius: '25px', fontSize: '16px', padding: '8px 25px', height: 'auto', boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)"}}>Cancel</Button>
                    <Button type="primary" htmlType="submit" icon={<CheckCircleOutlined />} style={{ background: 'linear-gradient(to right, #7d69ff, #917fff)', border: 'none', borderRadius: '25px', fontSize: '16px', fontWeight: '600', padding: '8px 25px', height: 'auto', boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)"}}>
                      Review Application
                    </Button>
                  </Space>
                </Form.Item>
              </Form>
            </Card>
          )}

          {/* Step 2: Review & Submit */}
          {step === 1 && (
            <Card>
              <Title level={4} style={{ marginBottom: 16 }}>
                <CheckCircleOutlined /> Review Your Application
              </Title>

              <Alert
                message="Review Before Submitting"
                description="Please review all your information carefully. Once submitted, you cannot edit your application."
                type="warning"
                showIcon
                style={{ marginBottom: 24 }}
              />

              <Summary />

              <Divider />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Button onClick={() => setStep(0)} icon={<FileTextOutlined />}>
                  Back to Edit
                </Button>
                <Button
                  type="primary"
                  size="large"
                  loading={submitting}
                  onClick={submit}
                  icon={<CheckCircleOutlined />}
                >
                  Submit Application
                </Button>
              </div>
            </Card>
          )}
        </Space>
      </Layout.Content>
      <Footer />
    </Layout>
  );
}

