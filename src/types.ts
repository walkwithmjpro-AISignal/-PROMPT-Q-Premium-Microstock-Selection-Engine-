export type ImagePipelineStatus =
  | 'queued'
  | 'prechecked'
  | 'ready_for_qc'
  | 'invalid'
  | 'too_small'
  | 'duplicate_file'
  | 'non_photorealistic'
  | 'qc_pass'
  | 'qc_fix'
  | 'rejected'
  | 'clustered'
  | 'hero'
  | 'alternate'
  | 'hold'
  | 'approved_now'
  | 'approved_backup'
  | 'metadata_ready'
  | 'exported';

export type AssetFamily = 
  | 'photorealistic_photo'
  | 'isolated_object'
  | 'vector_flat_graphic'
  | 'icon_sticker_sheet'
  | 'illustration_general'
  | 'line_art_minimal'
  | 'unknown';

export type CurationVerdict = 'APPROVED' | 'REVIEW' | 'REJECTED';
export type DuplicateRisk = 'very low' | 'low' | 'medium' | 'high' | 'very high';
export type QualityGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface VisualDescriptor {
  likelyWhiteBackground: boolean;
  likelyCenteredSubject: boolean;
  likelySheetLayout: boolean;
  likelyFlatGraphic: boolean;
  likelyIsolatedObject: boolean;
  likelyLineArt: boolean;
  brightnessProfile: 'dark' | 'mid' | 'bright';
  saturationProfile: 'muted' | 'vibrant' | 'neutral';
  edgeProfile: 'soft' | 'sharp' | 'complex';
  sharpnessProfile?: 'soft' | 'sharp' | 'complex' | 'very_sharp' | 'blurry';
  noiseProfile?: 'noisy' | 'clean' | 'grainy';
  clutterLevel?: 'high' | 'low' | 'medium';
  symmetryHint: boolean;
  negativeSpaceUsability: number; // 0-100
}

export interface UploadedImageItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  previewUrl: string;
  width: number | null;
  height: number | null;
  aspectRatio: number | null;
  fingerprint: string;
  status: ImagePipelineStatus;
  tags: string[];
  notes: string[];
  selected?: boolean;
  assetFamily?: AssetFamily;
  visualDescriptor?: VisualDescriptor;

  // Pipeline analysis fields
  dim?: string;
  qcScore?: number;
  sharp?: number;
  exp?: number;
  art?: number;
  comp?: number;
  safe?: number;
  real?: number;
  decision?: 'PASS' | 'FIX' | 'REJECT';
  role?: 'hero' | 'alt' | 'hold' | 'drop';
  finalScore?: number;
  bucket?: 'approved_now' | 'approved_backup' | 'fix_later' | 'rejected';
  uniqueness?: number;

  // CuratorPro-style curation fields
  grade?: QualityGrade;
  verdict?: CurationVerdict;
  duplicateRisk?: DuplicateRisk;
  originality?: number;
  actionItems?: string[];
  qualityFlags?: {
    pass: string[];
    warn: string[];
    fail: string[];
  };
  scores?: {
    composition: number;
    focus: number;
    exposure: number;
    noise: number;
    commercial: number;
    originality: number;
    technical: number;
  };
  platformSuitability?: {
    adobeStock: number;
    shutterstock: number;
  };

  // Prefilter fields
  prefilterReason?: string;
  isDuplicate?: boolean;
  isTooSmall?: boolean;
  isNonPhotorealistic?: boolean;
  prefilterNotes?: string[];

  // Anti Similar fields
  similarityScore?: number;
  uniquenessScore?: number;
  clusterId?: string;
  clusterRank?: number;
  heroRank?: number;
  visualSignature?: number[];
  filenameTokens?: string[];

  // Selector and Approval fields
  metadataPotential?: number;
  included?: boolean;
  excluded?: boolean;
  metaReady?: boolean;
  selectedForMetadata?: boolean;
  qcReviewLocked?: boolean;
  selectedAfterQC?: boolean;
  qcOverride?: boolean;
  qcReviewNote?: string[];
  qcNotes?: string[];
  analysisReady?: boolean;
  strictPass?: boolean;

  // Metadata and Export fields
  title?: string;
  exportFilename?: string;
  keywords?: string[];
  category?: string;
  safetyNote?: string;
  platformRecommendation?: string;
  approvalReason?: string;
  dailyBatch?: number;
  exportReady?: boolean;
}

export interface SimilarityCluster {
  id: string;
  items: UploadedImageItem[];
  avgSimilarity: number;
  heroId: string;
}

export type PipelineMode = 'strict_photorealistic' | 'all_strict';

export type MetadataJobStatus = 'idle' | 'running' | 'paused' | 'completed' | 'partial' | 'failed';
export type MetadataJobMode = 'preferred_only' | 'auto_failover' | 'local_only';
export type MetadataProvider = 'groq' | 'blackbox' | 'gemini' | 'local';
export type ProviderStatus = 'connected' | 'invalid' | 'missing' | 'quota_limited' | 'unavailable' | 'error';

export type QuotaGroupType = 'project_scope' | 'org_scope' | 'account_scope' | 'plan_scope' | 'unknown_scope';

export type AssetFormat =
  | 'Object'
  | 'Photorealistic'
  | 'Sticker'
  | 'Sticker - Grid 1x1'
  | 'Sticker - Grid 3x3'
  | 'Sticker - Grid 4x4'
  | 'Icon'
  | 'Icon - Grid 1x1'
  | 'Icon - Grid 3x3'
  | 'Icon - Grid 4x4'
  | 'Vector'
  | 'Vector - Grid 1x1'
  | 'Vector - Grid 2x2'
  | 'Vector - Grid 3x3'
  | 'Vector - Grid 4x4';

