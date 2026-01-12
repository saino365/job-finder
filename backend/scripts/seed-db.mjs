import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Users from '../src/models/users.model.js';
import Companies from '../src/models/companies.model.js';
import JobListings from '../src/models/job-listings.model.js';
import { VERIFICATION_STATUS, JobListingStatus } from '../src/constants/enums.js';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/jobfinder';

async function connect() {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(MONGO_URI);
}

async function ensureUser({ email, password, role = 'student', profile = {}, internProfile = {} }) {
  const existing = await Users.findOne({ email }).lean();
  if (existing) return existing;
  const hashed = await bcrypt.hash(password, 10);
  const doc = await Users.create({ email, username: email.toLowerCase(), password: hashed, role, profile, internProfile });
  return doc.toObject();
}

async function ensureCompany({ name, ownerUserId, industry, city, description, website }) {
  const existing = await Companies.findOne({ name }).lean();
  if (existing) return existing;
  const doc = await Companies.create({
    ownerUserId,
    name,
    industry,
    website,
    description,
    address: { city, country: 'Malaysia' },
    verifiedStatus: VERIFICATION_STATUS.APPROVED,
    submittedAt: new Date(),
    reviewedAt: new Date()
  });
  return doc.toObject();
}

function plusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

async function createJob({ companyId, title, description, city, state, salaryMin, salaryMax }) {
  const doc = await JobListings.create({
    companyId,
    title,
    position: 'intern',
    description,
    location: { city, state },
    salaryRange: { min: salaryMin, max: salaryMax },
    status: JobListingStatus.ACTIVE,
    publishAt: new Date(),
    expiresAt: plusDays(30)
  });
  return doc.toObject();
}

async function main() {
  await connect();

  const students = await Promise.all([
    ensureUser({ email: 'student1@example.com', password: 'Password123!', role: 'student', profile: { firstName: 'Aisha', lastName: 'Yusof', location: { city: 'Kuala Lumpur' } }, internProfile: { university: 'UM', major: 'Computer Science', skills: ['JS','React'], preferences: { industries: ['Technology'] } } }),
    ensureUser({ email: 'student2@example.com', password: 'Password123!', role: 'student', profile: { firstName: 'Benjamin', lastName: 'Tan', location: { city: 'Penang' } }, internProfile: { university: 'USM', major: 'Finance', skills: ['Excel','Accounting'], preferences: { industries: ['Finance'] } } }),
    ensureUser({ email: 'student3@example.com', password: 'Password123!', role: 'student', profile: { firstName: 'Chong', lastName: 'Wei', location: { city: 'Johor Bahru' } }, internProfile: { university: 'UTM', major: 'Mechanical Engineering', skills: ['CAD','MATLAB'], preferences: { industries: ['Manufacturing'] } } }),
    ensureUser({ email: 'student4@example.com', password: 'Password123!', role: 'student', profile: { firstName: 'Dina', lastName: 'Rahman', location: { city: 'Shah Alam' } }, internProfile: { university: 'UiTM', major: 'Marketing', skills: ['SEO','Copywriting'], preferences: { industries: ['Retail'] } } }),
    ensureUser({ email: 'student5@example.com', password: 'Password123!', role: 'student', profile: { firstName: 'Ehsan', lastName: 'Azmi', location: { city: 'Ipoh' } }, internProfile: { university: 'UTAR', major: 'Healthcare Management', skills: ['Research'], preferences: { industries: ['Healthcare'] } } })
  ]);

  const owners = await Promise.all([
    ensureUser({ email: 'comp1.owner@example.com', password: 'Password123!', role: 'company', profile: { firstName: 'Owner', lastName: 'One' } }),
    ensureUser({ email: 'comp2.owner@example.com', password: 'Password123!', role: 'company', profile: { firstName: 'Owner', lastName: 'Two' } }),
    ensureUser({ email: 'comp3.owner@example.com', password: 'Password123!', role: 'company', profile: { firstName: 'Owner', lastName: 'Three' } }),
    ensureUser({ email: 'comp4.owner@example.com', password: 'Password123!', role: 'company', profile: { firstName: 'Owner', lastName: 'Four' } }),
    ensureUser({ email: 'comp5.owner@example.com', password: 'Password123!', role: 'company', profile: { firstName: 'Owner', lastName: 'Five' } })
  ]);

  const companies = await Promise.all([
    ensureCompany({ name: 'TechNova Sdn Bhd', ownerUserId: owners[0]._id, industry: 'Information Technology', city: 'Kuala Lumpur', description: 'Software and AI solutions', website: 'https://technova.example.com' }),
    ensureCompany({ name: 'FinTrust Berhad', ownerUserId: owners[1]._id, industry: 'Finance', city: 'George Town', description: 'Financial services and analytics', website: 'https://fintrust.example.com' }),
    ensureCompany({ name: 'MediHeal Holdings', ownerUserId: owners[2]._id, industry: 'Healthcare', city: 'Johor Bahru', description: 'Healthcare and biotech', website: 'https://mediheal.example.com' }),
    ensureCompany({ name: 'EduSpark Malaysia', ownerUserId: owners[3]._id, industry: 'Education', city: 'Shah Alam', description: 'EdTech and training', website: 'https://eduspark.example.com' }),
    ensureCompany({ name: 'RetailHub Asia', ownerUserId: owners[4]._id, industry: 'Retail', city: 'Ipoh', description: 'E-commerce and retail ops', website: 'https://retailhub.example.com' })
  ]);

  const jobs = await Promise.all([
    createJob({ companyId: companies[0]._id, title: 'Frontend Intern', description: 'Work on Next.js and React UI.', city: 'Kuala Lumpur', state: 'WP Kuala Lumpur', salaryMin: 1200, salaryMax: 1800 }),
    createJob({ companyId: companies[1]._id, title: 'Finance Analyst Intern', description: 'Assist with financial models and reports.', city: 'George Town', state: 'Penang', salaryMin: 1000, salaryMax: 1500 }),
    createJob({ companyId: companies[2]._id, title: 'Biomedical Intern', description: 'Support lab research and documentation.', city: 'Johor Bahru', state: 'Johor', salaryMin: 1100, salaryMax: 1600 }),
    createJob({ companyId: companies[3]._id, title: 'Marketing Intern', description: 'Content, social media, and campaigns.', city: 'Shah Alam', state: 'Selangor', salaryMin: 900, salaryMax: 1300 }),
    createJob({ companyId: companies[4]._id, title: 'Operations Intern', description: 'Assist warehouse and logistics ops.', city: 'Ipoh', state: 'Perak', salaryMin: 1000, salaryMax: 1400 })
  ]);

  console.log('Seed complete');
  console.table({ students: students.length, companies: companies.length, jobs: jobs.length });
  await mongoose.disconnect();
}

main().catch(err => { console.error('Seed failed:', err); process.exit(1); });

