"use client";
import { useEffect, useState } from 'react';
import { Modal, message, App } from 'antd';
import { usePathname } from 'next/navigation';
import { API_BASE_URL } from '../config';

// Helper: decode JWT payload (best-effort, no verification)
function parseJwt(token) {
  try { return JSON.parse(atob(token.split('.')[1])); } catch { return null; }
}

const NAG_KEY = 'companyProfileNagLastShown';
const NAG_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const VERIFICATION_POPUP_KEY = 'companyVerificationPopupShown'; // Session-based key for D75

function CompanyStatusGateInner() {
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);
  const { modal } = App.useApp();

  useEffect(() => {
    // Avoid running on auth/register-like pages to prevent loops
    const skipPaths = ['/login', '/register', '/register-company', '/verify-email', '/forgot-password', '/reset-password'];
    if (skipPaths.some(p => pathname?.startsWith(p))) return;

    let cancelled = false;

    async function run() {
      const token = typeof window !== 'undefined' ? localStorage.getItem('jf_token') : null;
      if (!token) { setChecked(true); return; }

      const payload = parseJwt(token) || {};

      // Fetch current user for role and id (more reliable than decoding only)
      let user = null;
      try {
        const me = await fetch(`${API_BASE_URL}/users/me`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (me.ok) { user = await me.json(); }
      } catch (_) {}

      if (!user) { setChecked(true); return; }
      if (user.role !== 'company') { setChecked(true); return; }

      try {
        // 1) Check if user already has a company
        const cRes = await fetch(`${API_BASE_URL}/companies?ownerUserId=${user._id}`, { headers: { 'Authorization': `Bearer ${token}` } });

        if (!cRes.ok) {
          // If forbidden or pending approval, bounce to pending page
          try {
            const err = await cRes.json();
            if (cRes.status === 403 || err?.message?.includes('pending approval')) {
              if (!cancelled) {
                message.warning('Your company is pending approval.');
                window.location.href = '/company/pending-approval';
              }
              return;
            }
          } catch {}
          setChecked(true);
          return;
        }

        const cJson = await cRes.json().catch(()=>({}));
        const list = Array.isArray(cJson?.data) ? cJson.data : (Array.isArray(cJson) ? cJson : []);

        if (list.length === 0) {
          // No company document yet. Check if there's a pending submission; if so, redirect to pending page.
          try {
            const pv = await fetch(`${API_BASE_URL}/company-verifications?submittedBy=${user._id}&status=0&$limit=1&$sort[submittedAt]=-1`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (pv.ok) {
              const pvJson = await pv.json().catch(()=>({}));
              const pvList = Array.isArray(pvJson?.data) ? pvJson.data : (Array.isArray(pvJson) ? pvJson : []);
              if (pvList.length > 0) {
                if (!cancelled) {
                  message.warning('Your company is pending approval.');
                  window.location.href = '/company/pending-approval';
                }
                return;
              }
            }
          } catch {}

          // Otherwise, truly no submission yet: push them to setup page until completed
          if (!cancelled && pathname !== '/company/setup') {
            message.info('Please complete your company setup.');
            window.location.href = '/company/setup';
            return;
          }
          setChecked(true);
          return;
        }

        const company = list[0];

        // 2) If company exists but not approved -> handle pending vs rejected explicitly
        if (typeof company.verifiedStatus === 'number' && company.verifiedStatus !== 1) {
          // 0 = pending, 2 = rejected
          if (!cancelled) {
            if (company.verifiedStatus === 0) {
              message.warning('Your company is pending approval.');
              window.location.href = '/company/pending-approval';
            } else {
              // Rejected company: block access to company features and show explanation page
              message.error('Your company verification was rejected. Please review the reason and resubmit.');
              window.location.href = '/company/rejected';
            }
          }
          return;
        }

        // 3) Approved -> check verification status (latest company-verifications doc)
        // If there is a verifications record still pending, show a non-blocking modal (D75: only once per session)
        try {
          const vRes = await fetch(`${API_BASE_URL}/company-verifications?companyId=${company._id}&$limit=1&$sort[submittedAt]=-1`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (vRes.ok) {
            const vJson = await vRes.json().catch(()=>({}));
            const ver = Array.isArray(vJson?.data) ? vJson.data : (Array.isArray(vJson) ? vJson : []);
            const latest = ver[0];
            const status = latest?.status; // 0=pending,1=approved,2=rejected
            if (status === 0) {
              // Check if popup was already shown in this session (D75)
              const popupShown = sessionStorage.getItem(VERIFICATION_POPUP_KEY);
              if (!popupShown) {
                modal.info({
                  title: 'Company Verification In Progress',
                  content: 'Your documents are undergoing verification. You may continue browsing candidates and features available to approved companies.',
                  okText: 'Got it',
                  onOk: () => {
                    // Mark as shown for this session
                    sessionStorage.setItem(VERIFICATION_POPUP_KEY, 'true');
                  }
                });
                // Mark as shown immediately to prevent multiple modals
                sessionStorage.setItem(VERIFICATION_POPUP_KEY, 'true');
              }
            }
          }
        } catch {}

        // 4) Profile completeness nag after verified
        // Required: logoKey, description, industry, address.fullAddress, picName, picEmail, picPhone, website
        const needs = [];
        if (!company.logoKey) needs.push('Company logo');
        if (!company.description) needs.push('Company description');
        if (!company.industry) needs.push('Company nature');
        if (!company?.address?.fullAddress) needs.push('Company address');
        if (!company.picName) needs.push('Company PIC name');
        if (!company.picEmail) needs.push('Company PIC email');
        if (!company.picPhone) needs.push('Company PIC mobile number');
        if (!company.website) needs.push('Company website');

        const now = Date.now();
        const lastNag = Number(localStorage.getItem(NAG_KEY) || 0);
        const shouldNag = needs.length > 0 && (now - lastNag > NAG_INTERVAL_MS);

        if (shouldNag) {
          modal.confirm({
            title: 'Complete your company profile',
            content: `To unlock the best experience, please complete these fields: \n• ${needs.join('\n• ')}`,
            okText: 'Go to profile',
            cancelText: 'Later',
            onOk: () => { window.location.href = '/company/profile'; },
            onCancel: () => { localStorage.setItem(NAG_KEY, String(Date.now())); }
          });
        }
      } finally {
        if (!cancelled) setChecked(true);
      }
    }

    run();
    return () => { cancelled = true; };
  }, [pathname]);

  return null; // no UI
}

export default function CompanyStatusGate() {
  return (
    <App>
      <CompanyStatusGateInner />
    </App>
  );
}

