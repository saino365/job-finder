"use client";

import { useEffect, useState } from 'react';
import { Card, Form, DatePicker, Select, Input, InputNumber, Space, Button, Typography, Divider, message, Tooltip } from 'antd';
import { API_BASE_URL } from '../../config';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export default function InternshipEditor() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => { (async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('jf_token');
      if (!token) { message.info('Please sign in'); window.location.href = '/login'; return; }
      const res = await fetch(`${API_BASE_URL}/student/internship/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to load internship profile');
      const j = await res.json();
      const ip = j?.internProfile || {};
      const pref = ip?.preferences || {};
      const start = pref.preferredStartDate || pref.startDate;
      const end = pref.preferredEndDate || pref.endDate;
      const salary = pref.salaryRange || pref.salary || {};
      form.setFieldsValue({
        startEnd: (start && end) ? [start ? dayjs(start) : null, end ? dayjs(end) : null] : undefined,
        industries: Array.isArray(pref.industries) ? pref.industries : (pref.industry ? [pref.industry] : []),
        locations: Array.isArray(pref.locations) ? pref.locations : [],
        salaryMin: salary.min,
        salaryMax: salary.max,
        skills: ip?.skills || [],
        languages: ip?.languages || [],
        courses: (ip?.courses || []).map(c => ({ id: c.id ?? c.courseId, name: c.name ?? c.courseName, description: c.description ?? c.courseDescription })),
        assignments: (ip?.assignments || []).map(a => ({ title: a.title, nature: a.nature ?? a.natureOfAssignment, methodology: a.methodology, description: a.description }))
      });
    } catch (e) { message.error(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  })(); }, []); // Removed 'form' from dependencies - form instance is stable

  async function onSave(values) {
    try {
      setSaving(true);
      const token = localStorage.getItem('jf_token');

      // Calculate duration from start and end dates
      let preferredDuration = undefined;
      if (values.startEnd?.[0] && values.startEnd?.[1]) {
        const startDate = values.startEnd[0];
        const endDate = values.startEnd[1];
        const durationMonths = Math.round(endDate.diff(startDate, 'month', true));
        preferredDuration = `${durationMonths} months`;
      }

      const payload = {
        preferences: {
          startDate: values.startEnd?.[0]?.toISOString?.(),
          endDate: values.startEnd?.[1]?.toISOString?.(),
          preferredDuration,
          industries: Array.isArray(values.industries) ? values.industries : [],
          locations: Array.isArray(values.locations) ? values.locations.slice(0,3) : [],
          salary: { min: values.salaryMin != null ? Number(values.salaryMin) : undefined, max: values.salaryMax != null ? Number(values.salaryMax) : undefined }
        },
        skills: values.skills || [],
        languages: values.languages || [],
        courses: (values.courses || []).map(c => ({ id: c.id, name: c.name, description: c.description })),
        assignments: (values.assignments || []).map(a => ({ title: a.title, nature: a.nature, methodology: a.methodology, description: a.description }))
      };
      const res = await fetch(`${API_BASE_URL}/student/internship/me`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload)
      });
      if (!res.ok) { const t = await res.text(); throw new Error(t || 'Save failed'); }
      message.success('Internship profile saved');
    } catch (e) { message.error(e.message || 'Save failed'); }
    finally { setSaving(false); }
  }

  return (
    <Card loading={loading}>
      <Title level={4} style={{ marginBottom: 16 }}>Internship</Title>
      <Form layout="vertical" form={form} onFinish={onSave}>
        <Title level={5} style={{ marginTop: 0 }}>Internship details</Title>
        <Form.Item
          name="startEnd"
          label={
            <Space>
              <span>Internship duration (start - end)</span>
              <Tooltip title="Select your preferred internship start and end dates.">ℹ️</Tooltip>
            </Space>
          }
          rules={[
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || value.length !== 2) return Promise.resolve();
                const [s, e] = value;
                if (!s || !e) return Promise.resolve();
                if (e.isBefore(s)) return Promise.reject(new Error('End date must be after start date'));
                return Promise.resolve();
              }
            })
          ]}
        >
          <DatePicker.RangePicker />
        </Form.Item>
        <Form.Item
          name="industries"
          label={
            <Space>
              <span>Preferred industries</span>
              <Tooltip title="Add one or more industries you are interested in.">ℹ️</Tooltip>
            </Space>
          }
        >
          <Select mode="tags" tokenSeparators={[',']} placeholder="e.g. Software, Fintech, Marketing" />
        </Form.Item>
        <Form.Item
          name="locations"
          label={
            <Space>
              <span>Preferred location(s) (up to 3)</span>
              <Tooltip title="Add up to three preferred cities or city, state (e.g., Shah Alam, Selangor)">ℹ️</Tooltip>
            </Space>
          }
          getValueFromEvent={(val) => Array.isArray(val) ? val.slice(0,3) : []}
        >
          <Select mode="tags" tokenSeparators={[',']} placeholder="Add cities or city, state" />
        </Form.Item>
        <Space.Compact style={{ width: '100%' }}>
          <Form.Item name="salaryMin" label="Preferred salary min" style={{ flex: 1 }}>
            <InputNumber addonBefore="MYR" min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="salaryMax"
            label="Preferred salary max"
            style={{ flex: 1 }}
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const min = getFieldValue('salaryMin');
                  if (value != null && min != null && Number(value) < Number(min)) {
                    return Promise.reject(new Error('Max must be greater than or equal to Min'));
                  }
                  return Promise.resolve();
                }
              })
            ]}
          >
            <InputNumber addonBefore="MYR" min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Space.Compact>

        <Divider />
        <Title level={5}>Skills</Title>
        <Form.Item name="skills" extra="Press Enter to add">
          <Select mode="tags" tokenSeparators={[',']} placeholder="e.g. JavaScript, React, SQL" />
        </Form.Item>

        <Title level={5}>Languages</Title>
        <Form.Item name="languages" extra="Press Enter to add">
          <Select mode="tags" tokenSeparators={[',']} placeholder="e.g. English, Malay, Mandarin" />
        </Form.Item>

        <Divider />
        <Title level={5}>Course information</Title>
        <Form.List name="courses">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name, ...rest }) => (
                <Card key={key} size="small" style={{ marginBottom: 8 }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Space>
                      <Button danger size="small" onClick={() => remove(name)}>Remove</Button>
                    </Space>
                    <Form.Item {...rest} name={[name, 'id']} label="Course ID"><Input /></Form.Item>
                    <Form.Item {...rest} name={[name, 'name']} label="Course Name"><Input /></Form.Item>
                    <Form.Item {...rest} name={[name, 'description']} label="Course Description"><Input.TextArea rows={3} /></Form.Item>
                  </Space>
                </Card>
              ))}
              <Button type="dashed" onClick={() => add()} block>Add course</Button>
            </>
          )}
        </Form.List>

        <Divider />
        <Title level={5}>Assignment information</Title>
        <Form.List name="assignments">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name, ...rest }) => (
                <Card key={key} size="small" style={{ marginBottom: 8 }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Space>
                      <Button danger size="small" onClick={() => remove(name)}>Remove</Button>
                    </Space>
                    <Form.Item {...rest} name={[name, 'title']} label="Assignment Title"><Input /></Form.Item>
                    <Form.Item {...rest} name={[name, 'nature']} label="Nature of Assignment"><Input /></Form.Item>
                    <Form.Item {...rest} name={[name, 'methodology']} label="Methodology"><Input /></Form.Item>
                    <Form.Item {...rest} name={[name, 'description']} label="Assignment Description"><Input.TextArea rows={3} /></Form.Item>
                  </Space>
                </Card>
              ))}
              <Button type="dashed" onClick={() => add()} block>Add assignment</Button>
            </>
          )}
        </Form.List>

        <Form.Item style={{ textAlign: 'right', marginTop: 16 }}>
          <Space>
            <Button htmlType="submit" type="primary" loading={saving}>Save Internship Profile</Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
}

