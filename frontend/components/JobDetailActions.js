"use client";
import { useEffect, useState } from 'react';
import { Button, Space, Tooltip, message, Alert } from "antd";
import { useRouter } from 'next/navigation';
import { apiAuth, getToken } from '../lib/api';

export default function JobDetailActions({ jobId, quantityAvailable }) {
  const router = useRouter();
  const [existingApplication, setExistingApplication] = useState(null);
  const [hiredCount, setHiredCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if student already has an active application for this job
    // AND check how many people are already hired for this position
    (async () => {
      try {
        if (getToken()) {
          const apps = await apiAuth(`/applications?jobListingId=${jobId}`, { method: 'GET' });
          const appList = Array.isArray(apps?.data) ? apps.data : (Array.isArray(apps) ? apps : []);
          
          // Active statuses: SHORTLISTED (1), INTERVIEW_SCHEDULED (2), PENDING_ACCEPTANCE (3), ACCEPTED_PENDING_REVIEW (8), HIRED (4)
          const ACTIVE_STATUSES = [1, 2, 3, 8, 4];
          const activeApp = appList.find(app => ACTIVE_STATUSES.includes(app.status));
          if (activeApp) {
            setExistingApplication(activeApp);
          }
          
          // Count hired applications (status 4)
          const hired = appList.filter(app => app.status === 4).length;
          setHiredCount(hired);
        }
      } catch (_) { /* ignore */ }
      finally {
        setLoading(false);
      }
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
    // Don't navigate if position is full
    if (quantityAvailable && hiredCount >= quantityAvailable) {
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

  // Check if position is full
  const isPositionFull = quantityAvailable && hiredCount >= quantityAvailable;

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

  if (isPositionFull) {
    return (
      <Space>
        <Tooltip title={`This position is full. All ${quantityAvailable} available slot${quantityAvailable > 1 ? 's have' : ' has'} been filled.`}>
          <Button 
            disabled
            style={{ 
              background: '#ff4d4f', 
              color: 'white',
              border: 'none', 
              borderRadius: '25px', 
              fontSize: '16px', 
              fontWeight: '600', 
              padding: '8px 25px', 
              height: 'auto',
              cursor: 'not-allowed',
              opacity: 0.6
            }}
          >
            Position Closed
          </Button>
        </Tooltip>
      </Space>
    );
  }

  return (
    <Space>
      <Button 
        type="primary" 
        onClick={goApply} 
        loading={loading}
        style={{ 
          background: 'linear-gradient(to right, #7d69ff, #917fff)', 
          border: 'none', 
          borderRadius: '25px', 
          fontSize: '16px', 
          fontWeight: '600', 
          padding: '8px 25px', 
          height: 'auto', 
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)" 
        }}
      >
        Apply For Position
      </Button>
    </Space>
  );
}

