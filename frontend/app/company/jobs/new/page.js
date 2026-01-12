"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Layout, Card, Steps, Form, Input, InputNumber, DatePicker, Select, Upload, Button, Space, Typography, message, Divider, Checkbox, Alert } from "antd";
import Navbar from "../../../../components/Navbar";
import Footer from "../../../../components/Footer";
import { API_BASE_URL } from "../../../../config";
import { useRouter } from "next/navigation";
import { JobListingStatus } from "../../../../constants/enums";

const { Title, Text } = Typography;

export default function NewJobListingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [company, setCompany] = useState(null);
  const [current, setCurrent] = useState(0);

  // Single form instance for all steps
  const [form] = Form.useForm();

  const [generalDocs, setGeneralDocs] = useState([]);
  const [jobDocs, setJobDocs] = useState([]);

  const [draftId, setDraftId] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Gate: must be company and have a company record
  const loadCompany = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("jf_token");
      if (!token) {
        message.info("Please sign in");
        router.replace("/login");
        return;
      }
      const meRes = await fetch(`${API_BASE_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (!meRes.ok) throw new Error("Failed to load user");
      const me = await meRes.json();
      const cRes = await fetch(`${API_BASE_URL}/companies?ownerUserId=${me._id}`, { headers: { Authorization: `Bearer ${token}` } });
      const cJson = await cRes.json();
      const list = Array.isArray(cJson?.data) ? cJson.data : [];
      if (!list.length) {
        message.info("Please complete your company setup first.");
        router.replace("/company/setup");
        return;
      }
      setCompany(list[0]);
    } catch (e) {
      message.error(e.message || "Failed to load company");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { loadCompany(); }, [loadCompany]);

  const uploadToServer = async (file, field) => {
    try {
      const token = localStorage.getItem("jf_token");
      const fd = new FormData();
      fd.append(field, file);
      const up = await fetch(`${API_BASE_URL}/upload`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      if (!up.ok) throw new Error("Upload failed");
      const data = await up.json();
      const f = data?.files?.[field]?.[0];
      return { url: f?.url || f?.signedUrl, key: f?.key, name: file.name };
    } catch (e) {
      message.error(e.message || "Upload failed");
      return null;
    }
  };

  const handleUpload = (setter, field) => async (file) => {
    const meta = await uploadToServer(file, field);
    if (meta) setter((prev) => [...prev, meta]);
    return false;
  };



  const saveDraft = async () => {
    try {
      console.log('💾 Save Draft clicked');
      setErrorMessage(null);
      setLoading(true);
      setLoading(true);
      const token = localStorage.getItem("jf_token");
      if (!token) {
        setLoading(false);
        return message.info("Please sign in");
      }

      // Collect values without validation (draft can be incomplete)
      const vals = form.getFieldsValue();
      console.log('📝 Draft values collected:', vals);

      const payload = {
        companyId: company?._id,
        // Listing details
        position: vals?.position || 'intern',
        title: vals?.title || undefined,
        description: vals?.description || undefined,
        location: vals?.city || vals?.state ? { city: vals?.city, state: vals?.state } : undefined,
        salaryRange: vals?.salaryMin || vals?.salaryMax ? { min: vals?.salaryMin || 0, max: vals?.salaryMax || 0 } : undefined,
        quantityAvailable: vals?.quantity || 1,
        pic: {
          name: vals?.picName || undefined,
          phone: vals?.picContact || undefined,
        },
        // Project
        project: {
          title: vals?.projectTitle || undefined,
          description: vals?.projectDescription || undefined,
          startDate: vals?.projectStart ? vals.projectStart.startOf('month').toISOString() : undefined,
          endDate: vals?.projectEnd ? vals.projectEnd.startOf('month').toISOString() : undefined,
          locations: vals?.projectLocations || [],
          roleDescription: vals?.roleDescription || undefined,
          areasOfInterest: [vals?.interest1, vals?.interest2, vals?.interest3].filter(Boolean),
        },
        // Onboarding materials
        onboardingMaterials: [...generalDocs, ...jobDocs],
        // Publish prefs
        publishAt: vals?.publishAt ? (vals.publishAt.toDate ? vals.publishAt.toDate().toISOString() : new Date(vals.publishAt).toISOString()) : undefined,
        // Status: DRAFT
        status: JobListingStatus.DRAFT,
      };

      console.log('📤 Draft payload:', JSON.stringify(payload, null, 2));

      const res = await fetch(`${API_BASE_URL}/job-listings${draftId ? `/${draftId}` : ''}`, {
        method: draftId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        const errorMsg = errorData.message || "Failed to save draft";
        setErrorMessage(errorMsg);
        throw new Error(errorMsg);
      }

      const data = await res.json();
      console.log('✅ Draft saved, response:', data);
      if (!draftId) setDraftId(data?._id);
      message.success("Application saved as draft");
      setLoading(false);
      // Redirect to job management page
      router.push('/company/jobs');
    } catch (e) {
      console.error('❌ Draft save error:', e);
      message.error(e.message || "Failed to save draft");
      setLoading(false);
    }
  };

  const submitJob = async () => {
    try {
      console.log('🚀 Submit clicked');
      setErrorMessage(null);
      setLoading(true);
      const token = localStorage.getItem("jf_token");
      if (!token) {
        setLoading(false);
        return message.info("Please sign in");
      }

      // Validate all fields
      const vals = await form.validateFields();

      console.log('📝 All form values:', vals);
      console.log('📝 Title value:', vals?.title);

      const payload = {
        companyId: company?._id,
        position: vals?.position || 'intern',
        title: vals?.title,
        description: vals?.description,
        location: { city: vals?.city, state: vals?.state },
        salaryRange: { min: vals?.salaryMin || 0, max: vals?.salaryMax || 0 },
        quantityAvailable: vals?.quantity || 1,
        pic: {
          name: vals?.picName,
          phone: vals?.picContact,
        },
        project: {
          title: vals?.projectTitle,
          description: vals?.projectDescription,
          startDate: vals?.projectStart ? vals.projectStart.startOf('month').toISOString() : null,
          endDate: vals?.projectEnd ? vals.projectEnd.startOf('month').toISOString() : null,
          locations: vals?.projectLocations || [],
          roleDescription: vals?.roleDescription,
          areasOfInterest: [vals?.interest1, vals?.interest2, vals?.interest3].filter(Boolean),
        },
        onboardingMaterials: [...generalDocs, ...jobDocs],
        publishAt: vals?.publishAt ? (vals.publishAt.toDate ? vals.publishAt.toDate().toISOString() : new Date(vals.publishAt).toISOString()) : null,
        submitForApproval: true, // Submit for approval - changes status from DRAFT to PENDING
      };

      console.log('📤 Payload being sent:', JSON.stringify(payload, null, 2));

      const res = await fetch(`${API_BASE_URL}/job-listings${draftId ? `/${draftId}` : ''}`, {
        method: draftId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        const errorMsg = errorData.message || "Failed to submit job listing";
        setErrorMessage(errorMsg);
        throw new Error(errorMsg);
      }

      const data = await res.json();
      console.log('✅ Job submitted, response:', data);
      message.success("Job submitted for approval. Admin will review within ~2 hours.");
      setLoading(false);
      router.replace("/company/jobs");
    } catch (e) {
      console.error('❌ Submit error:', e);
      setLoading(false);
      if (e.errorFields) {
        // Form validation error
        setErrorMessage("Please fill in all required fields before submitting");
      } else {
        message.error(e.message || "Submission failed");
      }
    }
  };

  const steps = [
    {
      title: "Job listing details",
      content: (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Space wrap>
            <Form.Item name="internshipStart" label="Internship start (optional)">
              <DatePicker picker="month" format="MM/YY" />
            </Form.Item>
            <Form.Item name="internshipEnd" label="Internship end (optional)">
              <DatePicker picker="month" format="MM/YY" />
            </Form.Item>
          </Space>
          <Space wrap>
            <Form.Item name="position" label="Position" initialValue="intern">
              <Select options={[{label:'Intern',value:'intern'},{label:'Contract',value:'contract'}]} style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="profession" label="Profession" rules={[{ required: true }]}>
              <Input placeholder="e.g., Software Engineering" />
            </Form.Item>
          </Space>
          <Form.Item name="title" label="Job title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Job description" rules={[{ required: true }] }>
            <Input.TextArea rows={6} />
          </Form.Item>
          <Space wrap>
            <Form.Item name="city" label="City" rules={[{ required: true }]}>
              <Input style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="state" label="State" rules={[{ required: true }]}>
              <Input style={{ width: 200 }} />
            </Form.Item>
          </Space>
          <Space wrap>
            <Form.Item name="salaryMin" label="Salary min" rules={[{ required: true }]}>
              <InputNumber min={0} step={50} />
            </Form.Item>
            <Form.Item name="salaryMax" label="Salary max" rules={[{ required: true }]}>
              <InputNumber min={0} step={50} />
            </Form.Item>
            <Form.Item name="quantity" label="Quantity available" rules={[{ required: true }]}>
              <InputNumber min={1} />
            </Form.Item>
          </Space>
          <Space wrap>
            <Form.Item name="picName" label="PIC name" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="picContact" label="PIC contact" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          </Space>
        </Space>
      ),
    },
    {
      title: "Project details",
      content: (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Form.Item name="projectTitle" label="Project title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="projectDescription" label="Project description" rules={[{ required: true }]}>
            <Input.TextArea rows={6} />
          </Form.Item>
          <Space wrap>
            <Form.Item name="projectStart" label="Project start (optional)">
              <DatePicker picker="month" format="MM/YY" />
            </Form.Item>
            <Form.Item name="projectEnd" label="Project end (optional)">
              <DatePicker picker="month" format="MM/YY" />
            </Form.Item>
          </Space>
          <Form.Item name="projectLocations" label="Project location (multiple)">
            <Select mode="tags" placeholder="Type and press enter" style={{ width: 480 }} />
          </Form.Item>
          <Form.Item name="roleDescription" label="Role description" rules={[{ required: true }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Space wrap>
            <Form.Item name="interest1" label="Area of interest 1">
              <Input style={{ width: 240 }} />
            </Form.Item>
            <Form.Item name="interest2" label="Area of interest 2">
              <Input style={{ width: 240 }} />
            </Form.Item>
            <Form.Item name="interest3" label="Area of interest 3">
              <Input style={{ width: 240 }} />
            </Form.Item>
          </Space>
        </Space>
      ),
    },
    {
      title: "Onboarding materials",
      content: (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <Text strong>General onboarding documents</Text>
            <Upload.Dragger multiple beforeUpload={handleUpload(setGeneralDocs, 'general')} showUploadList={false} style={{ marginTop: 8 }}>
              <p>Click or drag files to upload</p>
            </Upload.Dragger>
            {!!generalDocs.length && (<div style={{ marginTop: 8 }}>{generalDocs.map((d,i)=>(<div key={i}><a href={d.url} target="_blank" rel="noreferrer">{d.name || d.key}</a></div>))}</div>)}
          </div>
          <div>
            <Text strong>Job specific onboarding documents</Text>
            <Upload.Dragger multiple beforeUpload={handleUpload(setJobDocs, 'jobSpecific')} showUploadList={false} style={{ marginTop: 8 }}>
              <p>Click or drag files to upload</p>
            </Upload.Dragger>
            {!!jobDocs.length && (<div style={{ marginTop: 8 }}>{jobDocs.map((d,i)=>(<div key={i}><a href={d.url} target="_blank" rel="noreferrer">{d.name || d.key}</a></div>))}</div>)}
          </div>
        </Space>
      ),
    },
    {
      title: "Publish date",
      content: (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Form.Item name="instantOnApproval" valuePropName="checked">
            <Checkbox>Instant publish upon approval</Checkbox>
          </Form.Item>
          <Form.Item name="publishAt" label="Specific date/time upon approval (optional)">
            <DatePicker showTime style={{ width: 280 }} />
          </Form.Item>
        </Space>
      ),
    },
  ];

  // Fields that must be valid before moving past each step
  const stepFieldNames = [
    ['profession', 'title', 'description', 'city', 'state', 'salaryMin', 'salaryMax', 'quantity', 'picName', 'picContact'],
    ['projectTitle', 'projectDescription', 'roleDescription'],
    [],
    []
  ];

  const next = async () => {
    try {
      const fields = stepFieldNames[current] || [];
      if (fields.length) {
        await form.validateFields(fields);
      }
      setCurrent((c) => Math.min(c + 1, steps.length - 1));
      setErrorMessage(null);
    } catch (e) {
      // Validation errors from AntD include errorFields
      if (e?.errorFields) {
        setErrorMessage('Please fill in all required fields on this step before proceeding');
      } else if (e?.message) {
        message.error(e.message);
      }
    }
  };
  const prev = () => setCurrent((c) => Math.max(c - 1, 0));

  return (
    <Layout>
      <Navbar />
      <Layout.Content style={{ maxWidth: 1200, margin: '24px auto', padding: '0 16px' }}>
        <Card>
          <Title level={3} style={{ marginBottom: 16 }}>Create Job Listing</Title>

          {errorMessage && (
            <Alert
              message="Error"
              description={errorMessage}
              type="error"
              closable
              onClose={() => setErrorMessage(null)}
              style={{ marginBottom: 16 }}
            />
          )}

          <Steps current={current} items={steps.map(s=>({ title: s.title }))} style={{ marginBottom: 24 }} />
          <Form form={form} layout="vertical" style={{ paddingTop: 8 }}>
            {steps.map((s, idx) => (
              <div key={idx} style={{ display: idx === current ? 'block' : 'none' }}>
                {s.content}
              </div>
            ))}
          </Form>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
            <Button disabled={current===0} onClick={prev}>Previous</Button>

            {current === steps.length - 1 ? (
              <Space>
                <Button onClick={saveDraft} loading={loading}>Save as Draft</Button>
                <Button type="primary" onClick={submitJob} loading={loading}>Submit</Button>
              </Space>
            ) : (
              <Button onClick={next}>Next</Button>
            )}
          </div>
        </Card>
      </Layout.Content>
      <Footer />
    </Layout>
  );
}

