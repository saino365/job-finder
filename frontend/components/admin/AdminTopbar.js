"use client";

import { Layout, Space, Dropdown, Avatar, Typography, Button, Badge, theme as antdTheme } from "antd";
import Link from "next/link";
import { BellOutlined } from '@ant-design/icons';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../config';

const NotificationsDropdownContent = dynamic(() => import('../NotificationsDropdownContent'), { ssr: false, loading: () => <div style={{ padding: 12 }}>Loading...</div> });

export default function AdminTopbar() {
  const { token } = antdTheme.useToken();
  const [notifs, setNotifs] = useState([]);
  const [notifTab, setNotifTab] = useState('direct');
  const [notifOpen, setNotifOpen] = useState(false);
  const [displayName, setDisplayName] = useState('Admin');
  const [initial, setInitial] = useState('A');

  async function fetchNotifs() {
    try {
      const jwt = localStorage.getItem('jf_token');
      if (!jwt) return;
      const nr = await fetch(`${API_BASE_URL}/notifications?$limit=10&$sort[createdAt]=-1`, { headers: { 'Authorization': `Bearer ${jwt}` } });
      const njson = await nr.json();
      const items = Array.isArray(njson) ? njson : (njson?.data || []);
      setNotifs(items);
    } catch (_) {
      setNotifs([]);
    }
  }

  const markAllAsRead = async (ids) => {
    try {
      const jwt = localStorage.getItem('jf_token');
      if (!Array.isArray(notifs)) return;
      const targets = Array.isArray(ids) && ids.length
        ? notifs.filter(n => ids.includes(n._id))
        : notifs.filter(n => !n.isRead && n._id);
      await Promise.all(targets.map(n => (
        fetch(`${API_BASE_URL}/notifications/${n._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
          body: JSON.stringify({ isRead: true })
        })
      )));
      fetchNotifs();
    } catch (_) {}
  };

  // Load admin identity
  useEffect(() => {
    (async () => {
      try {
        const jwt = localStorage.getItem('jf_token');
        if (!jwt) return;
        const res = await fetch(`${API_BASE_URL}/users/me`, { headers: { 'Authorization': `Bearer ${jwt}` } });
        if (res.ok) {
          const me = await res.json();
          const name = me?.fullName || me?.name || me?.email || 'Admin';
          setDisplayName(name);
          setInitial((name || 'A').charAt(0).toUpperCase());
        }
      } catch (_) {}
    })();
  }, []);

  const menu = {
    items: [
      { key: 'dash', label: <Link href="/admin/dashboard" prefetch={false}>Dashboard</Link> },
      { key: 'companies', label: <Link href="/admin/companies" prefetch={false}>Companies</Link> },
      { key: 'renewals', label: <Link href="/admin/renewals" prefetch={false}>Renewals</Link> },
      { type: 'divider' },
      { key: 'logout', label: 'Logout', onClick: () => { try { localStorage.removeItem('jf_token'); } catch {} window.location.href = '/'; } },
    ]
  };

  // Admin-only notifications filter
  const adminNotifs = Array.isArray(notifs) ? notifs.filter(n => {
    const t = (n.title || '').toLowerCase();
    const ty = (n.type || '').toLowerCase();
    const ch = (n.channel || '').toLowerCase();
    const aud = (n.audience || '').toLowerCase();
    if (n.isAdmin === true || n.admin === true) return true;
    if (aud === 'admin' || ch === 'admin' || ty === 'admin') return true;
    const hints = ['approval','renewal','monitoring','company','job','pending'];
    return hints.some(h => t.includes(h) || ty.includes(h));
  }) : [];
  const unreadCount = Array.isArray(adminNotifs) ? adminNotifs.filter(n => !n.read).length : 0;

  return (
    <Layout.Header style={{ background: token.colorBgContainer, borderBottom: `1px solid ${token.colorBorder}`, padding: '0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography.Text strong>Admin</Typography.Text>
        <Space>
          <Dropdown
            popupRender={() => (
              notifOpen ? (
                <NotificationsDropdownContent
                  notifs={adminNotifs}
                  token={typeof window !== 'undefined' ? localStorage.getItem('jf_token') : null}
                  onMarkAll={markAllAsRead}
                  notifTab={notifTab}
                  setNotifTab={setNotifTab}
                  onItemClick={(n) => { window.location.href = n.link || '/notifications'; }}
                  tokenColors={{ bg: token.colorBgElevated, border: token.colorBorder, primary: token.colorPrimary, radius: token.borderRadiusLG, shadow: token.boxShadowSecondary }}
                />
              ) : (
                <div style={{ width: 320, padding: 12 }}>Loading...</div>
              )
            )}
            onOpenChange={(o)=>{ setNotifOpen(o); if(o) fetchNotifs(); }}
            placement="bottomRight"
          >
            <Badge count={unreadCount} size="small">
              <Button type="text" icon={<BellOutlined />} />
            </Badge>
          </Dropdown>

          <Dropdown menu={menu} placement="bottomRight">
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <Avatar size={28} style={{ backgroundColor: token.colorPrimary }}>{initial}</Avatar>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>{displayName}</Typography.Text>
            </div>
          </Dropdown>
        </Space>
      </div>
    </Layout.Header>
  );
}

