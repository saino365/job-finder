"use client";
import { useState, useMemo } from 'react';
import { Steps, Form, Input, Button, Space, DatePicker, Select, Card, App, Typography, Checkbox } from 'antd';
import { API_BASE_URL } from '../config';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;


const EDU_LEVELS = ['Diploma', 'Degree', 'Master', 'PhD', 'Certificate', 'Other'];
const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship', 'Freelance'];

export default function RegisterWizard({ onStepChange }) {
  const { message } = App.useApp();
  const [current, setCurrent] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [form] = Form.useForm();

  const steps = useMemo(() => ([
    { key: 'account', title: 'Account' },
    { key: 'profile', title: 'Profile' },
    { key: 'education', title: 'Education (Optional)' },
    { key: 'certs', title: 'Certifications (Optional)' },
    { key: 'interests', title: 'Interests (Optional)' },
    { key: 'work', title: 'Work Experience (Optional)' },
    { key: 'events', title: 'Events (Optional)' },
  ]), []);

  async function handleSubmitAll(values) {
    // Compose payload matching backend schema
    const { username, password, email: emailInput, firstName, middleName, lastName, phone, icPassportNumber } = values;

    // Determine email/username relationship
    const usernameStr = String(username || '').trim().toLowerCase();
    const emailStr = String(emailInput || '').trim().toLowerCase();
    const isUsernameEmail = /@/.test(usernameStr);
    const email = isUsernameEmail ? usernameStr : emailStr;
    if (!email) { setCurrent(0); message.error('Email is required'); await form.validateFields(['email']); return; }

    const educations = (values.educations || []).map((e) => ({
      level: e?.level || undefined,
      institutionName: e?.institutionName || undefined,
      qualification: e?.qualification || undefined,
      startDate: e?.period?.[0] ? e.period[0] : undefined,
      endDate: e?.period?.[1] ? e.period[1] : undefined,
      fieldOfStudy: e?.fieldOfStudy || undefined,
    }));

    const certifications = (values.certifications || []).map((c) => ({
      title: c?.title || undefined,
      issuer: c?.issuer || undefined,
      acquiredDate: c?.acquiredDate || undefined,
      description: c?.description || undefined,
    }));

    const interests = (values.interests || []).map((i) => ({
      title: i?.title || undefined,
      description: i?.description || undefined,
      socialLinks: i?.socialLink ? [i.socialLink] : [],
      thumbnailUrl: i?.thumbnailUrl || undefined,
    }));

    const workExperiences = (values.workExperiences || []).map((w) => ({
      companyName: w?.companyName || undefined,
      industry: w?.industryOther ? w.industryOther : (w?.industry || undefined),
      jobTitle: w?.jobTitle || undefined,
      employmentType: w?.employmentType || undefined,
      startDate: w?.startDate || undefined,
      endDate: w?.ongoing ? undefined : (w?.endDate || undefined),
      jobDescription: w?.jobDescription || undefined,
    }));

    const eventExperiences = (values.eventExperiences || []).map((ev) => ({
      eventName: ev?.eventName || undefined,
      description: ev?.description || undefined,
      position: ev?.position || undefined,
      startDate: ev?.period?.[0] || undefined,
      endDate: ev?.period?.[1] || undefined,
      location: ev?.location || undefined,
      socialLinks: ev?.socialLink ? [ev.socialLink] : [],
    }));

    const payload = {
      role: 'student',
      username: usernameStr || undefined,
      email,
      password,
      profile: {
        firstName,
        middleName: middleName || undefined,
        lastName,
        phone: phone || undefined,
        avatar: undefined,
        icPassportNumber: icPassportNumber || undefined,
      },
      internProfile: {
        educations,
        certifications,
        interests,
        workExperiences,
        eventExperiences,
      },
    };

    // Convert dayjs to ISO
    const fixDates = (obj) => {
      for (const k in obj) {
        const v = obj[k];
        if (v && typeof v === 'object') {
          if (typeof v.toDate === 'function') obj[k] = v.toDate();
          else fixDates(v);
        }
      }
    };
    fixDates(payload);

    // Submit to backend
    const res = await fetch(`${API_BASE_URL}/users`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Registration failed: ${res.status} ${txt}`);
    }
    const created = await res.json();

    // Auto-login to allow avatar upload
    try {
      const authRes = await fetch(`${API_BASE_URL}/authentication`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ strategy: 'local', email, password })
      });
      if (authRes.ok) {
        const authData = await authRes.json();
        const token = authData?.accessToken;
        if (token) {
          localStorage.setItem('jf_token', token);
          // If avatar file present, upload and patch profile.avatar
          if (avatarFile) {
            const fd = new FormData();
            fd.append('avatar', avatarFile);
            const upRes = await fetch(`${API_BASE_URL}/upload`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd });
            if (upRes.ok) {
              const up = await upRes.json();
              const url = up?.files?.avatar?.[0]?.url || up?.files?.avatar?.[0]?.signedUrl;
              if (url) {
                await fetch(`${API_BASE_URL}/users/${created?._id || 'me'}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                  body: JSON.stringify({ 'profile.avatar': url })
                });
              }
            }
          }
        }
      }
    } catch {
    }

    // Send verification email (best-effort)
    try {
      await fetch(`${API_BASE_URL}/email-verification`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email })
      });
    } catch {}

    message.success('Registration complete. Please check your email to verify your account.');
    window.location.href = '/';
  }

  async function handleNext() {
    try {
      // validate this step's fields only
      const stepKey = steps[current].key;
      let fields = [];
      switch (stepKey) {
        case 'account': fields = ['username','password','email']; break;
        case 'profile': fields = ['firstName','lastName','phone','icPassportNumber']; break;
        default: fields = []; break;
      }
      console.log('Validating fields:', fields);
      console.log('Form values:', form.getFieldsValue());
      await form.validateFields(fields);
      const newStep = current + 1;
      setCurrent(newStep);
      if (onStepChange) onStepChange(newStep);
    } catch (err) {
      console.error('Validation failed:', err);
      message.error('Please fill in all required fields correctly');
    }
  }

  async function handlePrev() {
    const newStep = current - 1;
    setCurrent(newStep);
    if (onStepChange) onStepChange(newStep);
  }

  async function handleFinish() {
    try {
      const values = form.getFieldsValue(true);
      setSubmitting(true);
      await handleSubmitAll(values);
    } catch (e) {
      if (e?.message) {
        message.error(e.message);
      }
    } finally { setSubmitting(false); }
  }

  const isLast = current === steps.length - 1;

  return (
    <Card
      style={{
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
        height: '70vh',
        display: 'flex',
        flexDirection: 'column'
      }}
      styles={{
        body: {
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden'
        }
      }}
    >
      {/* Fixed header section */}
      <div
        style={{
          borderBottom: '1px solid #f0f0f0',
          padding: '20px 24px',
          backgroundColor: '#fff',
          flexShrink: 0
        }}
      >
        <Title level={3} style={{ }}>
          Create Account
        </Title>
        <Title level={4} style={{ color: 'blue' }}>
          Let&apos;s Start Your Journey
        </Title>
        <Text type="secondary">
          Step {current + 1} of {steps.length}
        </Text>
      </div>

      {/* Scrollable content area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px'
        }}
      >
        <Form form={form} layout="vertical" onValuesChange={(changed)=>{ if (Object.prototype.hasOwnProperty.call(changed,'username')) { const v=String(changed.username||''); if (v.includes('@')) { const cur=form.getFieldValue('email'); if (!cur) form.setFieldsValue({ email:v }); } } }}>
        {current === 0 && (
          <>
            <Title level={5}>1. Account</Title>
            <Form.Item
              name="username"
              label="Username (can be email)"
              rules={[
                { required: true },
                {
                  validator: async (_, value) => {
                    if (!value) return Promise.resolve();
                    
                    // If it's an email, skip username validation (email validation will handle it)
                    if (value.includes('@')) {
                      return Promise.resolve();
                    }
                    
                    // Count alphabetic characters (A-Z, a-z)
                    const alphabeticCount = (value.match(/[A-Za-z]/g) || []).length;
                    if (alphabeticCount < 3) {
                      return Promise.reject(new Error('Username must contain at least 3 alphabetic characters'));
                    }
                    
                    // Check if username already exists (async check)
                    try {
                      const checkRes = await fetch(`${API_BASE_URL}/users?username=${encodeURIComponent(value)}&$limit=1`);
                      if (checkRes.ok) {
                        const data = await checkRes.json();
                        if (data.data && data.data.length > 0) {
                          return Promise.reject(new Error('This username is already taken. Please choose another one.'));
                        }
                      }
                    } catch (e) {
                      // If check fails, don't block registration (backend will catch it)
                      console.warn('Username availability check failed:', e);
                    }
                    
                    return Promise.resolve();
                  }
                }
              ]}
            >
              <Input placeholder="username or email" onChange={(e)=>{ const v=e.target.value; form.setFieldsValue({ username:v }); if (v && v.includes('@')) { form.setFieldsValue({ email:v }); } }} />
            </Form.Item>
            <Form.Item
              name="password"
              label="Password"
              rules={[
                { required: true },
                {
                  validator: (_, value) => {
                    if (!value) return Promise.resolve();
                    const errors = [];
                    
                    // At least 8 characters
                    if (value.length < 8) {
                      errors.push('at least 8 characters');
                    }
                    
                    // At least 1 lowercase letter
                    if (!/[a-z]/.test(value)) {
                      errors.push('at least 1 lowercase letter');
                    }
                    
                    // At least 1 uppercase letter
                    if (!/[A-Z]/.test(value)) {
                      errors.push('at least 1 uppercase letter');
                    }
                    
                    // At least 1 numeric
                    if (!/[0-9]/.test(value)) {
                      errors.push('at least 1 number');
                    }
                    
                    // At least 1 special character
                    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value)) {
                      errors.push('at least 1 special character');
                    }
                    
                    if (errors.length > 0) {
                      return Promise.reject(new Error(`Password must contain: ${errors.join(', ')}`));
                    }
                    
                    return Promise.resolve();
                  }
                }
              ]}
            >
              <Input.Password placeholder="Min 8 chars: A-Z, a-z, 0-9, special" />
            </Form.Item>
            <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Please enter a valid email' }]}>
              <Input placeholder="name@example.com" />
            </Form.Item>

            <Text type="secondary">If your username is an email, we&apos;ll fill the email field for you automatically.</Text>
          </>
        )}

        {current === 1 && (
          <>
            <Title level={5}>2. Profile information</Title>
            <Form.Item
              name="firstName"
              label="First name"
              rules={[
                { required: true },
                {
                  validator: (_, value) => {
                    if (!value) return Promise.resolve();
                    // Only allow alphabetic characters, spaces, hyphens, and apostrophes
                    const nameRegex = /^[A-Za-z\s\-']+$/;
                    if (!nameRegex.test(value)) {
                      return Promise.reject(new Error('First name can only contain letters, spaces, hyphens, and apostrophes'));
                    }
                    // Must contain at least 3 alphabetic characters
                    const alphabeticCount = (value.match(/[A-Za-z]/g) || []).length;
                    if (alphabeticCount < 3) {
                      return Promise.reject(new Error('First name must contain at least 3 alphabetic characters'));
                    }
                    return Promise.resolve();
                  }
                }
              ]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="middleName"
              label="Middle name (optional)"
              rules={[
                {
                  validator: (_, value) => {
                    if (!value) return Promise.resolve();
                    // Only allow alphabetic characters, spaces, hyphens, and apostrophes
                    const nameRegex = /^[A-Za-z\s\-']+$/;
                    if (!nameRegex.test(value)) {
                      return Promise.reject(new Error('Middle name can only contain letters, spaces, hyphens, and apostrophes'));
                    }
                    // Must contain at least 3 alphabetic characters
                    const alphabeticCount = (value.match(/[A-Za-z]/g) || []).length;
                    if (alphabeticCount < 3) {
                      return Promise.reject(new Error('Middle name must contain at least 3 alphabetic characters'));
                    }
                    return Promise.resolve();
                  }
                }
              ]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="lastName"
              label="Last name"
              rules={[
                { required: true },
                {
                  validator: (_, value) => {
                    if (!value) return Promise.resolve();
                    // Only allow alphabetic characters, spaces, hyphens, and apostrophes
                    const nameRegex = /^[A-Za-z\s\-']+$/;
                    if (!nameRegex.test(value)) {
                      return Promise.reject(new Error('Last name can only contain letters, spaces, hyphens, and apostrophes'));
                    }
                    // Must contain at least 3 alphabetic characters
                    const alphabeticCount = (value.match(/[A-Za-z]/g) || []).length;
                    if (alphabeticCount < 3) {
                      return Promise.reject(new Error('Last name must contain at least 3 alphabetic characters'));
                    }
                    return Promise.resolve();
                  }
                }
              ]}
            >
              <Input />
            </Form.Item>
            <Form.Item name="icPassportNumber" label="IC / Passport number">
              <Input />
            </Form.Item>
            <Form.Item
              name="phone"
              label="Phone number"
              rules={[
                { required: true },
                {
                  validator: (_, value) => {
                    if (!value) return Promise.resolve();
                    // Check for any non-digit, non-plus characters
                    if (/[^0-9+]/.test(value)) {
                      return Promise.reject(new Error('Phone number can only contain digits (0-9) and optionally a plus sign (+) at the beginning'));
                    }
                    // Plus sign can only be at the beginning
                    if (value.includes('+') && !value.startsWith('+')) {
                      return Promise.reject(new Error('Plus sign (+) can only be at the beginning of the phone number'));
                    }
                    // Only one plus sign allowed
                    if ((value.match(/\+/g) || []).length > 1) {
                      return Promise.reject(new Error('Only one plus sign (+) is allowed'));
                    }
                    // Must have at least one digit
                    if (!/[0-9]/.test(value)) {
                      return Promise.reject(new Error('Phone number must contain at least one digit'));
                    }
                    return Promise.resolve();
                  }
                }
              ]}
            >
              <Input placeholder="e.g., +60123456789 or 60123456789" />
            </Form.Item>
            <Form.Item label="Photo (optional)">
              <input type="file" accept="image/*" onChange={(e) => setAvatarFile(e.target.files?.[0] || null)} />
            </Form.Item>

          </>
        )}

        {current === 2 && (
          <>
            <div style={{ marginBottom: '16px' }}>
              <Text type="secondary">
                Add your education background now, or skip and do it later from your profile.
              </Text>
            </div>
            <Form.List name="educations">
              {(fields, { add, remove }) => (
                <>
                  {fields.length === 0 ? (
                    // Empty state
                    <Card
                      style={{
                        textAlign: 'center',
                        padding: '40px 20px',
                        backgroundColor: '#fafafa',
                        border: '2px dashed #d9d9d9'
                      }}
                    >
                      <div style={{ marginBottom: '16px' }}>
                        <Text type="secondary" style={{ fontSize: '16px' }}>
                          No education entries yet
                        </Text>
                      </div>
                      <div style={{ marginBottom: '16px' }}>
                        <Text type="secondary">
                          Add your educational background to help employers understand your qualifications.
                        </Text>
                      </div>
                      <Space>
                        <Button type="primary" onClick={() => add()}>
                          Add Education
                        </Button>
                      </Space>
                    </Card>
                  ) : (
                    // Show existing entries
                    <>
                      {fields.map(({ key, name, ...rest }) => (
                        <Card key={key} size="small" style={{ marginBottom: 12 }}>
                          <Space direction="vertical" style={{ width: '100%' }}>
                            <Form.Item {...rest} name={[name, 'level']} label="Level of education">
                              <Select options={EDU_LEVELS.map(v => ({ value: v, label: v }))} allowClear />
                            </Form.Item>
                            <Form.Item {...rest} name={[name, 'institutionName']} label="Institution name">
                              <Input />
                            </Form.Item>
                            <Form.Item {...rest} name={[name, 'qualification']} label="Qualification / Programme">
                              <Input />
                            </Form.Item>
                            <Form.Item {...rest} name={[name, 'period']} label="Start date - End date">
                              <RangePicker style={{ width: '100%' }} />
                            </Form.Item>
                            <Form.Item {...rest} name={[name, 'fieldOfStudy']} label="Field of study">
                              <Input />
                            </Form.Item>
                            <Button danger onClick={() => remove(name)}>Remove</Button>
                          </Space>
                        </Card>
                      ))}
                      <div style={{ textAlign: 'center', marginTop: '16px' }}>
                        <Button onClick={() => add()}>Add Another Education</Button>
                      </div>
                    </>
                  )}
                </>
              )}
            </Form.List>
          </>
        )}

        {current === 3 && (
          <>
            <div style={{ marginBottom: '16px' }}>
              <Text type="secondary">
                Add your certifications and professional credentials, or skip and do it later.
              </Text>
            </div>
            <Form.List name="certifications">
              {(fields, { add, remove }) => (
                <>
                  {fields.length === 0 ? (
                    // Empty state
                    <Card
                      style={{
                        textAlign: 'center',
                        padding: '40px 20px',
                        backgroundColor: '#ffffffff',
                        border: '2px dashed #d9d9d9'
                      }}
                    >
                      <div style={{ marginBottom: '16px' }}>
                        <Text type="secondary" style={{ fontSize: '16px' }}>
                          No certifications yet
                        </Text>
                      </div>
                      <div style={{ marginBottom: '16px' }}>
                        <Text type="secondary">
                          Add your professional certifications to showcase your expertise.
                        </Text>
                      </div>
                      <Space>
                        <Button type="primary" onClick={() => add()}>
                          Add Certification
                        </Button>
                      </Space>
                    </Card>
                  ) : (
                    // Show existing entries
                    <>
                      {fields.map(({ key, name, ...rest }) => (
                        <Card key={key} size="small" style={{ marginBottom: 12 }}>
                          <Space direction="vertical" style={{ width: '100%' }}>
                            <Form.Item {...rest} name={[name, 'title']} label="Certificate title"><Input /></Form.Item>
                            <Form.Item {...rest} name={[name, 'issuer']} label="Certificate issuer"><Input /></Form.Item>
                            <Form.Item {...rest} name={[name, 'acquiredDate']} label="Acquired date"><DatePicker style={{ width: '100%' }} /></Form.Item>
                            <Form.Item {...rest} name={[name, 'description']} label="Description"><Input.TextArea rows={3} /></Form.Item>
                            <Button danger onClick={() => remove(name)}>Remove</Button>
                          </Space>
                        </Card>
                      ))}
                      <div style={{ textAlign: 'center', marginTop: '16px' }}>
                        <Button onClick={() => add()}>Add Another Certification</Button>
                      </div>
                    </>
                  )}
                </>
              )}
            </Form.List>
          </>
        )}

        {current === 4 && (
          <>
            <div style={{ marginBottom: '16px' }}>
              <Text type="secondary">
                Share your interests and hobbies to help employers get to know you better.
              </Text>
            </div>
            <Form.List name="interests">
              {(fields, { add, remove }) => (
                <>
                  {fields.length === 0 ? (
                    // Empty state
                    <Card
                      style={{
                        textAlign: 'center',
                        padding: '40px 20px',
                        backgroundColor: '#fafafa',
                        border: '2px dashed #d9d9d9'
                      }}
                    >
                      <div style={{ marginBottom: '16px' }}>
                        <Text type="secondary" style={{ fontSize: '16px' }}>
                          No interests added yet
                        </Text>
                      </div>
                      <div style={{ marginBottom: '16px' }}>
                        <Text type="secondary">
                          Add your interests and hobbies to show your personality.
                        </Text>
                      </div>
                      <Space>
                        <Button type="primary" onClick={() => add()}>
                          Add Interest
                        </Button>
                      </Space>
                    </Card>
                  ) : (
                    // Show existing entries
                    <>
                      {fields.map(({ key, name, ...rest }) => (
                        <Card key={key} size="small" style={{ marginBottom: 12 }}>
                          <Space direction="vertical" style={{ width: '100%' }}>
                            <Form.Item {...rest} name={[name, 'title']} label="Interest title"><Input /></Form.Item>
                            <Form.Item {...rest} name={[name, 'description']} label="Interest description"><Input.TextArea rows={3} /></Form.Item>
                            <Form.Item {...rest} name={[name, 'socialLink']} label="Social link"><Input placeholder="https://..." /></Form.Item>
                            <Form.Item {...rest} name={[name, 'thumbnailUrl']} label="Thumbnail URL (optional)"><Input placeholder="https://..." /></Form.Item>
                            <Button danger onClick={() => remove(name)}>Remove</Button>
                          </Space>
                        </Card>
                      ))}
                      <div style={{ textAlign: 'center', marginTop: '16px' }}>
                        <Button onClick={() => add()}>Add Another Interest</Button>
                      </div>
                    </>
                  )}
                </>
              )}
            </Form.List>
          </>
        )}

        {current === 5 && (
          <>
            <div style={{ marginBottom: '16px' }}>
              <Text type="secondary">
                Add your work experience to showcase your professional background.
              </Text>
            </div>
            <Form.List name="workExperiences">
              {(fields, { add, remove }) => (
                <>
                  {fields.length === 0 ? (
                    // Empty state
                    <Card
                      style={{
                        textAlign: 'center',
                        padding: '40px 20px',
                        backgroundColor: '#fafafa',
                        border: '2px dashed #d9d9d9'
                      }}
                    >
                      <div style={{ marginBottom: '16px' }}>
                        <Text type="secondary" style={{ fontSize: '16px' }}>
                          No work experience yet
                        </Text>
                      </div>
                      <div style={{ marginBottom: '16px' }}>
                        <Text type="secondary">
                          Add your work experience to highlight your professional skills.
                        </Text>
                      </div>
                      <Space>
                        <Button type="primary" onClick={() => add()}>
                          Add Work Experience
                        </Button>
                      </Space>
                    </Card>
                  ) : (
                    // Show existing entries
                    <>
                      {fields.map(({ key, name, ...rest }) => (
                    <Card key={key} size="small" style={{ marginBottom: 12 }}>
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <Form.Item {...rest} name={[name, 'companyName']} label="Company name"><Input /></Form.Item>
                        <Form.Item {...rest} name={[name, 'industry']} label="Industry">
                          <Select allowClear options={['Finance','Technology','Education','Healthcare','Retail','Manufacturing','Other'].map(v => ({ value: v, label: v }))} />
                        </Form.Item>
                        <Form.Item noStyle shouldUpdate>
                          {({ getFieldValue }) => {
                            const sel = getFieldValue(['workExperiences', name, 'industry']);
                            return sel === 'Other' ? (
                              <Form.Item {...rest} name={[name, 'industryOther']} label="Industry (other)"><Input /></Form.Item>
                            ) : null;
                          }}
                        </Form.Item>
                        <Form.Item {...rest} name={[name, 'jobTitle']} label="Job title"><Input /></Form.Item>
                        <Form.Item {...rest} name={[name, 'employmentType']} label="Employment type">
                          <Select allowClear options={EMPLOYMENT_TYPES.map(v => ({ value: v, label: v }))} />
                        </Form.Item>
                        <Form.Item {...rest} name={[name, 'startDate']} label="Start date"><DatePicker style={{ width: '100%' }} /></Form.Item>
                        <Form.Item {...rest} name={[name, 'ongoing']} valuePropName="checked"><Checkbox>Ongoing</Checkbox></Form.Item>
                        <Form.Item noStyle shouldUpdate>
                          {({ getFieldValue }) => !getFieldValue(['workExperiences', name, 'ongoing']) ? (
                            <Form.Item {...rest} name={[name, 'endDate']} label="End date"><DatePicker style={{ width: '100%' }} /></Form.Item>
                          ) : null}
                        </Form.Item>
                        <Form.Item {...rest} name={[name, 'jobDescription']} label="Job description"><Input.TextArea rows={3} /></Form.Item>
                        <Button danger onClick={() => remove(name)}>Remove</Button>
                      </Space>
                    </Card>
                  ))}
                      <div style={{ textAlign: 'center', marginTop: '16px' }}>
                        <Button onClick={() => add()}>Add Another Work Experience</Button>
                      </div>
                    </>
                  )}
                </>
              )}
            </Form.List>
          </>
        )}

        {current === 6 && (
          <>
            <div style={{ marginBottom: '16px' }}>
              <Text type="secondary">
                Add events you&apos;ve participated in or organized to showcase your involvement.
              </Text>
            </div>
            <Form.List name="eventExperiences">
              {(fields, { add, remove }) => (
                <>
                  {fields.length === 0 ? (
                    // Empty state
                    <Card
                      style={{
                        textAlign: 'center',
                        padding: '40px 20px',
                        backgroundColor: '#fafafa',
                        border: '2px dashed #d9d9d9'
                      }}
                    >
                      <div style={{ marginBottom: '16px' }}>
                        <Text type="secondary" style={{ fontSize: '16px' }}>
                          No events added yet
                        </Text>
                      </div>
                      <div style={{ marginBottom: '16px' }}>
                        <Text type="secondary">
                          Add events you&apos;ve participated in to show your community involvement.
                        </Text>
                      </div>
                      <Space>
                        <Button type="primary" onClick={() => add()}>
                          Add Event
                        </Button>
                      </Space>
                    </Card>
                  ) : (
                    // Show existing entries
                    <>
                      {fields.map(({ key, name, ...rest }) => (
                        <Card key={key} size="small" style={{ marginBottom: 12 }}>
                          <Space direction="vertical" style={{ width: '100%' }}>
                            <Form.Item {...rest} name={[name, 'eventName']} label="Event name"><Input /></Form.Item>
                            <Form.Item {...rest} name={[name, 'description']} label="Event description"><Input.TextArea rows={3} /></Form.Item>
                            <Form.Item {...rest} name={[name, 'position']} label="Event position"><Input /></Form.Item>
                            <Form.Item {...rest} name={[name, 'period']} label="Event date (start-end)"><RangePicker style={{ width: '100%' }} /></Form.Item>
                            <Form.Item {...rest} name={[name, 'location']} label="Event location"><Input /></Form.Item>
                            <Form.Item {...rest} name={[name, 'socialLink']} label="Social link"><Input placeholder="https://..." /></Form.Item>
                            <Button danger onClick={() => remove(name)}>Remove</Button>
                          </Space>
                        </Card>
                      ))}
                      <div style={{ textAlign: 'center', marginTop: '16px' }}>
                        <Button onClick={() => add()}>Add Another Event</Button>
                      </div>
                    </>
                  )}
                </>
              )}
            </Form.List>
          </>
        )}
        </Form>
      </div>

      {/* Fixed navigation buttons at bottom */}
      <div
        style={{
          borderTop: '1px solid #f0f0f0',
          padding: '16px 24px',
          backgroundColor: '#fafafa',
          flexShrink: 0
        }}
      >
        <Space>
          {current > 0 && (
            <Button onClick={handlePrev}>Previous</Button>
          )}
          {!isLast ? (
            <Button type="primary" style={{background: "linear-gradient(to right, #7d69ff, #917fff)" }} onClick={handleNext}>Next</Button>
          ) : (
            <Button type="primary" loading={submitting} onClick={handleFinish}>Submit</Button>
          )}
        </Space>
      </div>
    </Card>
  );
}
