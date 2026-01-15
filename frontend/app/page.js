import HomeContent from "../components/HomeContent";
export const metadata = { title: "Home" };

import { API_BASE_URL } from "../config";

async function fetchJson(path) {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, { 
      next: { revalidate: 60 },
      // Add timeout and error handling
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    if (!res.ok) return null;
    return res.json();
  } catch (error) {
    // Handle fetch errors gracefully (backend not available, network issues, etc.)
    console.warn(`Failed to fetch ${path}:`, error.message);
    return null;
  }
}

export default async function Home() {
  // Fetch data with error handling - if backend is not available, use empty arrays
  const [jobsRaw, companiesRaw] = await Promise.all([
    fetchJson('/job-listings?$limit=8').catch(() => null),
    fetchJson('/companies?$limit=8').catch(() => null),
  ]);
  const jobs = Array.isArray(jobsRaw) ? jobsRaw : (jobsRaw?.data || []);
  const companies = Array.isArray(companiesRaw) ? companiesRaw : (companiesRaw?.data || []);

  return (
    <HomeContent jobs={jobs} companies={companies} />
  );
}

