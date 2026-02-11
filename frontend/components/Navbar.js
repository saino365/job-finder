"use client";
import { useEffect, useState } from 'react';
import { Layout, Menu, Button, Space, Switch, Dropdown, theme as antdTheme, Avatar, Typography, Badge, Drawer } from 'antd';
import Link from 'next/link';
import { BellOutlined, MenuOutlined } from '@ant-design/icons';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useTheme } from './Providers';
import { API_BASE_URL } from '../config';
import UserAvatar from './UserAvatar';

export default function Navbar() {
  const { theme, toggle } = useTheme();
  const { token } = antdTheme.useToken();
  const [authed, setAuthed] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [role, setRole] = useState('');
  const [notifs, setNotifs] = useState([]);
  const [notifTab, setNotifTab] = useState('direct');
  const [mounted, setMounted] = useState(false);
  const unreadCount = Array.isArray(notifs) ? notifs.filter(n => !n.isRead).length : 0;
  
  // Fix hydration error: only render after mount to avoid SSR/client mismatch
  useEffect(() => {
    setMounted(true);
  }, []);


  const NotificationsDropdownContent = dynamic(() => import('./NotificationsDropdownContent'), { ssr: false, loading: () => <div style={{ padding: 12 }}>Loading...</div> });

  const fetchNotifs = async () => {
    try {
      const token = localStorage.getItem('jf_token');
      if (!token) return;
      // Fetch latest 50 notifications to ensure we have enough unread ones
      const nr = await fetch(`${API_BASE_URL}/notifications?$limit=50&$sort[createdAt]=-1`, { headers: { 'Authorization': `Bearer ${token}` } });
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
        : notifs.filter(n => !n.isRead && n._id); // Only check isRead field
      
      if (targets.length === 0) return;
      
      // Mark all as read
      const results = await Promise.all(targets.map(async (n) => {
        try {
          const res = await fetch(`${API_BASE_URL}/notifications/${n._id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ isRead: true })
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
        const res = await fetch(`${API_BASE_URL}/users/me`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) {
          console.error('Failed to fetch user info');
          return;
        }
        
        const userData = await res.json();
        
        // Determine role based on user data
        if (userData.role === 'admin') {
          setRole('admin');
          const name = userData?.fullName || userData?.name || userData?.email || 'Admin';
          setDisplayName(name);
        } else if (userData.role === 'student') {
          setRole('student');
          // Fetch student profile
          try {
            const studentRes = await fetch(`${API_BASE_URL}/users/${userData._id}`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (studentRes.ok) {
              const studentData = await studentRes.json();
              const fn = studentData?.profile?.firstName || '';
              const ln = studentData?.profile?.lastName || '';
              const name = `${fn} ${ln}`.trim() || 'Student';
              setDisplayName(name);
              setAvatarUrl(studentData?.profile?.avatar || '');
            }
          } catch (e) {
            console.error('Failed to fetch student profile:', e);
          }
        } else {
          // Company user
          setRole('company');
          try {
            // Fetch company by owner
            const cRes = await fetch(`${API_BASE_URL}/companies?ownerUserId=${userData._id}`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (cRes.ok) {
              const cJson = await cRes.json();
              const companies = Array.isArray(cJson?.data) ? cJson.data : [];
              if (companies.length > 0) {
                const company = companies[0];
                setDisplayName(company.name || 'Company');
                const logoUrl = company.logoKey || company.logo || '';
                setAvatarUrl(logoUrl);
              }
            }
          } catch (e) {
            console.error('Failed to fetch company info:', e);
          }
        }
      } catch (e) {
        console.error('Failed to fetch user data:', e);
      }
      
      // fetch notifications for dropdown (latest 50)
      try {
        const nr = await fetch(`${API_BASE_URL}/notifications?$limit=50&$sort[createdAt]=-1`, { headers: { 'Authorization': `Bearer ${token}` } });
        const njson = await nr.json();
        const items = Array.isArray(njson) ? njson : (njson?.data || []);
        setNotifs(items);
      } catch (_) {}
    })();
  }, []);

  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false); // D179: Mobile menu drawer state
  const [isMobile, setIsMobile] = useState(false); // D179: Mobile detection
  const logoSrc = theme === 'dark' ? '/logo_rect_dark.svg' : '/logo_rect_light.svg';
  
  // D179: Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
      { key: 'invitations', label: <Link href="/company/invitations" prefetch={false}>Invitations</Link> },
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

  // Fix hydration error: return empty header during SSR, render full content after mount
  if (!mounted) {
    return (
      <Layout.Header style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%', maxWidth: 1200, margin: '0 auto' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', marginRight: 24 }}>
            <Image src={logoSrc} alt="Job Finder" width={128} height={32} priority />
          </Link>
          <div style={{ flex: 1 }} /> {/* Placeholder for menu */}
        </div>
      </Layout.Header>
    );
  }

  return (
    <Layout.Header suppressHydrationWarning style={{ background: token.colorBgContainer, borderBottom: `1px solid ${token.colorBorder}`, padding: '0 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%', maxWidth: 1200, margin: '0 auto' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', marginRight: 24 }}>
          <Image src={logoSrc} alt="Job Finder" width={128} height={32} priority />
        </Link>
        {!isMobile && (
          <div suppressHydrationWarning style={{ flex: 1 }}>
            <Menu className="nav-menu" theme={theme === 'dark' ? 'dark' : 'light'} mode="horizontal" selectable={false} style={{ flex: 1, background: 'transparent' }} items={menuItems} />
          </div>
        )}
        <Space>
          {isMobile && (
            <Button type="text" icon={<MenuOutlined />} onClick={() => setMobileMenuOpen(true)} />
          )}
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
                {/* D192: Add "Notifications" text label on mobile */}
                <Button type="text" icon={<BellOutlined />}>
                  {isMobile && <span style={{ marginLeft: 4 }}>Notifications</span>}
                </Button>
              </Badge>
            </Dropdown>
          )}
          {authed ? (
            <Dropdown menu={userMenu} placement="bottomRight">
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <UserAvatar
                  name={displayName || 'User'}
                  avatarUrl={avatarUrl}
                  size={28}
                />
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
        {isMobile && (
          <Drawer title="Menu" placement="right" onClose={() => setMobileMenuOpen(false)} open={mobileMenuOpen} width={280}>
            <Menu mode="vertical" items={menuItems} style={{ border: 'none' }} onClick={() => setMobileMenuOpen(false)} />
            {authed && (
              <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid #f0f0f0' }}>
                <Typography.Text strong>Account</Typography.Text>
                <Menu mode="vertical" items={userMenu.items} style={{ border: 'none', marginTop: 8 }} onClick={() => setMobileMenuOpen(false)} />
              </div>
            )}
          </Drawer>
        )}
      </div>
    </Layout.Header>
  );
}

