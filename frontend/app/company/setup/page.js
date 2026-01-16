"use client";
import { useEffect, useState } from 'react';
import { Layout, Typography, Form, Input, Button, Upload, message, Modal, Select } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import Footer from '../../../components/Footer';
import { API_BASE_URL } from '../../../config';

const { TextArea } = Input;

// D170: Industry options for company registration
const INDUSTRY_OPTIONS = [
  'Information Technology',
  'Finance',
  'Healthcare',
  'Education',
  'Manufacturing',
  'Retail',
  'Consulting',
  'Media',
  'Government',
  'Non-profit',
  'Automotive',
  'Real Estate',
  'Hospitality',
  'Transportation'
];

export default function CompanySetupPage() {
  const [form] = Form.useForm();
  const [uploadFile, setUploadFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [modal, modalContextHolder] = Modal.useModal();

  useEffect(() => {
    const token = localStorage.getItem('jf_token');
    if (!token) {
      const next = encodeURIComponent('/company/setup');
      window.location.href = `/login?next=${next}`;
    } else {
      console.log('✅ User has token, checking if company already exists...');
      checkExistingCompany(token);
    }
    // Avoid flashing the form while we check
    return () => {};

  }, []);

  async function checkExistingCompany(token) {
    try {
      // First, verify the token is still valid by checking user profile
      console.log('🔍 Verifying user authentication status...');

      const userRes = await fetch(`${API_BASE_URL}/users/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!userRes.ok) {
        const errorData = await userRes.json().catch(() => ({}));
        console.log('❌ User authentication failed:', userRes.status, errorData);

        // Check if this is a pending approval error
        if (userRes.status === 403 && errorData.message?.includes('pending approval')) {
          console.log('🚫 Company pending approval detected from user check');
          message.warning('Your company is pending approval. Please wait for admin approval.');
          setTimeout(() => {
            window.location.href = '/company/pending-approval';
          }, 1500);
          return;
        }

        // Other auth errors - redirect to login
        localStorage.removeItem('jf_token');
        window.location.href = '/login?next=' + encodeURIComponent('/company/setup');
        return;
      }

      // If user auth is OK, check for existing company
      const userData = await userRes.json();
      console.log('✅ User authenticated:', userData.email);

      const userId = userData._id;
      console.log('🔍 Checking for existing company for user:', userId);

      // Check if company already exists
      const res = await fetch(`${API_BASE_URL}/companies?ownerUserId=${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      console.log('📡 Company check response status:', res.status);

      if (res.ok) {
        const data = await res.json();
        console.log('📊 Company data:', data);

        if (data.data && data.data.length > 0) {
          const company = data.data[0];
          console.log('🏢 Found existing company:', company.name, 'Status:', company.verifiedStatus);

          // Company already exists - redirect to pending approval page
          message.info('Your company has already been submitted for approval.');
          setTimeout(() => {
            window.location.href = '/company/pending-approval';
          }, 1500);
          return;
        } else {
          console.log('✅ No existing company found, allowing setup');
          setChecking(false);
        }
      } else {
        console.log('❌ Failed to check company:', res.status);
        const errorData = await res.json().catch(() => ({}));
        console.log('Error details:', errorData);
        // If forbidden or pending, redirect to pending page
        if (res.status === 403 || errorData.message?.includes('pending approval')) {
          message.warning('Your company is pending approval. Please wait for admin approval.');
          setTimeout(() => { window.location.href = '/company/pending-approval'; }, 1200);
          return;
        }
        // Otherwise allow setup
        setChecking(false);
      }
    } catch (error) {
      console.error('Error checking existing company:', error);
      // Continue to setup page if there's an error
      setChecking(false);
    }
  }

  async function handleSubmit(values) {
    const token = localStorage.getItem('jf_token');
    if (!token) { message.error('Please sign in'); return; }

    // D117: Check if email is verified before allowing company information submission
    try {
      const userRes = await fetch(`${API_BASE_URL}/users/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (userRes.ok) {
        const userData = await userRes.json();
        if (!userData.isEmailVerified) {
          message.error('Please verify your email address before submitting company information. Check your inbox for the verification email.');
          return;
        }
      }
    } catch (e) {
      message.error('Failed to verify email status. Please try again.');
      return;
    }

    // D170: Extract industry, website, and description from form values
    const { name, registrationNumber, phone, industry, website, description } = values;

    try {
      setLoading(true);

      // 1) Check uniqueness (fast path) — non-fatal if unavailable
      try {
        const check = await fetch(`${API_BASE_URL}/companies?$limit=1&registrationNumber=${encodeURIComponent(registrationNumber)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const json = await check.json().catch(()=>({}));
        const list = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
        if (list.length > 0) {
          const existingCompany = list[0];
          modal.info({
            title: 'Company already exists',
            content: (
              <div>
                <p>A company with registration number <strong>{registrationNumber}</strong> already exists:</p>
                <p><strong>{existingCompany.name}</strong></p>
                <p>Please sign in with the account that owns this company to manage it.</p>
              </div>
            ),
            onOk: () => window.location.href = '/login'
          });
          setLoading(false);
          return;
        }
      } catch (_) {}

      // 2) Upload SSM Superform (required)
      // D171: Validate file type - only PDF allowed, reject images
      if (!uploadFile) { message.error('Please upload your SSM Superform'); setLoading(false); return; }
      
      // D171: Check file type - must be PDF, not image
      const fileName = uploadFile.name || '';
      const fileType = uploadFile.type || '';
      const isImage = fileType.startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(fileName);
      const isPdf = fileType === 'application/pdf' || /\.pdf$/i.test(fileName);
      
      if (isImage) {
        message.error('Image files are not allowed. Please upload a PDF file (SSM Superform).');
        setLoading(false);
        return;
      }
      
      if (!isPdf) {
        message.error('Only PDF files are allowed for SSM Superform. Please upload a PDF file.');
        setLoading(false);
        return;
      }
      
      const fd = new FormData();
      fd.append('document', uploadFile);
      const up = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd
      });
      const upJson = await up.json();
      if (!up.ok) throw new Error(upJson?.message || 'Upload failed');
      const doc = upJson?.files?.document?.[0];
      const fileKey = doc?.key || doc?.Key || doc?.keyName;
      if (!fileKey) throw new Error('Could not determine uploaded file key');

      // 3) Create company (server also re-checks uniqueness and returns 409 if exists)
      // D170: Include industry, website, and description in company creation
      console.log('🔍 Creating company with data:', { name, registrationNumber, phone, industry, website, description });
      const companyData = { name, registrationNumber, phone };
      if (industry) companyData.industry = industry;
      if (website) companyData.website = website;
      if (description) companyData.description = description;
      
      const cRes = await fetch(`${API_BASE_URL}/companies`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(companyData)
      });
      console.log('🔍 Company creation response status:', cRes.status);
      if (cRes.status === 409) {
        const conflictData = await cRes.json().catch(() => ({}));
        modal.info({
          title: 'Company already exists',
          content: (
            <div>
              <p>A company with registration number <strong>{registrationNumber}</strong> already exists.</p>
              <p>Please sign in with the account that owns this company to manage it.</p>
            </div>
          ),
          onOk: () => window.location.href = '/login'
        });
        setLoading(false); return;
      }
      const company = await cRes.json();
      if (!cRes.ok) throw new Error(company?.message || 'Failed to create company');

      // 4) Submit verification with SSM Superform
      const vRes = await fetch(`${API_BASE_URL}/company-verifications`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ companyId: company._id, documents: [{ type: 'SSM_SUPERFORM', fileKey }] })
      });
      const vJson = await vRes.json().catch(()=>({}));
      if (!vRes.ok) throw new Error(vJson?.message || 'Failed to submit verification');

      message.success('Company submitted for approval. You will be notified once reviewed.');

      // Log out the user after submission
      localStorage.removeItem('jf_token');

      // Redirect to a pending approval page
      window.location.href = '/company/pending-approval';
    } catch (e) {
      console.error('❌ Company setup error:', e);
      message.error(e.message || 'An error occurred during company setup');
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <Layout>
        <Layout.Content style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>
          <Typography.Title level={4}>Checking your company status...</Typography.Title>
          <Typography.Paragraph type="secondary">Please wait a moment.</Typography.Paragraph>
        </Layout.Content>
        <Footer />
      </Layout>
    );
  }

  return (
    <>
      {modalContextHolder}
      <Layout>
      <Layout.Content style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>
        <Typography.Title level={3}>Company Information</Typography.Title>
        <Typography.Paragraph type="secondary">Enter your company details and upload your SSM Superform. Your submission will be reviewed by the site admin.</Typography.Paragraph>
        <Form layout="vertical" form={form} onFinish={handleSubmit}>
          <Form.Item name="name" label="Company name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Acme Sdn Bhd" />
          </Form.Item>
          <Form.Item name="registrationNumber" label="Company unique number (SSM)" rules={[{ required: true }]}>
            <Input placeholder="e.g. 202001234567 (SSM)" />
          </Form.Item>
          <Form.Item name="phone" label="Company contact number" rules={[{ required: true }]}>
            <Input placeholder="e.g. +603-1234 5678" />
          </Form.Item>
          {/* D170: Add Industry, Website, and Description fields during registration */}
          <Form.Item name="industry" label="Industry">
            <Select 
              placeholder="Select your company industry" 
              allowClear
              options={INDUSTRY_OPTIONS.map(opt => ({ label: opt, value: opt }))}
            />
          </Form.Item>
          <Form.Item 
            name="website" 
            label="Website"
            rules={[
              {
                type: 'url',
                message: 'Please enter a valid website URL (e.g., https://example.com)'
              }
            ]}
          >
            <Input placeholder="e.g., https://www.example.com" />
          </Form.Item>
          <Form.Item name="description" label="Company Description">
            <TextArea 
              rows={4} 
              placeholder="Describe your company, its mission, and what makes it unique..."
              maxLength={1000}
              showCount
            />
          </Form.Item>
          {/* D171: Add file type validation to prevent image uploads */}
          <Form.Item label="SSM Superform (PDF)" required>
            <Upload 
              beforeUpload={(file) => {
                // D171: Validate file type before allowing selection
                const fileName = file.name || '';
                const fileType = file.type || '';
                const isImage = fileType.startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(fileName);
                const isPdf = fileType === 'application/pdf' || /\.pdf$/i.test(fileName);
                
                if (isImage) {
                  message.error('Image files are not allowed. Please select a PDF file.');
                  return Upload.LIST_IGNORE;
                }
                
                if (!isPdf) {
                  message.error('Only PDF files are allowed. Please select a PDF file.');
                  return Upload.LIST_IGNORE;
                }
                
                return false; // Prevent automatic upload
              }} 
              maxCount={1} 
              accept=".pdf,application/pdf"
              onChange={(info) => {
                const file = info.fileList?.[0]?.originFileObj || null;
                setUploadFile(file);
              }}
            >
              <Button icon={<UploadOutlined />}>Select PDF file</Button>
            </Upload>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
              Only PDF files are accepted. Image files will be rejected.
            </Typography.Text>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>Submit for approval</Button>
          </Form.Item>
        </Form>
      </Layout.Content>
      <Footer />
    </Layout>
    </>
  );
}

