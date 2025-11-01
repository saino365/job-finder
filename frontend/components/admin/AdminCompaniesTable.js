"use client";

import { Table, Button, Space, Tag } from "antd";
import { CheckOutlined, CloseOutlined, EyeOutlined } from '@ant-design/icons';

function getStatusTag(status) {
  const s = typeof status === 'string' ? status : ({0:'pending',1:'approved',2:'rejected'}[status] ?? 'unknown');
  if (s === 'pending') return <Tag color="orange">Pending</Tag>;
  if (s === 'approved') return <Tag color="green">Approved</Tag>;
  if (s === 'rejected') return <Tag color="red">Rejected</Tag>;
  return <Tag>Unknown</Tag>;
}

export default function AdminCompaniesTable({ companies = [], loading, onApprove, onReject, onView }) {
  const columns = [
    {
      title: 'Company Name',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Button type="link" onClick={() => onView(record)}>{text}</Button>
      )
    },
    { title: 'Registration Number', dataIndex: 'registrationNumber', key: 'registrationNumber' },
    { title: 'Status', dataIndex: 'verifiedStatus', key: 'verifiedStatus', render: getStatusTag },
    { title: 'Submitted', dataIndex: 'submittedAt', key: 'submittedAt', render: (d) => d ? new Date(d).toLocaleDateString() : '-' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button type="primary" icon={<CheckOutlined />} size="small" disabled={record.verifiedStatus === 1} onClick={() => onApprove(record._id)}>Approve</Button>
          <Button danger icon={<CloseOutlined />} size="small" disabled={record.verifiedStatus === 2} onClick={() => onReject(record)}>Reject</Button>
          <Button icon={<EyeOutlined />} size="small" onClick={() => onView(record)}>View</Button>
        </Space>
      )
    }
  ];

  return (
    <Table
      columns={columns}
      dataSource={companies}
      loading={loading}
      rowKey="_id"
      pagination={{ pageSize: 10, showSizeChanger: true, showQuickJumper: true, showTotal: (t) => `Total ${t} companies` }}
    />
  );
}

