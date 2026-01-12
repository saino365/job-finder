"use client";
import { useEffect, useState } from "react";
import { Layout, Card, Typography, Button, Alert, Space, Spin, App } from "antd";
import Navbar from "../../../components/Navbar";
import Footer from "../../../components/Footer";
import { API_BASE_URL } from "../../../config";
import { getToken } from "../../../lib/api";

const { Title, Paragraph, Text } = Typography;

export default function ProfileSecurityPage() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [me, setMe] = useState(null);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const token = getToken();
        if (!token) {
          message.info("Please sign in to manage your security settings.");
          window.location.href = "/login?next=/profile/security";
          return;
        }
        const res = await fetch(`${API_BASE_URL}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          throw new Error("Failed to load your profile");
        }
        const data = await res.json();
        setMe(data);
      } catch (e) {
        console.error(e);
        setError(e.message || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [message]);

  async function sendResetLink() {
    if (!me?.email) {
      message.error("No email found for your account.");
      return;
    }
    try {
      setSending(true);
      setSent(false);
      setError(null);
      const res = await fetch(`${API_BASE_URL}/password-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: me.email }),
      });
      if (!res.ok) {
        throw new Error("Failed to send reset email");
      }
      setSent(true);
      message.success("Password reset link sent. Please check your email.");
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to send reset email");
      message.error(e.message || "Failed to send reset email");
    } finally {
      setSending(false);
    }
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Navbar />
      <Layout.Content style={{ maxWidth: 900, margin: "24px auto", padding: "0 24px" }}>
        <Card>
          <Title level={3}>Account Security</Title>
          {loading ? (
            <Spin />
          ) : error ? (
            <Alert type="error" message={error} />
          ) : (
            <Space direction="vertical" size="large" style={{ width: "100%" }}>
              <div>
                <Paragraph type="secondary">
                  You can change your password securely by requesting a reset link. We&apos;ll send an email to:
                </Paragraph>
                <Paragraph>
                  <Text strong>{me?.email}</Text>
                </Paragraph>
              </div>

              {sent && (
                <Alert
                  type="success"
                  showIcon
                  message="Reset link sent"
                  description="Check your inbox and follow the link to set a new password. The link expires after a short time for security."
                />
              )}

              <Button type="primary" onClick={sendResetLink} loading={sending}>
                Send password reset email
              </Button>

              <Paragraph type="secondary">
                Forgot your email or can&apos;t access it? Contact support so we can help you recover your account.
              </Paragraph>
            </Space>
          )}
        </Card>
      </Layout.Content>
      <Footer />
    </Layout>
  );
}

