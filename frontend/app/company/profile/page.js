"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Layout,
  Card,
  Typography,
  Button,
  Space,
  Row,
  Col,
  Tabs,
  Tag,
  Upload,
  message,
  Avatar,
  Skeleton,
} from "antd";
import {
  EditOutlined,
  UploadOutlined,
  GlobalOutlined,
  EnvironmentOutlined,
  MailOutlined,
  PhoneOutlined,
} from "@ant-design/icons";



import Navbar from "../../../components/Navbar";
import Footer from "../../../components/Footer";
import { API_BASE_URL } from "../../../config";
import dynamic from "next/dynamic";
const EditCompanyForm = dynamic(() => import("../../../components/company/EditCompanyForm"), { ssr: false, loading: () => <Card loading style={{ minHeight: 300 }} /> });


const { Title, Text } = Typography;


export default function CompanyProfilePage() {
  // Align with ProfilePageInner.js structure/state
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState(null);
  const [editing, setEditing] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [logoUrl, setLogoUrl] = useState(null);


  const storageBase =
    process.env.NEXT_PUBLIC_STORAGE_URL ||
    "https://job-finder-storage.s3.ap-southeast-1.amazonaws.com";

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("jf_token");
      if (!token) {
        message.info("Please sign in");
        window.location.href = "/login";
        return;
      }

      // Current user (company owner)
      const meRes = await fetch(`${API_BASE_URL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!meRes.ok) throw new Error("Failed to load user");
      const meJson = await meRes.json();

      // Company by owner
      const cRes = await fetch(
        `${API_BASE_URL}/companies?ownerUserId=${meJson._id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!cRes.ok) throw new Error("Failed to load company");
      const cJson = await cRes.json();
      const list = Array.isArray(cJson?.data) ? cJson.data : [];
      if (list.length === 0) {
        message.info("Please complete your company setup first.");
        window.location.href = "/company/setup";
        return;
      }
      setCompany(list[0]);
      setEditing(false);
    } catch (e) {
      console.error(e);
      message.error(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);



  useEffect(() => {
    load();
  }, [load]);

  // Generate signed URL for logo display
  useEffect(() => {
    async function loadLogo() {
      // Construct the full S3 URL from logoKey or use logo URL
      const fullUrl = company?.logoKey
        ? `${storageBase}/${company.logoKey}`
        : company?.logo;

      if (fullUrl) {
        try {
          const res = await fetch(`${API_BASE_URL}/signed-url?url=${encodeURIComponent(fullUrl)}`);
          if (res.ok) {
            const data = await res.json();
            setLogoUrl(data.signedUrl);
          } else {
            setLogoUrl(fullUrl); // Fallback to original URL
          }
        } catch (e) {
          console.error('Failed to get signed URL:', e);
          setLogoUrl(fullUrl); // Fallback to original URL
        }
      } else {
        setLogoUrl(null);
      }
    }
    loadLogo();
  }, [company?.logo, company?.logoKey, storageBase]);

  async function onUploadLogo(file) {
    try {
      const token = localStorage.getItem("jf_token");
      const fd = new FormData();
      fd.append("logo", file);
      message.loading("Uploading logo...", 0);
      const up = await fetch(`${API_BASE_URL}/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!up.ok) throw new Error("Upload failed");
      const data = await up.json();
      // Use public URL instead of signedUrl (signedUrl expires after 1 hour)
      const url = data?.files?.logo?.[0]?.url || data?.files?.logo?.[0]?.signedUrl;
      const key = data?.files?.logo?.[0]?.key;
      if (url || key) {
        const res = await fetch(`${API_BASE_URL}/companies/${company._id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ logo: url, logoKey: key }),
        });
        if (!res.ok) throw new Error("Failed to save logo");
        message.destroy();
        message.success("Logo updated!");
        await load();
      }
    } catch (e) {
      message.destroy();
      message.error(e.message || "Logo upload failed");
    }
    return false; // prevent auto upload
  }

  async function onSave(values) {
    try {
      const token = localStorage.getItem("jf_token");
      const body = {
        name: values.name,
        industry: values.industry,
        size: values.size,
        website: values.website,
        description: values.description,
        email: values.email,
        phone: values.phone,
        picName: values.picName,
        picEmail: values.picEmail,
        picPhone: values.picPhone,
        address: {
          fullAddress: values.fullAddress,
        },
      };
      const res = await fetch(`${API_BASE_URL}/companies/${company._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to update company");
      message.success("Company updated");
      await load();
      setEditing(false);
    } catch (e) {
      message.error(e.message || "Update failed");
    }
  }

  const ViewLayout = () => {
    const statusText =
      company?.verifiedStatus === 1
        ? "Approved"
        : company?.verifiedStatus === 2
        ? "Rejected"
        : "Pending";
    const statusColor =
      company?.verifiedStatus === 1
        ? "green"
        : company?.verifiedStatus === 2
        ? "red"
        : "orange";

    const tabItems = [
      {
        key: "overview",
        label: "Company overview",
        children: (
          <div style={{ padding: "24px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 24,
              }}
            >
              <Title level={4} style={{ margin: 0 }}>
                Company overview
              </Title>
              <Button type="text" icon={<EditOutlined />} onClick={() => setEditing(true)} />
            </div>
            <Text style={{ fontSize: 16, lineHeight: 1.8, color: '#595959' }}>
              {company?.description || "No description provided yet."}
            </Text>
          </div>
        ),
      },
    ];

    return (
      <Row gutter={10} style={{ width: '100%' }}>
        {/* Left Sidebar */}
        <Col xs={24} lg={8}>
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            {/* Profile Card */}
            <Card
              style={{
                textAlign: "center",
                position: "relative",
                borderRadius: 8,
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02)'
              }}
            >
              <div style={{ position: "absolute", top: 16, right: 16 }}>
                <Tag color={statusColor} style={{ borderRadius: 12, padding: '2px 12px' }}>
                  {statusText}
                </Tag>
              </div>

              <div style={{ position: "relative", display: "inline-block", marginBottom: 16, marginTop: 8 }}>
                <Avatar
                  size={100}
                  src={!logoError && logoUrl ? logoUrl : undefined}
                  style={{ border: '3px solid #f0f0f0' }}
                  onError={() => {
                    setLogoError(true);
                    return true;
                  }}
                >
                  {company?.name?.charAt(0) || "C"}
                </Avatar>
                <Upload beforeUpload={onUploadLogo} maxCount={1} accept="image/*" showUploadList={false}>
                  <Button
                    type="primary"
                    size="small"
                    icon={<UploadOutlined />}
                    style={{
                      position: "absolute",
                      bottom: 0,
                      right: 0,
                      borderRadius: "50%",
                      width: 32,
                      height: 32,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  />
                </Upload>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 4 }}>
                <Title level={4} style={{ margin: 0, fontSize: 20 }}>
                  {company?.name}
                </Title>
                <Button type="text" icon={<EditOutlined />} size="small" onClick={() => setEditing(true)} />
              </div>

              <Text style={{ fontSize: 14, color: '#8c8c8c', display: "block", marginBottom: 8 }}>
                {company?.registrationNumber || "Company Registration"}
              </Text>

              <Text style={{ fontSize: 15, fontWeight: 500, display: "block", marginBottom: 16, color: '#262626' }}>
                {company?.industry || "Company industry"}
              </Text>
            </Card>

            {/* Company Details */}
            <Card
              title={<span style={{ fontSize: 16, fontWeight: 600 }}>Company details</span>}
              style={{
                borderRadius: 8,
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02)'
              }}
            >
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <div>
                  <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 13, color: '#8c8c8c' }}>Registration Number:</Text>
                  <Text style={{ fontSize: 14, color: '#262626' }}>{company?.registrationNumber || "—"}</Text>
                </div>

                <div>
                  <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 13, color: '#8c8c8c' }}>Industry:</Text>
                  <Text style={{ fontSize: 14, color: '#262626' }}>{company?.industry || "—"}</Text>
                </div>

                <div>
                  <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 13, color: '#8c8c8c' }}>Company Size:</Text>
                  <Text style={{ fontSize: 14, color: '#262626' }}>{company?.size || "—"}</Text>
                </div>

                <div>
                  <GlobalOutlined style={{ color: '#8c8c8c', marginRight: 8 }} />
                  <a
                    href={company?.website || "#"}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 14 }}
                  >
                    {company?.website || "Website not set"}
                  </a>
                </div>

                <div>
                  <MailOutlined style={{ color: '#8c8c8c', marginRight: 8 }} />
                  <Text style={{ fontSize: 14, color: '#262626' }}>{company?.email || "—"}</Text>
                </div>

                <div>
                  <PhoneOutlined style={{ color: '#8c8c8c', marginRight: 8 }} />
                  <Text style={{ fontSize: 14, color: '#262626' }}>{company?.phone || "—"}</Text>
                </div>

                <div>
                  <EnvironmentOutlined style={{ color: '#8c8c8c', marginRight: 8 }} />
                  <Text style={{ fontSize: 14, color: '#262626' }}>
                    {company?.address?.fullAddress || "Address not set"}
                  </Text>
                </div>
              </Space>
            </Card>

            {/* Point of Contact */}
            <Card
              title={<span style={{ fontSize: 16, fontWeight: 600 }}>Point of Contact</span>}
              style={{
                borderRadius: 8,
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02)'
              }}
            >
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <div>
                  <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 13, color: '#8c8c8c' }}>Name:</Text>
                  <Text style={{ fontSize: 14, color: '#262626' }}>{company?.picName || "—"}</Text>
                </div>

                <div>
                  <MailOutlined style={{ color: '#8c8c8c', marginRight: 8 }} />
                  <Text style={{ fontSize: 14, color: '#262626' }}>{company?.picEmail || "—"}</Text>
                </div>

                <div>
                  <PhoneOutlined style={{ color: '#8c8c8c', marginRight: 8 }} />
                  <Text style={{ fontSize: 14, color: '#262626' }}>{company?.picPhone || "—"}</Text>
                </div>
              </Space>
            </Card>
          </Space>
        </Col>

        {/* Right Content */}
        <Col xs={24} lg={16}>
          <Card
            style={{
              minHeight: 400,
              borderRadius: 8,
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02)'
            }}
            bodyStyle={{ padding: 0 }}
          >
            <Tabs
              defaultActiveKey="overview"
              items={tabItems}
              tabBarStyle={{
                marginBottom: 0,
                paddingLeft: 24,
                paddingRight: 24,
                paddingTop: 16
              }}
            />
          </Card>
        </Col>
      </Row>
    );
  };

  if (loading) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Navbar />
        <Layout.Content style={{ maxWidth: 1600, margin: "24px auto", padding: "0 24px", width: '100%' }}>
          <Row gutter={10} style={{ width: '100%' }}>
            <Col xs={24} lg={8}>
              <Card loading style={{ minHeight: 300 }} />
            </Col>
            <Col xs={24} lg={16}>
              <Card loading style={{ minHeight: 400 }} />
            </Col>
          </Row>
        </Layout.Content>
        <Footer />
      </Layout>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Navbar />
      <Layout.Content style={{ maxWidth: 1600, margin: "24px auto", padding: "0 24px", width: '100%' }}>
        {!editing && <ViewLayout />}
        {editing && (
          <EditCompanyForm
            company={company}
            logoUrl={logoUrl}
            onUploadLogo={onUploadLogo}
            onSave={onSave}
            setEditing={setEditing}
          />
        )}
      </Layout.Content>
      <Footer />
    </Layout>
  );
}

