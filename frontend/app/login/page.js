"use client";
import { useState, Suspense } from "react";
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Footer from "../../components/Footer";
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Layout, Typography, Form, Input, Button, message, Modal, Alert, Card, Row, Col } from "antd";
import Link from 'next/link';
import { API_BASE_URL } from "../../config";

function LoginInner() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const search = useSearchParams();
  const next = search?.get('next') || '';

  async function onFinish(values) {
    try {
      setLoading(true);
      setError(null); // Clear any previous errors
      // Always clear any existing token before attempting a new login to avoid stale session artifacts
      try { localStorage.removeItem('jf_token'); } catch {}

      // If input doesn't contain @, treat it as username and look up the email
      let loginIdentifier = values.email;
      if (loginIdentifier && !loginIdentifier.includes('@')) {
        // It's a username, try to find the user's email
        try {
          const userRes = await fetch(`${API_BASE_URL}/users?username=${encodeURIComponent(loginIdentifier)}&$limit=1`);
          if (userRes.ok) {
            const userData = await userRes.json();
            if (userData.data && userData.data.length > 0) {
              loginIdentifier = userData.data[0].email;
            }
          }
        } catch (e) {
          // If lookup fails, proceed with username as-is (backend will handle it)
          console.warn('Username lookup failed:', e);
        }
      }

      const res = await fetch(`${API_BASE_URL}/authentication`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy: 'local', email: loginIdentifier, password: values.password }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        // Ensure no token remains on failure
        try { localStorage.removeItem('jf_token'); } catch {}

        // Handle company pending approval specifically (can be 403 or 500)
        if ((errorData.message || '').toLowerCase().includes('pending approval')) {
          Modal.warning({
            title: 'Company Pending Approval',
            content: errorData.message,
            maskClosable: false,
            closable: false,
            onOk: () => { window.location.href = '/company/pending-approval'; },
            onCancel: () => { window.location.href = '/company/pending-approval'; },
            okText: 'Go to Pending Page'
          });
          setTimeout(() => { window.location.href = '/company/pending-approval'; }, 2500);
          return;
        }

        throw new Error(errorData.message || 'Login failed');
      }

      const data = await res.json();
      localStorage.setItem('jf_token', data.accessToken);
      message.success('Signed in');

      // Role-based landing logic
      let dest = '/';
      try {
        const meRes = await fetch(`${API_BASE_URL}/users/me`, { headers: { 'Authorization': `Bearer ${data.accessToken}` } });
        const me = meRes.ok ? await meRes.json() : null;
        const role = (me?.role || '').toLowerCase();

        // If "next" is provided, only allow it when it matches the role access
        function isAllowed(pathname, r) {
          if (!pathname) return false;
          if (pathname.startsWith('/admin')) return r === 'admin';
          if (pathname.startsWith('/company')) return r === 'company' || r === 'admin';
          return true; // general pages are fine
        }

        if (role === 'admin') dest = '/admin/dashboard';
        else if (role === 'company') dest = '/company/profile';
        else dest = '/profile';

        // Prefer a valid next param if allowed for this role
        if (next && isAllowed(next, role)) dest = next;
      } catch (_) {
        // fallback: keep default dest
      }

      window.location.href = dest;
    } catch (e) {
      // Ensure token is cleared on any error
      try { localStorage.removeItem('jf_token'); } catch {}
      setError(e.message || 'An unexpected error occurred during login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Content style={{ padding: 0 }}>
        <Row style={{ minHeight: '100vh' }}>
          {/* Left side - Image */}
          <Col xs={0} md={12} lg={12} xl={12}>
            <div
              style={{
                height: '100vh',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}
            >
              {/* Replace with your actual image path */}
              <Image
                src="/images/login-image.png"
                alt="Login illustration"
                width={800}
                height={800}
                priority={true}
                style={{
                  maxWidth: '90%',
                  height: 'auto',
                  opacity: 0.9,
                  borderRadius: '8px'
                }}
                onError={(e) => {
                  // Fallback if image doesn't exist
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling.style.display = 'block';
                }}
              />
              {/* Fallback illustration if image doesn't exist */}
              <div
                style={{
                  display: 'none',
                  color: 'white',
                  textAlign: 'center',
                  fontSize: '48px'
                }}
              >
                🚀
              </div>
            </div>
          </Col>

          {/* Right side - Login Form */}
          <Col xs={24} md={12} lg={12} xl={12}>
            <div
              style={{
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
                backgroundColor: '#f5f5f5'
              }}
            >
              <Card
                style={{
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                  borderRadius: '8px',
                  border: '1px solid #f0f0f0',
                  width: '100%',
                  maxWidth: '400px',
                  textAlign: 'center'
                }}
              >
                <Image
                src="/logo_rect_light.svg"
                alt="Login illustration"
                width={200}
                height={200}
                priority={true}
                style={{
                  maxWidth: '90%',
                  height: 'auto',
                  opacity: 0.9,
                  borderRadius: '8px',
                  marginBottom: '30px'
                }}
                onError={(e) => {
                  // Fallback if image doesn't exist
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling.style.display = 'block';
                }}
              />
                <Typography.Title level={4} style={{ textAlign: 'center', marginBottom: 10 }}>
                  Welcome Back!
                </Typography.Title>
                <Typography.Paragraph style={{ textAlign: 'center', color: '#8c8c8c', marginBottom: 32 }}>
                  If you haven&apos;t created an account yet, please register first!
                </Typography.Paragraph>
                {error && (
                  <Alert message="Invalid Login" type="error" showIcon closable style={{
                    marginBottom: 16,
                    fontSize: '12px',
                    padding: '8px 12px'
                  }}
                  />
                )}
                <Form
                  name="login"
                  initialValues={{ remember: true }}
                  onFinish={onFinish}
                >
                  <Form.Item
                    name="email"
                    rules={[{ required: true, message: 'Please input your Email or Username!' }]}
                  >
                    <Input prefix={<UserOutlined />} placeholder="Email or Username" size="large" />
                  </Form.Item>
                  <Form.Item
                    name="password"
                    rules={[{ required: true, message: 'Please input your Password!' }]}
                  >
                    <Input prefix={<LockOutlined />} type="password" placeholder="Password" size="large" />
                  </Form.Item>
                  <Form.Item style={{ marginBottom: 16 }}>
                    <Typography.Text style={{ float: 'right' }}>
                      <Link href="/forgot-password">Forgot Password?</Link>
                    </Typography.Text>
                  </Form.Item>
                  <Form.Item>
                    <Button
                      block
                      type="primary"
                      htmlType="submit"
                      loading={loading}
                      size="large"
                      style={{
                        color: 'blue',
                        borderColor: '#1890ff',
                        borderRadius: '6px',
                        height: '48px',
                        fontSize: '16px',
                        fontWeight: '500'
                      }}
                    >
                      Login
                    </Button>
                  </Form.Item>
                </Form>
                <Typography.Paragraph style={{ textAlign: 'center', marginTop: 24 }}>
                  <Link href="/register-company">Register as a company</Link>
                </Typography.Paragraph>
              </Card>
            </div>
          </Col>
        </Row>
      </Layout.Content>
    </Layout>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div />}>
      <LoginInner />
    </Suspense>
  );
}