export type MarketPriority = 'US' | 'GB' | 'CA' | 'DE' | 'FR' | 'AU' | 'JP' | 'KR' | 'GLOBAL';

export interface CalendarEvent {
  id: string;
  dateStart: string; // MM-DD
  dateEnd: string; // MM-DD
  eventName: string;
  eventType: 'global holiday' | 'regional holiday' | 'world day' | 'seasonal event' | 'evergreen' | 'commercial shopping';
  regions: MarketPriority[];
  priorityScore: number;
  commercialStrength: number;
  assetFamilySuitability: AssetFormat[];
  notes: string;
  tags: string[];
}

export interface GeneratedPrompt {
  id: string;
  theme: string;
  dateRelevance: string;
  marketPriority: string;
  assetFormat: AssetFormat;
  promptTitle: string;
  mainPrompt: string;
  negativePrompt: string;
  commercialAngle: string;
  keywords: string[];
  priorityScore: number;
}


export interface QuotaIdentityGroup {
  id: string;
  provider: MetadataProvider;
  identityLabel: string;
  groupType: QuotaGroupType;
  enabled: boolean;
  cooldownUntil: string | null; // ISO string
  groupRateStatus: string; // e.g., 'Healthy', 'Limited', 'Quota Risk', 'Quota Limited', 'Unstable'
  dailyRequestLimit: number | null;
  minuteRequestLimit: number | null;
  dailyRequestUsed: number;
  minuteRequestUsed: number;
  projectsUsingGroup: number;
  last429At: string | null;
  lastSuccessAt: string | null;
  estimatedThroughput: string; // e.g., "~20 item/menit"
  estimatedRemainingBatchCapacity: string; // e.g., "~50 sisa item"
  
  // Internal metrics for calculation
  successCount: number;
  failureCount: number;
  recent429Count: number;
  avgLatencyMs: number;
  healthScore: number;
}

export interface KeySlot {
  id: string;
  key: string;
  label: string;
  status: ProviderStatus;
  lastValidated?: string;
  lastUsed?: string;
  isEnabled: boolean;
  identityGroupId?: string | null;
  // Capacity Estimation fields
  estimatedRemainingItems?: number;
  estimatedItemsPerMinute?: number;
  recentFailures?: number;
  recent429Count?: number;
  avgLatency?: number;
  lastSuccessfulUse?: string;
  successCount?: number;
  failureCount?: number;
  lastFailure?: string;
  healthScore?: number; // 0-100
  estimatedCapacityLabel?: string;
}

export interface ProjectProfile {
  id: string;
  name: string;
  preferredProvider: MetadataProvider;
  preferredGroupId: string | null;
  preferredKeyId: string | null;
  fallbackOrder: MetadataProvider[];
  generationMode: MetadataJobMode;
  notes?: string;
}

export interface ProviderConfig {
  apiKey: string | null; // Legacy
  status: ProviderStatus; // Legacy
  keyPool: KeySlot[];
  activeKeyId: string | null;
}

export interface MetadataJobState {
  status: MetadataJobStatus;
  mode: MetadataJobMode;
  totalItems: number;
  completedItems: number;
  succeededAI: number;
  succeededFallback: number;
  providerSuccessCounts: Record<MetadataProvider, number>;
  failedItems: number;
  currentIndex: number;
  currentItemName: string;
  percentComplete: number;
  resumeFromIndex: number;
  lastError: string | null;
  activeProvider: MetadataProvider | null;
  activeKeyId: string | null;
  activeKeyLabel: string | null;
  activeProfileName?: string | null;
  activeProfileId?: string | null;
  usageHistory: { provider: MetadataProvider, keyId: string, keyLabel: string, count: number, reason?: string }[];
  estimatedRemainingTime?: number; // in seconds
  itemsPerMinute?: number;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface AppState {
  view: string;
  mode: PipelineMode;
  batchId: string;
  uploaded: number;
  prefiltered: { ready: number, invalid: number, tooSmall: number, duplicate: number, nonPhoto: number };
  qc: { pass: number, fix: number, reject: number, strict: number, results: UploadedImageItem[] };
  asi: { clusters: number, heroes: number, alts: number, held: number, clusters_data: any[] };
  selector: { now: number, backup: number, fix: number, rejected: number, ranked: UploadedImageItem[] };
  approval: { now: UploadedImageItem[], backup: UploadedImageItem[], excluded: number, metaReady: number };
  metadata: { generated: number, items: UploadedImageItem[], dailyUsed: number, overflow: number };
  metadataJob: MetadataJobState;
  
  // Provider settings
  providers: Record<MetadataProvider, ProviderConfig>;
  quotaGroups: QuotaIdentityGroup[];
  providerPriority: MetadataProvider[];
  preferredProvider: MetadataProvider;

  // Project Profiles
  projectProfiles: ProjectProfile[];
  activeProfileId: string | null;
  
  // Legacy fields for backward compatibility during migration
  apiKey: string | null;
  apiKeyStatus: ProviderStatus;
  
  export: { built: boolean, count: number };
  log: { type: string, msg: string, time: string }[];
  uploadedItems: UploadedImageItem[];
  uploadPage: number;
  pageSize: number;
  selectedImageId: string | null;
  isUploading: boolean;
  useAI: boolean;
}
