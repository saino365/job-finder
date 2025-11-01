"use client";
import { useState, useEffect } from 'react';
import { Layout, Table, Button, Space, Tag, message, Modal, Typography, Card, Descriptions, Segmented, Form, Input } from 'antd';
import { CheckOutlined, CloseOutlined, EyeOutlined } from '@ant-design/icons';

import { API_BASE_URL } from '../../../config';
import dynamic from 'next/dynamic';
const AdminCompaniesTable = dynamic(() => import('../../../components/admin/AdminCompaniesTable'), { ssr: false, loading: () => <div /> });


const { Title } = Typography;

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all'); // all|pending|approved|rejected
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectingCompany, setRejectingCompany] = useState(null);
  const [rejectForm] = Form.useForm();
  const [approvingCompanies, setApprovingCompanies] = useState(new Set());

  useEffect(() => {
    loadCompanies();
  }, [statusFilter]);

  function statusToQueryValue(filter) {
    if (filter === 'pending') return 0;
    if (filter === 'approved') return 1;
    if (filter === 'rejected') return 2;
    return undefined;
  }

  async function loadCompanies() {
    try {
      const token = localStorage.getItem('jf_token');
      if (!token) {
        message.error('Please sign in as admin');
        window.location.href = '/login';
        return;
      }

      const vs = statusToQueryValue(statusFilter);
      const qs = new URLSearchParams();
      qs.set('$sort[submittedAt]','-1');
      qs.set('$limit','200');
      if (vs !== undefined) qs.set('verifiedStatus', String(vs));
      const res = await fetch(`${API_BASE_URL}/companies?${qs.toString()}` , {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error('Failed to load companies');
      }

      const data = await res.json();
      setCompanies(Array.isArray(data) ? data : (data?.data || []));
    } catch (error) {
      console.error('Error loading companies:', error);
      message.error('Failed to load companies');
    } finally {
      setLoading(false);
    }
  }

  async function findCompanyVerification(companyId) {
    const token = localStorage.getItem('jf_token');
    const res = await fetch(`${API_BASE_URL}/company-verifications?companyId=${companyId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to find verification');
    const data = await res.json();
    const verifications = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
    return verifications.find(v => v.companyId === companyId);
  }

  async function approveCompany(companyId) {
    try {
      setApprovingCompanies(prev => new Set([...prev, companyId]));
      const token = localStorage.getItem('jf_token');

      // Find the verification record
      const verification = await findCompanyVerification(companyId);
      if (!verification) {
        throw new Error('No verification record found for this company');
      }

      // Use the proper company-verifications endpoint
      const res = await fetch(`${API_BASE_URL}/company-verifications/${verification._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'approve'
        })
      });

      if (!res.ok) {
        throw new Error('Failed to approve company');
      }

      message.success('Company approved successfully');
      loadCompanies();
    } catch (error) {
      console.error('Error approving company:', error);
      message.error(error.message || 'Failed to approve company');
    } finally {
      setApprovingCompanies(prev => {
        const newSet = new Set(prev);
        newSet.delete(companyId);
        return newSet;
      });
    }
  }

  function openRejectModal(company) {
    setRejectingCompany(company);
    setRejectModalOpen(true);
  }

  async function handleReject() {
    try {
      const values = await rejectForm.validateFields();
      const token = localStorage.getItem('jf_token');

      // Find the verification record
      const verification = await findCompanyVerification(rejectingCompany._id);
      if (!verification) {
        throw new Error('No verification record found for this company');
      }

      // Use the proper company-verifications endpoint
      const res = await fetch(`${API_BASE_URL}/company-verifications/${verification._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'reject',
          rejectionReason: values.rejectionReason
        })
      });

      if (!res.ok) {
        throw new Error('Failed to reject company');
      }

      message.success('Company rejected successfully');
      setRejectModalOpen(false);
      rejectForm.resetFields();
      setRejectingCompany(null);
      loadCompanies();
    } catch (error) {
      console.error('Error rejecting company:', error);
      message.error(error.message || 'Failed to reject company');
    }
  }

  function getStatusTag(status) {
    const s = typeof status === 'string' ? status : ({0:'pending',1:'approved',2:'rejected'}[status] ?? 'unknown');
    if (s === 'pending') return <Tag color="orange">Pending</Tag>;
    if (s === 'approved') return <Tag color="green">Approved</Tag>;
    if (s === 'rejected') return <Tag color="red">Rejected</Tag>;
    return <Tag>Unknown</Tag>;
  }

  const columns = [
    {
      title: 'Company Name',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Button type="link" onClick={() => {
          setSelectedCompany(record);
          setDetailsVisible(true);
        }}>
          {text}
        </Button>
      )
    },
    {
      title: 'Registration Number',
      dataIndex: 'registrationNumber',
      key: 'registrationNumber'
    },
    {
      title: 'Status',
      dataIndex: 'verifiedStatus',
      key: 'verifiedStatus',
      render: getStatusTag
    },
    {
      title: 'Submitted',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      render: (date) => date ? new Date(date).toLocaleDateString() : '-'
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => {
        // Show status for processed companies
        if (record.verifiedStatus === 1) { // APPROVED
          return (
            <Space>
              <Button
                icon={<EyeOutlined />}
                size="small"
                onClick={() => {
                  setSelectedCompany(record);
                  setDetailsVisible(true);
                }}
              >
                View
              </Button>
              <Tag color="green">Approved</Tag>
            </Space>
          );
        }
        if (record.verifiedStatus === 2) { // REJECTED
          return (
            <Space>
              <Button
                icon={<EyeOutlined />}
                size="small"
                onClick={() => {
                  setSelectedCompany(record);
                  setDetailsVisible(true);
                }}
              >
                View
              </Button>
              <Tag color="red">Rejected</Tag>
              {record.rejectionReason && (
                <span style={{ fontSize: '12px', color: '#666' }}>({record.rejectionReason})</span>
              )}
            </Space>
          );
        }
        // Show buttons for pending companies
        return (
          <Space>
            <Button
              type="primary"
              icon={<CheckOutlined />}
              size="small"
              loading={approvingCompanies.has(record._id)}
              onClick={() => approveCompany(record._id)}
            >
              Approve
            </Button>
            <Button
              danger
              icon={<CloseOutlined />}
              size="small"
              onClick={() => openRejectModal(record)}
            >
              Reject
            </Button>
            <Button
              icon={<EyeOutlined />}
              size="small"
              onClick={() => {
                setSelectedCompany(record);
                setDetailsVisible(true);
              }}
            >
              View
            </Button>
          </Space>
        );
      }
    }
  ];

  return (
    <div>
      <Title level={2}>Company Management</Title>

      <Card style={{ marginBottom: 16 }}>
        <Space style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <Segmented
            options={[
              { label: 'All', value: 'all' },
              { label: 'Pending', value: 'pending' },
              { label: 'Approved', value: 'approved' },
              { label: 'Rejected', value: 'rejected' }
            ]}
            value={statusFilter}
            onChange={setStatusFilter}
          />
          <Button onClick={loadCompanies}>Refresh</Button>
        </Space>
      </Card>

      <Card>
        <AdminCompaniesTable
          companies={companies}
          loading={loading}
          onApprove={approveCompany}
          onReject={openRejectModal}
          onView={(rec) => { setSelectedCompany(rec); setDetailsVisible(true); }}
          approvingCompanies={approvingCompanies}
        />
      </Card>

      <Modal
        title="Company Details"
        open={detailsVisible}
        onCancel={() => setDetailsVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailsVisible(false)}>
            Close
          </Button>
        ]}
        width={800}
      >
        {selectedCompany && (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="Company Name">
              {selectedCompany.name}
            </Descriptions.Item>
            <Descriptions.Item label="Registration Number">
              {selectedCompany.registrationNumber}
            </Descriptions.Item>
            <Descriptions.Item label="Phone">
              {selectedCompany.phone}
            </Descriptions.Item>
            <Descriptions.Item label="Industry">
              {selectedCompany.industry || 'Not specified'}
            </Descriptions.Item>
            <Descriptions.Item label="Website">
              {selectedCompany.website || 'Not specified'}
            </Descriptions.Item>
            <Descriptions.Item label="Description">
              {selectedCompany.description || 'Not specified'}
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              {getStatusTag(selectedCompany.verifiedStatus)}
            </Descriptions.Item>
            <Descriptions.Item label="Submitted At">
              {selectedCompany.submittedAt ? new Date(selectedCompany.submittedAt).toLocaleString() : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Reviewed At">
              {selectedCompany.reviewedAt ? new Date(selectedCompany.reviewedAt).toLocaleString() : '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* Rejection Modal */}
      <Modal
        title="Reject Company Verification"
        open={rejectModalOpen}
        onCancel={() => {
          setRejectModalOpen(false);
          rejectForm.resetFields();
          setRejectingCompany(null);
        }}
        onOk={handleReject}
        okText="Reject"
        okButtonProps={{ danger: true }}
      >
        <Form form={rejectForm} layout="vertical">
          <Form.Item
            label="Rejection Reason"
            name="rejectionReason"
            rules={[{ required: true, message: 'Please provide a rejection reason' }]}
          >
            <Input.TextArea rows={4} placeholder="Explain why this company verification is rejected" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
