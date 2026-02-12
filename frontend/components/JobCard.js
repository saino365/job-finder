"use client";
import { useEffect, useState } from 'react';
import { Card, Tag, Typography, Button, Space, App, Modal, Divider, Tooltip, theme as antdTheme } from 'antd';
import { HeartOutlined, HeartFilled, BookOutlined, BookFilled, EnvironmentOutlined, DollarOutlined, ClockCircleOutlined, AppstoreOutlined, TeamOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { apiAuth, getToken } from '../lib/api';
import AuthPromptModal from './AuthPromptModal';
import { API_BASE_URL } from '../config';

const { Text } = Typography;

export default function JobCard({ job, companyView = false }) {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // D194: Detect mobile device for responsive job title
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  const { message } = App.useApp();
  const { token } = antdTheme.useToken();
  const [saved, setSaved] = useState(false);
  const [savedId, setSavedId] = useState(null);
  const [liked, setLiked] = useState(false);
  const [likedId, setLikedId] = useState(null);
  const [authModalConfig, setAuthModalConfig] = useState({});
  const [logoSignedUrl, setLogoSignedUrl] = useState(null);
  const [logoError, setLogoError] = useState(false);
  const [existingApplication, setExistingApplication] = useState(null);
  const [hiredCount, setHiredCount] = useState(job.hiredCount || 0);
  const [loadingHiredCount, setLoadingHiredCount] = useState(false);
  const router = useRouter();
  const companyName = job.company?.name || job.companyName || 'Company';

  const statusLabel = (s) => {
    switch (s) {
      case 0: return 'Draft';
      case 1: return 'Pending Final Approval';
      case 2: return 'Active';
      case 3: return 'Closed';
      case 4: return 'Pending Pre-Approval';
      case 5: return 'Pre-Approved';
      default: return '';
    }
  };

  const statusColor = (s) => {
    switch (s) {
      case 0: return 'default';
      case 1: return 'orange';
      case 2: return 'green';
      case 3: return 'red';
      case 4: return 'blue';
      case 5: return 'cyan';
      default: return 'default';
    }
  };

  const daysLeft = (() => {
    if (!job?.expiresAt) return null;
    const now = new Date();
    const exp = new Date(job.expiresAt);
    const diff = Math.ceil((exp.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    return diff;
  })();

  // D157: Fix job click error - handle unauthenticated access by redirecting to login first
  function handleCardClick() {
    // D157: Check if user is authenticated before allowing job view
    if (!companyView && !getToken()) {
      message.info('Please sign in to view job details');
      router.push(`/login?next=/jobs/${job._id}`);
      return;
    }
    
    if (companyView) {
      router.push(`/company/jobs/${job._id}`);
    } else {
      router.push(`/jobs/${job._id}`);
    }
  }

  function handleApplyClick() {
    if (!getToken()) {
      message.info('Please sign in to apply');
      router.push(`/login?next=/jobs/${job._id}/apply`);
      return;
    }
    // Don't navigate if there's an existing active application
    if (existingApplication) {
      return;
    }
    router.push(`/jobs/${job._id}/apply`);
  }

  // Get status label for existing application
  const getApplicationStatusLabel = (status) => {
    const statusLabels = {
      1: 'Shortlisted',
      2: 'Interview Scheduled',
      3: 'Pending Acceptance',
      8: 'Accepted - Pending Review',
      4: 'Hired'
    };
    return statusLabels[status] || 'Active';
  };

  // Load company logo with signed URL
  useEffect(() => {
    async function loadLogo() {
      let logoUrl = job.company?.logo || job.company?.logoUrl || job.companyLogo;
      if (!logoUrl && job.company?.logoKey) {
        logoUrl = `${process.env.NEXT_PUBLIC_STORAGE_URL || 'https://ap-southeast-mys1.oss.ips1cloud.com/job-finder-bucket'}/${job.company.logoKey}`;
      }

      if (logoUrl) {
        try {
          const res = await fetch(`${API_BASE_URL}/signed-url?url=${encodeURIComponent(logoUrl)}`);
          if (res.ok) {
            const data = await res.json();
            setLogoSignedUrl(data.signedUrl);
          } else {
            setLogoSignedUrl(logoUrl);
          }
        } catch (e) {
          setLogoSignedUrl(logoUrl);
        }
      }
    }
    loadLogo();
  }, [job.company?.logo, job.company?.logoUrl, job.company?.logoKey, job.companyLogo]);

  useEffect(() => {
    // Preload saved and liked state for this job
    (async () => {
      if (!getToken()) return;
      try {
        const s = await apiAuth(`/saved-jobs?jobListingId=${job._id}`, { method: 'GET' });
        const savedList = Array.isArray(s?.data) ? s.data : (Array.isArray(s) ? s : []);
        if ((savedList || []).length > 0) { setSaved(true); setSavedId(savedList[0]._id); } else { setSaved(false); setSavedId(null); }
      } catch (_) { /* ignore */ }
      try {
        const l = await apiAuth(`/liked-jobs?jobListingId=${job._id}`, { method: 'GET' });
        const likedList = Array.isArray(l?.data) ? l.data : (Array.isArray(l) ? l : []);
        if ((likedList || []).length > 0) { setLiked(true); setLikedId(likedList[0]._id); } else { setLiked(false); setLikedId(null); }
      } catch (_) { /* ignore */ }
      
      // Check if student already has an active application for this job
      try {
        const apps = await apiAuth(`/applications?jobListingId=${job._id}`, { method: 'GET' });
        const appList = Array.isArray(apps?.data) ? apps.data : (Array.isArray(apps) ? apps : []);
        // Active statuses: SHORTLISTED (1), INTERVIEW_SCHEDULED (2), PENDING_ACCEPTANCE (3), ACCEPTED_PENDING_REVIEW (8), HIRED (4)
        const ACTIVE_STATUSES = [1, 2, 3, 8, 4];
        const activeApp = appList.find(app => ACTIVE_STATUSES.includes(app.status));
        if (activeApp) {
          setExistingApplication(activeApp);
        }
      } catch (_) { /* ignore */ }
    })();
  }, [job._id]);

  async function handleSave(e){
    e.preventDefault(); e.stopPropagation();

    // Check if user is signed in
    if (!getToken()) {
      setAuthModalConfig({
        title: "Save Job",
        description: "Please sign in to save this job to your list. You'll be able to view all your saved jobs in your profile.",
        actionText: "Sign In to Save"
      });
      setAuthModalOpen(true);
      return;
    }

    try {
      if (!saved) {
        const created = await apiAuth('/saved-jobs', { method: 'POST', body: { jobListingId: job._id } });
        setSaved(true);
        setSavedId(created?._id || created?.id || null);
        message.success('Saved');
      } else {
        if (savedId) {
          await apiAuth(`/saved-jobs/${savedId}`, { method: 'DELETE' });
        } else {
          // Fallback: find then remove
          const res = await apiAuth(`/saved-jobs?jobListingId=${job._id}`, { method: 'GET' });
          const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
          if (list?.[0]?._id) await apiAuth(`/saved-jobs/${list[0]._id}`, { method: 'DELETE' });
        }
        setSaved(false);
        setSavedId(null);
        message.success('Removed from Saved');
      }
    }
    catch(err){
      message.error('Failed to update saved state. Please try again.');
    }
  }

  async function handleLike(e){
    e.preventDefault(); e.stopPropagation();

    if (!getToken()) {
      setAuthModalConfig({
        title: "Like Job",
        description: "Please sign in to add this job to your like list. Companies will receive monthly reports about candidates who liked their jobs.",
        actionText: "Sign In to Like"
      });
      setAuthModalOpen(true);
      return;
    }

    try {
      if (!liked) {
        const created = await apiAuth('/liked-jobs', { method: 'POST', body: { jobListingId: job._id } });
        setLiked(true);
        setLikedId(created?._id || created?.id || null);
        message.success('Liked');
      } else {
        if (likedId) {
          await apiAuth(`/liked-jobs/${likedId}`, { method: 'DELETE' });
        } else {
          const res = await apiAuth(`/liked-jobs?jobListingId=${job._id}`, { method: 'GET' });
          const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
          if (list?.[0]?._id) await apiAuth(`/liked-jobs/${list[0]._id}`, { method: 'DELETE' });
        }
        setLiked(false);
        setLikedId(null);
        message.success('Removed Like');
      }
    }
    catch(err){
      message.error('Failed to update like state. Please try again.');
    }
  }

  async function requestRenewal(e) {
    e?.preventDefault?.(); e?.stopPropagation?.();
    try {
      if (!getToken()) { message.error('Sign in required'); return; }
      await apiAuth(`/job-listings/${job._id}`, { method: 'PATCH', body: { requestRenewal: true } });
      message.success('Renewal requested. Awaiting operator approval.');
      // naive refresh of the page/route to fetch updated job data
      if (typeof window !== 'undefined') window.location.reload();
    } catch (err) {
      message.error('Failed to request renewal');
    }
  }

  // Calculate days ago
  const daysAgo = (() => {
    const posted = job.approvedAt || job.createdAt;
    if (!posted) return 0;
    const now = new Date();
    const postedDate = new Date(posted);
    const diff = Math.floor((now.getTime() - postedDate.getTime()) / (24 * 60 * 60 * 1000));
    return diff;
  })();

  // Check if position is full
  const isPositionFull = job.quantityAvailable && hiredCount >= job.quantityAvailable;

  // Format salary
  const formatSalary = () => {
    if (!job.salaryRange || (!job.salaryRange.min && !job.salaryRange.max)) return 'Not specified';
    const min = job.salaryRange.min ? `RM ${job.salaryRange.min.toLocaleString()}` : '';
    const max = job.salaryRange.max ? `RM ${job.salaryRange.max.toLocaleString()}` : '';
    if (min && max) return `${min} - ${max}`;
    return min || max;
  };

  return (
    <Card
      hoverable
      onClick={handleCardClick}
      style={{
        cursor: 'pointer',
        transition: 'all 0.2s',
        border: `1px solid ${token.colorBorder}`,
        backgroundColor: token.colorBgContainer,
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
      styles={{ body: { padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' } }}
    >
      {/* D148: Ensure consistent card height with flex layout */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
        {/* Header with logo and actions */}
        {/* D147: Move Like and Save buttons inside the card */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ display: 'flex', gap: 16, flex: 1 }}>
            {/* Company Logo */}
            {logoSignedUrl && !logoError ? (
              <img
                src={logoSignedUrl}
                alt={companyName}
                onError={() => setLogoError(true)}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 8,
                  objectFit: 'cover',
                  border: `1px solid ${token.colorBorder}`
                }}
              />
            ) : (
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 8,
                  backgroundColor: token.colorBgLayout,
                  border: `1px solid ${token.colorBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                  fontWeight: 600,
                  color: token.colorTextTertiary,
                  flexShrink: 0
                }}
              >
                {companyName.charAt(0).toUpperCase()}
              </div>
            )}

            {/* Job Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                {/* D194: Allow job title to wrap on mobile instead of truncating */}
                <h3 style={{ 
                  fontSize: isMobile ? 18 : 20, 
                  fontWeight: 600, 
                  color: token.colorText, 
                  margin: 0, 
                  overflow: 'hidden', 
                  textOverflow: isMobile ? 'clip' : 'ellipsis', 
                  whiteSpace: isMobile ? 'normal' : 'nowrap',
                  wordBreak: isMobile ? 'break-word' : 'normal',
                  flex: 1,
                  lineHeight: 1.3,
                  display: '-webkit-box',
                  WebkitLineClamp: isMobile ? 2 : 1,
                  WebkitBoxOrient: 'vertical'
                }}>
                  {job.title}
                </h3>
                {/* D147: Like and Save buttons inside card */}
                <div style={{ display: 'flex', gap: 8, marginLeft: 8, flexShrink: 0 }}>
                  <Button
                    type="text"
                    icon={liked ? <HeartFilled style={{ color: '#ff4d4f', fontSize: 20 }} /> : <HeartOutlined style={{ fontSize: 20 }} />}
                    onClick={handleLike}
                    style={{ padding: '4px 8px' }}
                  />
                  <Button
                    type="text"
                    icon={saved ? <BookFilled style={{ color: '#1890ff', fontSize: 20 }} /> : <BookOutlined style={{ fontSize: 20 }} />}
                    onClick={handleSave}
                    style={{ padding: '4px 8px' }}
                  />
                </div>
              </div>
              <p style={{ fontSize: 16, color: token.colorTextSecondary, margin: '0 0 8px 0' }}>{companyName}</p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 14, color: token.colorTextSecondary }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <EnvironmentOutlined style={{ color: token.colorTextTertiary }} />
                  {job.location?.city || job.location?.state ?
                    [job.location?.city, job.location?.state].filter(Boolean).join(', ') :
                    'Location not specified'}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <DollarOutlined style={{ color: token.colorTextTertiary }} />
                  {formatSalary()}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AppstoreOutlined style={{ color: token.colorTextTertiary }} />
                  {job.company?.industry || 'Industry not specified'}
                </span>
                {job.quantityAvailable && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <TeamOutlined style={{ color: token.colorTextTertiary }} />
                    {Math.max(0, job.quantityAvailable - hiredCount)}/{job.quantityAvailable} position{job.quantityAvailable > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        <p style={{ color: token.colorTextSecondary, fontSize: 14, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {job.description}
        </p>

        {/* Skills/Tags */}
        {job.company?.industry && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Tag style={{ margin: 0, padding: '4px 12px', fontSize: 12, borderRadius: 4 }}>
              {job.company.industry}
            </Tag>
            {job?.project?.startDate && job?.project?.endDate && (
              <Tag style={{ margin: 0, padding: '4px 12px', fontSize: 12, borderRadius: 4 }}>
                {(() => {
                  const s = new Date(job.project.startDate);
                  const e = new Date(job.project.endDate);
                  const months = Math.round(((e - s) / (1000*60*60*24*30)));
                  return `${months} month${months===1?'':'s'} duration`;
                })()}
              </Tag>
            )}
          </div>
        )}

        <Divider style={{ margin: '8px 0' }} />

        {/* Footer with date and actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: token.colorTextTertiary }}>
            <ClockCircleOutlined style={{ fontSize: 14 }} />
            <span>Posted {daysAgo === 0 ? 'today' : `${daysAgo} ${daysAgo === 1 ? 'day' : 'days'} ago`}</span>
          </div>
          <Space>
            <Button size="large" onClick={(e) => { e.stopPropagation(); handleCardClick(); }}>
              View Details
            </Button>
            {isPositionFull ? (
              <Tooltip title={`This position is full. All ${job.quantityAvailable} available slot${job.quantityAvailable > 1 ? 's have' : ' has'} been filled.`}>
                <Button type="primary" size="large" disabled style={{ background: '#ff4d4f', borderColor: '#ff4d4f', opacity: 0.6 }}>
                  Position Closed
                </Button>
              </Tooltip>
            ) : existingApplication ? (
              <Tooltip title={`You already have an active application for this position (Status: ${getApplicationStatusLabel(existingApplication.status)}). You cannot apply again while your application is still active.`}>
                <Button type="primary" size="large" disabled>
                  Already Applied
                </Button>
              </Tooltip>
            ) : (
              <Button type="primary" size="large" onClick={(e) => { e.stopPropagation(); handleApplyClick(); }}>
                Apply Now
              </Button>
            )}
          </Space>
        </div>

        {/* Company view specific content */}
        {companyView && (
          <>
            {/* Status/expiry notice */}
            {job.status !== 2 && (
              <div style={{ marginTop: 8 }}>
                <Tag color={statusColor(job.status)}>{statusLabel(job.status)}</Tag>
              </div>
            )}

            {/* Rejection reason */}
            {job.status === 0 && (job.preApprovalRejectionReason || job.rejectionReason) && (
              <div style={{
                padding: '8px 12px',
                border: '1px solid #ff4d4f',
                borderRadius: 6,
                background: token.colorErrorBg || '#fff1f0',
                marginTop: 8
              }}>
                <Text type="danger" strong>Rejection Reason:</Text>
                <Typography.Paragraph style={{ margin: '4px 0 0 0', color: token.colorText }}>
                  {job.preApprovalRejectionReason || job.rejectionReason}
                </Typography.Paragraph>
              </div>
            )}

            {/* Expiry notice */}
            {job.status === 2 && daysLeft != null && daysLeft <= 7 && (
              <div style={{
                padding: '8px 12px',
                border: `1px dashed ${token.colorBorder}`,
                borderRadius: 6,
                background: token.colorBgLayout,
                marginTop: 8
              }}>
                <Space wrap>
                  <Tag color="orange">Expiring in {Math.max(daysLeft, 0)} day{Math.max(daysLeft,0)===1?'':'s'}</Tag>
                  {job.renewal ? (
                    <Tag color="blue">Renewal pending approval</Tag>
                  ) : (
                    <Button size="small" type="primary" onClick={requestRenewal}>Request renewal</Button>
                  )}
                </Space>
              </div>
            )}
          </>
        )}

        {/* Company view action buttons */}
        {companyView && job.status === 0 && (
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <Button size="small" onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); router.push(`/company/jobs/${job._id}/edit`); }}>
              Continue editing
            </Button>
            <Button size="small" onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); router.push(`/company/jobs/${job._id}`); }}>
              View
            </Button>
          </div>
        )}
        {companyView && job.status === 1 && (
          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
            {job.picUpdatedAt && <Tag color="blue">PIC updated</Tag>}
            <Button size="small" onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); router.push(`/company/jobs/${job._id}`); }}>
              View
            </Button>
            <Button size="small" onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); router.push(`/company/jobs/${job._id}?editPIC=1`); }}>
              Edit PIC
            </Button>
          </div>
        )}
        {companyView && job.status === 2 && (
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <Button size="small" onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); router.push(`/company/jobs/${job._id}`); }}>View</Button>
            <Button size="small" danger onClick={(e)=>{
              e.preventDefault(); e.stopPropagation();
              Modal.confirm({
                title: 'Close this job?',
                content: 'Once closed, it will be removed from public listings.',
                okText: 'Yes, close job',
                cancelText: 'Cancel',
                onOk: async () => {
                  try {
                    if (!getToken()) { message.error('Sign in required'); return; }
                    await apiAuth(`/job-listings/${job._id}`, { method: 'PATCH', body: { close: true } });
                    message.success('Job closed');
                    if (typeof window !== 'undefined') window.location.href = '/company/profile?tab=past';
                  } catch (err) { message.error('Failed to close job'); }
                }
              });
            }}>Close job</Button>
          </div>
        )}
      </div>

      <AuthPromptModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        title={authModalConfig.title}
        description={authModalConfig.description}
        actionText={authModalConfig.actionText}
      />
    </Card>
  );
}

