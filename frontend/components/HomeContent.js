"use client";
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";
import Navbar from "./Navbar";
import Footer from "./Footer";
import Hero from "./Hero";
import JobCard from "./JobCard";
import CompanyCard from "./CompanyCard";
import InternCard from "./InternCard";
import FilterBar from "./FilterBar";
import { getFilterConfig } from "./filterConfigs";
import { useFilters } from "../hooks/useFilters";
import { Layout, Row, Col, Typography, Skeleton, Empty, Space, Select, Button, message, Segmented, InputNumber } from "antd";
import { API_BASE_URL } from "../config";
import { apiAuth, getToken } from "../lib/api";

const { Text } = Typography;

function buildQuery(base, { q, location, nature, city, salaryMin, salaryMax, sort }) {
  const isJobs = base.includes("job-listings");
  const params = new URLSearchParams({ "$limit": "8" });
  if (isJobs) {
    if (q) { params.append(`title[$regex]`, q); params.append(`title[$options]`, "i"); }
    if (location) { params.append(`location.city[$regex]`, location); params.append(`location.city[$options]`, "i"); }
  } else {
    if (q) params.append('q', q);
    if (nature) params.append('nature', nature);
    if (city) params.append('city', city);
  }
  if (isJobs && (salaryMin != null || salaryMax != null)) {
    if (salaryMin != null) params.append('salaryRange.min[$gte]', String(salaryMin));
    if (salaryMax != null) params.append('salaryRange.max[$lte]', String(salaryMax));
  }

  if (!isJobs && (salaryMin != null || salaryMax != null)) {
    if (salaryMin != null) params.append('salaryMin', String(salaryMin));
    if (salaryMax != null) params.append('salaryMax', String(salaryMax));
  }
  if (!isJobs && sort) {
    params.append('sort', sort);
  }
  return `${API_BASE_URL}${base}?${params.toString()}`;
}

