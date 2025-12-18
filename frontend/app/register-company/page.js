"use client";
import { useState } from 'react';
import { Layout, Typography, Form, Input, Button, message } from 'antd';
import { API_BASE_URL } from '../../config';
import RegistrationHeader from "../../components/RegistrationHeader";

export default function RegisterCompanyPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  function onValuesChange(changed) {
    if ('username' in changed) {
      const v = String(changed.username || '').trim();
      const isEmail = v.includes('@');
      if (isEmail && !form.getFieldValue('email')) {
        form.setFieldsValue({ email: v });
      }
    }
  }

  async function onFinish(values) {
    const username = String(values.username || '').trim();
    const email = username.includes('@') ? username : String(values.email || '').trim();
    if (!email) { message.error('Email is required'); return; }
    try {
      setLoading(true);
      // Create company user account
      const res = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: values.password, role: 'company', username: username || undefined })
      });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(data?.message || 'Failed to register');

      // Send verification email
      try {
        const verifyRes = await fetch(`${API_BASE_URL}/email-verification`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email })
        });
        if (!verifyRes.ok) {
          const verifyData = await verifyRes.json().catch(() => ({}));
          console.warn('Email verification request failed:', verifyData?.message);
        }
      } catch (e) {
        console.warn('Email verification request failed:', e.message);
      }

      message.success('Account created. Check your email to verify your account.');
      // Guide them to verification page with instructions (no token needed, they'll enter the code)
      window.location.href = `/verify-email?email=${encodeURIComponent(email)}&forCompany=1`;
    } catch (e) {
      let errorMsg = e.message;

      if (e.message.includes('E11000') || e.message.includes('duplicate key')) {
        if (e.message.includes('email')) {
          errorMsg = 'This email address is already registered. Please use a different email address.';
        } else if (e.message.includes('username')) {
          errorMsg = 'This username is already registered. Please use a different username.';
        } else {
          errorMsg = 'This account already exists. Please use different credentials.';
        }
      } else if (e.message.includes('email: value already exists')) {
        errorMsg = 'This email address is already registered. Please use a different email address.';
      } else if (e.message.includes('username: value already exists')) {
        errorMsg = 'This username is already registered. Please use a different username.';
      } else if (e.message.includes('Conflict')) {
        errorMsg = 'This email is already registered. Please sign in or use a different email.';
      } else if (e.message.includes('validation')) {
        errorMsg = 'Please check your input and try again.';
      }

      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <RegistrationHeader />
      <Layout
        style={{
          minHeight: '100vh',
          backgroundImage: 'url(/images/company-registration.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'left center',
          backgroundRepeat: 'no-repeat',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}
      >
        <Layout.Content
          style={{
            padding: '40px',
            maxWidth: '520px',
            width: '100%',
            margin: '20px auto',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            borderRadius: '8px',
            border: '1px solid #f0f0f0',
            textAlign: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.95)'
          }}
        >
          <Typography.Title level={3} style={{ color: 'blue'}}>Hire The Best People Anywhere</Typography.Title>
          <Typography.Title level={3}>Register Your Company Admin Account</Typography.Title>
          <Typography.Paragraph type="secondary">
            Use your work email. After verifying your email, you&apos;ll complete your company information and submit verification.
          </Typography.Paragraph>
          <Form layout="vertical" form={form} onValuesChange={onValuesChange} onFinish={onFinish} style={{ marginTop: '24px'}}>
            <Form.Item
              name="username"
              label="Username (can be your email)"
              rules={[
                { required: true },
                {
                  validator: (_, value) => {
                    if (!value) return Promise.resolve();
                    // Count alphabetic characters (A-Z, a-z)
                    const alphabeticCount = (value.match(/[A-Za-z]/g) || []).length;
                    if (alphabeticCount < 3) {
                      return Promise.reject(new Error('Username must contain at least 3 alphabetic characters'));
                    }
                    return Promise.resolve();
                  }
                }
              ]}
            >
              <Input placeholder="Username or Email" />
            </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true, min: 6 }]}>
            <Input.Password placeholder="Minimum 6 characters" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Please enter a valid email (required if username is not an email)' }]}>
            <Input placeholder="name@company.com" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block style={{ background: "linear-gradient(to right, #7d69ff, #917fff)"}}>Create account</Button>
          </Form.Item>
        </Form>
        </Layout.Content>
      </Layout>
    </>
  );
}

