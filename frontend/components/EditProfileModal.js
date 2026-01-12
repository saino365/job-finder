"use client";
import { useState, useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Button, Space, Select, Upload, App, Checkbox } from 'antd';
import { PlusOutlined, MinusCircleOutlined, UploadOutlined, DeleteOutlined } from '@ant-design/icons';
import { API_BASE_URL } from '../config';

const { TextArea } = Input;

export default function EditProfileModal({ visible, onClose, user, onSuccess, section = 'personal' }) {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [uploadingCert, setUploadingCert] = useState({});

  // Helper function to format date for HTML date input (YYYY-MM-DD)
  const formatDateForInput = (date) => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  };

  // Initialize form with user data when modal opens
  useEffect(() => {
    if (visible && user) {
      // Format educations with dates
      const educations = (user?.internProfile?.educations || []).map(edu => ({
        ...edu,
        startDate: formatDateForInput(edu.startDate),
        endDate: formatDateForInput(edu.endDate)
      }));

      // Format work experiences with dates and ongoing status
      const workExperiences = (user?.internProfile?.workExperiences || []).map(exp => ({
        ...exp,
        startDate: formatDateForInput(exp.startDate),
        endDate: formatDateForInput(exp.endDate),
        ongoing: !exp.endDate // If no end date, it's ongoing
      }));

      // Format event experiences with dates
      const eventExperiences = (user?.internProfile?.eventExperiences || []).map(event => ({
        ...event,
        startDate: formatDateForInput(event.startDate),
        endDate: formatDateForInput(event.endDate)
      }));

      // Format certifications with dates
      const certifications = (user?.internProfile?.certifications || []).map(cert => ({
        ...cert,
        acquiredDate: formatDateForInput(cert.acquiredDate)
      }));

      form.setFieldsValue({
        firstName: user?.profile?.firstName,
        middleName: user?.profile?.middleName,
        lastName: user?.profile?.lastName,
        phone: user?.profile?.phone,
        icPassportNumber: user?.profile?.icPassportNumber,
        city: user?.profile?.location?.city,
        state: user?.profile?.location?.state,
        country: user?.profile?.location?.country,
        university: user?.internProfile?.university,
        major: user?.internProfile?.major,
        gpa: user?.internProfile?.gpa,
        graduationYear: user?.internProfile?.graduationYear,
        educations,
        workExperiences,
        certifications,
        skills: user?.internProfile?.skills || [],
        languages: user?.internProfile?.languages || [],
        interests: user?.internProfile?.interests || [],
        eventExperiences,
        courses: user?.internProfile?.courses || [],
        assignments: user?.internProfile?.assignments || [],
        jobTypes: user?.internProfile?.preferences?.jobTypes || [],
        locations: user?.internProfile?.preferences?.locations || [],
        industries: user?.internProfile?.preferences?.industries || [],
        preferredStartDate: formatDateForInput(user?.internProfile?.preferences?.preferredStartDate),
        preferredEndDate: formatDateForInput(user?.internProfile?.preferences?.preferredEndDate),
        salaryMin: user?.internProfile?.preferences?.salaryRange?.min,
        salaryMax: user?.internProfile?.preferences?.salaryRange?.max,
      });
    }
  }, [visible, user, form]);

  const handleFinish = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      const token = localStorage.getItem('jf_token');

      let body = {};

      // Only update the fields for the current section
      if (section === 'personal') {
        body = {
          'profile.firstName': values.firstName,
          'profile.middleName': values.middleName,
          'profile.lastName': values.lastName,
          'profile.phone': values.phone,
          'profile.icPassportNumber': values.icPassportNumber,
          'profile.location.city': values.city,
          'profile.location.state': values.state,
          'profile.location.country': values.country,
          'internProfile.university': values.university,
          'internProfile.major': values.major,
          'internProfile.gpa': values.gpa != null ? Number(values.gpa) : undefined,
          'internProfile.graduationYear': values.graduationYear != null ? Number(values.graduationYear) : undefined,
        };
      } else if (section === 'preferences') {
        body = {
          'internProfile.preferences.jobTypes': values.jobTypes || [],
          'internProfile.preferences.locations': values.locations || [],
          'internProfile.preferences.industries': values.industries || [],
        };
      } else if (section === 'skills') {
        body = {
          'internProfile.skills': values.skills || [],
          'internProfile.languages': values.languages || [],
        };
      } else if (section === 'education') {
        // Convert date strings to ISO format for educations
        const educations = (values.educations || []).map(edu => ({
          ...edu,
          startDate: edu.startDate ? new Date(edu.startDate).toISOString() : null,
          endDate: edu.endDate ? new Date(edu.endDate).toISOString() : null
        }));
        body = {
          'internProfile.educations': educations,
        };
      } else if (section === 'experience') {
        // Convert date strings to ISO format for work experiences
        const workExperiences = (values.workExperiences || []).map(exp => {
          const { ongoing, ...rest } = exp; // Remove 'ongoing' field (not stored in DB)
          return {
            ...rest,
            startDate: rest.startDate ? new Date(rest.startDate).toISOString() : null,
            endDate: ongoing ? null : (rest.endDate ? new Date(rest.endDate).toISOString() : null)
          };
        });
        body = {
          'internProfile.workExperiences': workExperiences,
        };
      } else if (section === 'certifications') {
        // Convert date strings to ISO format for certifications
        const certifications = (values.certifications || []).map(cert => ({
          ...cert,
          acquiredDate: cert.acquiredDate ? new Date(cert.acquiredDate).toISOString() : null
        }));
        body = {
          'internProfile.certifications': certifications,
        };
      } else if (section === 'interests') {
        body = {
          'internProfile.interests': values.interests || [],
        };
      } else if (section === 'events') {
        // Convert date strings to ISO format for event experiences
        const eventExperiences = (values.eventExperiences || []).map(event => ({
          ...event,
          startDate: event.startDate ? new Date(event.startDate).toISOString() : null,
          endDate: event.endDate ? new Date(event.endDate).toISOString() : null
        }));
        body = {
          'internProfile.eventExperiences': eventExperiences,
        };
      } else if (section === 'courses') {
        body = {
          'internProfile.courses': values.courses || [],
        };
      } else if (section === 'assignments') {
        body = {
          'internProfile.assignments': values.assignments || [],
        };
      } else if (section === 'internship') {
        // Calculate duration from start and end dates
        let preferredDuration = undefined;
        if (values.preferredStartDate && values.preferredEndDate) {
          const startDate = new Date(values.preferredStartDate);
          const endDate = new Date(values.preferredEndDate);
          const durationMonths = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24 * 30));
          preferredDuration = `${durationMonths} months`;
        }

        body = {
          'internProfile.preferences.preferredStartDate': values.preferredStartDate,
          'internProfile.preferences.preferredEndDate': values.preferredEndDate,
          'internProfile.preferences.preferredDuration': preferredDuration,
          'internProfile.preferences.industries': values.industries || [],
          'internProfile.preferences.locations': values.locations || [],
          'internProfile.preferences.salaryRange.min': values.salaryMin,
          'internProfile.preferences.salaryRange.max': values.salaryMax,
          'internProfile.skills': values.skills || [],
          'internProfile.languages': values.languages || [],
          'internProfile.courses': values.courses || [],
          'internProfile.assignments': values.assignments || [],
        };
      }

      const res = await fetch(`${API_BASE_URL}/users/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        let errorMessage = 'Failed to update profile';
        try {
          const errorData = await res.json();
          // Extract user-friendly error message
          if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // If JSON parsing fails, try text
          const txt = await res.text();
          if (txt) errorMessage = txt;
        }

        // Make error messages more user-friendly
        if (errorMessage.includes('Cast to Number failed')) {
          if (errorMessage.includes('gpa')) {
            errorMessage = 'GPA must be a valid number between 0.0 and 4.0';
          } else if (errorMessage.includes('graduationYear')) {
            errorMessage = 'Graduation year must be a valid year';
          } else {
            errorMessage = 'Please enter valid numeric values';
          }
        }

        throw new Error(errorMessage);
      }

      message.success('Profile updated successfully!');
      onSuccess();
      onClose();
    } catch (e) {
      // Show validation errors from form
      if (e.errorFields) {
        message.error('Please fix the validation errors');
        return;
      }
      message.error(e.message || 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  const getSectionTitle = () => {
    const titles = {
      personal: 'Edit Personal Info',
      preferences: 'Edit Job Preferences',
      skills: 'Edit Skills & Languages',
      education: 'Edit Education',
      experience: 'Edit Work Experience',
      certifications: 'Edit Certifications',
      interests: 'Edit Interests',
      events: 'Edit Event Experience',
      courses: 'Edit Courses',
      assignments: 'Edit Assignments',
      internship: 'Edit Internship Details',
    };
    return titles[section] || 'Edit Profile';
  };

  const renderSectionContent = () => {
    switch (section) {
      case 'personal':
        return (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Form.Item
              name="firstName"
              label="First Name"
              rules={[
                { required: true },
                {
                  validator: (_, value) => {
                    if (!value) return Promise.resolve();
                    // Count alphabetic characters (A-Z, a-z)
                    const alphabeticCount = (value.match(/[A-Za-z]/g) || []).length;
                    if (alphabeticCount < 3) {
                      return Promise.reject(new Error('First name must contain at least 3 alphabetic characters'));
                    }
                    return Promise.resolve();
                  }
                }
              ]}
            >
              <Input placeholder="First Name" />
            </Form.Item>
            <Form.Item
              name="middleName"
              label="Middle Name"
              rules={[
                {
                  validator: (_, value) => {
                    if (!value) return Promise.resolve();
                    // Count alphabetic characters (A-Z, a-z)
                    const alphabeticCount = (value.match(/[A-Za-z]/g) || []).length;
                    if (alphabeticCount < 3) {
                      return Promise.reject(new Error('Middle name must contain at least 3 alphabetic characters'));
                    }
                    return Promise.resolve();
                  }
                }
              ]}
            >
              <Input placeholder="Middle Name" />
            </Form.Item>
            <Form.Item
              name="lastName"
              label="Last Name"
              rules={[
                { required: true },
                {
                  validator: (_, value) => {
                    if (!value) return Promise.resolve();
                    // Count alphabetic characters (A-Z, a-z)
                    const alphabeticCount = (value.match(/[A-Za-z]/g) || []).length;
                    if (alphabeticCount < 3) {
                      return Promise.reject(new Error('Last name must contain at least 3 alphabetic characters'));
                    }
                    return Promise.resolve();
                  }
                }
              ]}
            >
              <Input placeholder="Last Name" />
            </Form.Item>
            <Form.Item
              name="phone"
              label="Phone"
              rules={[
                {
                  validator: (_, value) => {
                    if (!value) return Promise.resolve();
                    // Only allow digits and plus sign
                    const phoneRegex = /^[0-9+]+$/;
                    if (!phoneRegex.test(value)) {
                      return Promise.reject(new Error('Phone number can only contain digits (0-9) and plus sign (+)'));
                    }
                    // Plus sign can only be at the beginning
                    if (value.includes('+') && !value.startsWith('+')) {
                      return Promise.reject(new Error('Plus sign (+) can only be at the beginning'));
                    }
                    // Only one plus sign allowed
                    if ((value.match(/\+/g) || []).length > 1) {
                      return Promise.reject(new Error('Only one plus sign (+) is allowed'));
                    }
                    return Promise.resolve();
                  }
                }
              ]}
              normalize={(value) => {
                // Remove any characters that are not digits or plus sign
                if (!value) return value;
                return value.replace(/[^0-9+]/g, '');
              }}
            >
              <Input placeholder="e.g., +60123456789" />
            </Form.Item>
            <Form.Item
              name="icPassportNumber"
              label="IC/Passport Number"
              rules={[
                {
                  validator: (_, value) => {
                    if (!value) return Promise.resolve();
                    // Only allow alphanumeric characters (letters and numbers)
                    const icPassportRegex = /^[A-Za-z0-9]+$/;
                    if (!icPassportRegex.test(value)) {
                      return Promise.reject(new Error('IC/Passport number can only contain letters (A-Z) and digits (0-9)'));
                    }
                    return Promise.resolve();
                  }
                }
              ]}
              normalize={(value) => {
                // Remove any special characters, only keep alphanumeric
                if (!value) return value;
                return value.replace(/[^A-Za-z0-9]/g, '');
              }}
            >
              <Input placeholder="e.g., A12345678 or 123456789012" />
            </Form.Item>
            <Form.Item name="city" label="City">
              <Input placeholder="e.g., Kuala Lumpur" />
            </Form.Item>
            <Form.Item name="state" label="State">
              <Input placeholder="e.g., Selangor" />
            </Form.Item>
            <Form.Item name="country" label="Country">
              <Input placeholder="e.g., Malaysia" />
            </Form.Item>
            <Form.Item name="university" label="University">
              <Input placeholder="University" />
            </Form.Item>
            <Form.Item name="major" label="Major">
              <Input placeholder="Major/Field of Study" />
            </Form.Item>
            <Form.Item
              name="gpa"
              label="GPA"
              rules={[
                {
                  validator: (_, value) => {
                    if (!value) return Promise.resolve();
                    const num = Number(value);
                    if (isNaN(num)) {
                      return Promise.reject(new Error('GPA must be a valid number'));
                    }
                    if (num < 0 || num > 4.0) {
                      return Promise.reject(new Error('GPA must be between 0.0 and 4.0'));
                    }
                    return Promise.resolve();
                  }
                }
              ]}
            >
              <InputNumber
                placeholder="e.g., 3.75"
                min={0}
                max={4.0}
                step={0.01}
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item
              name="graduationYear"
              label="Graduation Year"
              rules={[
                {
                  validator: (_, value) => {
                    if (!value) return Promise.resolve();
                    const num = Number(value);
                    if (isNaN(num)) {
                      return Promise.reject(new Error('Please enter only numbers'));
                    }
                    const currentYear = new Date().getFullYear();
                    if (num < 1900 || num > currentYear + 10) {
                      return Promise.reject(new Error(`Graduation year must be between 1900 and ${currentYear + 10}`));
                    }
                    return Promise.resolve();
                  }
                }
              ]}
            >
              <InputNumber
                placeholder="e.g., 2025"
                min={1900}
                max={new Date().getFullYear() + 10}
                style={{ width: '100%' }}
                controls={false}
              />
            </Form.Item>
          </Space>
        );

      case 'preferences':
        return (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Form.Item name="jobTypes" label="Job Types">
              <Select mode="tags" placeholder="Type and press Enter to add job types" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="locations" label="Preferred Locations">
              <Select mode="tags" placeholder="Type and press Enter to add locations" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="industries" label="Preferred Industries">
              <Select mode="tags" placeholder="Type and press Enter to add industries" style={{ width: '100%' }} />
            </Form.Item>
          </Space>
        );

      case 'skills':
        return (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Form.Item name="skills" label="Skills">
              <Select mode="tags" placeholder="Type and press Enter to add skills" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="languages" label="Languages">
              <Select mode="tags" placeholder="Type and press Enter to add languages" style={{ width: '100%' }} />
            </Form.Item>
          </Space>
        );

      case 'education':
        return (
          <Form.List name="educations">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => {
                  const eduValues = form.getFieldValue(['educations', name]);
                  const isOngoing = eduValues?.ongoing === true;

                  return (
                    <Space key={key} direction="vertical" style={{ width: '100%', marginBottom: 16, padding: 16, border: '1px solid #d9d9d9', borderRadius: 8 }}>
                      <Form.Item
                        {...restField}
                        name={[name, 'level']}
                        label="Level"
                        rules={[{ required: true, message: 'Please enter education level' }]}
                      >
                        <Input placeholder="Level (e.g., Bachelor)" />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'institutionName']}
                        label="Institution"
                        rules={[{ required: true, message: 'Please enter institution name' }]}
                      >
                        <Input placeholder="Institution Name" />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'qualification']}
                        label="Qualification"
                        rules={[{ required: true, message: 'Please enter qualification' }]}
                      >
                        <Input placeholder="Qualification" />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'fieldOfStudy']}
                        label="Field of Study"
                        rules={[{ required: true, message: 'Please enter field of study' }]}
                      >
                        <Input placeholder="Field of Study" />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'startDate']}
                        label="Start Date"
                        rules={[{ required: true, message: 'Please select start date' }]}
                      >
                        <Input type="date" placeholder="Start Date" />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'endDate']}
                        label="End Date"
                        rules={[
                          {
                            required: !isOngoing,
                            message: 'Please select end date or mark as ongoing'
                          }
                        ]}
                      >
                        <Input
                          type="date"
                          placeholder="End Date"
                          disabled={isOngoing}
                          value={isOngoing ? '' : undefined}
                        />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'ongoing']} valuePropName="checked">
                        <Checkbox
                          onChange={(e) => {
                            const educations = form.getFieldValue('educations');
                            if (e.target.checked) {
                              // Clear end date when ongoing is checked
                              educations[name].endDate = null;
                            }
                            // Update form to trigger re-render
                            form.setFieldsValue({ educations });
                          }}
                        >
                          Ongoing (Present)
                        </Checkbox>
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'gpa']}
                        label="GPA"
                        rules={[
                          {
                            validator: (_, value) => {
                              if (!value) return Promise.resolve();
                              const num = Number(value);
                              if (isNaN(num)) {
                                return Promise.reject(new Error('GPA must be a valid number'));
                              }
                              if (num < 0 || num > 4.0) {
                                return Promise.reject(new Error('GPA must be between 0.0 and 4.0'));
                              }
                              return Promise.resolve();
                            }
                          }
                        ]}
                      >
                        <InputNumber
                          placeholder="e.g., 3.75 (optional)"
                          min={0}
                          max={4.0}
                          step={0.01}
                          style={{ width: '100%' }}
                        />
                      </Form.Item>
                      <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(name)}>
                        Remove Education
                      </Button>
                    </Space>
                  );
                })}
                <Form.Item>
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    Add Education
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>
        );

      case 'experience':
        return (
          <Form.List name="workExperiences">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => {
                  const workExpValues = form.getFieldValue(['workExperiences', name]);
                  const isOngoing = workExpValues?.ongoing === true;

                  return (
                    <Space key={key} direction="vertical" style={{ width: '100%', marginBottom: 16, padding: 16, border: '1px solid #d9d9d9', borderRadius: 8 }}>
                      <Form.Item {...restField} name={[name, 'jobTitle']} label="Job Title">
                        <Input placeholder="Job Title" />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'companyName']} label="Company">
                        <Input placeholder="Company Name" />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'employmentType']} label="Employment Type">
                        <Select placeholder="Select Type">
                          <Select.Option value="Full-time">Full-time</Select.Option>
                          <Select.Option value="Part-time">Part-time</Select.Option>
                          <Select.Option value="Internship">Internship</Select.Option>
                          <Select.Option value="Contract">Contract</Select.Option>
                        </Select>
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'industry']} label="Industry">
                        <Input placeholder="Industry" />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'startDate']} label="Start Date">
                        <Input type="date" placeholder="Start Date" />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'endDate']} label="End Date">
                        <Input
                          type="date"
                          placeholder="End Date"
                          disabled={isOngoing}
                          value={isOngoing ? '' : undefined}
                        />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'ongoing']} valuePropName="checked">
                        <Checkbox
                          onChange={(e) => {
                            const workExps = form.getFieldValue('workExperiences');
                            if (e.target.checked) {
                              // Clear end date when ongoing is checked
                              workExps[name].endDate = null;
                            }
                            // Update form to trigger re-render
                            form.setFieldsValue({ workExperiences: workExps });
                          }}
                        >
                          Ongoing (Present)
                        </Checkbox>
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'jobDescription']} label="Description">
                        <TextArea rows={3} placeholder="Job Description" />
                      </Form.Item>
                      <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(name)}>
                        Remove Work Experience
                      </Button>
                    </Space>
                  );
                })}
                <Form.Item>
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    Add Work Experience
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>
        );

      case 'certifications':
        return (
          <Form.List name="certifications">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => {
                  const certValues = form.getFieldValue(['certifications', name]);
                  return (
                    <Space key={key} direction="vertical" style={{ width: '100%', marginBottom: 16, padding: 16, border: '1px solid #d9d9d9', borderRadius: 8 }}>
                      <Form.Item {...restField} name={[name, 'title']} label="Title">
                        <Input placeholder="Certification Title" />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'issuer']} label="Issuer">
                        <Input placeholder="Issuing Organization" />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'acquiredDate']}
                        label="Acquired Date"
                        rules={[
                          {
                            validator: (_, value) => {
                              if (!value) return Promise.resolve();
                              const selectedDate = new Date(value);
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              if (selectedDate > today) {
                                return Promise.reject(new Error('Certificate issue date must not be set in the future'));
                              }
                              return Promise.resolve();
                            }
                          }
                        ]}
                      >
                        <Input type="date" />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'description']} label="Description">
                        <TextArea rows={2} placeholder="Description" />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'fileUrl']} label="Certificate Document">
                        <div>
                          {certValues?.fileUrl ? (
                            <div style={{ marginBottom: 8 }}>
                              <Space>
                                <Button
                                  type="link"
                                  icon={<UploadOutlined />}
                                  onClick={async () => {
                                    try {
                                      // Extract key from URL (same logic as ProfilePageInner.js)
                                      const url = certValues.fileUrl;
                                      if (!url) {
                                        message.error('Invalid file URL');
                                        return;
                                      }

                                      const urlObj = new URL(url);
                                      const pathParts = urlObj.pathname.split('/');
                                      // Remove empty strings and bucket name (first two parts)
                                      const keyParts = pathParts.filter(Boolean).slice(1);
                                      const key = keyParts.join('/');

                                      if (!key) {
                                        message.error('Invalid file URL');
                                        return;
                                      }

                                      const token = localStorage.getItem('jf_token');
                                      const res = await fetch(`${API_BASE_URL}/upload/${encodeURIComponent(key)}`, {
                                        headers: { Authorization: `Bearer ${token}` }
                                      });
                                      const data = await res.json();
                                      const signedUrl = data.signedUrl || data.publicUrl;

                                      if (signedUrl) {
                                        window.open(signedUrl, '_blank');
                                      } else {
                                        message.error('Failed to resolve file');
                                      }
                                    } catch (e) {
                                      message.error(e.message || 'Failed to open file');
                                    }
                                  }}
                                  style={{ padding: 0 }}
                                >
                                  View Uploaded Certificate
                                </Button>
                                <Button
                                  danger
                                  type="text"
                                  size="small"
                                  icon={<DeleteOutlined />}
                                  onClick={() => {
                                    const certs = form.getFieldValue('certifications');
                                    certs[name].fileUrl = null;
                                    form.setFieldsValue({ certifications: certs });
                                  }}
                                >
                                  Remove
                                </Button>
                              </Space>
                            </div>
                          ) : null}
                          <Upload
                            beforeUpload={async (file) => {
                              try {
                                setUploadingCert({ ...uploadingCert, [name]: true });
                                const token = localStorage.getItem('jf_token');
                                const fd = new FormData();
                                fd.append('document', file);

                                const res = await fetch(`${API_BASE_URL}/upload`, {
                                  method: 'POST',
                                  headers: { 'Authorization': `Bearer ${token}` },
                                  body: fd
                                });

                                if (!res.ok) throw new Error('Upload failed');

                                const data = await res.json();
                                // Use public URL instead of signedUrl (signedUrl expires after 1 hour)
                                const url = data?.files?.document?.[0]?.url || data?.files?.document?.[0]?.signedUrl;
                                const originalName = data?.files?.document?.[0]?.originalName;

                                if (url) {
                                  const certs = form.getFieldValue('certifications');
                                  certs[name].fileUrl = url;
                                  certs[name].fileOriginalName = originalName;
                                  form.setFieldsValue({ certifications: certs });
                                  message.success('Certificate uploaded successfully!');
                                }
                              } catch (e) {
                                message.error('Upload failed: ' + e.message);
                              } finally {
                                setUploadingCert({ ...uploadingCert, [name]: false });
                              }
                              return false;
                            }}
                            maxCount={1}
                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.txt"
                            showUploadList={false}
                          >
                            <Button icon={<UploadOutlined />} loading={uploadingCert[name]}>
                              {certValues?.fileUrl ? 'Replace Certificate' : 'Upload Certificate'}
                            </Button>
                          </Upload>
                        </div>
                      </Form.Item>
                      <Button danger onClick={() => remove(name)} icon={<MinusCircleOutlined />}>Remove Certification</Button>
                    </Space>
                  );
                })}
                <Form.Item>
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    Add Certification
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>
        );

      case 'interests':
        return (
          <Form.List name="interests">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} direction="vertical" style={{ width: '100%', marginBottom: 16, padding: 16, border: '1px solid #d9d9d9', borderRadius: 8 }}>
                    <Form.Item {...restField} name={[name, 'title']} label="Title">
                      <Input placeholder="Interest Title" />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'description']} label="Description">
                      <TextArea rows={2} placeholder="Description" />
                    </Form.Item>
                    <Button danger onClick={() => remove(name)} icon={<MinusCircleOutlined />}>Remove</Button>
                  </Space>
                ))}
                <Form.Item>
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    Add Interest
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>
        );

      case 'events':
        return (
          <Form.List name="eventExperiences">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} direction="vertical" style={{ width: '100%', marginBottom: 16, padding: 16, border: '1px solid #d9d9d9', borderRadius: 8 }}>
                    <Form.Item {...restField} name={[name, 'eventName']} label="Event Name">
                      <Input placeholder="Event Name" />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'position']} label="Position">
                      <Input placeholder="Your Position/Role" />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'location']} label="Location">
                      <Input placeholder="Location" />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'startDate']}
                      label="Start Date"
                      rules={[
                        {
                          validator: (_, value) => {
                            if (!value) return Promise.resolve();
                            const selectedDate = new Date(value);
                            const today = new Date();
                            today.setHours(23, 59, 59, 999);
                            if (selectedDate > today) {
                              return Promise.reject(new Error('Event start date must not be set in the future'));
                            }
                            return Promise.resolve();
                          }
                        }
                      ]}
                    >
                      <Input type="date" />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'endDate']}
                      label="End Date"
                      rules={[
                        {
                          validator: (_, value) => {
                            if (!value) return Promise.resolve();
                            const selectedDate = new Date(value);
                            const today = new Date();
                            today.setHours(23, 59, 59, 999);
                            if (selectedDate > today) {
                              return Promise.reject(new Error('Event end date must not be set in the future'));
                            }

                            const eventValues = form.getFieldValue(['eventExperiences', name]);
                            if (eventValues?.startDate) {
                              const startDate = new Date(eventValues.startDate);
                              if (selectedDate < startDate) {
                                return Promise.reject(new Error('End date must be after start date'));
                              }
                            }
                            return Promise.resolve();
                          }
                        }
                      ]}
                    >
                      <Input type="date" />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'description']} label="Description">
                      <TextArea rows={2} placeholder="Description" />
                    </Form.Item>
                    <Button danger onClick={() => remove(name)} icon={<MinusCircleOutlined />}>Remove</Button>
                  </Space>
                ))}
                <Form.Item>
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    Add Event Experience
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>
        );

      case 'courses':
        return (
          <Form.List name="courses">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} direction="vertical" style={{ width: '100%', marginBottom: 16, padding: 16, border: '1px solid #d9d9d9', borderRadius: 8 }}>
                    <Form.Item {...restField} name={[name, 'courseName']} label="Course Name">
                      <Input placeholder="Course Name" />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'courseId']} label="Course ID">
                      <Input placeholder="Course ID (optional)" />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'courseDescription']} label="Description">
                      <TextArea rows={2} placeholder="Course Description" />
                    </Form.Item>
                    <Button danger onClick={() => remove(name)} icon={<MinusCircleOutlined />}>Remove</Button>
                  </Space>
                ))}
                <Form.Item>
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    Add Course
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>
        );

      case 'assignments':
        return (
          <Form.List name="assignments">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} direction="vertical" style={{ width: '100%', marginBottom: 16, padding: 16, border: '1px solid #d9d9d9', borderRadius: 8 }}>
                    <Form.Item {...restField} name={[name, 'title']} label="Assignment Title">
                      <Input placeholder="Assignment Title" />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'natureOfAssignment']} label="Nature of Assignment">
                      <Input placeholder="Nature of Assignment" />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'methodology']} label="Methodology">
                      <Input placeholder="Methodology" />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'description']} label="Description">
                      <TextArea rows={2} placeholder="Description" />
                    </Form.Item>
                    <Button danger onClick={() => remove(name)} icon={<MinusCircleOutlined />}>Remove</Button>
                  </Space>
                ))}
                <Form.Item>
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    Add Assignment
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>
        );

      case 'internship':
        return (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            {/* Internship Preferences */}
            <div style={{ padding: 16, border: '1px solid #d9d9d9', borderRadius: 8 }}>
              <h3 style={{ marginTop: 0 }}>Internship Preferences</h3>

              <Form.Item name="preferredStartDate" label="Preferred Start Date">
                <Input type="date" />
              </Form.Item>

              <Form.Item name="preferredEndDate" label="Preferred End Date">
                <Input type="date" />
              </Form.Item>

              <Form.Item name="industries" label="Preferred Industry">
                <Select mode="tags" placeholder="Type and press Enter to add industries" style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item name="locations" label="Preferred Location (1-3)">
                <Select mode="tags" placeholder="Type and press Enter to add locations (max 3)" maxCount={3} style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item label="Preferred Salary Range">
                <Space.Compact style={{ width: '100%' }}>
                  <Form.Item name="salaryMin" noStyle>
                    <Input placeholder="Min (RM)" type="number" style={{ width: '50%' }} />
                  </Form.Item>
                  <Form.Item name="salaryMax" noStyle>
                    <Input placeholder="Max (RM)" type="number" style={{ width: '50%' }} />
                  </Form.Item>
                </Space.Compact>
              </Form.Item>

              <Form.Item name="skills" label="Skills">
                <Select mode="tags" placeholder="Type and press Enter to add skills" style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item name="languages" label="Languages">
                <Select mode="tags" placeholder="Type and press Enter to add languages" style={{ width: '100%' }} />
              </Form.Item>
            </div>

            {/* Course Information */}
            <div style={{ padding: 16, border: '1px solid #d9d9d9', borderRadius: 8 }}>
              <h3 style={{ marginTop: 0 }}>Course Information</h3>
              <Form.List name="courses">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name, ...restField }) => (
                      <Space key={key} direction="vertical" style={{ width: '100%', marginBottom: 16, padding: 12, border: '1px solid #d9d9d9', borderRadius: 8, backgroundColor: 'white' }}>
                        <Form.Item {...restField} name={[name, 'courseId']} label="Course ID">
                          <Input placeholder="e.g., CS101" />
                        </Form.Item>
                        <Form.Item {...restField} name={[name, 'courseName']} label="Course Name">
                          <Input placeholder="Course Name" />
                        </Form.Item>
                        <Form.Item {...restField} name={[name, 'courseDescription']} label="Course Description">
                          <TextArea rows={2} placeholder="Course Description" />
                        </Form.Item>
                        <Button danger onClick={() => remove(name)} icon={<MinusCircleOutlined />}>Remove Course</Button>
                      </Space>
                    ))}
                    <Form.Item>
                      <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                        Add Course
                      </Button>
                    </Form.Item>
                  </>
                )}
              </Form.List>
            </div>

            {/* Assignment Information */}
            <div style={{ padding: 16, border: '1px solid #d9d9d9', borderRadius: 8 }}>
              <h3 style={{ marginTop: 0 }}>Past/Current Assignments</h3>
              <Form.List name="assignments">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name, ...restField }) => (
                      <Space key={key} direction="vertical" style={{ width: '100%', marginBottom: 16, padding: 12, border: '1px solid #d9d9d9', borderRadius: 8, backgroundColor: 'white' }}>
                        <Form.Item {...restField} name={[name, 'title']} label="Assignment Title">
                          <Input placeholder="Assignment Title" />
                        </Form.Item>
                        <Form.Item {...restField} name={[name, 'natureOfAssignment']} label="Nature of Assignment">
                          <Input placeholder="e.g., Research, Development, Analysis" />
                        </Form.Item>
                        <Form.Item {...restField} name={[name, 'methodology']} label="Methodology">
                          <Input placeholder="Methodology used" />
                        </Form.Item>
                        <Form.Item {...restField} name={[name, 'description']} label="Description">
                          <TextArea rows={3} placeholder="Assignment Description" />
                        </Form.Item>
                        <Button danger onClick={() => remove(name)} icon={<MinusCircleOutlined />}>Remove Assignment</Button>
                      </Space>
                    ))}
                    <Form.Item>
                      <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                        Add Assignment
                      </Button>
                    </Form.Item>
                  </>
                )}
              </Form.List>
            </div>
          </Space>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      title={getSectionTitle()}
      open={visible}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button key="save" type="primary" loading={loading} onClick={handleFinish}>
          Save
        </Button>
      ]}
    >
      <Form form={form} layout="vertical">
        <div style={{ maxHeight: 500, overflowY: 'auto', padding: '0 8px' }}>
          {renderSectionContent()}
        </div>
      </Form>
    </Modal>
  );
}