export default function HomeContent({ jobs = [], companies = [] }) {
  const [q, setQ] = useState("");
  const [location, setLocation] = useState("");
  const [nature, setNature] = useState();
  const [companyCity, setCompanyCity] = useState("");
  const [salaryMin, setSalaryMin] = useState(0);
  const [salaryMax, setSalaryMax] = useState(5000);
  const [sort, setSort] = useState('latest');
  const [prefApplied, setPrefApplied] = useState(false);

  // View modes
  const [jobsView, setJobsView] = useState('list');
  const [companiesView, setCompaniesView] = useState('list');
  // Role detection (student/company/admin)
  const [role, setRole] = useState('');
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    (async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (r.ok) {
          const me = await r.json();
          setRole(String(me?.role || '').toLowerCase());
        }
      } catch (_) {}
    })();
  }, []);

  // Only FilterBar is used for filtering - no legacy filters
  const [internsView, setInternsView] = useState('list');

  // Initialize filter configuration and state for company intern search
  const filterConfig = getFilterConfig('intern-search');
  const {
    filters: selectedFilters,
    updateFilter: handleFilterChange,
    clearAllFilters: handleClearAllFilters,
    hasActiveFilters,
    toURLSearchParams
  } = useFilters({
    fieldOfStudy: [],
    educationLevel: [],
    university: [],
    workExperience: [],
    skills: [],
    preferredLocations: []
  });

  // Debug filter changes
  useEffect(() => {
    console.log('🎯 Filter state changed:', selectedFilters);
  }, [selectedFilters]);

  // Debug search query changes
  useEffect(() => {
    console.log('🔍 Search query (q) changed to:', q);
    console.log('🔍 Current role:', role);
  }, [q, role]);

  // Student filters for job and company search
  const {
    filters: studentFilters,
    updateFilter: handleStudentFilterChange,
    clearAllFilters: handleClearStudentFilters,
    hasActiveFilters: hasActiveStudentFilters
  } = useFilters({
    industry: [],
    jobType: [],
    experience: [],
    location: [],
    salary: []
  });

  // Guest (non-authenticated) filters for company search
  const {
    filters: guestFilters,
    updateFilter: handleGuestFilterChange,
    clearAllFilters: handleClearGuestFilters,
    hasActiveFilters: hasActiveGuestFilters
  } = useFilters({
    industry: [],
    location: []
  });

  const candidatesUrl = useMemo(() => {
    const qs = new URLSearchParams();

    // Apply filter selections to API query based on actual data structure
    const {
      fieldOfStudy,
      educationLevel,
      university,
      workExperience,
      skills,
      preferredLocations
    } = selectedFilters;

    // Field of Study filter - backend expects 'fieldOfStudy' parameter
    if (fieldOfStudy?.length > 0) {
      fieldOfStudy.forEach(field => {
        qs.append('fieldOfStudy', field);
      });
    }

    // Education Level filter - backend expects 'educationLevel' parameter
    if (educationLevel?.length > 0) {
      educationLevel.forEach(level => {
        qs.append('educationLevel', level);
      });
    }

    // University filter - backend expects 'university' parameter
    if (university?.length > 0) {
      university.forEach(uni => {
        qs.append('university', uni);
      });
    }

    // Work Experience filter - backend expects 'workIndustry' parameter
    if (workExperience?.length > 0) {
      workExperience.forEach(industry => {
        qs.append('workIndustry', industry);
      });
    }

    // Skills filter - backend expects 'skills' parameter
    if (skills?.length > 0) {
      skills.forEach(skill => {
        qs.append('skills', skill);
      });
    }

    // Preferred Locations filter - backend expects 'preferredLocation' parameter
    if (preferredLocations?.length > 0) {
      preferredLocations.forEach(location => {
        qs.append('preferredLocation', location);
      });
    }

    // NO legacy filters - FilterBar only!

    // Add cache-busting parameter to force fresh requests
    qs.append('_t', Date.now().toString());

    const finalUrl = `${API_BASE_URL}/programme-candidates?${qs.toString()}`;

    // Debug logging
    if (typeof window !== 'undefined') {
      console.log('🔍 FilterBar ONLY - Candidates URL:', finalUrl);
      console.log('📊 FilterBar selections:', selectedFilters);
      console.log('🗂️ Query params sent to backend:', Object.fromEntries(qs.entries()));
      console.log('🔗 Full URL breakdown:');
      console.log('  - Base URL:', `${API_BASE_URL}/programme-candidates`);
      console.log('  - Query string:', qs.toString());
      console.log('  - Individual params:');
      qs.forEach((value, key) => {
        console.log(`    ${key}: ${value}`);
      });
    }

    return finalUrl;
  }, [selectedFilters]);

  const internsQuery = useQuery({
    queryKey: ['home-interns', candidatesUrl, role, selectedFilters],
    queryFn: async () => {
      console.log('🚀 Making API request to:', candidatesUrl);
      const token = getToken();
      const res = await fetch(candidatesUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: 'no-cache' // Force fresh request
      });
      console.log('📡 API Response status:', res.status);
      if (!res.ok) {
        const errorText = await res.text();
        console.error('❌ API Error:', errorText);
        throw new Error(`Candidates fetch failed: ${res.status} ${errorText}`);
      }
      const data = await res.json();
      console.log('📊 API Response data:', data);
      return data?.items || [];
    },
    enabled: role === 'company',
    initialData: [],
    staleTime: 0, // Always consider data stale
    cacheTime: 0, // Don't cache the data
  });

  async function handleSaveCompanySearchProfile() {
    try {
      const {
        fieldOfStudy,
        educationLevel,
        university,
        workExperience,
        skills,
        preferredLocations
      } = selectedFilters;

      await apiAuth('/search-profiles', {
        method: 'POST',
        body: {
          kind: 'intern',
          filters: {
            // FilterBar only - no legacy fields
            fieldOfStudy: fieldOfStudy?.length > 0 ? fieldOfStudy : undefined,
            educationLevel: educationLevel?.length > 0 ? educationLevel : undefined,
            university: university?.length > 0 ? university : undefined,
            workExperience: workExperience?.length > 0 ? workExperience : undefined,
            skills: skills?.length > 0 ? skills : undefined,
            preferredLocations: preferredLocations?.length > 0 ? preferredLocations : undefined
          }
        }
      });
      message.success('Intern search profile saved');
    } catch (e) {
      message.error(e.message || 'Failed to save search profile');
    }
  }

  async function handleSaveStudentSearchProfile() {
    try {
      const {
        industry,
        jobType,
        experience,
        location,
        salary
      } = studentFilters;

      await apiAuth('/search-profiles', {
        method: 'POST',
        body: {
          kind: 'company',
          filters: {
            // Save student's search preferences for jobs and companies
            industry: industry?.length > 0 ? industry : undefined,
            jobType: jobType?.length > 0 ? jobType : undefined,
            experience: experience?.length > 0 ? experience : undefined,
            location: location?.length > 0 ? location : undefined,
            salary: salary?.length > 0 ? salary : undefined,

            // Save complete filter selections
            filterSelections: studentFilters
          }
        }
      });
      message.success('Search preferences saved');
    } catch (e) {
      message.error(e.message || 'Failed to save search preferences');
    }
  }

  // Student company search profile
  const [studentPrefApplied, setStudentPrefApplied] = useState(false);
  const studentSearchProfileQuery = useQuery({
    queryKey: ['student-search-profile-company', role],
    queryFn: async () => {
      const token = getToken();
      if (!token) return null;
      const res = await fetch(`${API_BASE_URL}/search-profiles?kind=company`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return null;
      const data = await res.json();
      const items = data?.items || data?.data || [];
      return items[0] || null;
    },
    enabled: role === 'student',
    staleTime: 60_000,
  });

  useEffect(() => {
    if (role !== 'student') return;
    if (studentPrefApplied) return;
    const filters = studentSearchProfileQuery.data?.filters;
    if (!filters) return;
    if (filters.keyword != null) setQ(filters.keyword);
    if (filters.nature != null) setNature(filters.nature);
    if (filters.location != null) setCompanyCity(filters.location);
    if (filters.salaryRange) {
      setSalaryMin(filters.salaryRange.min ?? 0);
      setSalaryMax(filters.salaryRange.max ?? 5000);
    }
    if (filters.sort) setSort(filters.sort);
    setStudentPrefApplied(true);
  }, [role, studentPrefApplied, studentSearchProfileQuery.data]);


  // Build filtered URL function for student company search
  const buildFilteredCompaniesUrl = (searchQuery, filters) => {
    const params = new URLSearchParams();
    params.set("$limit", "50");
    params.set("verifiedStatus", "1");

    // Add search query
    if (searchQuery) {
      params.set("q", searchQuery);
    }

    // Add filters - for now support single value (first selected)
    // TODO: Backend needs to support multiple values properly
    if (filters.industry?.length > 0) {
      params.set("industry", filters.industry[0]);
    }
    if (filters.location?.length > 0) {
      params.set("city", filters.location[0]);
    }

    const url = `${API_BASE_URL}/companies?${params.toString()}`;
    console.log('🔍 Frontend: Built filtered companies URL:', url);
    console.log('🔍 Frontend: Filters:', filters);
    return url;
  };

  const jobsUrl = useMemo(() => buildQuery("/job-listings", { q, location, salaryMin, salaryMax }), [q, location, salaryMin, salaryMax]);
  const companiesUrl = useMemo(() => buildQuery("/companies", { q, nature, city: companyCity, salaryMin, salaryMax, sort }), [q, nature, companyCity, salaryMin, salaryMax, sort]);

  const jobsQuery = useQuery({
    queryKey: ["home-jobs", jobsUrl],
    queryFn: async () => {
      const res = await fetch(jobsUrl);
      if (!res.ok) throw new Error("Jobs fetch failed");
      const data = await res.json();
      return Array.isArray(data) ? data : (data?.data || []);
    },
    initialData: jobs,
  });

  const companiesQuery = useQuery({
    queryKey: ["home-companies", companiesUrl],
    queryFn: async () => {
      const res = await fetch(companiesUrl);
      if (!res.ok) throw new Error("Companies fetch failed");
      const data = await res.json();
      return Array.isArray(data) ? data : (data?.data || []);
    },
    initialData: companies,
  });

  const industriesQuery = useQuery({
    queryKey: ["industries"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/companies?$select[]=industry&$limit=500`);
      if (!res.ok) throw new Error("Industries fetch failed");
      const raw = await res.json();
      const arr = Array.isArray(raw) ? raw : (raw?.data || []);
      const list = Array.from(new Set(arr.map((x) => x?.industry).filter(Boolean))).sort();
      return list;
    },
    initialData: [],
  });

  // Filtered queries for students

  const filteredCompaniesQuery = useQuery({
    queryKey: ["filtered-companies", q, studentFilters.industry, studentFilters.location],
    queryFn: async () => {
      const url = buildFilteredCompaniesUrl(q, studentFilters);
      console.log('🔍 Fetching filtered companies from:', url);
      const res = await fetch(url);
      if (!res.ok) throw new Error("Filtered companies fetch failed");
      const data = await res.json();
      console.log('🔍 Filtered companies response:', data);
      const result = Array.isArray(data) ? data : (data?.data || []);
      console.log('🔍 Filtered companies result array:', result, 'Length:', result.length);
      return result;
    },
    enabled: role === 'student',
  });

  // Filtered queries for guest (non-authenticated) users
  const guestCompaniesQuery = useQuery({
    queryKey: ["guest-companies", q, guestFilters.industry, guestFilters.location],
    queryFn: async () => {
      const url = buildFilteredCompaniesUrl(q, guestFilters);
      console.log('🔍 Guest: Fetching filtered companies from:', url);
      const res = await fetch(url);
      if (!res.ok) throw new Error("Guest companies fetch failed");
      const data = await res.json();
      const result = Array.isArray(data) ? data : (data?.data || []);
      return result;
    },
    enabled: !role, // Only enabled when no role (not logged in)
  });

  // Debug: Log when query should be enabled
  useEffect(() => {
    console.log('🔍 filteredCompaniesQuery enabled?', role === 'student', 'role:', role);
  }, [role]);

  // Load student's saved search preferences (if signed in as student)
  const profileQuery = useQuery({
    queryKey: ["me-intern-profile"],
    queryFn: async () => {
      const token = getToken();
      if (!token) return null;
      const res = await fetch(`${API_BASE_URL}/student/internship/me`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: typeof window !== 'undefined',
    staleTime: 60_000,
  });

  // Apply preferences once
  useEffect(() => {
    const prefs = profileQuery.data?.internProfile?.preferences;
    if (!prefApplied && prefs) {
      if (prefs.industries?.length) setNature(prefs.industries[0]);
      if (prefs.locations?.length) setCompanyCity(prefs.locations[0]);
      if (prefs.salaryRange && (prefs.salaryRange.min != null || prefs.salaryRange.max != null)) {
        setSalaryMin(prefs.salaryRange.min ?? 0);
        setSalaryMax(prefs.salaryRange.max ?? 5000);
      }
      setPrefApplied(true);
    }
  }, [profileQuery.data, prefApplied]);


  async function handleSaveSearchProfile() {
    try {
      const {
        industry,
        jobType,
        experience,
        location,
        salary
      } = studentFilters;

      await apiAuth('/search-profiles', {
        method: 'POST',
        body: {
          kind: 'job-search',
          filters: {
            // Save student's search preferences for jobs and companies
            industry: industry?.length > 0 ? industry : undefined,
            jobType: jobType?.length > 0 ? jobType : undefined,
            experience: experience?.length > 0 ? experience : undefined,
            location: location?.length > 0 ? location : undefined,
            salary: salary?.length > 0 ? salary : undefined,

            // Legacy fields for backward compatibility
            keyword: q || undefined,
            salaryRange: { min: salaryMin, max: salaryMax },
            sort
          }
        }
      });
      message.success('Job search profile saved');
    } catch (e) {
      if (e.message?.includes('Not authenticated')) message.warning('Sign in to save your search profile');
      else message.error('Failed to save search profile');
    }
  }


  return (
    <Layout>
      <Navbar />
      <Hero onSearch={({ q: qq = "" }) => {
        console.log('🔍 HomeContent: onSearch called with:', qq);
        setQ(qq);
        console.log('🔍 HomeContent: q state updated to:', qq);
      }} industryOptions={industriesQuery.data || []} />
      <Layout.Content style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
        {role === 'company' ? (
          <>
            {/* Filter Bar for Companies - Intern Search */}
            <FilterBar
              filterConfig={filterConfig}
              selectedFilters={selectedFilters}
              onFilterChange={handleFilterChange}
              onClearAll={handleClearAllFilters}
              onSaveProfile={handleSaveCompanySearchProfile}
              showSaveProfile={true}
              showClearAll={true}
              theme={{
                activeColor: '#7d69ff',
                inactiveColor: '#f5f5f5',
                textColor: '#666',
                activeTextColor: '#fff'
              }}
            />

            {/* DEBUG: Test filter functionality */}
            <div style={{ margin: '16px 0', padding: '16px', border: '1px solid #ccc', borderRadius: '4px' }}>
              <Typography.Text strong>🔧 DEBUG: Test Filters</Typography.Text>
              <br />
              <Button
                onClick={() => {
                  console.log('🔧 TEST: Manual filter trigger');
                  console.log('🔧 TEST: Current selectedFilters before:', selectedFilters);
                  handleFilterChange('fieldOfStudy', ['Bachelor of Computer Science']);
                  console.log('🔧 TEST: handleFilterChange called with:', 'fieldOfStudy', ['Bachelor of Computer Science']);
                }}
                style={{ margin: '8px 4px' }}
              >
                Test: Add Computer Science Filter
              </Button>
              <Button
                onClick={() => {
                  console.log('🔧 TEST: Clear all filters');
                  handleClearAllFilters();
                }}
                style={{ margin: '8px 4px' }}
              >
                Test: Clear All Filters
              </Button>
              <br />
              <Typography.Text>Current filters: {JSON.stringify(selectedFilters)}</Typography.Text>
            </div>

            {/* Save Profile Button */}
            <div style={{ marginBottom: 24, textAlign: 'right' }}>
              <Button type="primary" onClick={handleSaveCompanySearchProfile}>
                Save Filter Profile
              </Button>
            </div>

            <section id="interns" style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Typography.Title level={3} style={{ margin: 0 }}>Interns</Typography.Title>
                <Segmented value={internsView} onChange={setInternsView} options={[{label:'List',value:'list'},{label:'Grid',value:'grid'}]} />
              </div>
              {internsQuery.isLoading ? (
                <Skeleton active />
              ) : internsQuery.data?.length ? (
                <Row gutter={[16,16]}>
                  {internsQuery.data.map((u) => (
                    <Col xs={24} sm={internsView==='grid'?12:24} md={internsView==='grid'?12:24} lg={internsView==='grid'?8:24} key={u._id || u.id}>
                      <InternCard intern={u} />
                    </Col>
                  ))}
                </Row>
              ) : (
                <Empty
                  image={<Image src="/images/not_found.svg" alt="No interns found" width={200} height={150} priority />}
                  imageStyle={{ height: 150 }}
                  description={
                    <div>
                      <Text style={{ fontSize: 16, display: 'block', marginBottom: 8 }}>No interns found</Text>
                      <Text type="secondary">Try adjusting your filters or search criteria</Text>
                    </div>
                  }
                />
              )}
            </section>
          </>
        ) : role === 'student' ? (
          <>
            {/* Filter Bar for Students - Company Search */}
            <FilterBar
              filterConfig={getFilterConfig('job-search')}
              selectedFilters={studentFilters}
              onFilterChange={handleStudentFilterChange}
              onClearAll={handleClearStudentFilters}
              onSaveProfile={handleSaveStudentSearchProfile}
              showSaveProfile={true}
              showClearAll={true}
              theme={{
                activeColor: '#7d69ff',
                inactiveColor: '#f5f5f5',
                textColor: '#666',
                activeTextColor: '#fff'
              }}
            />

            {/* Companies Section */}
            <section id="companies" style={{ marginBottom: 32, minHeight: '400px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Typography.Title level={3} style={{ margin: 0 }}>
                  {q || (studentFilters.industry?.length > 0) || (studentFilters.location?.length > 0) ? 'Search Results' : 'Featured Companies'}
                </Typography.Title>
                <Link href="/companies">
                  <Button type="link">View All Companies →</Button>
                </Link>
              </div>
              {(() => {
                console.log('🔍 RENDER - q:', q, 'data length:', filteredCompaniesQuery.data?.length, 'isLoading:', filteredCompaniesQuery.isLoading);
                console.log('🔍 RENDER - Companies:', filteredCompaniesQuery.data?.map(c => c.name));
                return null;
              })()}
              {filteredCompaniesQuery.isLoading ? (
                <Skeleton active />
              ) : filteredCompaniesQuery.data?.length ? (
                <div style={{ minHeight: '350px' }}>
                  <Row gutter={[16,16]}>
                    {filteredCompaniesQuery.data.slice(0, 6).map((company) => (
                      <Col xs={24} sm={12} md={12} lg={8} key={company._id || company.id}>
                        <CompanyCard company={company} />
                      </Col>
                    ))}
                  </Row>
                </div>
              ) : (
                <Empty
                  image={<Image src="/images/not_found.svg" alt="No companies found" width={200} height={150} priority />}
                  description={
                    <div>
                      <Text style={{ fontSize: 16, display: 'block', marginBottom: 8 }}>
                        {q || (studentFilters.industry?.length > 0) || (studentFilters.location?.length > 0) ? "No companies match your search" : "No companies found"}
                      </Text>
                      <Text type="secondary">Try adjusting your filters or search criteria</Text>
                    </div>
                  }
                />
              )}
            </section>
          </>
        ) : (
          <>
            {/* Filter Bar for Guest Users - Company Search */}
            <FilterBar
              filterConfig={getFilterConfig('company-search')}
              selectedFilters={guestFilters}
              onFilterChange={handleGuestFilterChange}
              onClearAll={handleClearGuestFilters}
              showSaveProfile={false}
              showClearAll={true}
              theme={{
                activeColor: '#7d69ff',
                inactiveColor: '#f5f5f5',
                textColor: '#666',
                activeTextColor: '#fff'
              }}
            />
            <section id="jobs" style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Typography.Title level={3} style={{ margin: 0 }}>Latest Jobs</Typography.Title>
                <Segmented value={jobsView} onChange={setJobsView} options={[{label:'List',value:'list'},{label:'Grid',value:'grid'}]} />
              </div>
              {jobsQuery.isLoading ? (
                <Skeleton active />
              ) : jobsQuery.data?.length ? (
                <Row gutter={[16, 16]}>
                  {jobsQuery.data.map((j) => (
                    <Col xs={24} sm={jobsView==='grid'?12:24} md={jobsView==='grid'?12:24} lg={jobsView==='grid'?8:24} key={j._id}>
                      <JobCard job={j} />
                    </Col>
                  ))}
                </Row>
              ) : (
                <Empty
                  image={<Image src="/images/not_found.svg" alt="No jobs found" width={200} height={150} priority />}
                  description={
                    <div>
                      <Text style={{ fontSize: 16, display: 'block', marginBottom: 8 }}>No jobs found</Text>
                      <Text type="secondary">Try adjusting your filters or search criteria</Text>
                    </div>
                  }
                />
              )}
            </section>
            <section id="companies" style={{ marginBottom: 32, minHeight: '400px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Typography.Title level={3} style={{ margin: 0 }}>
                  {q || (guestFilters.industry?.length > 0) || (guestFilters.location?.length > 0) ? 'Search Results' : 'Featured Companies'}
                </Typography.Title>
                <Link href="/companies">
                  <Button type="link">View All Companies →</Button>
                </Link>
              </div>
              {guestCompaniesQuery.isLoading ? (
                <Skeleton active />
              ) : guestCompaniesQuery.data?.length ? (
                <div style={{ minHeight: '350px' }}>
                  <Row gutter={[16, 16]}>
                    {guestCompaniesQuery.data.slice(0, 6).map((c) => (
                      <Col xs={24} sm={12} md={12} lg={8} key={c._id}>
                        <CompanyCard company={c} />
                      </Col>
                    ))}
                  </Row>
                </div>
              ) : (
                <Empty
                  image={<Image src="/images/not_found.svg" alt="No companies found" width={200} height={150} priority />}
                  description={
                    <div>
                      <Text style={{ fontSize: 16, display: 'block', marginBottom: 8 }}>
                        {q || (guestFilters.industry?.length > 0) || (guestFilters.location?.length > 0) ? "No companies match your search" : "No companies found"}
                      </Text>
                      <Text type="secondary">Try adjusting your filters or search criteria</Text>
                    </div>
                  }
                />
              )}
            </section>
          </>
        )}

      </Layout.Content>
      <Footer />
    </Layout>
  );
}
