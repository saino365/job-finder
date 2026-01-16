"use client";
import { useState, useEffect } from 'react';
import { Layout, Card, Typography, Switch, Space, Divider, Button, message, Select } from 'antd';
import { MoonOutlined, SunOutlined, BellOutlined, GlobalOutlined, UserOutlined, LockOutlined, ClockCircleOutlined } from '@ant-design/icons';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { useTheme } from '../../components/Providers';
import { API_BASE_URL } from '../../config';
import { getToken } from '../../lib/api';

const { Title, Text } = Typography;
const { Content } = Layout;

export default function SettingsPage() {
  const { theme, toggle } = useTheme();
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    jobAlerts: true,
    applicationUpdates: true,
    companyMessages: true
  });
  const [language, setLanguage] = useState('en');
  const [timezone, setTimezone] = useState('Asia/Kuala_Lumpur');
  const [hidePhoneForCompanies, setHidePhoneForCompanies] = useState(false); // D185: Hide phone from companies
  const [timesheetCadence, setTimesheetCadence] = useState('weekly'); // D195: Timesheet cadence
  const [userRole, setUserRole] = useState(null); // D195: Track user role
  const [loading, setLoading] = useState(false);

  // Load user preferences on mount
  useEffect(() => {
    async function loadPreferences() {
      const token = getToken();
      if (!token) return;
      
      try {
        const res = await fetch(`${API_BASE_URL}/users/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const user = await res.json();
          // D195: Set user role
          setUserRole(user?.role);
          // Load language and timezone from user profile if available
          if (user?.profile?.language) setLanguage(user.profile.language);
          if (user?.profile?.timezone) setTimezone(user.profile.timezone);
          // D185: Load hidePhoneForCompanies setting
          if (user?.profile?.hidePhoneForCompanies !== undefined) {
            setHidePhoneForCompanies(user.profile.hidePhoneForCompanies);
          }
          // D195: Load timesheet cadence from company profile if user is company
          if (user?.role === 'company') {
            const companyRes = await fetch(`${API_BASE_URL}/companies?ownerUserId=${user._id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (companyRes.ok) {
              const companyData = await companyRes.json();
              const company = Array.isArray(companyData?.data) ? companyData.data[0] : companyData;
              if (company?.timesheetCadence) {
                setTimesheetCadence(company.timesheetCadence);
              }
            }
          }
        }
      } catch (e) {
        console.warn('Failed to load preferences:', e);
      }
    }
    loadPreferences();
  }, []);

  const handleNotificationChange = (key, value) => {
    setNotifications(prev => ({
      ...prev,
      [key]: value
    }));
    message.success('Notification preferences updated');
  };

  const handleLanguageChange = async (value) => {
    setLanguage(value);
    const token = getToken();
    if (!token) {
      message.warning('Please sign in to save preferences');
      return;
    }
    
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/users/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ 'profile.language': value })
      });
      if (res.ok) {
        message.success('Language preference saved');
      } else {
        throw new Error('Failed to save');
      }
    } catch (e) {
      message.error('Failed to save language preference');
    } finally {
      setLoading(false);
    }
  };

  const handleTimezoneChange = async (value) => {
    setTimezone(value);
    const token = getToken();
    if (!token) {
      message.warning('Please sign in to save preferences');
      return;
    }
    
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/users/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ 'profile.timezone': value })
      });
      if (res.ok) {
        message.success('Timezone preference saved');
      } else {
        throw new Error('Failed to save');
      }
    } catch (e) {
      message.error('Failed to save timezone preference');
    } finally {
      setLoading(false);
    }
  };

  // D185: Handle hide phone from companies setting
  const handleHidePhoneChange = async (checked) => {
    setHidePhoneForCompanies(checked);
    const token = getToken();
    if (!token) {
      message.warning('Please sign in to save preferences');
      return;
    }
    
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/users/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ 'profile.hidePhoneForCompanies': checked })
      });
      if (res.ok) {
        message.success(checked ? 'Phone number hidden from companies' : 'Phone number visible to companies');
      } else {
        throw new Error('Failed to save');
      }
    } catch (e) {
      message.error('Failed to save privacy preference');
      setHidePhoneForCompanies(!checked); // Revert on error
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <Navbar />
      <Content style={{ padding: '24px', maxWidth: 800, margin: '0 auto', width: '100%' }}>
        <div style={{ marginBottom: 24 }}>
          <Title level={2}>Settings</Title>
          <Text type="secondary">Manage your account preferences and settings</Text>
        </div>

        {/* Appearance Settings */}
        <Card style={{ marginBottom: 24 }}>
          <Title level={4} style={{ marginBottom: 16 }}>
            <SunOutlined style={{ marginRight: 8 }} />
            Appearance
          </Title>
          
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text strong>Dark Mode</Text>
                <br />
                <Text type="secondary">Switch between light and dark themes</Text>
              </div>
              <Switch 
                checked={theme === 'dark'} 
                onChange={toggle}
                checkedChildren={<MoonOutlined />}
                unCheckedChildren={<SunOutlined />}
              />
            </div>
          </Space>
        </Card>

        {/* Notification Settings */}
        <Card style={{ marginBottom: 24 }}>
          <Title level={4} style={{ marginBottom: 16 }}>
            <BellOutlined style={{ marginRight: 8 }} />
            Notifications
          </Title>
          
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text strong>Email Notifications</Text>
                <br />
                <Text type="secondary">Receive notifications via email</Text>
              </div>
              <Switch 
                checked={notifications.email} 
                onChange={(checked) => handleNotificationChange('email', checked)}
              />
            </div>
            
            <Divider style={{ margin: '12px 0' }} />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text strong>Push Notifications</Text>
                <br />
                <Text type="secondary">Receive browser push notifications</Text>
              </div>
              <Switch 
                checked={notifications.push} 
                onChange={(checked) => handleNotificationChange('push', checked)}
              />
            </div>
            
            <Divider style={{ margin: '12px 0' }} />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text strong>Job Alerts</Text>
                <br />
                <Text type="secondary">Get notified about new job opportunities</Text>
              </div>
              <Switch 
                checked={notifications.jobAlerts} 
                onChange={(checked) => handleNotificationChange('jobAlerts', checked)}
              />
            </div>
            
            <Divider style={{ margin: '12px 0' }} />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text strong>Application Updates</Text>
                <br />
                <Text type="secondary">Updates on your job applications</Text>
              </div>
              <Switch 
                checked={notifications.applicationUpdates} 
                onChange={(checked) => handleNotificationChange('applicationUpdates', checked)}
              />
            </div>
            
            <Divider style={{ margin: '12px 0' }} />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text strong>Company Messages</Text>
                <br />
                <Text type="secondary">Messages from companies and recruiters</Text>
              </div>
              <Switch 
                checked={notifications.companyMessages} 
                onChange={(checked) => handleNotificationChange('companyMessages', checked)}
              />
            </div>
          </Space>
        </Card>

        {/* Language & Region Settings */}
        <Card style={{ marginBottom: 24 }}>
          <Title level={4} style={{ marginBottom: 16 }}>
            <GlobalOutlined style={{ marginRight: 8 }} />
            Language & Region
          </Title>
          
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <Text strong>Language</Text>
                <br />
                <Text type="secondary">Choose your preferred language</Text>
              </div>
              <Select
                value={language}
                onChange={handleLanguageChange}
                style={{ width: 200 }}
                options={[
                  { value: 'en', label: 'English' },
                  { value: 'ms', label: 'Bahasa Malaysia' },
                  { value: 'zh', label: '中文' },
                  { value: 'ta', label: 'தமிழ்' }
                ]}
              />
            </div>
            
            <Divider style={{ margin: '12px 0' }} />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <Text strong>Timezone</Text>
                <br />
                <Text type="secondary">Your local timezone for scheduling</Text>
              </div>
              <Select
                value={timezone}
                onChange={handleTimezoneChange}
                style={{ width: 200 }}
                options={[
                  { value: 'Asia/Kuala_Lumpur', label: 'Kuala Lumpur (GMT+8)' },
                  { value: 'Asia/Singapore', label: 'Singapore (GMT+8)' },
                  { value: 'Asia/Jakarta', label: 'Jakarta (GMT+7)' },
                  { value: 'Asia/Bangkok', label: 'Bangkok (GMT+7)' }
                ]}
              />
            </div>
          </Space>
        </Card>

        {/* D185: Privacy Settings */}
        <Card style={{ marginBottom: 24 }}>
          <Title level={4} style={{ marginBottom: 16 }}>
            <LockOutlined style={{ marginRight: 8 }} />
            Privacy
          </Title>
          
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text strong>Hide Phone from Companies</Text>
                <br />
                <Text type="secondary">When enabled, your phone number will not be visible to companies viewing your profile</Text>
              </div>
              <Switch 
                checked={hidePhoneForCompanies} 
                onChange={handleHidePhoneChange}
                disabled={loading}
              />
            </div>
          </Space>
        </Card>

        {/* D195: Timesheet Cadence Settings (Company only) */}
        {userRole === 'company' && (
          <Card style={{ marginBottom: 24 }}>
            <Title level={4} style={{ marginBottom: 16 }}>
              <ClockCircleOutlined style={{ marginRight: 8 }} />
              Timesheet Settings
            </Title>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <Text strong>Timesheet Cadence</Text>
                  <br />
                  <Text type="secondary">Default timesheet submission frequency for new employees</Text>
                </div>
                <Select
                  value={timesheetCadence}
                  onChange={async (value) => {
                    setTimesheetCadence(value);
                    const token = getToken();
                    if (!token) { message.warning('Please sign in to save preferences'); return; }
                    try {
                      setLoading(true);
                      // Get company ID
                      const userRes = await fetch(`${API_BASE_URL}/users/me`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                      });
                      if (!userRes.ok) throw new Error('Failed to get user');
                      const user = await userRes.json();
                      const companyRes = await fetch(`${API_BASE_URL}/companies?ownerUserId=${user._id}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                      });
                      if (!companyRes.ok) throw new Error('Failed to get company');
                      const companyData = await companyRes.json();
                      const company = Array.isArray(companyData?.data) ? companyData.data[0] : companyData;
                      if (!company?._id) throw new Error('Company not found');
                      // Update company with timesheet cadence
                      const updateRes = await fetch(`${API_BASE_URL}/companies/${company._id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ timesheetCadence: value })
                      });
                      if (updateRes.ok) {
                        message.success('Timesheet cadence saved');
                      } else {
                        throw new Error('Failed to save');
                      }
                    } catch (e) {
                      message.error('Failed to save timesheet cadence');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  style={{ width: 200 }}
                  options={[
                    { value: 'weekly', label: 'Weekly' },
                    { value: 'biweekly', label: 'Bi-weekly' },
                    { value: 'monthly', label: 'Monthly' }
                  ]}
                />
              </div>
            </Space>
          </Card>
        )}

        {/* Account Settings */}
        <Card>
          <Title level={4} style={{ marginBottom: 16 }}>
            <UserOutlined style={{ marginRight: 8 }} />
            Account
          </Title>
          
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div>
              <Text type="secondary">
                For account security settings, password changes, and data management, 
                please visit your profile page.
              </Text>
            </div>
            
            <div style={{ display: 'flex', gap: 12 }}>
              <Button type="primary" href="/profile">
                Go to Profile
              </Button>
              <Button href="/profile/security">
                Security Settings
              </Button>
            </div>
          </Space>
        </Card>
      </Content>
      <Footer />
    </Layout>
  );
}
