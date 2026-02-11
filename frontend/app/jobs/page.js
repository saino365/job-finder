"use client";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import JobsContent from "../../components/JobsContent";
import { Layout, Typography, Button, Space } from "antd";
import { Suspense } from "react";
import * as React from "react";
import { API_BASE_URL } from "../../config";

export default function JobsPage() {
  const [role, setRole] = React.useState('');
  React.useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('jf_token') : null;
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/student/internship/me`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) setRole('student'); else setRole('company');
      } catch (_) {}
    })();
  }, []);
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Navbar />
      <Layout.Content style={{ padding: '24px', maxWidth: 1200, width: '100%', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Typography.Title level={3} style={{ margin: 0 }}>All Jobs</Typography.Title>
          {role === 'company' && (
            <Button type="primary" href="/company/jobs/new">Employer Register</Button>
          )}
        </div>
        <Suspense fallback={null}>
          <JobsContent />
        </Suspense>
      </Layout.Content>
      <Footer />
    </Layout>
  );
}

