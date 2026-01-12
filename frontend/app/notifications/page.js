"use client";

import React from "react";
import { Layout, Card, List, Typography, Tag, Space, Button, Pagination, Skeleton, Empty } from "antd";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { API_BASE_URL } from "../../components/../config";
import Link from "next/link";

export default function NotificationsPage() {
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("jf_token");
      const params = new URLSearchParams({ "$limit": "10" });
      if (page > 1) params.set("$skip", String((page - 1) * 10));
      const res = await fetch(`${API_BASE_URL}/notifications?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (data?.data || []);
      setItems(arr);
      setTotal(data?.total ?? arr.length);
    } catch (_) {
      setItems([]); setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page]);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  const markRead = async (id) => {
    try {
      const token = localStorage.getItem("jf_token");
      await fetch(`${API_BASE_URL}/notifications/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ isRead: true }) });
      fetchData();
    } catch (_) {}
  };

  return (
    <Layout>
      <Navbar />
      <Layout.Content style={{ maxWidth: 1200, margin: '24px auto', padding: '0 16px' }}>
        <Card title="Notifications">
          {loading ? (
            <Skeleton active />
          ) : items.length ? (
            <>
              <List
                itemLayout="vertical"
                dataSource={items}
                renderItem={(n) => (
                  <List.Item
                    key={n._id}
                    extra={<Space>
                      {!n.isRead && <Tag color="blue">Unread</Tag>}
                      <Button size="small" onClick={() => markRead(n._id)}>Mark as read</Button>
                      {n.link && <Link href={n.link}><Button size="small" type="link">Open</Button></Link>}
                    </Space>}
                  >
                    <List.Item.Meta
                      title={n.title || n.message || 'Notification'}
                      description={new Date(n.createdAt || Date.now()).toLocaleString()}
                    />
                    <div>{n.body || n.message}</div>
                  </List.Item>
                )}
              />
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
                <Pagination current={page} pageSize={10} total={total} showSizeChanger={false} onChange={(p)=> setPage(p)} />
              </div>
            </>
          ) : (
            <Empty description="No notifications" />
          )}
        </Card>
      </Layout.Content>
      <Footer />
    </Layout>
  );
}

