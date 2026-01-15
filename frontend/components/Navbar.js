"use client";
import { useEffect, useState } from 'react';
import { Layout, Menu, Button, Space, Switch, Dropdown, theme as antdTheme, Avatar, Typography, Badge } from 'antd';
import Link from 'next/link';
import { BellOutlined } from '@ant-design/icons';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useTheme } from './Providers';
import { API_BASE_URL } from '../config';

export default function Navbar() {
  const { theme, toggle } = useTheme();
  const { token } = antdTheme.useToken();
  const [authed, setAuthed] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarSignedUrl, setAvatarSignedUrl] = useState('');
  const [role, setRole] = useState('');
  const [notifs, setNotifs] = useState([]);
  const [notifTab, setNotifTab] = useState('direct');
  const unreadCount = Array.isArray(notifs) ? notifs.filter(n => !n.read).length : 0;


  const NotificationsDropdownContent = dynamic(() => import('./NotificationsDropdownContent'), { ssr: false, loading: () => <div style={{ padding: 12 }}>Loading...</div> });

  const fetchNotifs = async () => {
    try {
      const token = localStorage.getItem('jf_token');
      if (!token) return;
      const nr = await fetch(`${API_BASE_URL}/notifications?$limit=10&$sort[createdAt]=-1`, { headers: { 'Authorization': `Bearer ${token}` } });
      const njson = await nr.json();
      const items = Array.isArray(njson) ? njson : (njson?.data || []);
      setNotifs(items);
    } catch (_) {
      setNotifs([]);
    }
  };

  // D154: Fix Mark all as read - ensure notifications are properly marked as read
  const markAllAsRead = async (ids) => {
    try {
      const token = localStorage.getItem('jf_token');
      if (!Array.isArray(notifs)) return;
      const targets = Array.isArray(ids) && ids.length
        ? notifs.filter(n => ids.includes(n._id))
        : notifs.filter(n => !n.isRead && !n.read && n._id); // Check both isRead and read
      
      if (targets.length === 0) return;
      
      // Mark all as read
      const results = await Promise.all(targets.map(async (n) => {
        try {
          const res = await fetch(`${API_BASE_URL}/notifications/${n._id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ isRead: true, read: true }) // Set both fields
          });
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to mark as read');
          }
          return res.json();
        } catch (e) {
          console.error(`Failed to mark notification ${n._id} as read:`, e);
          return null;
        }
      }));
      
      // Refresh notifications after marking as read
      await fetchNotifs();
    } catch (e) {
      console.error('Mark all as read error:', e);
    }
  };

  // Moved statusTag and heavy dropdown UI into dynamic NotificationsDropdownContent
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('jf_token') : null;
    setAuthed(!!token);
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/student/internship/me`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          const fn = data?.profile?.firstName || '';
          const ln = data?.profile?.lastName || '';
          const name = `${fn} ${ln}`.trim() || 'Student';
          setDisplayName(name);
          setAvatarUrl(data?.profile?.avatar || '');
          setRole('student');

          // Generate signed URL for avatar
          if (data?.profile?.avatar) {
            try {
              const signedRes = await fetch(`${API_BASE_URL}/signed-url?url=${encodeURIComponent(data.profile.avatar)}`);
              if (signedRes.ok) {
                const signedData = await signedRes.json();
                setAvatarSignedUrl(signedData.signedUrl);
              }
            } catch (_) {}
          }
        } else {
          // If not a student, detect admin; otherwise default to company
          try {
            const ar = await fetch(`${API_BASE_URL}/admin-dashboard/overview`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (ar.ok) {
              setRole('admin');
              // Fetch admin user info
              try {
                const meRes = await fetch(`${API_BASE_URL}/users/me`, { headers: { 'Authorization': `Bearer ${token}` } });
                if (meRes.ok) {
                  const me = await meRes.json();
                  const name = me?.fullName || me?.name || me?.email || 'Admin';
                  setDisplayName(name);
                }
              } catch (_) {}
            } else {
              setRole('company');
              // Fetch company info
              try {
                const meRes = await fetch(`${API_BASE_URL}/users/me`, { headers: { 'Authorization': `Bearer ${token}` } });
                if (meRes.ok) {
                  const me = await meRes.json();
                  // Fetch company by owner
                  const cRes = await fetch(`${API_BASE_URL}/companies?ownerUserId=${me._id}`, { headers: { 'Authorization': `Bearer ${token}` } });
                  if (cRes.ok) {
                    const cJson = await cRes.json();
                    const companies = Array.isArray(cJson?.data) ? cJson.data : [];
                    if (companies.length > 0) {
                      const company = companies[0];
                      setDisplayName(company.name || 'Company');
                      const logoUrl = company.logoKey || company.logo || '';
                      setAvatarUrl(logoUrl);

                      // Generate signed URL for company logo
                      if (logoUrl) {
                        try {
                          const signedRes = await fetch(`${API_BASE_URL}/signed-url?url=${encodeURIComponent(logoUrl)}`);
                          if (signedRes.ok) {
                            const signedData = await signedRes.json();
                            setAvatarSignedUrl(signedData.signedUrl);
                          }
                        } catch (_) {}
                      }
                    }
                  }
                }
              } catch (_) {}
            }
          } catch (_) { setRole('company'); }
        }
      } catch (_) {}
      // fetch notifications for dropdown (latest 10)
      try {
        const nr = await fetch(`${API_BASE_URL}/notifications?$limit=10&$sort[createdAt]=-1`, { headers: { 'Authorization': `Bearer ${token}` } });
        const njson = await nr.json();
        const items = Array.isArray(njson) ? njson : (njson?.data || []);
        setNotifs(items);
      } catch (_) {}
    })();
  }, []);

  const [notifOpen, setNotifOpen] = useState(false);
  const logoSrc = theme === 'dark' ? '/logo_rect_dark.svg' : '/logo_rect_light.svg';

  // Dynamic menu items based on user role
  const menuItems = role === 'company' ? [
    { key: 'candidates', label: <Link href="/" prefetch={false}>Candidates</Link> },
  ] : [
    { key: 'jobs', label: <Link href="/jobs" prefetch={false}>Jobs</Link> },
    { key: 'companies', label: <Link href="/companies" prefetch={false}>Companies</Link> },
  ];

  const userMenu = {
    items: role === 'admin' ? [
      { key: 'admin-dashboard', label: <Link href="/admin/dashboard" prefetch={false}>Dashboard</Link> },
      { key: 'admin-companies', label: <Link href="/admin/companies" prefetch={false}>Companies</Link> },
      { key: 'admin-renewals', label: <Link href="/admin/renewals" prefetch={false}>Renewal Requests</Link> },
      { type: 'divider' },
      { key: 'settings', label: <Link href="/settings" prefetch={false}>Settings</Link> },
      { key: 'logout', label: 'Logout', onClick: () => { localStorage.removeItem('jf_token'); window.location.reload(); } },
    ] : role === 'company' ? [
      { key: 'profile', label: <Link href="/company/profile" prefetch={false}>Profile</Link> },
      { key: 'jobs', label: <Link href="/company/jobs" prefetch={false}>Job Management</Link> },
      { key: 'applications', label: <Link href="/company/applications" prefetch={false}>Applications</Link> },
      { key: 'employees', label: <Link href="/company/employees" prefetch={false}>Employees</Link> },
      { key: 'universities', label: <Link href="/company/universities" prefetch={false}>Universities & Programmes</Link> },
      { key: 'create-job', label: <Link href="/company/jobs/new" prefetch={false}>Create Job</Link> },
      { type: 'divider' },
      { key: 'settings', label: <Link href="/settings" prefetch={false}>Settings</Link> },
      { key: 'logout', label: 'Logout', onClick: () => { localStorage.removeItem('jf_token'); window.location.reload(); } },
    ] : [
      { key: 'profile', label: <Link href="/profile" prefetch={false}>Profile</Link> },
      { key: 'applications', label: <Link href="/applications" prefetch={false}>Applications</Link> },
      { key: 'invitations', label: <Link href="/invitations" prefetch={false}>Invitations</Link> },
      { key: 'saved', label: <Link href="/saved-jobs" prefetch={false}>Saved Jobs</Link> },
      { key: 'liked', label: <Link href="/liked-jobs" prefetch={false}>Liked Jobs</Link> },
      { key: 'liked-companies', label: <Link href="/liked-companies" prefetch={false}>Liked Companies</Link> },
      { type: 'divider' },
      { key: 'settings', label: <Link href="/settings" prefetch={false}>Settings</Link> },
      { key: 'logout', label: 'Logout', onClick: () => { localStorage.removeItem('jf_token'); window.location.reload(); } },
    ]
  };

  return (
    <Layout.Header style={{ background: token.colorBgContainer, borderBottom: `1px solid ${token.colorBorder}`, padding: '0 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%', maxWidth: 1200, margin: '0 auto' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', marginRight: 24 }}>
          <Image src={logoSrc} alt="Job Finder" width={128} height={32} priority />
        </Link>
        <Menu className="nav-menu" theme={theme === 'dark' ? 'dark' : 'light'} mode="horizontal" selectable={false} style={{ flex: 1, background: 'transparent' }} items={menuItems} />
        <Space>
          {authed && (
            <Dropdown
              popupRender={() => (
                notifOpen ? (
                  <NotificationsDropdownContent
                    notifs={notifs}
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
          )}
          {authed ? (
            <Dropdown menu={userMenu} placement="bottomRight">
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <Avatar size={28} src={avatarSignedUrl || avatarUrl || undefined} style={{ backgroundColor: token.colorPrimary }}>
                  {(displayName || 'U').charAt(0).toUpperCase()}
                </Avatar>
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
                  <Typography.Text style={{ margin: 0 }}>
                    {displayName || 'Account'}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12, margin: 0 }}>
                    {role ? role.charAt(0).toUpperCase() + role.slice(1) : ''}
                  </Typography.Text>
                </div>
              </div>
            </Dropdown>
          ) : (
            <>
              <Link href="/login" prefetch={false}><Button type="text" className="nav-text-btn">Sign in</Button></Link>
              <Link href="/register" prefetch={false}><Button type="text" className="nav-text-btn">Register</Button></Link>
              <Link href="/register-company" prefetch={false}><Button className="nav-outline-btn">Employer Register</Button></Link>
            </>
          )}
        </Space>
      </div>
    </Layout.Header>
  );
}

