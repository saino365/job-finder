"use client";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import CompaniesContent from "../../components/CompaniesContent";
import { Layout, Typography } from "antd";
import { Suspense } from "react";

export default function CompaniesPage() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Navbar />
      <Layout.Content style={{ padding: '24px', maxWidth: 1200, width: '100%', margin: '0 auto' }}>
        <Typography.Title level={3} style={{ marginBottom: 16 }}>All Companies</Typography.Title>
        <Suspense fallback={null}>
          <CompaniesContent />
        </Suspense>
      </Layout.Content>
      <Footer />
    </Layout>
  );
}

