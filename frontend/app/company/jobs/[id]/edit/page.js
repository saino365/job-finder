"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Layout, Card, Steps, Form, Input, InputNumber, DatePicker, Select, Upload, Button, Space, Typography, message, Checkbox, Modal, Alert } from "antd";
import Navbar from "../../../../../components/Navbar";
import Footer from "../../../../../components/Footer";
import { API_BASE_URL } from "../../../../../config";

const { Title, Text } = Typography;

export default function EditJobListingPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;

  const [loading, setLoading] = useState(false);
  const [company, setCompany] = useState(null);
  const [current, setCurrent] = useState(0);
  const [initial, setInitial] = useState(null);

  const [generalDocs, setGeneralDocs] = useState([]);
  const [jobDocs, setJobDocs] = useState([]);
  const [errorMessage, setErrorMessage] = useState(null);

  const [form1] = Form.useForm();
  const [form2] = Form.useForm();
  const [form3] = Form.useForm();
  const [form4] = Form.useForm();

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("jf_token");
      if (!token) { message.info("Please sign in"); router.replace("/login"); return; }
      const meRes = await fetch(`${API_BASE_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } });
      const me = await meRes.json();
      const cRes = await fetch(`${API_BASE_URL}/companies?ownerUserId=${me._id}`, { headers: { Authorization: `Bearer ${token}` } });
      const cJson = await cRes.json();
      const list = Array.isArray(cJson?.data) ? cJson.data : [];
      if (!list.length) { message.info("Please complete your company setup first."); router.replace("/company/setup"); return; }
      setCompany(list[0]);
      // Load listing
      const lr = await fetch(`${API_BASE_URL}/job-listings/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!lr.ok) throw new Error("Failed to load listing");
      const l = await lr.json();
      setInitial(l);
      // Pre-fill forms
      form1.setFieldsValue({
        internshipStart: l.internshipStart ? dayjs(l.internshipStart) : null,
        internshipEnd: l.internshipEnd ? dayjs(l.internshipEnd) : null,
        position: l.position || 'intern',
        profession: l.profession,
        title: l.title,
        description: l.description,
        city: l?.location?.city,
        state: l?.location?.state,
        salaryMin: l?.salaryRange?.min,
        salaryMax: l?.salaryRange?.max,
        quantity: l?.quantity,
        picName: l?.picName,
        picContact: l?.picContact,
      });
      form2.setFieldsValue({
        projectTitle: l?.project?.title,
        projectDescription: l?.project?.description,
        projectStart: l?.project?.start ? dayjs(l.project.start) : null,
        projectEnd: l?.project?.end ? dayjs(l.project.end) : null,
        projectLocations: l?.project?.locations || [],
        roleDescription: l?.project?.roleDescription,
        interest1: l?.project?.interests?.[0],
        interest2: l?.project?.interests?.[1],
        interest3: l?.project?.interests?.[2],
      });
      setGeneralDocs(l?.onboarding?.generalDocs || []);
      setJobDocs(l?.onboarding?.jobSpecificDocs || []);
      form4.setFieldsValue({ instantOnApproval: !!l?.instantOnApproval, publishAt: l?.publishAt ? dayjs(l.publishAt) : null });
    } catch (e) {
      message.error(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id, router, form1, form2, form4]);

  useEffect(() => { loadAll(); }, [loadAll]);

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
    } catch (e) { message.error(e.message || "Upload failed"); return null; }
  };

  const handleUpload = (setter, field) => async (file) => { const meta = await uploadToServer(file, field); if (meta) setter((prev) => [...prev, meta]); return false; };

  const collectPayload = async () => {
    const v1 = await form1.validateFields().catch(() => null);
    const v2 = await form2.validateFields().catch(() => null);
    const v3 = await form3.validateFields().catch(() => null);
    const v4 = await form4.validateFields().catch(() => null);
    return { ...v1, ...v2, ...v3, ...v4 };
  };

  const saveDraft = async () => {
    try {
      setErrorMessage(null);
      const token = localStorage.getItem("jf_token");
      if (!token) return message.info("Please sign in");

      // Collect values without validation (draft can be incomplete)
      const v1 = form1.getFieldsValue();
      const v2 = form2.getFieldsValue();
      const v3 = form3.getFieldsValue();
      const v4 = form4.getFieldsValue();
      const vals = { ...v1, ...v2, ...v3, ...v4 };

      const payload = {
        companyId: company?._id,
        internshipStart: vals?.internshipStart ? vals.internshipStart.startOf('month').toISOString() : undefined,
        internshipEnd: vals?.internshipEnd ? vals.internshipEnd.startOf('month').toISOString() : undefined,
        position: vals?.position || 'intern',
        profession: vals?.profession || undefined,
        title: vals?.title || undefined,
        description: vals?.description || undefined,
        location: vals?.city || vals?.state ? { city: vals?.city, state: vals?.state } : undefined,
        salaryRange: vals?.salaryMin || vals?.salaryMax ? { min: vals?.salaryMin || 0, max: vals?.salaryMax || 0 } : undefined,
        quantity: vals?.quantity || 1,
        picName: vals?.picName || undefined,
        picContact: vals?.picContact || undefined,
        project: {
          title: vals?.projectTitle || undefined,
          description: vals?.projectDescription || undefined,
          start: vals?.projectStart ? vals.projectStart.startOf('month').toISOString() : undefined,
          end: vals?.projectEnd ? vals.projectEnd.startOf('month').toISOString() : undefined,
          locations: vals?.projectLocations || [],
          roleDescription: vals?.roleDescription || undefined,
          interests: [vals?.interest1, vals?.interest2, vals?.interest3].filter(Boolean),
        },
        onboarding: {
          generalDocs: generalDocs,
          jobSpecificDocs: jobDocs,
        },
        instantOnApproval: !!vals?.instantOnApproval,
        publishAt: vals?.publishAt || undefined,
        status: 0,
      };
      const res = await fetch(`${API_BASE_URL}/job-listings/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });

      if (!res.ok) {
        const errorData = await res.json();
        const errorMsg = errorData.message || "Failed to save draft";
        setErrorMessage(errorMsg);
        throw new Error(errorMsg);
      }

      message.success("Draft saved");
    } catch (e) {
      message.error(e.message || "Failed to save");
    }
  };

  const submitForApproval = async () => {
    try {
      setErrorMessage(null);
      const token = localStorage.getItem("jf_token");
      if (!token) return message.info("Please sign in");

      const v1 = await form1.validateFields();
      const v2 = await form2.validateFields();
      const v3 = await form3.validateFields();
      const v4 = await form4.validateFields();

      const vals = { ...v1, ...v2, ...v3, ...v4 };

      const payload = {
        companyId: company?._id,
        internshipStart: vals?.internshipStart ? vals.internshipStart.startOf('month').toISOString() : null,
        internshipEnd: vals?.internshipEnd ? vals.internshipEnd.startOf('month').toISOString() : null,
        position: vals?.position || 'intern',
        profession: vals?.profession,
        title: vals?.title,
        description: vals?.description,
        location: { city: vals?.city, state: vals?.state },
        salaryRange: { min: vals?.salaryMin || 0, max: vals?.salaryMax || 0 },
        quantity: vals?.quantity || 1,
        picName: vals?.picName,
        picContact: vals?.picContact,
        project: {
          title: vals?.projectTitle,
          description: vals?.projectDescription,
          start: vals?.projectStart ? vals.projectStart.startOf('month').toISOString() : null,
          end: vals?.projectEnd ? vals.projectEnd.startOf('month').toISOString() : null,
          locations: vals?.projectLocations || [],
          roleDescription: vals?.roleDescription,
          interests: [vals?.interest1, vals?.interest2, vals?.interest3].filter(Boolean),
        },
        onboarding: { generalDocs, jobSpecificDocs: jobDocs },
        instantOnApproval: !!vals?.instantOnApproval,
        publishAt: vals?.publishAt || null,
        submitForApproval: true, // Submit for approval - changes status from DRAFT to PENDING
      };

      const res = await fetch(`${API_BASE_URL}/job-listings/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });

      if (!res.ok) {
        const errorData = await res.json();
        const errorMsg = errorData.message || "Failed to submit";
        setErrorMessage(errorMsg);
        throw new Error(errorMsg);
      }

      message.success("Submitted for approval");
      router.replace("/company/jobs");
    } catch (e) {
      if (e.errorFields) {
        setErrorMessage("Please fill in all required fields before submitting");
      } else {
        message.error(e.message || "Submission failed");
      }
    }
  };

  const steps = [
    { title: "Job listing details", content: (
      <Form form={form1} layout="vertical">
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Space wrap>
            <Form.Item name="internshipStart" label="Internship start" rules={[{ required: true }]}><DatePicker picker="month" format="MM/YY" /></Form.Item>
            <Form.Item name="internshipEnd" label="Internship end" rules={[{ required: true }]}><DatePicker picker="month" format="MM/YY" /></Form.Item>
          </Space>
          <Space wrap>
            <Form.Item name="position" label="Position" initialValue="intern"><Select options={[{label:'Intern',value:'intern'},{label:'Contract',value:'contract'}]} style={{ width: 200 }} /></Form.Item>
            <Form.Item name="profession" label="Profession" rules={[{ required: true }]}><Input placeholder="e.g., Software Engineering" /></Form.Item>
          </Space>
          <Form.Item name="title" label="Job title" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Job description" rules={[{ required: true }]}><Input.TextArea rows={6} /></Form.Item>
          <Space wrap>
            {/* D101: Location validation in job edit form */}
            <Form.Item 
              name="city" 
              label="City" 
              rules={[
                { required: true, message: 'City is required' },
                { min: 2, message: 'City must be at least 2 characters' }
              ]}
            >
              <Input style={{ width: 200 }} placeholder="e.g., Kuala Lumpur" />
            </Form.Item>
            <Form.Item 
              name="state" 
              label="State" 
              rules={[
                { required: true, message: 'State is required' },
                { min: 2, message: 'State must be at least 2 characters' }
              ]}
            >
              <Input style={{ width: 200 }} placeholder="e.g., Selangor" />
            </Form.Item>
          </Space>
          <Space wrap>
            <Form.Item name="salaryMin" label="Salary min" rules={[{ required: true, type: 'number', min: 0 }]}>
              <InputNumber min={0} step={50} />
            </Form.Item>
            <Form.Item 
              name="salaryMax" 
              label="Salary max" 
              rules={[
                { required: true, type: 'number', min: 0 },
                {
                  validator: (_, value) => {
                    if (!value) return Promise.resolve();
                    const min = form1.getFieldValue('salaryMin');
                    // D94, D100: Validate max is greater than or equal to min
                    if (min != null && value < min) {
                      return Promise.reject(new Error('Salary max must be greater than or equal to salary min'));
                    }
                    return Promise.resolve();
                  }
                }
              ]}
            >
              <InputNumber min={0} step={50} />
            </Form.Item>
            <Form.Item name="quantity" label="Quantity available" rules={[{ required: true }]}><InputNumber min={1} /></Form.Item>
          </Space>
          <Space wrap>
            <Form.Item name="picName" label="PIC name" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="picContact" label="PIC contact" rules={[{ required: true }]}><Input /></Form.Item>
          </Space>
        </Space>
      </Form>
    ) },
    { title: "Project details", content: (
      <Form form={form2} layout="vertical">
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Form.Item name="projectTitle" label="Project title" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="projectDescription" label="Project description" rules={[{ required: true }]}><Input.TextArea rows={6} /></Form.Item>
          <Space wrap>
            {/* D95, D96, D98: Date validation and logic */}
            <Form.Item 
              name="projectStart" 
              label="Project start" 
              rules={[
                { required: true },
                {
                  validator: (_, value) => {
                    if (!value) return Promise.resolve();
                    // D95: Validate start date is not in the past
                    const startDate = value.startOf('month');
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (startDate.toDate() < today) {
                      return Promise.reject(new Error('Project start date cannot be in the past'));
                    }
                    return Promise.resolve();
                  }
                }
              ]}
            >
              <DatePicker picker="month" format="MM/YY" />
            </Form.Item>
            <Form.Item 
              name="projectEnd" 
              label="Project end" 
              rules={[
                { required: true },
                {
                  validator: (_, value) => {
                    if (!value) return Promise.resolve();
                    const endDate = value.startOf('month');
                    const projectStart = form2.getFieldValue('projectStart');
                    // D95, D98: Validate end date is after start date
                    if (projectStart) {
                      const startDate = projectStart.startOf('month');
                      if (endDate.toDate() <= startDate.toDate()) {
                        return Promise.reject(new Error('Project end date must be after start date'));
                      }
                    }
                    return Promise.resolve();
                  }
                }
              ]}
            >
              <DatePicker picker="month" format="MM/YY" />
            </Form.Item>
          </Space>
          <Form.Item name="projectLocations" label="Project location (multiple)"><Select mode="tags" placeholder="Type and press enter" style={{ width: 480 }} /></Form.Item>
          <Form.Item name="roleDescription" label="Role description" rules={[{ required: true }]}><Input.TextArea rows={4} /></Form.Item>
          <Space wrap>
            <Form.Item name="interest1" label="Area of interest 1"><Input style={{ width: 240 }} /></Form.Item>
            <Form.Item name="interest2" label="Area of interest 2"><Input style={{ width: 240 }} /></Form.Item>
            <Form.Item name="interest3" label="Area of interest 3"><Input style={{ width: 240 }} /></Form.Item>
          </Space>
        </Space>
      </Form>
    ) },
    { title: "Onboarding materials", content: (
      <Form form={form3} layout="vertical">
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <Text strong>General onboarding documents</Text>
            <Upload.Dragger multiple beforeUpload={file=>{ handleUpload(setGeneralDocs,'general')(file); }} showUploadList={false} style={{ marginTop: 8 }}>
              <p>Click or drag files to upload</p>
            </Upload.Dragger>
            {!!generalDocs.length && (<div style={{ marginTop: 8 }}>{generalDocs.map((d,i)=>(<div key={i}><a href={d.url} target="_blank" rel="noreferrer">{d.name || d.key}</a></div>))}</div>)}
          </div>
          <div>
            <Text strong>Job specific onboarding documents</Text>
            <Upload.Dragger multiple beforeUpload={file=>{ handleUpload(setJobDocs,'jobSpecific')(file); }} showUploadList={false} style={{ marginTop: 8 }}>
              <p>Click or drag files to upload</p>
            </Upload.Dragger>
            {!!jobDocs.length && (<div style={{ marginTop: 8 }}>{jobDocs.map((d,i)=>(<div key={i}><a href={d.url} target="_blank" rel="noreferrer">{d.name || d.key}</a></div>))}</div>)}
          </div>
        </Space>
      </Form>
    ) },
    { title: "Publish date", content: (
      <Form form={form4} layout="vertical">
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Form.Item name="instantOnApproval" valuePropName="checked"><Checkbox>Instant publish upon approval</Checkbox></Form.Item>
          <Form.Item name="publishAt" label="Specific date/time upon approval (optional)"><DatePicker showTime style={{ width: 280 }} /></Form.Item>
        </Space>
      </Form>
    ) },
  ];

  const next = () => setCurrent((c) => Math.min(c + 1, steps.length - 1));
  const prev = () => setCurrent((c) => Math.max(c - 1, 0));

  // D124: Fix Cancel button functionality
  const onCancelEdit = () => {
    Modal.confirm({
      title: 'Discard changes?',
      content: 'Any unsaved changes will be lost. Do you want to leave this page?',
      okText: 'Discard and leave',
      cancelText: 'Stay',
      onOk: () => {
        router.replace('/company/jobs');
      },
      onCancel: () => {
        // Stay on page - do nothing
      }
    });
  };

  return (
    <Layout>
      <Navbar />
      <Layout.Content style={{ maxWidth: 1200, margin: '24px auto', padding: '0 16px' }}>
        <Card>
          <Title level={3} style={{ marginBottom: 16 }}>Edit Job Listing</Title>

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
          <div style={{ paddingTop: 8 }}>{steps[current].content}</div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
            <Button disabled={current===0} onClick={prev}>Previous</Button>

            {current === steps.length - 1 ? (
              <Space>
                <Button onClick={onCancelEdit}>Cancel</Button>
                <Button onClick={saveDraft} loading={loading}>Save as Draft</Button>
                <Button type="primary" onClick={submitForApproval} loading={loading}>Submit</Button>
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

