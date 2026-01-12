"use client";
import { useEffect, useMemo, useState, Suspense } from 'react';
import { Layout, Typography, Form, Input, Button, message, Alert, Space } from 'antd';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Footer from '../../components/Footer';
import { API_BASE_URL } from '../../config';

function formatTimeLeft(ms) {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function ResetPasswordInner() {
  const search = useSearchParams();
  const token = search.get('token') || '';
  const email = search.get('email') || '';
  const exp = Number(search.get('exp') || 0);
  const hasParams = !!token && !!email;

  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [now, setNow] = useState(Date.now());

  const timeLeftMs = useMemo(() => (exp > 0 ? exp - now : 0), [exp, now]);
  const expired = exp > 0 && timeLeftMs <= 0;

  useEffect(() => {
    if (!exp) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [exp]);

  async function onFinish(values) {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/password-reset`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, password: values.password })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Failed to reset password');
      setDone(true);
      message.success('Password updated. You can sign in now.');
      setTimeout(() => { window.location.href = '/login'; }, 1000);
    } catch (e) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <Layout.Content style={{ padding: 24, maxWidth: 480, margin: '0 auto' }}>
        <Typography.Title level={3}>Set a new password</Typography.Title>
        {!hasParams && (
          <Alert type="error" showIcon style={{ marginBottom: 16 }} message="Invalid reset link" description="The link is missing required parameters." />
        )}
        {!!exp && (
          <Space style={{ marginBottom: 12 }}>
            <Typography.Text type={expired ? 'danger' : 'secondary'}>
              {expired ? 'Link expired' : `Link expires in ${formatTimeLeft(timeLeftMs)}`}
            </Typography.Text>
          </Space>
        )}
        {done && (
          <Alert type="success" showIcon style={{ marginBottom: 16 }} message="Password updated" />
        )}
        <Form layout="vertical" onFinish={onFinish} disabled={loading || done || !hasParams || expired}>
          <Form.Item label="Email">
            <Input value={email} disabled />
          </Form.Item>
          <Form.Item
            name="password"
            label="New password"
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
            hasFeedback
          >
            <Input.Password placeholder="Min 8 chars: A-Z, a-z, 0-9, special" />
          </Form.Item>
          <Form.Item name="confirm" label="Confirm password" dependencies={["password"]} hasFeedback rules={[
            { required: true, message: 'Please confirm your password' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) return Promise.resolve();
                return Promise.reject(new Error('Passwords do not match'));
              }
            })
          ]}>
            <Input.Password placeholder="Re-enter password" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>Update password</Button>
          </Form.Item>
        </Form>
        <Typography.Paragraph style={{ textAlign: 'center' }}>
          <Link href="/login">Back to sign in</Link>
        </Typography.Paragraph>
      </Layout.Content>
      <Footer />
    </Layout>
  );
}


export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div />}>
      <ResetPasswordInner />
    </Suspense>
  );
}
