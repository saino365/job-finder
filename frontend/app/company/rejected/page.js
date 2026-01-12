"use client";

import { Layout, Card, Typography, Button, Space, Result } from 'antd';
import { CloseCircleOutlined, ReloadOutlined, LogoutOutlined, MailOutlined } from '@ant-design/icons';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';

const { Title, Paragraph, Text } = Typography;

export default function CompanyRejectedPage() {
  function refreshStatus() { window.location.reload(); }
  function signOut() {
    try { localStorage.removeItem('jf_token'); } catch {}
    window.location.href = '/login';
  }

  return (
    <Layout>
      <Navbar />
      <Layout.Content style={{ padding: '48px 16px', minHeight: '80vh' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <Card
            bordered={false}
            style={{
              marginBottom: 16,
              textAlign: 'center',
              background: 'linear-gradient(180deg,#fff5f5,#fff)',
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)"
            }}
          >
            <Result
              status="error"
              icon={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
              title="Your company verification was rejected"
              subTitle="You cannot publish jobs or access company features until your company is approved."
            />
            <div style={{ maxWidth: 560, margin: '0 auto 8px' }}>
              <Paragraph type="secondary" style={{ marginTop: 12 }}>
                Please review the rejection reason in your email. You can update your company information
                and resubmit your documents for another review, or contact support if you believe this is a mistake.
              </Paragraph>
              <Space>
                <Button icon={<ReloadOutlined />} onClick={refreshStatus}>Refresh status</Button>
                <Button
                  icon={<MailOutlined />}
                  href="mailto:support@example.com"
                  type="link"
                >
                  Contact support
                </Button>
                <Button icon={<LogoutOutlined />} onClick={signOut}>Sign out</Button>
              </Space>
            </div>
          </Card>

          <Card style={{ textAlign: 'left' }}>
            <Title level={4}>What you can do next</Title>
            <ul style={{ paddingLeft: 20, marginTop: 8 }}>
              <li>
                <Text>Check the rejection email for specific reasons (e.g. incomplete documents or mismatched information).</Text>
              </li>
              <li>
                <Text>Update your company profile and documents to fix the issues.</Text>
              </li>
              <li>
                <Text>Submit a new verification request from the company portal once everything is corrected.</Text>
              </li>
            </ul>
          </Card>
        </div>
      </Layout.Content>
      <Footer />
    </Layout>
  );
}

