"use client";

import React, { Suspense } from "react";
import { Layout, Card, List, Typography, Tag, Space, Button, Pagination, Skeleton, Empty, Tabs } from "antd";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { API_BASE_URL } from "../../components/../config";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function NotificationsPageContent() {
  const searchParams = useSearchParams();
  const activeTab = searchParams?.get('tab') || 'direct';
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [currentTab, setCurrentTab] = React.useState(activeTab);

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("jf_token");
      const params = new URLSearchParams({ "$limit": "10" });
      if (page > 1) params.set("$skip", String((page - 1) * 10));
      const res = await fetch(`${API_BASE_URL}/notifications?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (data?.data || []);
      // D202, D203: Filter by tab (direct or watching)
      let filtered = arr;
      if (currentTab === 'watching') {
        filtered = arr.filter(n => {
          const channel = n.channel || '';
          const type = n.type || '';
          return channel === 'watching' || type === 'watching' || (type && (type.includes('job') || type.includes('track')));
        });
      } else {
        filtered = arr.filter(n => {
          const channel = n.channel || '';
          const type = n.type || '';
          return channel !== 'watching' && type !== 'watching' && !(type && (type.includes('job') || type.includes('track')));
        });
      }
      setItems(filtered);
      setTotal(data?.total ?? filtered.length);
    } catch (_) {
      setItems([]); setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, currentTab]);

  React.useEffect(() => { 
    const tab = searchParams?.get('tab') || 'direct';
    setCurrentTab(tab);
  }, [searchParams]);
  
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
        <Card>
          {/* D203: Add tabs for Direct and Watching notifications */}
          <Tabs activeKey={currentTab} onChange={(key) => { setCurrentTab(key); setPage(1); window.history.pushState({}, '', `/notifications?tab=${key}`); }} items={[
            { 
              key: 'direct', 
              label: 'Direct',
              children: loading ? (
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
              )
            },
            { 
              key: 'watching', 
              label: 'Watching',
              children: loading ? (
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
                <Empty description="No watching notifications" />
              )
            }
          ]} />
        </Card>
      </Layout.Content>
      <Footer />
    </Layout>
  );
}

