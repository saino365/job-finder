"use client";
import { useEffect, useState } from 'react';
import { Button, Space, Tooltip, message } from "antd";
import { useRouter } from 'next/navigation';
import { apiAuth, getToken } from '../lib/api';

export default function JobDetailActions({ jobId }) {
  const router = useRouter();
  const [existingApplication, setExistingApplication] = useState(null);

  useEffect(() => {
    // Check if student already has an active application for this job
    (async () => {
      if (!getToken()) return;
      try {
        const apps = await apiAuth(`/applications?jobListingId=${jobId}`, { method: 'GET' });
        const appList = Array.isArray(apps?.data) ? apps.data : (Array.isArray(apps) ? apps : []);
        // Active statuses: SHORTLISTED (1), INTERVIEW_SCHEDULED (2), PENDING_ACCEPTANCE (3), ACCEPTED_PENDING_REVIEW (8), HIRED (4)
        const ACTIVE_STATUSES = [1, 2, 3, 8, 4];
        const activeApp = appList.find(app => ACTIVE_STATUSES.includes(app.status));
        if (activeApp) {
          setExistingApplication(activeApp);
        }
      } catch (_) { /* ignore */ }
    })();
  }, [jobId]);

  function goApply() {
    if (!getToken()) {
      message.info('Please sign in to apply');
      router.push(`/login?next=/jobs/${jobId}/apply`);
      return;
    }
    // Don't navigate if there's an existing active application
    if (existingApplication) {
      return;
    }
    router.push(`/jobs/${jobId}/apply`);
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

  if (existingApplication) {
    return (
      <Space>
        <Tooltip title={`You already have an active application for this position (Status: ${getApplicationStatusLabel(existingApplication.status)}). You cannot apply again while your application is still active.`}>
          <Button 
            type="primary" 
            disabled
            style={{ 
              background: '#d9d9d9', 
              border: 'none', 
              borderRadius: '25px', 
              fontSize: '16px', 
              fontWeight: '600', 
              padding: '8px 25px', 
              height: 'auto',
              cursor: 'not-allowed'
            }}
          >
            Already Applied
          </Button>
        </Tooltip>
      </Space>
    );
  }

  return (
    <Space>
      <Button type="primary" onClick={goApply} style={{ background: 'linear-gradient(to right, #7d69ff, #917fff)', border: 'none', borderRadius: '25px', fontSize: '16px', fontWeight: '600', padding: '8px 25px', height: 'auto', boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)" }}>Apply For Position</Button>
    </Space>
  );
}


