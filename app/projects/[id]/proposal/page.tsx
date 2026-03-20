"use client";
import { useEffect, useState, useRef, Suspense } from "react";
import { createPortal } from 'react-dom';
import NextImage from 'next/image';
import { useParams, useSearchParams } from "next/navigation";
import { storage } from "../../../../src/lib/firebase";
import { getProject, getProjectByCode, updateProject, getOrgByCode, updateOrg, fieldDelete, fieldArrayUnion, fieldArrayRemove } from '@/lib/dal';
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { resizeImageBlob, resizeImageFile, IMAGE_MAX_BANNER, IMAGE_MAX_THUMB } from "../../../../src/lib/imageResize";
import { getAuth } from "firebase/auth";
import PageShell from "../../../../components/PageShell";
import ProfileLoadingShell from "../../../../components/ProfileLoadingShell";
import MapPreview from "../../../../components/MapPreview";
import InteractiveMapPicker from "../../../../components/InteractiveMapPicker";
import AITextarea from "../../../../components/AITextarea";
import LocationEditorModal from "../../../../components/LocationEditorModal";
import ProjectAIReviewModal from "../../../../components/ProjectAIReviewModal";
import BecomePartnerModal from "../../../../components/BecomePartnerModal";
import type { OrgLocation } from "../../../../components/OrgLocationsTab";
import { 
  MapPinIcon,
  CalendarIcon, 
  CurrencyDollarIcon, 
  DocumentTextIcon,
  BuildingOfficeIcon,
  ClockIcon,
  LightBulbIcon,
  UsersIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  PencilIcon,
  CheckIcon,
  EyeIcon,
  EyeSlashIcon,
  PhotoIcon,
  FilmIcon,
  MusicalNoteIcon,
  DocumentIcon,
  TrashIcon,
  ArrowUpTrayIcon,
  GlobeAltIcon,
  LockClosedIcon,
  StarIcon,
  SparklesIcon,
  ArrowDownTrayIcon,
  ShareIcon
} from '@heroicons/react/24/outline';
import { generateProjectPDF } from '../../../../src/lib/pdfGenerator';
import { moderateProfileContent, submitToModerationQueue, getPendingReviewMessage } from '../../../../src/lib/moderation';
import { generateListWithAI } from '../../../../src/lib/ai';

const auth = typeof window !== "undefined" ? getAuth() : null;

interface ProjectDocument {
  name: string;
  url: string;
  type: string;
  size?: number;
}

interface ProjectLocation {
  country?: string;
  town?: string;
  latitude?: number;
  longitude?: number;
  zoom?: number;
  name?: string;
}

interface Project {
  name: string;
  description: string;
  projectId?: string;
  location?: ProjectLocation;
  locationName?: string;
  locationDescription?: string;
  locationIntroduction?: string;
  projectHeading?: string;
  strapline?: string;
  projectSummary?: string;
  projectImpact?: string;
  impactItems?: string[];
  startDate?: any;
  endDate?: any;
  targetCompletionDate?: string;
  projectDuration?: number;
  projectDurationUnit?: string;
  totalBudget?: number;
  amountPledged?: number;
  amountRaised?: number;
  currency?: string;
  matchedFundingNote?: string;
  seekingMultiplePartners?: boolean;
  organizationId?: string;
  organizationName?: string;
  organizationLogoUrl?: string;
  organizationLogo?: string;
  organizationDescription?: string;
  vision?: string;
  coverPhotoUrl?: string;
  createdBy?: string;
  team?: any[];
  goals?: string[];
  milestones?: any[];
  beneficiaries?: string;
  involved?: any[];
  peopleInvolved?: any[];
  oversight?: string;
  approved?: boolean;
  safeguardingInPlace?: boolean;
  financialAccountabilityInPlace?: boolean;
  otherDetails?: string;
  keyDocuments?: ProjectDocument[];
  galleryImages?: string[];
  visibility?: 'public' | 'private';
  status?: 'draft' | 'live' | 'pending_review';
  showOnOrganizationOverview?: boolean;
  locationId?: string;
}

