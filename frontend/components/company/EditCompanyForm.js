"use client";

import { useMemo } from "react";
import { Row, Col, Card, Space, Avatar, Upload, Button, Typography, Form, Input } from "antd";
import { UploadOutlined } from "@ant-design/icons";

const { Title } = Typography;
const { TextArea } = Input;

export default function EditCompanyForm({ company, logoUrl, onUploadLogo, onSave, setEditing }) {
  const [form] = Form.useForm();

  const initialValues = useMemo(() => ({
    name: company?.name,
    industry: company?.industry,
    size: company?.size,
    website: company?.website,
    description: company?.description,
    email: company?.email,
    phone: company?.phone,
    picName: company?.picName,
    picEmail: company?.picEmail,
    picPhone: company?.picPhone,
    fullAddress: company?.address?.fullAddress,
  }), [company]);

  return (
    <Row gutter={24}>
      <Col xs={24} lg={8}>
        <Card title="Logo & Branding">
          <Space direction="vertical" size="large" style={{ width: "100%", textAlign: "center" }}>
            <Avatar size={120} src={logoUrl} style={{ marginBottom: 16 }}>
              {company?.name?.charAt(0) || "C"}
            </Avatar>
            <Upload beforeUpload={onUploadLogo} maxCount={1} accept="image/*" showUploadList={false}>
              <Button icon={<UploadOutlined />} block>
                Change Logo
              </Button>
            </Upload>
          </Space>
        </Card>
      </Col>

      <Col xs={24} lg={16}>
        <Card>
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Title level={3} style={{ margin: 0 }}>
                Edit Company
              </Title>
              <Button onClick={() => setEditing(false)}>Cancel</Button>
            </div>

            <Form form={form} layout="vertical" initialValues={initialValues} onFinish={onSave}>
              <Form.Item name="name" label="Company Name" rules={[{ required: true, message: "Please enter company name" }]}>
                <Input placeholder="Enter company name" />
              </Form.Item>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item name="industry" label="Industry">
                    <Input placeholder="e.g. Manufacturing" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="size" label="Company Size">
                    <Input placeholder="e.g. 11-50 employees" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item name="website" label="Website">
                    <Input placeholder="https://..." />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="picName" label="Point of Contact Name">
                    <Input placeholder="e.g. Hiring Manager" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item name="picEmail" label="Point of Contact Email">
                    <Input placeholder="pic@company.com" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="picPhone" label="Point of Contact Phone">
                    <Input placeholder="+60 ..." />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item name="email" label="Contact Email">
                    <Input placeholder="name@company.com" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="phone" label="Contact Phone">
                    <Input placeholder="+60 ..." />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="fullAddress" label="Address">
                <Input placeholder="Full address" />
              </Form.Item>
              <Form.Item name="description" label="Company Description">
                <TextArea rows={4} placeholder="Describe your company" />
              </Form.Item>

              <Form.Item style={{ textAlign: "right", marginBottom: 0 }}>
                <Space>
                  <Button onClick={() => setEditing(false)}>Cancel</Button>
                  <Button htmlType="submit" type="primary">Save Changes</Button>
                </Space>
              </Form.Item>
            </Form>
          </Space>
        </Card>
      </Col>
    </Row>
  );
}

