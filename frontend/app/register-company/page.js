"use client";
import { useState, useEffect } from 'react';
import { Layout, Typography, Form, Input, Button, message } from 'antd';
import { API_BASE_URL } from '../../config';
import RegistrationHeader from "../../components/RegistrationHeader";

export default function RegisterCompanyPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  function onValuesChange(changed) {
    if ('username' in changed) {
      const v = String(changed.username || '').trim();
      const isEmail = v.includes('@');
      // D119: Fix email auto-fill - copy the full email including everything after @
      if (isEmail && !form.getFieldValue('email')) {
        form.setFieldsValue({ email: v });
      } else if (isEmail) {
        // If email field already has a value, update it with the full username value
        const currentEmail = form.getFieldValue('email') || '';
        if (!currentEmail.includes('@') || currentEmail.length < v.length) {
          form.setFieldsValue({ email: v });
        }
      }
    }
  }

  // D156: Fix company registration loading - ensure proper error handling and loading state management
  async function onFinish(values) {
    const username = String(values.username || '').trim();
    const email = username.includes('@') ? username : String(values.email || '').trim();
    if (!email) { message.error('Email is required'); return; }
    try {
      setLoading(true);
      // Clear any previous errors
      message.destroy();
      // Create company user account
      const res = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: values.password, role: 'company', username: username || undefined })
      });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(data?.message || 'Failed to register');

      // D120: Send verification email only once (prevent duplicate emails)
      // Note: The backend email-verification service should handle duplicate prevention,
      // but we ensure we only call it once here
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
      setLoading(false); // D156: Ensure loading state is cleared on error
    } catch (e) {
      // D156: Catch any unexpected errors
      console.error('Registration error:', e);
      message.error(e.message || 'An unexpected error occurred. Please try again.');
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
        <Layout.Content style={{ padding: isMobile ? 20 : 40, maxWidth: 520, margin: '0 auto', marginTop: isMobile ? '5vh' : '10vh', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)', borderRadius: '8px', border: '1px solid #f0f0f0', maxHeight: isMobile ? 'none' : '75vh', textAlign: 'center', backgroundColor: 'rgba(255, 255, 255, 0.95)', marginRight: isMobile ? 0 : '20vh', overflow: isMobile ? 'auto' : 'visible' }}>
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
                    
                    // Check if username already exists (D12: async validation)
                    try {
                      const checkRes = await fetch(`${API_BASE_URL}/users?username=${encodeURIComponent(value)}&$limit=1`);
                      if (checkRes.ok) {
                        const data = await checkRes.json();
                        if (data.data && data.data.length > 0) {
                          return Promise.reject(new Error('This username is already registered. Please use a different username.'));
                        }
                      }
                    } catch (e) {
                      // If check fails, allow submission (backend will catch duplicate)
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
          <Form.Item 
            name="email" 
            label="Email" 
            rules={[
              { required: true, type: 'email', message: 'Please enter a valid email (required if username is not an email)' },
              {
                validator: async (_, value) => {
                  if (!value) return Promise.resolve();
                  
                  // Check if email already exists (D12: async validation)
                  try {
                    const checkRes = await fetch(`${API_BASE_URL}/users?email=${encodeURIComponent(value)}&$limit=1`);
                    if (checkRes.ok) {
                      const data = await checkRes.json();
                      if (data.data && data.data.length > 0) {
                        return Promise.reject(new Error('This email address is already registered. Please use a different email address.'));
                      }
                    }
                  } catch (e) {
                    // If check fails, allow submission (backend will catch duplicate)
                  }
                  
                  return Promise.resolve();
                }
              }
            ]}
          >
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