function ProjectProposalInner() {
  const params = useParams();
  const routeParam = params.id as string;
  const searchParams = useSearchParams();
  const fromShowcase = searchParams.get('from') === 'showcase';
  const showcaseReturnCode = searchParams.get('code') || '';
  const [resolvedDocId, setResolvedDocId] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [editMode, setEditMode] = useState<Record<string, boolean>>({});
  const [editValues, setEditValues] = useState<Partial<Project>>({});
  const [saving, setSaving] = useState(false);
  const [orgLogo, setOrgLogo] = useState<string | null>(null);
  const [orgLocations, setOrgLocations] = useState<OrgLocation[]>([]);
  const [orgDocId, setOrgDocId] = useState<string | null>(null);
  const [orgSafeguardingUrl, setOrgSafeguardingUrl] = useState<string | null>(null);
  const [orgLatestAuditReport, setOrgLatestAuditReport] = useState<{ url: string; year: string; label: string } | null>(null);
  const [orgLocEditOpen, setOrgLocEditOpen] = useState(false);
  const [orgLocEditForm, setOrgLocEditForm] = useState<OrgLocation | null>(null);
  const [orgLocSaving, setOrgLocSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(fromShowcase);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [pendingReviewMsg, setPendingReviewMsg] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [ytInput, setYtInput] = useState('');
  const [keyDocsEditOpen, setKeyDocsEditOpen] = useState(false);
  const [newImpactItem, setNewImpactItem] = useState('');
  const [newGoalItem, setNewGoalItem] = useState('');
  const [generatingGoals, setGeneratingGoals] = useState(false);
  const [generatingImpactItems, setGeneratingImpactItems] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [aiReviewModalOpen, setAiReviewModalOpen] = useState(false);
  const [partnerModalOpen, setPartnerModalOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [orgTeamMembers, setOrgTeamMembers] = useState<any[]>([]);
  const [uploadingPersonPhoto, setUploadingPersonPhoto] = useState<number | null>(null);
  const [showOrgMemberPicker, setShowOrgMemberPicker] = useState(false);
  const personPhotoInputRef = useRef<HTMLInputElement>(null);
  const [personPhotoTargetIndex, setPersonPhotoTargetIndex] = useState<number | null>(null);

  const getYouTubeId = (url: string): string | null => {
    try {
      const u = new URL(url);
      if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('?')[0];
      if (u.hostname.includes('youtube.com')) {
        const v = u.searchParams.get('v');
        if (v) return v;
        const parts = u.pathname.split('/');
        const embedIdx = parts.indexOf('embed');
        if (embedIdx !== -1) return parts[embedIdx + 1];
      }
    } catch {}
    return null;
  };

  // Resize image to max 200x200 and return as Blob — delegates to shared utility
  const resizeImage = (file: File, maxSize = IMAGE_MAX_THUMB): Promise<Blob> => {
    return resizeImageBlob(file, maxSize);
  };

  // Upload person photo: resize then upload to Firebase Storage
  const handlePersonPhotoUpload = async (file: File, index: number) => {
    if (!resolvedDocId) return;
    setUploadingPersonPhoto(index);
    try {
      const resized = await resizeImage(file, 200);
      const sRef = storageRef(storage, `projects/${resolvedDocId}/people/${Date.now()}_${index}.webp`);
      await uploadBytes(sRef, resized, { contentType: 'image/webp', cacheControl: 'public, max-age=31536000' });
      const url = await getDownloadURL(sRef);
      const newPeople = [...(editValues.peopleInvolved || [])];
      newPeople[index] = { ...newPeople[index], photoURL: url };
      setEditValues(prev => ({ ...prev, peopleInvolved: newPeople }));
    } catch (err) {
      console.error('Error uploading person photo:', err);
    } finally {
      setUploadingPersonPhoto(null);
    }
  };

  // Track current user
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  const isActualCreator = !!(currentUser && project && project.createdBy === currentUser.uid);
  const isCreator = isActualCreator && !previewMode;

  const toggleEditMode = (section: string) => {
    setEditMode(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
    if (!editMode[section]) {
      const values = { ...project };
      // Initialize impactItems as empty array if not exists
      if (section === 'projectImpact' && !values.impactItems) {
        values.impactItems = [];
      }
      // Initialize goals as empty array if not exists
      if (section === 'goals' && !values.goals) {
        values.goals = [];
      }
      // Initialize peopleInvolved as empty array if not exists
      if (section === 'people' && !values.peopleInvolved) {
        values.peopleInvolved = [];
      }
      // Initialize location as empty object if not exists
      if (section === 'location' && !values.location) {
        values.location = {};
      }
      setEditValues(values || {});
    }
  };

  const geocodeAddress = async (address: string) => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setGeocodeError('Google Maps API key not configured');
      return;
    }
    
    setGeocoding(true);
    setGeocodeError(null);
    
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
      );
      const data = await response.json();
      
      if (data.status === 'OK' && data.results.length > 0) {
        const result = data.results[0];
        const location = result.geometry.location;
        
        // Extract address components
        let town = '';
        let country = '';
        
        result.address_components.forEach((component: any) => {
          if (component.types.includes('locality') || component.types.includes('administrative_area_level_2')) {
            town = component.long_name;
          }
          if (component.types.includes('country')) {
            country = component.long_name;
          }
        });
        
        setEditValues(prev => ({
          ...prev,
          location: {
            ...prev.location,
            latitude: location.lat,
            longitude: location.lng,
            name: result.formatted_address,
            town: town || prev.location?.town,
            country: country || prev.location?.country
          }
        }));
        
        setGeocodeError(null);
      } else {
        setGeocodeError('Location not found. Please try a different search or enter coordinates manually.');
      }
    } catch (err: any) {
      console.error('Geocoding error:', err);
      setGeocodeError('Failed to search location. Please try again.');
    } finally {
      setGeocoding(false);
    }
  };

  const saveSection = async (section: string, fields: string[]) => {
    if (!resolvedDocId || !editValues) return;
    
    setSaving(true);
    try {
      const updates: any = {};       // sent to Firestore (may contain fieldDelete())
      const localUpdates: any = {};  // applied to React state (uses undefined instead)
      fields.forEach(field => {
        const val = editValues[field as keyof Project];
        if (val === undefined) return; // skip unset fields
        if (val === '' || val === null) {
          updates[field] = fieldDelete();
          localUpdates[field] = undefined;
        } else {
          updates[field] = val;
          localUpdates[field] = val;
        }
      });
      
      await updateProject(resolvedDocId, updates as any);
      
      setProject(prev => prev ? { ...prev, ...localUpdates } : null);
      setEditMode(prev => ({ ...prev, [section]: false }));
    } catch (err: any) {
      console.error('Error saving:', err);
      alert('Failed to save changes: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Resolve project ID or doc ID
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!routeParam) {
        setError('Missing project');
        return;
      }
      
      console.log('Route param:', routeParam);
      
      // Check if it's a project code (e.g., P123456)
      if (/^P[A-Z0-9]{6}$/i.test(routeParam)) {
        console.log('Treating as project code');
        try {
          const found = await getProjectByCode(routeParam.toUpperCase());
          if (!found) {
            console.log('Project code not found');
            setError('Project not found.');
            setResolvedDocId(null);
            setLoading(false);
            return;
          }
          console.log('Found project doc:', found.id);
          setResolvedDocId(found.id);
        } catch (e: any) {
          console.error('Error looking up project:', e);
          setError(e.message || 'Lookup failed');
          setLoading(false);
        }
        return;
      }
      
      // Assume it's a document ID
      console.log('Treating as document ID');
      setResolvedDocId(routeParam);
    })();
    return () => {
      cancelled = true;
    };
  }, [routeParam]);

  // Load project data
  useEffect(() => {
    if (!resolvedDocId) return;
    
    const loadProject = async () => {
      setLoading(true);
      setError('');
      try {
        console.log('Loading project:', resolvedDocId);
        const projectData = await getProject(resolvedDocId);
        
        if (!projectData) {
          console.log('Project not found');
          setError('Project not found.');
          setProject(null);
          setLoading(false);
          return;
        }
        
        const data = projectData as unknown as Project;
        console.log('Project loaded:', data);
        console.log('Has cover photo:', !!data.coverPhotoUrl);
        console.log('Has org logo from project:', !!data.organizationLogoUrl);
        setProject(data);
        
        // Fetch organization logo if not in project data
        if (data.organizationId && !data.organizationLogoUrl) {
          try {
            const orgData = await getOrgByCode(data.organizationId);
            if (orgData) {
              console.log('Fetched org logo:', orgData.logoUrl);
              setOrgLogo((orgData as any).logoUrl || null);
              setOrgLocations(Array.isArray((orgData as any).locations) ? (orgData as any).locations : []);
              setOrgDocId((orgData as any).id || null);
              setOrgSafeguardingUrl((orgData as any).safeguardingPolicyUrl || null);
              setOrgTeamMembers(Array.isArray((orgData as any).team) ? (orgData as any).team : []);
            }
          } catch (err) {
            console.error('Error fetching org logo:', err);
          }
        } else if (data.organizationLogoUrl) {
          setOrgLogo(data.organizationLogoUrl);
          // Still need to fetch org locations even if logo is in project data
          if (data.organizationId) {
            try {
              const orgData = await getOrgByCode(data.organizationId);
              if (orgData) {
                setOrgLocations(Array.isArray((orgData as any).locations) ? (orgData as any).locations : []);
                setOrgDocId((orgData as any).id || null);
                setOrgSafeguardingUrl((orgData as any).safeguardingPolicyUrl || null);
                setOrgTeamMembers(Array.isArray((orgData as any).team) ? (orgData as any).team : []);
                const reports2 = Array.isArray((orgData as any).auditorReports) ? (orgData as any).auditorReports : [];
                if (reports2.length > 0) setOrgLatestAuditReport(reports2[0]);
              }
            } catch {/* ignore */}
          }
        }
        
        setLoading(false);
      } catch (err: any) {
        console.error('Error loading project:', err);
        setError(err.message || 'Error loading project.');
        setLoading(false);
      }
    };
    
    loadProject();
  }, [resolvedDocId]);

  // Check for openPartner query parameter (when returning from org creation)
  useEffect(() => {
    if (typeof window === 'undefined' || !project) return;
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('openPartner') === 'true') {
      setPartnerModalOpen(true);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [project]);

  const getMapParams = (loc: ProjectLocation | undefined): { lat: number; lng: number; zoom: number } | null => {
    if (!loc) return null;
    
    const hasCoords = typeof loc.latitude === 'number' && typeof loc.longitude === 'number';
    if (hasCoords && loc.latitude !== undefined && loc.longitude !== undefined) {
      return { lat: loc.latitude, lng: loc.longitude, zoom: loc.zoom || 13 };
    }
    
    const countryCenters: Record<string, { lat: number; lng: number; zoom: number }> = {
      kenya: { lat: -0.0236, lng: 37.9062, zoom: 6 },
      uganda: { lat: 1.3733, lng: 32.2903, zoom: 6 },
      tanzania: { lat: -6.3690, lng: 34.8888, zoom: 6 },
      ghana: { lat: 7.9465, lng: -1.0232, zoom: 6 },
      nigeria: { lat: 9.0820, lng: 8.6753, zoom: 6 },
      rwanda: { lat: -1.9403, lng: 29.8739, zoom: 7 },
      ethiopia: { lat: 9.145, lng: 40.4897, zoom: 6 },
      malawi: { lat: -13.2543, lng: 34.3015, zoom: 7 },
    };
    
    const countryKey = (loc.country || '').toLowerCase();
    if (countryKey && countryCenters[countryKey]) {
      return countryCenters[countryKey];
    }
    
    return null;
  };

  const formatCurrency = (amount: number, currency: string) => {
    const symbols: Record<string, string> = {
      USD: '$',
      GBP: '£',
      EUR: '€',
      KES: 'KSh',
      MWK: 'MK'
    };
    const symbol = symbols[currency] || currency;
    return `${symbol}${amount.toLocaleString()}`;
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Not set';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return 'Invalid date';
    }
  };

  if (loading) {
    return <ProfileLoadingShell title="Project Proposal" />;
  }

  if (error || !project) {
    return (
      <PageShell title="Project Proposal">
        <div className="px-8 py-8">
          <div className="text-center text-red-600">{error || 'Project not found'}</div>
        </div>
      </PageShell>
    );
  }

  const mapParams = getMapParams(project.location);

  const activeLoc = project.locationId
    ? orgLocations.find(l => l.id === project.locationId) ?? null
    : null;

  // Prefer linked org location data over project-level location fields
  const activeLocMapParams = activeLoc?.latitude && activeLoc?.longitude
    ? { lat: activeLoc.latitude, lng: activeLoc.longitude, zoom: activeLoc.zoom || 13 }
    : null;
  const displayMapParams = activeLocMapParams || mapParams;
  const displayLocationName = activeLoc?.name || project.locationName;
  const displayLocationDescription = activeLoc?.description || project.locationDescription;
  const displayTown = activeLoc?.town || project.location?.town;
  const displayCountry = activeLoc?.country || project.location?.country;

  async function saveVisibilityField(patch: Partial<Pick<Project, 'visibility' | 'status' | 'showOnOrganizationOverview'>>) {
    if (!resolvedDocId) return;
    setSavingVisibility(true);
    setPendingReviewMsg(null);
    try {
      // Run mandatory moderation scan before going live
      if (patch.status === 'live' && project) {
        const contentSnapshot: Record<string, string> = {};
        const scanFields: (keyof Project)[] = [
          'name', 'description', 'vision', 'projectSummary', 'projectImpact',
          'beneficiaries', 'oversight', 'otherDetails',
        ];
        scanFields.forEach(f => {
          const v = project[f];
          if (v && typeof v === 'string') contentSnapshot[f] = v;
        });

        const modResult = await moderateProfileContent(contentSnapshot, 'project');

        if (modResult.flagged) {
          // Set to pending_review instead of live
          await updateProject(resolvedDocId, { status: 'pending_review' } as any);
          setProject(prev => prev ? { ...prev, status: 'pending_review' } : null);
          await submitToModerationQueue({
            type: 'project',
            docId: resolvedDocId,
            docCollection: 'projects',
            profileName: project.name || 'Unnamed project',
            profileCode: project.projectId || resolvedDocId,
            ownerUid: currentUser?.uid || '',
            result: modResult,
            contentSnapshot,
          });
          setPendingReviewMsg(getPendingReviewMessage('project'));
          return;
        }
      }

      await updateProject(resolvedDocId, patch as any);
      setProject(prev => prev ? { ...prev, ...patch } : null);
    } catch (e: any) {
      console.error('Failed to save visibility:', e);
    } finally {
      setSavingVisibility(false);
    }
  }

  const projectVisibility = project.visibility ?? 'public';
  const projectStatus = project.status ?? 'live';
  const isPublic = projectVisibility === 'public';
  const isLive = projectStatus === 'live';
  const isPendingReview = projectStatus === 'pending_review';

  return (
    <PageShell
      title={`${project.name} - Proposal`}
      headerRight={(
        <div className="flex items-center gap-2">
          {project?.projectId && (
            <span className="text-lg font-mono font-bold text-white tracking-widest">{project.projectId}</span>
          )}
        </div>
      )}
    >
      <div className="space-y-0">

        {/* Pending review / moderation banner */}
        {(isPendingReview || pendingReviewMsg) && (
          <div className="mx-6 md:mx-8 mt-4 bg-yellow-50 border border-yellow-300 rounded-2xl px-5 py-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="text-sm text-yellow-800">
              {pendingReviewMsg || getPendingReviewMessage('project')}
            </p>
          </div>
        )}

        {/* Hero Header */}
        <div className="relative w-[calc(100%+3rem)] md:w-[calc(100%+4rem)] -ml-6 md:-ml-8" style={{ marginTop: '-2rem' }}>
          {/* Background Image with Overlay */}
          <div className="absolute inset-0 bg-gray-900 overflow-hidden">
            {project.coverPhotoUrl && (
              <>
                <NextImage
                  src={project.coverPhotoUrl}
                  alt={project.name}
                  fill
                  priority
                  sizes="100vw"
                  style={{ objectFit: 'cover' }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/20"></div>
              </>
            )}
          </div>
          
          {/* Organization Logo - Top Right */}
          {orgLogo && (
            <div className="absolute top-10 right-[2.7rem] z-20">
              <NextImage
                src={orgLogo}
                alt="Organization"
                width={160}
                height={96}
                style={{ height: '6rem', width: 'auto', objectFit: 'contain' }}
                className="bg-white rounded-lg p-3 shadow-2xl border-2 border-gray-200"
              />
            </div>
          )}
          
          {/* Project Code + Partner Button + Share - Bottom Right */}
          <div className="absolute bottom-10 right-[2.7rem] z-20 flex items-stretch gap-3">
            {!isActualCreator && (
              <button
                onClick={() => setPartnerModalOpen(true)}
                className="px-5 py-3 bg-white text-brand-main rounded-lg font-semibold hover:bg-gray-100 transition-all shadow-lg flex items-center gap-2 text-sm"
              >
                <StarIcon className="w-4 h-4" />
                Become a Partner
              </button>
            )}
            {/* Download PDF — visible to all visitors */}
            <button
              onClick={() => {
                generateProjectPDF({
                  name: project.name,
                  projectId: project.projectId || resolvedDocId || undefined,
                  strapline: project.strapline,
                  description: project.description,
                  coverPhotoUrl: project.coverPhotoUrl,
                  locationName: project.locationName,
                  locationIntroduction: project.locationIntroduction,
                  locationVision: activeLoc?.vision,
                  locationWhatWeDo: activeLoc?.whatWeDo,
                  vision: project.vision,
                  projectSummary: project.projectSummary,
                  projectImpact: project.projectImpact,
                  targetCompletionDate: project.targetCompletionDate,
                  totalBudget: project.totalBudget,
                  currency: project.currency,
                  goals: project.goals,
                  beneficiaries: project.beneficiaries,
                  organizationName: project.organizationName,
                  organizationLogoUrl: project.organizationLogoUrl || project.organizationLogo || orgLogo || undefined
                });
              }}
              className="h-full px-4 py-3 bg-white/20 backdrop-blur-sm rounded-lg border border-white/30 text-white hover:bg-white/30 transition flex items-center gap-2 text-sm font-medium"
              title="Download profile as PDF"
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
              <span className="hidden md:inline">Download PDF</span>
            </button>
            {project.projectId && (
              <div className="relative">
                <button
                  onClick={() => setShareOpen(o => !o)}
                  className="h-full px-4 py-3 bg-green-500/40 backdrop-blur-sm rounded-lg border border-green-300/40 text-white hover:bg-green-500/60 transition flex items-center gap-2 text-sm font-medium"
                  title="Share this project"
                >
                  <ShareIcon className="w-5 h-5" />
                  <span className="hidden md:inline">Share</span>
                </button>
                {shareOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShareOpen(false)} />
                    <div className="absolute right-0 bottom-full mb-2 z-20 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden min-w-[200px]">
                      <p className="text-xs text-gray-400 px-4 pt-3 pb-1 font-semibold uppercase tracking-wider">Share via</p>
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent('Check out this project: https://close2source.com/?id=' + project.projectId)}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-green-50 text-gray-700 text-sm transition"
                        onClick={() => setShareOpen(false)}
                      >
                        <span className="text-lg">💬</span>
                        WhatsApp
                      </a>
                      <a
                        href={`mailto:?subject=${encodeURIComponent('Check out: ' + project.name)}&body=${encodeURIComponent('I wanted to share this project with you:\n\nhttps://close2source.com/?id=' + project.projectId)}`}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 text-gray-700 text-sm transition"
                        onClick={() => setShareOpen(false)}
                      >
                        <span className="text-lg">✉️</span>
                        Email
                      </a>
                      <a
                        href={`fb-messenger://share?link=${encodeURIComponent('https://close2source.com/?id=' + project.projectId)}`}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 text-gray-700 text-sm transition"
                        onClick={() => setShareOpen(false)}
                      >
                        <span className="text-lg">💬</span>
                        Messenger
                      </a>
                      <button
                        onClick={() => { navigator.clipboard.writeText('https://close2source.com/?id=' + project.projectId); setShareOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-gray-700 text-sm transition border-t border-gray-100"
                      >
                        <ShareIcon className="w-4 h-4 text-gray-400" />
                        Copy link
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          
          {/* Content */}
          <div className="relative py-12 md:py-20 px-8">
            <div className="max-w-4xl">
              {/* Project Label */}
              <div className="inline-block mb-4 px-4 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
                <span className="text-xs font-semibold text-white uppercase tracking-wider">Project Proposal</span>
              </div>
              
              {/* Project Title */}
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-3 leading-tight">
                {project.name}
              </h1>

              {/* Strapline */}
              {project.strapline && (
                <p className="text-lg md:text-xl text-white/90 font-medium mb-4 leading-snug">
                  {project.strapline}
                </p>
              )}
              
              {/* Organization and Actions */}
              <div className="flex flex-wrap items-center gap-4 text-white/90">
                {project.organizationName && (
                  (project.organizationId && !fromShowcase) ? (
                    <a
                      href={`/org/${project.organizationId}`}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 hover:bg-white/20 hover:border-white/40 transition-colors"
                    >
                      <BuildingOfficeIcon className="w-4 h-4" />
                      <span className="text-sm font-medium">{project.organizationName}</span>
                    </a>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
                      <BuildingOfficeIcon className="w-4 h-4" />
                      <span className="text-sm font-medium">{project.organizationName}</span>
                    </div>
                  )
                )}
              </div>
              

            </div>
          </div>
        </div>
        
        {/* Creator Action Bar / Black Border Line */}
        <div className="w-[calc(100%+3rem)] md:w-[calc(100%+4rem)] -ml-6 md:-ml-8 bg-black">
          {isActualCreator ? (
            <div className="flex items-center gap-2 px-6 py-2.5 min-h-[42px]">
              {isCreator && (
              <div className="flex flex-wrap items-center gap-2 flex-1">
              {/* Visibility: Public / Private */}
              <button
                disabled={savingVisibility}
                onClick={() => {
                  const next = isPublic ? 'private' : 'public';
                  const patch: any = { visibility: next };
                  if (next === 'private') patch.showOnOrganizationOverview = false;
                  saveVisibilityField(patch);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all disabled:opacity-60 ${
                  isPublic
                    ? 'bg-white/15 text-white border-white/25 hover:bg-white/25'
                    : 'bg-amber-500/90 text-white border-amber-400 hover:bg-amber-600'
                }`}
                title={isPublic ? 'Project is Public — click to make Private' : 'Project is Private — click to make Public'}
              >
                {isPublic ? <GlobeAltIcon className="w-3.5 h-3.5" /> : <LockClosedIcon className="w-3.5 h-3.5" />}
                <span>{isPublic ? 'Public' : 'Private'}</span>
              </button>

              {/* Status: Draft / Live / Pending Review */}
              {isPendingReview ? (
                <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border bg-yellow-500/90 text-white border-yellow-400 cursor-default">
                  <span className="w-2 h-2 rounded-full bg-yellow-200"></span>
                  <span>Under Review</span>
                </span>
              ) : (
                <button
                  disabled={savingVisibility}
                  onClick={() => saveVisibilityField({ status: isLive ? 'draft' : 'live' })}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all disabled:opacity-60 ${
                    isLive
                      ? 'bg-green-600/80 text-white border-green-500 hover:bg-green-700'
                      : 'bg-white/15 text-white border-white/25 hover:bg-white/25'
                  }`}
                  title={isLive ? 'Project is Live — click to set to Draft' : 'Project is Draft — click to set Live'}
                >
                  <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-300' : 'bg-gray-400'}`}></span>
                  <span>{isLive ? 'Live' : 'Draft'}</span>
                </button>
              )}

              {/* Showcase — only when public */}
              {isPublic && (
                <button
                  disabled={savingVisibility}
                  onClick={() => saveVisibilityField({ showOnOrganizationOverview: !project.showOnOrganizationOverview })}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all disabled:opacity-60 ${
                    project.showOnOrganizationOverview
                      ? 'bg-orange-500 text-white border-orange-400 hover:bg-orange-600'
                      : 'bg-white/15 text-white border-white/25 hover:bg-white/25'
                  }`}
                  title={project.showOnOrganizationOverview ? 'Showing on org Overview — click to remove' : 'Add to org Overview showcase'}
                >
                  <StarIcon className="w-3.5 h-3.5" />
                  <span>Showcase</span>
                </button>
              )}



              {/* AI Review */}
              <button
                onClick={() => setAiReviewModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all bg-white/15 text-white border-white/25 hover:bg-white/25"
                title="Use AI to review and improve project content"
              >
                <SparklesIcon className="w-3.5 h-3.5" />
                <span>AI Review</span>
              </button>
              </div>
              )}
              {!isCreator && <div className="flex-1" />}
              {/* Return to Showcase — visible to all when accessed from a showcase */}
              {fromShowcase && showcaseReturnCode && (
                <a
                  href={`/showcase/${showcaseReturnCode}`}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all bg-orange-500 text-white border-orange-400 hover:bg-orange-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  Return to Showcase
                </a>
              )}
              {/* Preview/Edit toggle — always visible, right-aligned */}
              <div className="ml-auto pl-2">
                <button
                  onClick={() => setPreviewMode(p => !p)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border transition-all ${
                    previewMode
                      ? 'bg-orange-500 text-white border-orange-400 hover:bg-orange-600'
                      : 'bg-white/15 text-white border-white/25 hover:bg-white/25'
                  }`}
                  title={previewMode ? 'Return to edit mode' : 'Preview as public visitor'}
                >
                  {previewMode ? (
                    <><PencilIcon className="w-4 h-4" /><span>Edit Mode</span></>
                  ) : (
                    <><EyeIcon className="w-4 h-4" /><span>Preview</span></>
                  )}
                </button>
              </div>
            </div>
          ) : (
            fromShowcase && showcaseReturnCode ? (
              <div className="flex items-center justify-end px-6 py-2 min-h-[42px]">
                <a
                  href={`/showcase/${showcaseReturnCode}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white text-xs font-semibold rounded-md hover:bg-orange-600 transition"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  Return to Showcase
                </a>
              </div>
            ) : (
              <div className="h-[2px]" />
            )
          )}
        </div>

        {/* Content Container */}
        <div className="space-y-8 pt-8">

        {/* Location Introduction - Full Width Transparent */}
        {(project.locationIntroduction || isCreator || activeLoc?.vision || activeLoc?.whatWeDo) && (
          <div className="bg-transparent pr-6 pt-0 pb-0">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-3xl font-light text-black">
                {editMode.locationIntro ? (
                  <input
                    type="text"
                    value={editValues.locationIntroduction || 'Location Introduction'}
                    onChange={(e) => setEditValues(prev => ({ ...prev, locationIntroduction: e.target.value }))}
                    className="w-full bg-transparent border-b-2 border-gray-300 focus:border-orange-500 focus:outline-none font-light"
                    placeholder="Location Introduction"
                  />
                ) : (
                  project.locationIntroduction || 'Location Introduction'
                )}
              </h2>
              {isCreator && (
                <button
                  onClick={() => editMode.locationIntro ? saveSection('locationIntro', ['locationIntroduction']) : toggleEditMode('locationIntro')}
                  disabled={saving}
                  className="p-2 bg-white rounded-lg hover:bg-gray-50 disabled:opacity-50 shadow-sm border border-gray-200"
                  title={editMode.locationIntro ? 'Save' : 'Edit'}
                >
                  {editMode.locationIntro ? (
                    <CheckIcon className="w-5 h-5 text-green-600" />
                  ) : (
                    <PencilIcon className="w-5 h-5 text-orange-600" />
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Vision, Description & Organization - 3 Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Vision & Description (67% width) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Location Vision card (from linked org location) */}
            {activeLoc?.vision && (
              <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg shadow-md p-6 border-l-4 border-orange-600">
                <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
                  <LightBulbIcon className="w-6 h-6 text-orange-600" />
                  Our Vision
                </h2>
                <div className="text-lg text-gray-800 italic whitespace-pre-wrap">{activeLoc.vision}</div>
              </div>
            )}

            {/* Location What We Do card (from linked org location) */}
            {activeLoc?.whatWeDo && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
                  <DocumentTextIcon className="w-6 h-6 text-orange-600" />
                  What We Do
                </h2>
                <div className="prose max-w-none text-gray-700 whitespace-pre-wrap">{activeLoc.whatWeDo}</div>
              </div>
            )}

            {/* Vision */}
            {!activeLoc?.vision && (project.vision || isCreator) && (
              <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg shadow-md p-6 border-l-4 border-orange-600">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <LightBulbIcon className="w-6 h-6 text-orange-600" />
                    Our Vision
                  </h2>
                  {isCreator && (
                    <button
                      onClick={() => editMode.vision ? saveSection('vision', ['vision']) : toggleEditMode('vision')}
                      disabled={saving}
                      className="p-2 bg-white rounded-lg hover:bg-gray-50 disabled:opacity-50 shadow-sm border border-gray-200"
                      title={editMode.vision ? 'Save' : 'Edit'}
                    >
                      {editMode.vision ? (
                        <CheckIcon className="w-5 h-5 text-green-600" />
                      ) : (
                        <PencilIcon className="w-5 h-5 text-orange-600" />
                      )}
                    </button>
                  )}
                </div>
                {editMode.vision ? (
                  <AITextarea
                    value={editValues.vision || ''}
                    onChange={(value) => setEditValues(prev => ({ ...prev, vision: value }))}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter the vision..."
                    rows={3}
                    aiContext="a project vision statement"
                  />
                ) : (
                  <div className="text-lg text-gray-800 italic whitespace-pre-wrap">
                    {project.vision || (isCreator ? 'Click Edit to add vision' : '')}
                  </div>
                )}
              </div>
            )}

            {/* Description */}
            {!activeLoc?.whatWeDo && <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <DocumentTextIcon className="w-6 h-6 text-orange-600" />
                  What We Do
                </h2>
                {isCreator && (
                  <button
                    onClick={() => editMode.description ? saveSection('description', ['description']) : toggleEditMode('description')}
                    disabled={saving}
                    className="p-2 bg-white rounded-lg hover:bg-gray-50 disabled:opacity-50 shadow-sm border border-gray-200"
                    title={editMode.description ? 'Save' : 'Edit'}
                  >
                    {editMode.description ? (
                      <CheckIcon className="w-5 h-5 text-green-600" />
                    ) : (
                      <PencilIcon className="w-5 h-5 text-orange-600" />
                    )}
                  </button>
                )}
              </div>
              {editMode.description ? (
                <AITextarea
                  value={editValues.description || ''}
                  onChange={(value) => setEditValues(prev => ({ ...prev, description: value }))}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe the project..."
                  rows={6}
                  aiContext="a project description"
                />
              ) : (
                <div className="prose max-w-none text-gray-700 whitespace-pre-wrap">
                  {project.description || 'No description provided.'}
                </div>
              )}
            </div>}
          </div>

          {/* Right Column - Location only (33% width) */}
          <div className="lg:col-span-1 space-y-6">
            {/* Location Details (merged card) */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <MapPinIcon className="w-6 h-6 text-orange-600" />
                  Location Details
                </h2>
                {isCreator && (
                  <button
                    onClick={() => {
                      if (activeLoc && orgDocId) {
                        setOrgLocEditForm({ ...activeLoc });
                        setOrgLocEditOpen(true);
                      } else {
                        setLocationModalOpen(true);
                      }
                    }}
                    disabled={saving}
                    className="p-2 bg-white rounded-lg hover:bg-gray-50 disabled:opacity-50 shadow-sm border border-gray-200"
                    title="Edit location"
                  >
                    <PencilIcon className="w-5 h-5 text-orange-600" />
                  </button>
                )}
              </div>
              {false ? (
                <div className="space-y-4">
                  {/* Location Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location Name</label>
                    <input
                      type="text"
                      value={editValues.locationName || ''}
                      onChange={(e) => setEditValues(prev => ({ ...prev, locationName: e.target.value }))}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                      placeholder="e.g., Community Center, Main Office..."
                    />
                  </div>
                  
                  {/* Location Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <AITextarea
                      value={editValues.locationDescription || ''}
                      onChange={(value) => setEditValues(prev => ({ ...prev, locationDescription: value }))}
                      className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500"
                      placeholder="Describe this location..."
                      rows={4}
                      aiContext="a project location description"
                    />
                  </div>

                  {/* Place Search */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Search by Place Name</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        id="placeSearch"
                        placeholder="e.g., Nairobi, Kenya or specific address..."
                        className="flex-1 min-w-0 p-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const input = e.currentTarget.value;
                            if (input.trim()) geocodeAddress(input);
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          const input = document.getElementById('placeSearch') as HTMLInputElement;
                          if (input?.value.trim()) geocodeAddress(input.value);
                        }}
                        disabled={geocoding}
                        className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium whitespace-nowrap flex-shrink-0"
                      >
                        {geocoding ? 'Searching...' : 'Search'}
                      </button>
                    </div>
                    {geocodeError && (
                      <p className="text-sm text-red-600 mt-1">{geocodeError}</p>
                    )}
                  </div>

                  {/* Interactive Map Picker */}
                  {editValues.location?.latitude && editValues.location?.longitude ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Drag Map to Position Pin on Location</label>
                      <InteractiveMapPicker
                        lat={editValues.location!.latitude!}
                        lng={editValues.location!.longitude!}
                        zoom={editValues.location!.zoom || 13}
                        onLocationChange={(lat, lng) => {
                          setEditValues(prev => ({
                            ...prev,
                            location: {
                              ...prev.location,
                              latitude: lat,
                              longitude: lng
                            }
                          }));
                        }}
                        onZoomChange={(zoom) => {
                          setEditValues(prev => ({
                            ...prev,
                            location: {
                              ...prev.location,
                              zoom: zoom
                            }
                          }));
                        }}
                      />
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                      <MapPinIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600 mb-4">No location set. Use the search above or click below to load the map.</p>
                      <button
                        onClick={() => {
                          // Set default location (center of Africa/Kenya)
                          setEditValues(prev => ({
                            ...prev,
                            location: {
                              ...prev.location,
                              latitude: -1.2921,
                              longitude: 36.8219,
                              zoom: 13
                            }
                          }));
                        }}
                        className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
                      >
                        Load Interactive Map
                      </button>
                    </div>
                  )}

                  {/* Manual GPS Coordinates - Only show if map is loaded */}
                  {editValues.location?.latitude && editValues.location?.longitude && (
                    <>
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-gray-300"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                          <span className="px-2 bg-white text-gray-500">Manual Coordinates</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                          <input
                            type="number"
                            step="any"
                            value={editValues.location?.latitude ?? ''}
                            onChange={(e) => setEditValues(prev => ({
                              ...prev,
                              location: {
                                ...prev.location,
                                latitude: e.target.value ? parseFloat(e.target.value) : undefined
                              }
                            }))}
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                            placeholder="e.g., -1.2921"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                          <input
                            type="number"
                            step="any"
                            value={editValues.location?.longitude ?? ''}
                            onChange={(e) => setEditValues(prev => ({
                              ...prev,
                              location: {
                                ...prev.location,
                                longitude: e.target.value ? parseFloat(e.target.value) : undefined
                              }
                            }))}
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                            placeholder="e.g., 36.8219"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Town & Country */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Town/City</label>
                      <input
                        type="text"
                        value={editValues.location?.town ?? ''}
                        onChange={(e) => setEditValues(prev => ({
                          ...prev,
                          location: {
                            ...prev.location,
                            town: e.target.value
                          }
                        }))}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                        placeholder="e.g., Nairobi"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                      <input
                        type="text"
                        value={editValues.location?.country ?? ''}
                        onChange={(e) => setEditValues(prev => ({
                          ...prev,
                          location: {
                            ...prev.location,
                            country: e.target.value
                          }
                        }))}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                        placeholder="e.g., Kenya"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Location Name & Description — prefer linked org location values */}
                  {(displayLocationName || displayLocationDescription) && (
                    <div className="space-y-2">
                      {displayLocationName && (
                        <div className="text-lg font-semibold text-gray-900">
                          {displayLocationName}
                        </div>
                      )}
                      {displayLocationDescription && (
                        <div className="prose max-w-none text-gray-700 whitespace-pre-wrap text-sm">
                          {displayLocationDescription}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Map Display — prefer linked org location coords */}
                  {displayMapParams ? (
                    <>
                      <div className="rounded overflow-hidden border">
                        <MapPreview lat={displayMapParams.lat} lng={displayMapParams.lng} zoom={displayMapParams.zoom} />
                      </div>
                      {/* Location Text Below Map */}
                      {(displayTown || displayCountry) && (
                        <div className="space-y-1">
                          {displayTown && (
                            <div className="text-gray-700 font-medium">{displayTown}</div>
                          )}
                          {displayCountry && (
                            <div className="text-gray-600">{displayCountry}</div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    /* Fallback: show text only if no map available */
                    <>
                      {(displayTown || displayCountry) ? (
                        <div className="space-y-1">
                          {displayTown && (
                            <div className="text-gray-700 font-medium">{displayTown}</div>
                          )}
                          {displayCountry && (
                            <div className="text-gray-600">{displayCountry}</div>
                          )}
                          <p className="text-sm text-gray-500 italic mt-2">
                            {isCreator ? 'Click Edit to add GPS coordinates for map display' : 'Map not available'}
                          </p>
                        </div>
                      ) : (
                        <div className="text-gray-500">{isCreator ? 'Click Edit to add location details' : 'Location not specified'}</div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Our Proposed Project Heading - Full Width Transparent - always visible */}
        <div className="bg-transparent pr-6 pt-0 pb-0">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-3xl font-light text-black">
              {editMode.projectHeading ? (
                <input
                  type="text"
                  value={editValues.projectHeading || 'Our Proposed Project'}
                  onChange={(e) => setEditValues(prev => ({ ...prev, projectHeading: e.target.value }))}
                  className="w-full bg-transparent border-b-2 border-gray-300 focus:border-orange-500 focus:outline-none font-light"
                  placeholder="Our Proposed Project"
                />
              ) : (
                project.projectHeading || 'Our Proposed Project'
              )}
            </h2>
            {isCreator && (
              <button
                onClick={() => editMode.projectHeading ? saveSection('projectHeading', ['projectHeading']) : toggleEditMode('projectHeading')}
                disabled={saving}
                className="p-2 bg-white rounded-lg hover:bg-gray-50 disabled:opacity-50 shadow-sm border border-gray-200"
                title={editMode.projectHeading ? 'Save' : 'Edit'}
              >
                {editMode.projectHeading ? (
                  <CheckIcon className="w-5 h-5 text-green-600" />
                ) : (
                  <PencilIcon className="w-5 h-5 text-orange-600" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Project Details & Budget - 2 Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left Column - Project Name, Summary, Impact, Other Details (67%) */}
          <div className="lg:col-span-2 space-y-6">

            {/* Project Overview Card */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <DocumentTextIcon className="w-6 h-6 text-orange-600" />
                  Project Overview
                </h2>
                {isCreator && (
                  <button
                    onClick={() => editMode.projectName ? saveSection('projectName', ['name', 'strapline', 'description']) : toggleEditMode('projectName')}
                    disabled={saving}
                    className="p-2 bg-white rounded-lg hover:bg-gray-50 disabled:opacity-50 shadow-sm border border-gray-200"
                    title={editMode.projectName ? 'Save' : 'Edit'}
                  >
                    {editMode.projectName ? (
                      <CheckIcon className="w-5 h-5 text-green-600" />
                    ) : (
                      <PencilIcon className="w-5 h-5 text-orange-600" />
                    )}
                  </button>
                )}
              </div>
              {editMode.projectName ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editValues.name || ''}
                    onChange={(e) => setEditValues(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 text-2xl font-semibold"
                    placeholder="Project name..."
                  />
                  <input
                    type="text"
                    value={editValues.strapline || ''}
                    onChange={(e) => setEditValues(prev => ({ ...prev, strapline: e.target.value }))}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 text-base font-semibold"
                    placeholder="One-line summary of what will be funded, e.g. Building a 3 Bedroom House for Staff & Visitors"
                  />
                  <textarea
                    value={editValues.description || ''}
                    onChange={(e) => setEditValues(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="Short project description..."
                    rows={3}
                  />
                </div>
              ) : (
                <div>
                  <div className="text-2xl font-semibold text-gray-900">{project.name}</div>
                  {project.strapline && (
                    <p className="mt-2 text-base font-semibold text-gray-800">{project.strapline}</p>
                  )}
                  {project.description && (
                    <p className="mt-2 text-gray-600 leading-relaxed">{project.description}</p>
                  )}
                </div>
              )}
            </div>

            {/* Project Summary */}
            {(project.projectSummary || isCreator) && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <DocumentTextIcon className="w-6 h-6 text-orange-600" />
                    Project Summary
                  </h2>
                  {isCreator && (
                    <button
                      onClick={() => editMode.projectSummary ? saveSection('projectSummary', ['projectSummary']) : toggleEditMode('projectSummary')}
                      disabled={saving}
                      className="p-2 bg-white rounded-lg hover:bg-gray-50 disabled:opacity-50 shadow-sm border border-gray-200"
                      title={editMode.projectSummary ? 'Save' : 'Edit'}
                    >
                      {editMode.projectSummary ? (
                        <CheckIcon className="w-5 h-5 text-green-600" />
                      ) : (
                        <PencilIcon className="w-5 h-5 text-orange-600" />
                      )}
                    </button>
                  )}
                </div>
                {editMode.projectSummary ? (
                  <AITextarea
                    value={editValues.projectSummary || ''}
                    onChange={(value) => setEditValues(prev => ({ ...prev, projectSummary: value }))}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="Summarise the project..."
                    rows={5}
                    aiContext="a project summary"
                  />
                ) : (
                  <div className="prose max-w-none text-gray-700 whitespace-pre-wrap">
                    {project.projectSummary || (isCreator ? 'Click Edit to add a project summary' : '')}
                  </div>
                )}
              </div>
            )}

            {/* Project Impact */}
            {(project.projectImpact || (project.impactItems && project.impactItems.length > 0) || isCreator) && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <LightBulbIcon className="w-6 h-6 text-orange-600" />
                    Project Impact
                  </h2>
                  {isCreator && (
                    <button
                      onClick={() => editMode.projectImpact ? saveSection('projectImpact', ['projectImpact', 'impactItems']) : toggleEditMode('projectImpact')}
                      disabled={saving}
                      className="p-2 bg-white rounded-lg hover:bg-gray-50 disabled:opacity-50 shadow-sm border border-gray-200"
                      title={editMode.projectImpact ? 'Save' : 'Edit'}
                    >
                      {editMode.projectImpact ? (
                        <CheckIcon className="w-5 h-5 text-green-600" />
                      ) : (
                        <PencilIcon className="w-5 h-5 text-orange-600" />
                      )}
                    </button>
                  )}
                </div>

                {editMode.projectImpact ? (
                  <div className="space-y-5">
                    {/* Intro text */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Introduction</label>
                      <AITextarea
                        value={editValues.projectImpact || ''}
                        onChange={(value) => setEditValues(prev => ({ ...prev, projectImpact: value }))}
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500"
                        placeholder="Write a short overview of the expected impact…"
                        rows={3}
                        aiContext="a project impact introduction"
                      />
                    </div>

                    {/* Impact items list */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Impact Points</label>
                      <div className="space-y-2 mb-3">
                        {(editValues.impactItems || []).map((item: string, i: number) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />
                            <input
                              type="text"
                              value={item}
                              onChange={(e) => {
                                const updated = [...(editValues.impactItems || [])];
                                updated[i] = e.target.value;
                                setEditValues(prev => ({ ...prev, impactItems: updated }));
                              }}
                              className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
                            />
                            <button
                              onClick={() => {
                                const updated = (editValues.impactItems || []).filter((_: string, j: number) => j !== i);
                                setEditValues(prev => ({ ...prev, impactItems: updated }));
                              }}
                              className="p-1 text-red-400 hover:text-red-600 flex-shrink-0"
                              title="Remove"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                      {/* Add new item */}
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" />
                        <input
                          type="text"
                          value={newImpactItem}
                          onChange={(e) => setNewImpactItem(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newImpactItem.trim()) {
                              setEditValues(prev => ({ ...prev, impactItems: [...(prev.impactItems || []), newImpactItem.trim()] }));
                              setNewImpactItem('');
                            }
                          }}
                          placeholder="Add impact point and press Enter…"
                          className="flex-1 px-3 py-1.5 text-sm border border-dashed border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50"
                        />
                        <button
                          onClick={() => {
                            if (!newImpactItem.trim()) return;
                            setEditValues(prev => ({ ...prev, impactItems: [...(prev.impactItems || []), newImpactItem.trim()] }));
                            setNewImpactItem('');
                          }}
                          className="px-3 py-1.5 text-sm rounded-lg bg-orange-50 border border-orange-200 text-orange-700 font-medium hover:bg-orange-100 transition"
                        >
                          + Add
                        </button>
                      </div>
                      {/* AI Generate Impact Points */}
                      <button
                        type="button"
                        disabled={generatingImpactItems}
                        onClick={async () => {
                          setGeneratingImpactItems(true);
                          try {
                            const context = [
                              project.name ? `Project: ${project.name}` : '',
                              project.description ? `Description: ${project.description}` : '',
                              project.projectImpact ? `Impact overview: ${project.projectImpact}` : '',
                              project.projectSummary ? `Summary: ${project.projectSummary}` : '',
                            ].filter(Boolean).join('. ');
                            const existing = editValues.impactItems || [];
                            const count = Math.max(3, 5 - existing.length);
                            const generated = await generateListWithAI(
                              `specific impact points describing how this project benefits the community: ${context}`,
                              existing,
                              count
                            );
                            setEditValues(prev => ({ ...prev, impactItems: [...(prev.impactItems || []), ...generated] }));
                          } catch (err: any) {
                            alert(err.message || 'Failed to generate impact points');
                          } finally {
                            setGeneratingImpactItems(false);
                          }
                        }}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 text-white text-sm font-medium hover:from-purple-600 hover:to-blue-600 transition disabled:opacity-50"
                      >
                        {generatingImpactItems ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <SparklesIcon className="w-4 h-4" />
                        )}
                        {generatingImpactItems ? 'Generating…' : 'Generate Impact Points with AI'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {project.projectImpact && (
                      <p className="text-gray-700 whitespace-pre-wrap">{project.projectImpact}</p>
                    )}
                    {project.impactItems && project.impactItems.length > 0 && (
                      <ul className="space-y-2">
                        {project.impactItems.map((item, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <span className="mt-1 w-4 h-4 rounded-full border-2 border-orange-400 flex items-center justify-center flex-shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                            </span>
                            <span className="text-gray-700">{item}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {!project.projectImpact && (!project.impactItems || project.impactItems.length === 0) && isCreator && (
                      <p className="text-gray-400 text-sm">Click Edit to add project impact</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Project Goals */}
            {(project.goals && project.goals.length > 0 || isCreator) && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <CheckCircleIcon className="w-6 h-6 text-orange-600" />
                    Project Goals
                  </h2>
                  {isCreator && (
                    <button
                      onClick={() => editMode.goals ? saveSection('goals', ['goals']) : toggleEditMode('goals')}
                      disabled={saving}
                      className="p-2 bg-white rounded-lg hover:bg-gray-50 disabled:opacity-50 shadow-sm border border-gray-200"
                      title={editMode.goals ? 'Save' : 'Edit'}
                    >
                      {editMode.goals ? (
                        <CheckIcon className="w-5 h-5 text-green-600" />
                      ) : (
                        <PencilIcon className="w-5 h-5 text-orange-600" />
                      )}
                    </button>
                  )}
                </div>

                {editMode.goals ? (
                  <div className="space-y-4">
                    <div className="space-y-2 mb-3">
                      {(editValues.goals || []).map((goal: string, i: number) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                          <input
                            type="text"
                            value={goal}
                            onChange={(e) => {
                              const updated = [...(editValues.goals || [])];
                              updated[i] = e.target.value;
                              setEditValues(prev => ({ ...prev, goals: updated }));
                            }}
                            className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
                          />
                          <button
                            onClick={() => {
                              const updated = (editValues.goals || []).filter((_: string, j: number) => j !== i);
                              setEditValues(prev => ({ ...prev, goals: updated }));
                            }}
                            className="p-1 text-red-400 hover:text-red-600 flex-shrink-0"
                            title="Remove"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    {/* Add new goal */}
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-xs font-bold flex-shrink-0">{(editValues.goals || []).length + 1}</span>
                      <input
                        type="text"
                        value={newGoalItem}
                        onChange={(e) => setNewGoalItem(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newGoalItem.trim()) {
                            setEditValues(prev => ({ ...prev, goals: [...(prev.goals || []), newGoalItem.trim()] }));
                            setNewGoalItem('');
                          }
                        }}
                        placeholder="Add a goal and press Enter…"
                        className="flex-1 px-3 py-1.5 text-sm border border-dashed border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50"
                      />
                      <button
                        onClick={() => {
                          if (!newGoalItem.trim()) return;
                          setEditValues(prev => ({ ...prev, goals: [...(prev.goals || []), newGoalItem.trim()] }));
                          setNewGoalItem('');
                        }}
                        className="px-3 py-1.5 text-sm rounded-lg bg-orange-50 border border-orange-200 text-orange-700 font-medium hover:bg-orange-100 transition"
                      >
                        + Add
                      </button>
                    </div>
                    {/* AI Generate Goals */}
                    <button
                      type="button"
                      disabled={generatingGoals}
                      onClick={async () => {
                        setGeneratingGoals(true);
                        try {
                          const context = [
                            project.name ? `Project: ${project.name}` : '',
                            project.description ? `Description: ${project.description}` : '',
                            project.projectSummary ? `Summary: ${project.projectSummary}` : '',
                            project.projectImpact ? `Impact: ${project.projectImpact}` : '',
                          ].filter(Boolean).join('. ');
                          const existing = editValues.goals || [];
                          const count = Math.max(3, 5 - existing.length);
                          const generated = await generateListWithAI(
                            `project goals/key objectives based on this project: ${context}`,
                            existing,
                            count
                          );
                          setEditValues(prev => ({ ...prev, goals: [...(prev.goals || []), ...generated] }));
                        } catch (err: any) {
                          alert(err.message || 'Failed to generate goals');
                        } finally {
                          setGeneratingGoals(false);
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 text-white text-sm font-medium hover:from-purple-600 hover:to-blue-600 transition disabled:opacity-50"
                    >
                      {generatingGoals ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <SparklesIcon className="w-4 h-4" />
                      )}
                      {generatingGoals ? 'Generating…' : 'Generate Goals with AI'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {project.goals && project.goals.length > 0 ? (
                      <ol className="space-y-2">
                        {project.goals.map((goal, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <span className="mt-0.5 w-5 h-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                            <span className="text-gray-700">{goal}</span>
                          </li>
                        ))}
                      </ol>
                    ) : isCreator ? (
                      <p className="text-gray-400 text-sm">Click Edit to add project goals</p>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            {/* People Involved */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <UsersIcon className="w-6 h-6 text-orange-600" />
                  People Involved
                </h2>
                {isCreator && (
                  <button
                    onClick={() => editMode.people ? saveSection('people', ['peopleInvolved']) : toggleEditMode('people')}
                    disabled={saving}
                    className="p-2 bg-white rounded-lg hover:bg-gray-50 disabled:opacity-50 shadow-sm border border-gray-200"
                    title={editMode.people ? 'Save' : 'Edit'}
                  >
                    {editMode.people ? (
                      <CheckIcon className="w-5 h-5 text-green-600" />
                    ) : (
                      <PencilIcon className="w-5 h-5 text-orange-600" />
                    )}
                  </button>
                )}
              </div>

              {/* Hidden file input for person photo upload */}
              <input
                ref={personPhotoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && personPhotoTargetIndex !== null) {
                    handlePersonPhotoUpload(file, personPhotoTargetIndex);
                  }
                  e.target.value = '';
                }}
              />

              {editMode.people ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(editValues.peopleInvolved || []).map((person: any, index: number) => (
                      <div key={index} className="relative flex flex-col items-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <button
                          onClick={() => {
                            const newPeople = (editValues.peopleInvolved || []).filter((_: any, i: number) => i !== index);
                            setEditValues(prev => ({ ...prev, peopleInvolved: newPeople }));
                          }}
                          className="absolute top-2 right-2 p-1 text-red-600 hover:bg-red-50 rounded-full transition-colors"
                          title="Remove person"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                        {/* Clickable avatar for photo upload */}
                        <button
                          type="button"
                          onClick={() => {
                            setPersonPhotoTargetIndex(index);
                            personPhotoInputRef.current?.click();
                          }}
                          className="relative w-20 h-20 rounded-full overflow-hidden mb-3 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500"
                          title="Click to upload photo"
                        >
                          {uploadingPersonPhoto === index ? (
                            <div className="w-full h-full bg-orange-100 flex items-center justify-center">
                              <svg className="w-6 h-6 text-orange-500 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                            </div>
                          ) : person.photoURL ? (
                            <>
                              <img src={person.photoURL} alt={person.name || ''} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <PhotoIcon className="w-6 h-6 text-white" />
                              </div>
                            </>
                          ) : (
                            <div className="w-full h-full bg-orange-100 flex items-center justify-center relative">
                              <span className="text-2xl font-semibold text-orange-600">
                                {person.name?.charAt(0)?.toUpperCase() || '?'}
                              </span>
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <PhotoIcon className="w-6 h-6 text-white" />
                              </div>
                            </div>
                          )}
                        </button>
                        {person.uid && (
                          <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full mb-1.5">Linked User</span>
                        )}
                        <input
                          type="text"
                          value={person.name || ''}
                          onChange={(e) => {
                            const newPeople = [...(editValues.peopleInvolved || [])];
                            newPeople[index] = { ...newPeople[index], name: e.target.value };
                            setEditValues(prev => ({ ...prev, peopleInvolved: newPeople }));
                          }}
                          className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500 text-center mb-2"
                          placeholder="Name"
                        />
                        <input
                          type="text"
                          value={person.role || ''}
                          onChange={(e) => {
                            const newPeople = [...(editValues.peopleInvolved || [])];
                            newPeople[index] = { ...newPeople[index], role: e.target.value };
                            setEditValues(prev => ({ ...prev, peopleInvolved: newPeople }));
                          }}
                          className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500 text-center text-sm"
                          placeholder="Role"
                        />
                      </div>
                    ))}
                    {/* Add Person manually */}
                    <button
                      onClick={() => {
                        const newPeople = [...(editValues.peopleInvolved || []), { name: '', role: '', type: 'manual' }];
                        setEditValues(prev => ({ ...prev, peopleInvolved: newPeople }));
                      }}
                      className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-orange-500 hover:text-orange-600 hover:bg-orange-50 transition-colors min-h-[200px]"
                    >
                      <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span className="text-sm font-medium">Add Person</span>
                    </button>
                  </div>

                  {/* Add from Organization */}
                  {orgTeamMembers.length > 0 && (
                    <div className="mt-4">
                      <button
                        onClick={() => setShowOrgMemberPicker(prev => !prev)}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors"
                      >
                        <BuildingOfficeIcon className="w-4 h-4" />
                        {showOrgMemberPicker ? 'Hide Organisation Members' : 'Add from Organisation'}
                      </button>
                      {showOrgMemberPicker && (
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {orgTeamMembers
                            .filter(member => {
                              // Hide members already added
                              const existing = editValues.peopleInvolved || [];
                              return !existing.some((p: any) =>
                                (member.uid && p.uid === member.uid) ||
                                (member.email && p.email === member.email)
                              );
                            })
                            .map((member, idx) => {
                              const displayName = [member.name, member.surname].filter(Boolean).join(' ') || member.email || 'Unknown';
                              return (
                                <button
                                  key={idx}
                                  onClick={() => {
                                    const newPerson: any = {
                                      name: displayName,
                                      role: member.role || '',
                                      type: 'user',
                                      uid: member.uid || undefined,
                                      email: member.email || undefined,
                                      photoURL: member.photoURL || undefined,
                                    };
                                    const newPeople = [...(editValues.peopleInvolved || []), newPerson];
                                    setEditValues(prev => ({ ...prev, peopleInvolved: newPeople }));
                                  }}
                                  className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-orange-400 hover:bg-orange-50 transition-colors text-left"
                                >
                                  <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                                    {member.photoURL ? (
                                      <img src={member.photoURL} alt={displayName} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full bg-orange-100 flex items-center justify-center">
                                        <span className="text-sm font-semibold text-orange-600">
                                          {displayName.charAt(0).toUpperCase()}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="font-medium text-gray-900 text-sm truncate">{displayName}</div>
                                    {member.role && <div className="text-xs text-gray-500 truncate">{member.role}</div>}
                                  </div>
                                  <svg className="w-5 h-5 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                </button>
                              );
                            })}
                          {orgTeamMembers.filter(member => {
                            const existing = editValues.peopleInvolved || [];
                            return !existing.some((p: any) =>
                              (member.uid && p.uid === member.uid) ||
                              (member.email && p.email === member.email)
                            );
                          }).length === 0 && (
                            <p className="col-span-full text-sm text-gray-500 italic py-2">All organisation members have been added</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {project.peopleInvolved && project.peopleInvolved.length > 0 ? (
                    project.peopleInvolved.map((person: any, index: number) => (
                      <div key={index} className="flex flex-col items-center p-4 bg-gray-50 rounded-lg">
                        <div className="w-20 h-20 rounded-full overflow-hidden mb-3">
                          {person.photoURL ? (
                            <img src={person.photoURL} alt={person.name || ''} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-orange-100 flex items-center justify-center">
                              <span className="text-2xl font-semibold text-orange-600">
                                {person.name?.charAt(0)?.toUpperCase() || '?'}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-gray-900 mb-1">{person.name || 'Unknown'}</div>
                          <div className="text-sm text-gray-600">{person.role || 'No role specified'}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="col-span-full text-sm text-gray-500 italic text-center py-4">
                      {isCreator ? 'Click Edit to add people' : 'No people listed yet'}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Other Details */}
            {(project.otherDetails?.trim() || isCreator) && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <InformationCircleIcon className="w-6 h-6 text-orange-600" />
                    Other Details
                  </h2>
                  {isCreator && (
                    <button
                      onClick={() => editMode.otherDetails ? saveSection('otherDetails', ['otherDetails']) : toggleEditMode('otherDetails')}
                      disabled={saving}
                      className="p-2 bg-white rounded-lg hover:bg-gray-50 disabled:opacity-50 shadow-sm border border-gray-200"
                      title={editMode.otherDetails ? 'Save' : 'Edit'}
                    >
                      {editMode.otherDetails ? (
                        <CheckIcon className="w-5 h-5 text-green-600" />
                      ) : (
                        <PencilIcon className="w-5 h-5 text-orange-600" />
                      )}
                    </button>
                  )}
                </div>
                {editMode.otherDetails ? (
                  <AITextarea
                    value={editValues.otherDetails || ''}
                    onChange={(value) => setEditValues(prev => ({ ...prev, otherDetails: value }))}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="Additional details..."
                    rows={5}
                    aiContext="additional project details"
                  />
                ) : (
                  <div className="prose max-w-none text-gray-700 whitespace-pre-wrap">
                    {project.otherDetails || (isCreator ? 'Click Edit to add other details' : '')}
                  </div>
                )}
              </div>
            )}

            {/* Photo Gallery */}
            {((project.galleryImages && project.galleryImages.length > 0) || isCreator) && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <PhotoIcon className="w-6 h-6 text-orange-600" />
                    Photo Gallery
                  </h2>
                  {isCreator && (
                    <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 border border-orange-200 text-orange-700 text-sm font-medium cursor-pointer hover:bg-orange-100 transition ${
                      uploadingGallery ? 'opacity-50 pointer-events-none' : ''
                    }`}>
                      <ArrowUpTrayIcon className="w-4 h-4" />
                      {uploadingGallery ? 'Uploading…' : '+ Add Photos'}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        disabled={uploadingGallery}
                        onChange={async (e) => {
                          const files = Array.from(e.target.files || []);
                          if (!files.length || !resolvedDocId) return;
                          setUploadingGallery(true);
                          try {
                            const urls: string[] = [];
                            for (const file of files) {
                              const resized = await resizeImageFile(file, IMAGE_MAX_BANNER);
                              const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                              const sRef = storageRef(storage, `projects/${resolvedDocId}/gallery/${Date.now()}_${safeName}`);
                              await uploadBytes(sRef, resized, { contentType: resized.type, cacheControl: 'public, max-age=31536000' });
                              urls.push(await getDownloadURL(sRef));
                            }
                            await updateProject(resolvedDocId, { galleryImages: fieldArrayUnion(...urls) } as any);
                            setProject(prev => prev ? { ...prev, galleryImages: [...(prev.galleryImages || []), ...urls] } : null);
                          } catch (err: any) {
                            alert('Failed to upload: ' + err.message);
                          } finally {
                            setUploadingGallery(false);
                            e.target.value = '';
                          }
                        }}
                      />
                    </label>
                  )}
                </div>
                {(!project.galleryImages || project.galleryImages.length === 0) ? (
                  <div className="text-center py-6 text-gray-400">
                    <PhotoIcon className="w-10 h-10 mx-auto mb-2" />
                    <p className="text-sm">No photos yet. Click + Add Photos to upload.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {project.galleryImages.map((url, i) => (
                      <div key={i} className="relative group aspect-square">
                        <NextImage
                          fill
                          src={url}
                          alt={`Gallery ${i + 1}`}
                          sizes="(max-width: 768px) 33vw, 20vw"
                          style={{ objectFit: 'cover' }}
                          className="rounded-lg cursor-pointer hover:opacity-90 transition"
                          onClick={() => setLightboxIndex(i)}
                        />
                        {isCreator && (
                          <button
                            onClick={async (ev) => {
                              ev.stopPropagation();
                              if (!resolvedDocId || !confirm('Remove this photo?')) return;
                              await updateProject(resolvedDocId, { galleryImages: fieldArrayRemove(url) } as any);
                              setProject(prev => prev ? { ...prev, galleryImages: prev.galleryImages?.filter((_, j) => j !== i) } : null);
                            }}
                            className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"
                            title="Remove"
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Right Column - Budget + Timeline (33%) */}
          <div className="lg:col-span-1 space-y-6">

            {/* Cover Photo Card */}
            {(project.coverPhotoUrl || isCreator) && (
              isCreator ? (
                /* Edit mode: title + upload button */
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <PhotoIcon className="w-6 h-6 text-orange-600" />
                      Cover Photo
                    </h2>
                  </div>
                  {project.coverPhotoUrl ? (
                    <div className="relative group mb-3 h-40">
                      <NextImage
                        fill
                        src={project.coverPhotoUrl}
                        alt="Cover"
                        sizes="(max-width: 1024px) 100vw, 33vw"
                        style={{ objectFit: 'cover' }}
                        className="rounded-lg"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-40 bg-gray-100 rounded-lg flex items-center justify-center mb-3 border-2 border-dashed border-gray-300">
                      <div className="text-center text-gray-400">
                        <PhotoIcon className="w-10 h-10 mx-auto mb-1" />
                        <span className="text-sm">No cover photo yet</span>
                      </div>
                    </div>
                  )}
                  <label className={`flex items-center justify-center gap-2 w-full py-2 px-4 rounded-lg border-2 border-orange-300 text-orange-700 font-medium text-sm cursor-pointer hover:bg-orange-50 transition ${
                    uploadingCover ? 'opacity-50 pointer-events-none' : ''
                  }`}>
                    <PhotoIcon className="w-4 h-4" />
                    {uploadingCover ? 'Uploading…' : project.coverPhotoUrl ? 'Change Photo' : 'Upload Photo'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingCover}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !resolvedDocId) return;
                        setUploadingCover(true);
                        try {
                          const resized = await resizeImageFile(file, IMAGE_MAX_BANNER);
                          const ext = file.name.split('.').pop();
                          const sRef = storageRef(storage, `projects/${resolvedDocId}/coverPhoto.${ext}`);
                          await uploadBytes(sRef, resized, { contentType: resized.type, cacheControl: 'public, max-age=31536000' });
                          const url = await getDownloadURL(sRef);
                          await updateProject(resolvedDocId, { coverPhotoUrl: url } as any);
                          setProject(prev => prev ? { ...prev, coverPhotoUrl: url } : null);
                        } catch (err: any) {
                          alert('Failed to upload photo: ' + err.message);
                        } finally {
                          setUploadingCover(false);
                          e.target.value = '';
                        }
                      }}
                    />
                  </label>
                </div>
              ) : (
                /* View mode: image fills card with 5px padding, no title */
                project.coverPhotoUrl ? (
                  <div className="bg-white rounded-lg shadow-md" style={{ padding: 5 }}>
                    <NextImage
                      src={project.coverPhotoUrl}
                      alt="Cover"
                      width={400}
                      height={267}
                      sizes="(max-width: 1024px) 100vw, 33vw"
                      className="w-full h-auto rounded-md"
                    />
                  </div>
                ) : null
              )
            )}

            {/* Budget Card */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <CurrencyDollarIcon className="w-6 h-6 text-orange-600" />
                  Fundraising Target
                </h2>
                {isCreator && (
                  <button
                    onClick={() => editMode.budget ? saveSection('budget', ['totalBudget', 'amountPledged', 'amountRaised', 'currency', 'beneficiaries', 'matchedFundingNote', 'seekingMultiplePartners']) : toggleEditMode('budget')}
                    disabled={saving}
                    className="p-2 bg-white rounded-lg hover:bg-gray-50 disabled:opacity-50 shadow-sm border border-gray-200"
                    title={editMode.budget ? 'Save' : 'Edit'}
                  >
                    {editMode.budget ? (
                      <CheckIcon className="w-5 h-5 text-green-600" />
                    ) : (
                      <PencilIcon className="w-5 h-5 text-orange-600" />
                    )}
                  </button>
                )}
              </div>
              {editMode.budget ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Total Budget</label>
                    <input
                      type="number"
                      value={editValues.totalBudget || ''}
                      onChange={(e) => setEditValues(prev => ({ ...prev, totalBudget: Number(e.target.value) }))}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                      placeholder="Amount"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                    <select
                      value={editValues.currency || 'USD'}
                      onChange={(e) => setEditValues(prev => ({ ...prev, currency: e.target.value }))}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="KES">KES (KSh)</option>
                      <option value="MWK">MWK (MK)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount Pledged</label>
                    <input
                      type="number"
                      value={editValues.amountPledged ?? ''}
                      onChange={(e) => setEditValues(prev => ({ ...prev, amountPledged: e.target.value ? Number(e.target.value) : undefined }))}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                      placeholder="Amount pledged so far"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount Raised</label>
                    <input
                      type="number"
                      value={editValues.amountRaised ?? ''}
                      onChange={(e) => setEditValues(prev => ({ ...prev, amountRaised: e.target.value ? Number(e.target.value) : undefined }))}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                      placeholder="Amount actually received"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Beneficiaries</label>
                    <input
                      type="text"
                      value={editValues.beneficiaries || ''}
                      onChange={(e) => setEditValues(prev => ({ ...prev, beneficiaries: e.target.value }))}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                      placeholder="Who will benefit?"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Matched Funding Note <span className="text-gray-400 font-normal">(optional)</span></label>
                    <textarea
                      value={editValues.matchedFundingNote || ''}
                      onChange={(e) => setEditValues(prev => ({ ...prev, matchedFundingNote: e.target.value }))}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                      placeholder="e.g. We have the possibility of 2:1 matched funding from the Gates Foundation if we can secure the initial £10,000…"
                      rows={3}
                    />
                    <p className="mt-1 text-xs text-gray-400">Mention any matched funding opportunities from other donors or funding bodies.</p>
                  </div>
                  <div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!editValues.seekingMultiplePartners}
                        onChange={(e) => setEditValues(prev => ({ ...prev, seekingMultiplePartners: e.target.checked }))}
                        className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-700">Seeking Multiple Partners</span>
                        <p className="text-xs text-gray-400">Show that this project is open to funding from multiple donors or partners.</p>
                      </div>
                    </label>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-3xl font-bold text-gray-900 mb-4">
                    {project.totalBudget 
                      ? formatCurrency(project.totalBudget, project.currency || 'USD')
                      : 'Budget not set'}
                  </div>
                  {project.seekingMultiplePartners && (
                    <div className="mb-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-sm font-medium">
                      <UsersIcon className="w-4 h-4" />
                      Seeking Multiple Partners
                    </div>
                  )}
                  {/* Pledged & Raised rows */}
                  {(project.amountPledged || project.amountRaised) && (
                    <div className="space-y-3 pt-2 border-t">
                      {project.amountPledged ? (
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-500">Pledged</span>
                            <span className="font-semibold text-gray-800">{formatCurrency(project.amountPledged, project.currency || 'USD')}</span>
                          </div>
                          {project.totalBudget ? (
                            <div className="w-full bg-gray-100 rounded-full h-2">
                              <div
                                className="bg-orange-400 h-2 rounded-full transition-all"
                                style={{ width: `${Math.min(100, (project.amountPledged / project.totalBudget) * 100).toFixed(1)}%` }}
                              />
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      {project.amountRaised ? (
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-500">Raised</span>
                            <span className="font-semibold text-green-700">{formatCurrency(project.amountRaised, project.currency || 'USD')}</span>
                          </div>
                          {project.totalBudget ? (
                            <div className="w-full bg-gray-100 rounded-full h-2">
                              <div
                                className="bg-green-500 h-2 rounded-full transition-all"
                                style={{ width: `${Math.min(100, (project.amountRaised / project.totalBudget) * 100).toFixed(1)}%` }}
                              />
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  )}
                  {project.beneficiaries && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="text-sm text-gray-500">Beneficiaries</div>
                      <div className="text-gray-700">{project.beneficiaries}</div>
                    </div>
                  )}
                  {project.matchedFundingNote && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="text-sm text-gray-500 flex items-center gap-1.5 mb-1">
                        <span>💰</span> Matched Funding
                      </div>
                      <div className="text-gray-700 whitespace-pre-wrap text-sm bg-orange-50 rounded-lg px-3 py-2 border border-orange-100">{project.matchedFundingNote}</div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Compliance */}
            <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg shadow-md p-6 border-l-4 border-orange-600">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <CheckCircleIcon className="w-6 h-6 text-orange-600" />
                  Compliance
                </h2>
                {isCreator && (
                  <button
                    onClick={() => editMode.quickCheck ? saveSection('quickCheck', ['oversight', 'approved', 'safeguardingInPlace', 'financialAccountabilityInPlace']) : toggleEditMode('quickCheck')}
                    disabled={saving}
                    className="p-2 bg-white rounded-lg hover:bg-gray-50 disabled:opacity-50 shadow-sm border border-gray-200"
                    title={editMode.quickCheck ? 'Save' : 'Edit'}
                  >
                    {editMode.quickCheck ? (
                      <CheckIcon className="w-5 h-5 text-green-600" />
                    ) : (
                      <PencilIcon className="w-5 h-5 text-orange-600" />
                    )}
                  </button>
                )}
              </div>
              {editMode.quickCheck ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Oversight</label>
                    <input
                      type="text"
                      value={editValues.oversight || ''}
                      onChange={(e) => setEditValues(prev => ({ ...prev, oversight: e.target.value }))}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Who has oversight?"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="approved2" checked={editValues.approved || false}
                      onChange={(e) => setEditValues(prev => ({ ...prev, approved: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
                    <label htmlFor="approved2" className="text-sm font-medium text-gray-700">Approved</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="safeguarding2" checked={editValues.safeguardingInPlace || false}
                      onChange={(e) => setEditValues(prev => ({ ...prev, safeguardingInPlace: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
                    <label htmlFor="safeguarding2" className="text-sm font-medium text-gray-700">Safeguarding Process in Place</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="financial2" checked={editValues.financialAccountabilityInPlace || false}
                      onChange={(e) => setEditValues(prev => ({ ...prev, financialAccountabilityInPlace: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
                    <label htmlFor="financial2" className="text-sm font-medium text-gray-700">Financial Accountability in Place</label>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {project.oversight && (
                    <div className="flex items-start gap-2">
                      <div className="text-sm text-gray-500 font-medium min-w-[120px] flex-shrink-0">Oversight:</div>
                      <div className="text-gray-900 text-sm">{project.oversight}</div>
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <div className="text-sm text-gray-500 font-medium min-w-[120px] flex-shrink-0">Safeguarding:</div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {project.safeguardingInPlace ? (
                          <><CheckCircleIcon className="w-4 h-4 text-green-600" /><span className="text-green-700 font-medium text-sm">In Place</span></>
                        ) : (
                          <span className="text-gray-500 text-sm">Not Set</span>
                        )}
                      </div>
                      {project.safeguardingInPlace && orgSafeguardingUrl && (
                        <a
                          href={orgSafeguardingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-orange-700 underline hover:text-orange-900 font-medium"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          View Safeguarding Document
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="text-sm text-gray-500 font-medium min-w-[120px] flex-shrink-0">Financial:</div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {project.financialAccountabilityInPlace ? (
                          <><CheckCircleIcon className="w-4 h-4 text-green-600" /><span className="text-green-700 font-medium text-sm">In Place</span></>
                        ) : (
                          <span className="text-gray-500 text-sm">Not Set</span>
                        )}
                      </div>
                      {project.financialAccountabilityInPlace && orgLatestAuditReport && (
                        <a
                          href={orgLatestAuditReport.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-orange-700 underline hover:text-orange-900 font-medium"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          View Latest Audit Report{orgLatestAuditReport.year ? ` (${orgLatestAuditReport.year})` : ''}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Timeline Cards */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <CalendarIcon className="w-6 h-6 text-orange-600" />
                  Timeline
                </h2>
                {isCreator && (
                  <button
                    onClick={() => editMode.timeline ? saveSection('timeline', ['targetCompletionDate', 'projectDuration', 'projectDurationUnit']) : toggleEditMode('timeline')}
                    disabled={saving}
                    className="p-2 bg-white rounded-lg hover:bg-gray-50 disabled:opacity-50 shadow-sm border border-gray-200"
                    title={editMode.timeline ? 'Save' : 'Edit'}
                  >
                    {editMode.timeline ? (
                      <CheckIcon className="w-5 h-5 text-green-600" />
                    ) : (
                      <PencilIcon className="w-5 h-5 text-orange-600" />
                    )}
                  </button>
                )}
              </div>
              {editMode.timeline ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Target Completion Date</label>
                    <input
                      type="date"
                      value={editValues.targetCompletionDate || ''}
                      onChange={(e) => setEditValues(prev => ({ ...prev, targetCompletionDate: e.target.value }))}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expected Duration</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="1"
                        value={editValues.projectDuration ?? ''}
                        onChange={(e) => setEditValues(prev => ({ ...prev, projectDuration: e.target.value ? Number(e.target.value) : undefined }))}
                        className="flex-1 p-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                        placeholder="e.g. 6"
                      />
                      <select
                        value={editValues.projectDurationUnit || 'months'}
                        onChange={(e) => setEditValues(prev => ({ ...prev, projectDurationUnit: e.target.value }))}
                        className="p-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="weeks">Weeks</option>
                        <option value="months">Months</option>
                        <option value="years">Years</option>
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Target Completion Date Card */}
                  {(project.targetCompletionDate || isCreator) && (
                    <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
                      <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <CalendarIcon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Target Completion</div>
                        <div className="text-gray-900 font-semibold">
                          {project.targetCompletionDate
                            ? new Date(project.targetCompletionDate + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                            : (isCreator ? 'Click Edit to set' : 'Not set')}
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Duration Card */}
                  {(project.projectDuration || isCreator) && (
                    <div className="flex items-center gap-3 p-3 bg-black rounded-lg">
                      <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <ClockIcon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="text-xs text-white/70 font-medium uppercase tracking-wide">Expected Duration</div>
                        <div className="text-white font-semibold">
                          {project.projectDuration
                            ? `${project.projectDuration} ${(project.projectDurationUnit || 'months').charAt(0).toUpperCase() + (project.projectDurationUnit || 'months').slice(1)}`
                            : (isCreator ? 'Click Edit to set' : 'Not set')}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Key Documents Card */}
            {((project.keyDocuments && project.keyDocuments.length > 0) || isCreator) && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <DocumentIcon className="w-6 h-6 text-orange-600" />
                    Key Documents
                  </h2>
                  {isCreator && (
                    <button
                      onClick={() => setKeyDocsEditOpen(v => !v)}
                      className="p-1.5 rounded-lg text-gray-400 hover:bg-orange-50 hover:text-orange-600 transition"
                      title={keyDocsEditOpen ? 'Done editing' : 'Edit documents'}
                    >
                      {keyDocsEditOpen
                        ? <CheckIcon className="w-5 h-5" />
                        : <PencilIcon className="w-5 h-5" />}
                    </button>
                  )}
                </div>

                {(!project.keyDocuments || project.keyDocuments.length === 0) ? (
                  <p className="text-sm text-gray-400">No Documents Uploaded</p>
                ) : (
                  <div className="space-y-3">
                    {project.keyDocuments.map((d, i) => {
                      const isYouTube = d.type === 'youtube';
                      const isVideo = !isYouTube && d.type.startsWith('video/');
                      const isAudio = d.type.startsWith('audio/');
                      const removeDoc = async () => {
                        if (!resolvedDocId || !confirm(`Remove "${d.name}"?`)) return;
                        await updateProject(resolvedDocId, { keyDocuments: fieldArrayRemove(d) } as any);
                        setProject(prev => prev ? { ...prev, keyDocuments: prev.keyDocuments?.filter((_, j) => j !== i) } : null);
                      };
                      return (
                        <div key={i} className="rounded-lg border border-gray-100 overflow-hidden">
                          {isYouTube ? (
                            <div>
                              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                                <iframe
                                  src={d.url}
                                  title={d.name}
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                  className="absolute inset-0 w-full h-full rounded-t-lg"
                                />
                              </div>
                              <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
                                <div className="flex items-center gap-2 min-w-0">
                                  <FilmIcon className="w-4 h-4 text-red-500 flex-shrink-0" />
                                  <span className="text-sm text-gray-700 truncate">YouTube Video</span>
                                </div>
                                {keyDocsEditOpen && (
                                  <button onClick={removeDoc} className="ml-2 p-1 text-red-400 hover:text-red-600 flex-shrink-0" title="Remove">
                                    <TrashIcon className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : isVideo ? (
                            <div>
                              <video src={d.url} controls className="w-full rounded-t-lg bg-black" style={{ maxHeight: 200 }} />
                              <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
                                <div className="flex items-center gap-2 min-w-0">
                                  <FilmIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                  <span className="text-sm text-gray-700 truncate">{d.name}</span>
                                </div>
                                {keyDocsEditOpen && (
                                  <button onClick={removeDoc} className="ml-2 p-1 text-red-400 hover:text-red-600 flex-shrink-0" title="Remove">
                                    <TrashIcon className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : isAudio ? (
                            <div className="flex items-center gap-3 p-3 bg-gray-50">
                              <MusicalNoteIcon className="w-5 h-5 text-orange-500 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-700 truncate mb-1">{d.name}</div>
                                <audio src={d.url} controls className="w-full" style={{ height: 32 }} />
                              </div>
                              {keyDocsEditOpen && (
                                <button onClick={removeDoc} className="p-1 text-red-400 hover:text-red-600 flex-shrink-0" title="Remove">
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-3 p-3 hover:bg-gray-50 transition">
                              <DocumentTextIcon className="w-8 h-8 text-orange-500 flex-shrink-0" />
                              <a href={d.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-800 hover:text-orange-600 truncate">{d.name}</div>
                                {d.size && <div className="text-xs text-gray-400">{(d.size / 1024).toFixed(0)} KB</div>}
                              </a>
                              {keyDocsEditOpen && (
                                <button onClick={removeDoc} className="p-1 text-red-400 hover:text-red-600 flex-shrink-0" title="Remove">
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Edit form — only shown when editing */}
                {isCreator && keyDocsEditOpen && (
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                    {/* YouTube */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Add YouTube Video</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={ytInput}
                          onChange={(e) => setYtInput(e.target.value)}
                          placeholder="Paste YouTube URL…"
                          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
                        />
                        <button
                          onClick={async () => {
                            const id = getYouTubeId(ytInput.trim());
                            if (!id) { alert('Please enter a valid YouTube URL'); return; }
                            if (!resolvedDocId) return;
                            const newDoc: ProjectDocument = { name: `YouTube: ${ytInput.trim()}`, url: `https://www.youtube.com/embed/${id}`, type: 'youtube' };
                            await updateProject(resolvedDocId, { keyDocuments: fieldArrayUnion(newDoc) } as any);
                            setProject(prev => prev ? { ...prev, keyDocuments: [...(prev.keyDocuments || []), newDoc] } : null);
                            setYtInput('');
                          }}
                          className="px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-medium hover:bg-red-100 transition flex-shrink-0"
                        >
                          + Add
                        </button>
                      </div>
                    </div>
                    {/* File upload */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Upload File</label>
                      <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-50 border border-orange-200 text-orange-700 text-sm font-medium cursor-pointer hover:bg-orange-100 transition ${
                        uploadingDoc ? 'opacity-50 pointer-events-none' : ''
                      }`}>
                        <ArrowUpTrayIcon className="w-4 h-4" />
                        {uploadingDoc ? 'Uploading…' : 'Choose File'}
                        <input
                          type="file"
                          className="hidden"
                          disabled={uploadingDoc}
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.mp3,.mp4,.mov,.avi,.wav,.ogg,.webm,audio/*,video/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file || !resolvedDocId) return;
                            setUploadingDoc(true);
                            try {
                              const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                              const sRef = storageRef(storage, `projects/${resolvedDocId}/documents/${Date.now()}_${safeName}`);
                              await uploadBytes(sRef, file, { contentType: file.type });
                              const url = await getDownloadURL(sRef);
                              const newDoc: ProjectDocument = { name: file.name, url, type: file.type, size: file.size };
                              await updateProject(resolvedDocId, { keyDocuments: fieldArrayUnion(newDoc) } as any);
                              setProject(prev => prev ? { ...prev, keyDocuments: [...(prev.keyDocuments || []), newDoc] } : null);
                            } catch (err: any) {
                              alert('Failed to upload: ' + err.message);
                            } finally {
                              setUploadingDoc(false);
                              e.target.value = '';
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-gray-50 rounded-lg p-6 text-center border border-gray-200">
          <div className="text-sm text-gray-600">
            For more information about this project, please contact{' '}
            <span className="font-semibold text-gray-900">
              {project.organizationName || 'the project organisation'}
            </span>
          </div>
        </div>

        </div>
        {/* End Content Container */}

      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && project.galleryImages && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white"
            onClick={() => setLightboxIndex(null)}
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          {lightboxIndex > 0 && (
            <button
              className="absolute left-4 text-white/80 hover:text-white"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
            >
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
          )}
          <img
            key={lightboxIndex}
            src={project.galleryImages[lightboxIndex]}
            alt={`Gallery ${lightboxIndex + 1}`}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          {lightboxIndex < project.galleryImages.length - 1 && (
            <button
              className="absolute right-4 text-white/80 hover:text-white"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
            >
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          )}
          <div className="absolute bottom-4 text-white/60 text-sm">{lightboxIndex + 1} / {project.galleryImages.length}</div>
        </div>,
        document.body
      )}

      {locationModalOpen && project && (
        <LocationEditorModal
          initial={{
            locationId: project.locationId,
            locationName: project.locationName,
            locationDescription: project.locationDescription,
            location: project.location,
          }}
          saving={saving}
          orgLocations={orgLocations}
          onSave={async (vals) => {
            if (!resolvedDocId) return;
            setSaving(true);
            try {
              const updates: any = {
                locationId: vals.locationId ?? fieldDelete(),
                locationName: vals.locationName ?? fieldDelete(),
                locationDescription: vals.locationDescription ?? fieldDelete(),
                location: vals.location ?? fieldDelete(),
              };
              await updateProject(resolvedDocId, updates as any);
              setProject(prev => prev ? { ...prev, ...vals } : prev);
              setLocationModalOpen(false);
            } catch (err: any) {
              alert('Failed to save: ' + err.message);
            } finally {
              setSaving(false);
            }
          }}
          onClose={() => setLocationModalOpen(false)}
        />
      )}

      {/* Org Location Edit Modal — edits the org location directly so changes are shared */}
      {orgLocEditOpen && orgLocEditForm && orgDocId && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <MapPinIcon className="w-5 h-5 text-orange-600" />
                Edit Location: {orgLocEditForm.name}
              </h3>
              <button onClick={() => setOrgLocEditOpen(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location Name *</label>
                <input type="text" value={orgLocEditForm.name}
                  onChange={e => setOrgLocEditForm(p => p ? { ...p, name: e.target.value } : p)}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500" placeholder="Location name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Town / City</label>
                  <input type="text" value={orgLocEditForm.town || ''}
                    onChange={e => setOrgLocEditForm(p => p ? { ...p, town: e.target.value } : p)}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500" placeholder="e.g. Nairobi" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                  <input type="text" value={orgLocEditForm.country || ''}
                    onChange={e => setOrgLocEditForm(p => p ? { ...p, country: e.target.value } : p)}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500" placeholder="e.g. Kenya" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <AITextarea value={orgLocEditForm.description || ''}
                  onChange={v => setOrgLocEditForm(p => p ? { ...p, description: v } : p)}
                  rows={3} placeholder="Describe this location..." aiContext="a project location description" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Our Vision</label>
                <AITextarea value={orgLocEditForm.vision || ''}
                  onChange={v => setOrgLocEditForm(p => p ? { ...p, vision: v } : p)}
                  rows={2} placeholder="What does this location's work ultimately aim to achieve?" aiContext="a location vision statement for a project proposal" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">What We Do</label>
                <AITextarea value={orgLocEditForm.whatWeDo || ''}
                  onChange={v => setOrgLocEditForm(p => p ? { ...p, whatWeDo: v } : p)}
                  rows={3} placeholder="Describe the activities and work carried out at this location…" aiContext="a description of activities and work carried out at an organisation location" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                  <input type="number" step="any" value={orgLocEditForm.latitude ?? ''}
                    onChange={e => setOrgLocEditForm(p => p ? { ...p, latitude: e.target.value ? parseFloat(e.target.value) : undefined } : p)}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500" placeholder="e.g. -1.2921" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                  <input type="number" step="any" value={orgLocEditForm.longitude ?? ''}
                    onChange={e => setOrgLocEditForm(p => p ? { ...p, longitude: e.target.value ? parseFloat(e.target.value) : undefined } : p)}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500" placeholder="e.g. 36.8219" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t">
              <button onClick={() => setOrgLocEditOpen(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors">
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!orgLocEditForm?.name?.trim() || !orgDocId) return;
                  setOrgLocSaving(true);
                  try {
                    const oldLoc = orgLocations.find(l => l.id === orgLocEditForm.id);
                    if (oldLoc) await updateOrg(orgDocId, { locations: fieldArrayRemove(oldLoc) } as any);
                    const updated: OrgLocation = {
                      id: orgLocEditForm.id,
                      name: orgLocEditForm.name.trim(),
                      town: orgLocEditForm.town?.trim() || undefined,
                      country: orgLocEditForm.country?.trim() || undefined,
                      latitude: orgLocEditForm.latitude !== undefined ? Number(orgLocEditForm.latitude) : undefined,
                      longitude: orgLocEditForm.longitude !== undefined ? Number(orgLocEditForm.longitude) : undefined,
                      zoom: orgLocEditForm.zoom ?? 13,
                      description: orgLocEditForm.description?.trim() || undefined,
                      vision: orgLocEditForm.vision?.trim() || undefined,
                      whatWeDo: orgLocEditForm.whatWeDo?.trim() || undefined,
                    };
                    const clean: any = Object.fromEntries(Object.entries(updated).filter(([, v]) => v !== undefined));
                    await updateOrg(orgDocId, { locations: fieldArrayUnion(clean) } as any);
                    // Update local org locations state so UI reflects immediately
                    setOrgLocations(prev => prev.map(l => l.id === updated.id ? updated : l));
                    setOrgLocEditOpen(false);
                  } catch (err: any) {
                    alert('Failed to save: ' + (err.message || 'Unknown error'));
                  } finally {
                    setOrgLocSaving(false);
                  }
                }}
                disabled={orgLocSaving || !orgLocEditForm?.name?.trim()}
                className="px-4 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                {orgLocSaving ? 'Saving…' : 'Save Location'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {aiReviewModalOpen && project && resolvedDocId && (
        <ProjectAIReviewModal
          isOpen={aiReviewModalOpen}
          onClose={() => setAiReviewModalOpen(false)}
          projectId={resolvedDocId}
          currentData={{
            name: project.name,
            description: project.description,
            locationName: project.locationName,
            locationIntroduction: project.locationIntroduction,
            locationDescription: project.locationDescription,
            vision: project.vision,
            projectHeading: project.projectHeading,
            projectSummary: project.projectSummary,
            projectImpact: project.projectImpact,
            targetCompletionDate: project.targetCompletionDate,
            totalBudget: project.totalBudget,
            currency: project.currency,
            goals: project.goals,
            beneficiaries: project.beneficiaries,
            oversight: project.oversight,
            otherDetails: project.otherDetails
          }}
          onUpdate={(updatedData) => {
            // Refresh the project data
            setProject(prev => prev ? { ...prev, ...updatedData } : prev);
          }}
        />
      )}

      {project && resolvedDocId && (
        <BecomePartnerModal
          isOpen={partnerModalOpen}
          onClose={() => setPartnerModalOpen(false)}
          project={project}
          projectDocId={resolvedDocId}
          currentUser={currentUser}
        />
      )}

    </PageShell>
  );
}

export default function ProjectProposal() {
  return (
    <Suspense>
      <ProjectProposalInner />
    </Suspense>
  );
}
