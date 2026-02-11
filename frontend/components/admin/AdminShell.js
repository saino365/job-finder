"use client";

import { Layout, Menu, theme as antdTheme, App } from "antd";
import Link from "next/link";
import AdminTopbar from "./AdminTopbar";
import { useState, useMemo } from "react";
import { usePathname } from 'next/navigation';

export default function AdminShell({ children }) {
  const { token } = antdTheme.useToken();
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  const selectedKey = useMemo(() => {
    if (!pathname) return 'dashboard';
    if (pathname.startsWith('/admin/companies')) return 'companies';
    if (pathname.startsWith('/admin/monitoring')) return 'monitoring';
    if (pathname.startsWith('/admin/renewals')) return 'renewals';
    return 'dashboard';
  }, [pathname]);

  const items = [
    { key: 'dashboard', label: <Link href="/admin/dashboard" prefetch={false}>Dashboard</Link> },
    { key: 'companies', label: <Link href="/admin/companies" prefetch={false}>Companies</Link> },
    { key: 'monitoring', label: <Link href="/admin/monitoring?type=pending_jobs" prefetch={false}>Monitoring</Link> },
    { key: 'renewals', label: <Link href="/admin/renewals" prefetch={false}>Renewals</Link> },
  ];

  return (
    <App>
      <Layout style={{ minHeight: '100vh' }}>
        <Layout.Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} theme="light" style={{ borderRight: `1px solid ${token.colorBorder}` }}>
          <div style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>Admin</div>
          <Menu mode="inline" items={items} selectedKeys={[selectedKey]} />
        </Layout.Sider>
        <Layout>
          <AdminTopbar />
          <Layout.Content style={{ padding: 16 }}>
            <div style={{ maxWidth: 1200, margin: '0 auto' }}>{children}</div>
          </Layout.Content>
        </Layout>
      </Layout>
    </App>
  );
}

