import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../store';
import { Tag, Download, Upload, FileText, Package, FileJson, Sparkles, Zap, Shield, Pause, Play, Key, RefreshCw, AlertCircle, CheckCircle, XCircle, ChevronUp, ChevronDown, Settings, Trash2, Eye, EyeOff } from 'lucide-react';
import { UploadedImageItem, MetadataJobStatus, MetadataJobMode, MetadataProvider, ProviderStatus, QuotaIdentityGroup } from '../types';
import JSZip from 'jszip';
import { Providers, NormalizedMetadata, polishProviderResult } from '../services/metadataProviders';

// --- Metadata SEO Sanitization Helpers v9 ---

const FORBIDDEN_WORDS = new Set([
  'photorealistic', 'hyperrealistic', 'realistic', 'detailed', 'sharp', 'focus', 
  'bokeh', 'lighting', 'cinematic', 'studio', '4k', '8k', 'trending', 
  'artstation', 'unreal', 'engine', 'masterpiece', 'best', 'stunning', 'amazing',
  'simple', 'linear', 'style', 'clean', 'modern', 'commercial', 'marketing', 'branding',
  'premium', 'professional', 'concept', 'design', 'visual', 'graphic', 'element',
  'upscaled', 'upscale', 'enhanced', 'render', 'rendered', 'make', 'similar', 
  'copy', 'with', 'in', 'for', 'shot', 'view', 'side', 'top', 'front', 'back',
  'high', 'resolution', 'quality', 'stock', 'image', 'img', 'dsc', 'file', 'batch', 
  'version', 'v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'exterior', 'interior', 'generated', 
  'ai', 'midjourney', 'dalle', 'create', 'accurate', 'editorial', 'realism', 'hd',
  'stylized', 'plain', 'simple', 'minimal', 'artwork', 'digital', 'pattern', 'texture', 'cutout',
  'gemini', '3d', '2d', 'concept', 'design', 'visual', 'element', 'modern', 'clean', 'simple', 
  'creative', 'stock', 'asset', 'professional', 'commercial', 'marketing', 'branding',
  'premium', 'professional', 'upscaled', 'shot', 'view', 'concept', 'design', 'style',
  'similar', 'copy', 'create', 'residue', 'timestamp', 'fragment', 'marketing use', 'commercial use',
  'digital branding', 'upscaled', 'shot', 'view', 'concept design', 'graphic element', 'similar copy',
  'create', 'prompt residue', 'timestamp fragments', 'nanobananacreate', 'nanobanana', 'nano', 'banana', 'create'
]);

const FAMILY_WORDS = new Set([
  'vector', 'illustration', 'photo', 'icon', 'sticker', 'sheet', 'line', 'art', 
  'minimalist', 'flat', 'isolated', 'background', 'white', 'object', 'set', 
  'collection', 'drawing', 'outline', 'graphic'
]);

const stripTimestampTokens = (tokens: string[]): string[] => {
  return tokens.filter(t => !/^\d{8,}$/.test(t) && !/^\d{4}[-_]\d{2}[-_]\d{2}/.test(t));
};

const sanitizeTokens = (tokens: string[]): string[] => {
  let sanitized = stripTimestampTokens(tokens);
  sanitized = sanitized.filter(t => {
    const lower = t.toLowerCase();
    // Strict filter for meaningless filename fragments v8
    if (lower === 'nano' || lower === 'create' || lower === 'banana' || lower === 'asset' || lower === 'image') return false;
    return !FORBIDDEN_WORDS.has(lower) && !FAMILY_WORDS.has(lower) && lower.length > 2;
  });
  return Array.from(new Set(sanitized));
};

const normalizeSubjectPhrase = (phrase: string): string => {
  if (!phrase) return '';
  return phrase.toLowerCase()
    .split(' ')
    .filter(w => !FORBIDDEN_WORDS.has(w) && !FAMILY_WORDS.has(w) && w.length > 2)
    .join(' ')
    .trim();
};

const extractCleanSubject = (tokens: string[]): string => {
  const sanitized = sanitizeTokens(tokens);
  if (sanitized.length === 0) return 'Commercial stock asset';
  
  // Normalize common patterns v8
  const descriptors = new Set(['strong', 'cute', 'happy', 'sad', 'big', 'small', 'large', 'tiny', 'beautiful', 'modern', 'vintage', 'old', 'new', 'bright', 'dark', 'colorful', 'vibrant', 'golden', 'silver', 'blue', 'red', 'green', 'black', 'white', 'wooden', 'metallic', 'abstract', 'geometric', 'organic', 'floral', 'tropical', 'winter', 'summer', 'stylized', 'minimalist', 'elegant', 'powerful', 'majestic', 'wild', 'domestic', 'angry', 'calm', 'peaceful', 'scary', 'funny', 'cool', 'vivid', 'enterprise', 'corporate']);
  
  let result = [...sanitized];
  if (result.length >= 2) {
    if (descriptors.has(result[1].toLowerCase()) && !descriptors.has(result[0].toLowerCase())) {
      const temp = result[0];
      result[0] = result[1];
      result[1] = temp;
    }
  }

  const seen = new Set<string>();
  const final = result.filter(t => {
    const stem = t.toLowerCase().replace(/s$/, '');
    if (seen.has(stem)) return false;
    seen.add(stem);
    return true;
  });

  return final.slice(0, 3).join(' ');
};

// --- Image-First Metadata Engine Helpers v8 ---

interface InternalDescriptor {
  primarySubjectHint: string;
  styleClass: string;
  backgroundClass: string;
  layoutClass: string;
  contextClass: string;
  assetIntent: string;
}

const buildInternalDescriptor = (img: UploadedImageItem, subject: string): InternalDescriptor => {
  const vd = img.visualDescriptor;
  const family = img.assetFamily || 'photorealistic_photo';
  
  let styleClass = '';
  if (family === 'vector_flat_graphic') styleClass = 'flat vector';
  else if (family === 'line_art_minimal') styleClass = 'line art';
  else if (family === 'icon_sticker_sheet') styleClass = 'icon set';
  else if (family === 'illustration_general') styleClass = 'illustration';
  else if (family === 'photorealistic_photo') styleClass = 'photo';
  else if (family === 'isolated_object') styleClass = 'isolated object';
  
  let backgroundClass = '';
  if (vd?.likelyWhiteBackground) backgroundClass = 'white background';
  else if (vd?.likelyIsolatedObject) backgroundClass = 'isolated';
  else if (vd?.brightnessProfile === 'dark') backgroundClass = 'dark background';
  
  let layoutClass = '';
  if (vd?.likelyCenteredSubject) layoutClass = 'centered';
  if (vd?.likelySheetLayout) layoutClass = 'sheet layout';
  
  let contextClass = '';
  if (vd?.saturationProfile === 'vibrant') contextClass = 'vibrant';
  if (vd?.saturationProfile === 'muted') contextClass = 'muted';
  
  return {
    primarySubjectHint: subject,
    styleClass,
    backgroundClass,
    layoutClass,
    contextClass,
    assetIntent: 'commercial stock'
  };
};

const getFallbackTitle = (family: string): string => {
  switch (family) {
    case 'photorealistic_photo': return 'Photorealistic lifestyle image';
    case 'isolated_object': return 'Isolated object on white background';
    case 'vector_flat_graphic': return 'Flat vector illustration';
    case 'icon_sticker_sheet': return 'Icon set collection';
    case 'line_art_minimal': return 'Minimalist line art illustration';
    case 'illustration_general': return 'Digital illustration';
    default: return 'Commercial stock asset';
  }
};

const isTooCloseToRawFilename = (candidate: string, originalName: string): boolean => {
  const cleanCandidate = candidate.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanOriginal = originalName.toLowerCase().replace(/\.[^/.]+$/, "").replace(/[^a-z0-9]/g, '');
  
  if (cleanCandidate === cleanOriginal) return true;
  if (cleanOriginal.includes(cleanCandidate) && cleanCandidate.length > 5 && cleanCandidate.length > cleanOriginal.length * 0.7) return true;
  
  // Detect meaningless filename fragments v8
  if (cleanCandidate.includes('nanobananacreate')) return true;
  if (cleanCandidate.includes('nanobanana')) return true;
  
  return false;
};

const scoreTitleCandidate = (candidate: string, originalTokens: string[], family: string, originalName: string): number => {
  let score = 100;
  const lower = candidate.toLowerCase();
  
  // 1. Adobe-friendly Length Scoring v10
  // Target: ~70 chars. Soft range: 55-90. Hard max: 200.
  const len = candidate.length;
  if (len < 30) score -= 60;
  else if (len < 55) score -= 20;
  else if (len >= 55 && len <= 90) score += 30; // Bonus for ideal range
  else if (len > 90 && len <= 120) score -= 10;
  else if (len > 120 && len <= 160) score -= 30;
  else if (len > 160) score -= 60;

  // Closeness to 70 bonus
  const diffTo70 = Math.abs(len - 70);
  if (diffTo70 < 10) score += 20;
  
  // 2. Anti-filename-echo v8
  if (isTooCloseToRawFilename(candidate, originalName)) score -= 150;
  
  // 3. Forbidden words check
  FORBIDDEN_WORDS.forEach(word => {
    if (lower.includes(word.toLowerCase())) score -= 70;
  });

  // 4. Family appropriateness v8
  if (family === 'vector_flat_graphic' && !lower.includes('vector')) score -= 20;
  if (family === 'line_art_minimal' && !lower.includes('line art')) score -= 20;
  if (family === 'isolated_object' && !lower.includes('isolated')) score -= 20;

  // 5. Readability / Structure v8
  const words = candidate.split(' ');
  if (words.length < 5) score -= 40;
  
  // 6. Subject-first bonus v8
  const firstWord = words[0].toLowerCase();
  if (!FAMILY_WORDS.has(firstWord) && !FORBIDDEN_WORDS.has(firstWord)) score += 20;
  
  return score;
};

const smartShortenTitle = (title: string, max: number): string => {
  if (title.length <= max) return title;
  
  // Try to cut at last space before max
  const cut = title.substring(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > max * 0.7) {
    return cut.substring(0, lastSpace).trim();
  }
  return cut.trim();
};

const slugify = (text: string): string => {
  return text.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
};

const generateSmartFilename = (title: string): string => {
  let slug = slugify(title);
  
  // Basename rule: 35-80 ideal, 100 hard max
  if (slug.length > 100) {
    // Remove repeated words or weak modifiers
    const words = slug.split('-');
    const seen = new Set<string>();
    const filtered = words.filter(w => {
      if (seen.has(w) || w.length < 3) return false;
      seen.add(w);
      return true;
    });
    slug = filtered.join('-');
  }
  
  if (slug.length > 100) {
    slug = slug.substring(0, 100).replace(/-$/, '');
  }
  
  return slug + '.jpg';
};

const generateTitleCandidates = (subject: string, descriptor: InternalDescriptor, family: string): string[] => {
  const candidates: string[] = [];
  if (!subject) return [];

  // Literal Subject v8
  candidates.push(subject);

  // Family-Aware Templates v8: Subject-first priority
  switch (family) {
    case 'photorealistic_photo':
      candidates.push(`${subject} in ${descriptor.contextClass || 'natural'} environment`);
      if (descriptor.backgroundClass) candidates.push(`${subject} on ${descriptor.backgroundClass}`);
      candidates.push(`${subject} stock photo for commercial use`);
      break;
    case 'isolated_object':
      candidates.push(`${subject} isolated on white background`);
      candidates.push(`${subject} isolated object for design projects`);
      candidates.push(`${subject} cutout on clean white background`);
      break;
    case 'vector_flat_graphic':
      candidates.push(`Flat vector illustration of ${subject}`);
      candidates.push(`${subject} vector graphic design element`);
      candidates.push(`${subject} flat illustration for web design`);
      break;
    case 'icon_sticker_sheet':
      candidates.push(`${subject} icon set collection for apps`);
      candidates.push(`${subject} sticker sheet design bundle`);
      candidates.push(`${subject} graphic icon collection for UI`);
      break;
    case 'line_art_minimal':
      candidates.push(`Minimalist line art of ${subject}`);
      candidates.push(`Continuous line drawing of ${subject} subject`);
      candidates.push(`${subject} outline illustration for branding`);
      break;
    case 'illustration_general':
      candidates.push(`${subject} digital illustration for marketing`);
      candidates.push(`Stylized illustration of ${subject} character`);
      break;
    default:
      candidates.push(`${subject} commercial stock asset`);
  }

  if (descriptor.contextClass) {
    candidates.push(`${descriptor.contextClass} ${subject} visual asset`);
  }

  return Array.from(new Set(candidates));
};

const getStableVariation = (seed: string, min: number, max: number): number => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const range = max - min + 1;
  return min + (Math.abs(hash) % range);
};

// --- Metadata SEO Logic v8: Image-First Engine ---

export const generateMetadataLogic = (img: UploadedImageItem, mode: string) => {
  const rawTokens = img.filenameTokens || [];
  const family = img.assetFamily || 'photorealistic_photo';
  const originalName = img.name;
  
  // 1. Subject Extraction v8
  const subject = extractCleanSubject(rawTokens);
  
  // 2. Visual Descriptor Context v8
  const descriptor = buildInternalDescriptor(img, subject);

  // 3. Candidate Generation v8
  const candidates = generateTitleCandidates(subject, descriptor, family);
  
  // 4. Scoring & Selection v8
  const scored = candidates.map(c => ({
    phrase: c,
    score: scoreTitleCandidate(c, rawTokens, family, originalName)
  }));
  
  scored.sort((a, b) => b.score - a.score);
  
  let finalTitle = scored[0]?.phrase || getFallbackTitle(family);
  
  // Final Polish v8
  finalTitle = finalTitle.replace(/photorealistic photo/gi, 'photo')
                         .replace(/high resolution/gi, '')
                         .replace(/concept design/gi, 'design')
                         .replace(/graphic element/gi, 'element')
                         .replace(/nanobananacreate/gi, '')
                         .replace(/nanobanana/gi, '')
                         .replace(/\s+/g, ' ')
                         .trim();
  
  if (FAMILY_WORDS.has(finalTitle.toLowerCase())) {
    finalTitle = `${subject} ${finalTitle}`;
  }
  
  // Hard limit 200 chars
  if (finalTitle.length > 200) {
    finalTitle = smartShortenTitle(finalTitle, 200);
  }

  finalTitle = finalTitle.charAt(0).toUpperCase() + finalTitle.slice(1);
  
  // Filename Sync v10: Adobe-friendly basename rules
  const exportFilename = generateSmartFilename(finalTitle);

  // 5. Category Inference v8
  const tokenStr = rawTokens.join(' ').toLowerCase();
  let category = 'Objects / Product / Commercial';
  if (tokenStr.match(/business|office|corporate|work|meeting|desk|laptop|professional|career/)) category = 'Business / Office / Corporate';
  else if (tokenStr.match(/people|portrait|lifestyle|woman|man|child|family|person|human/)) category = 'People / Lifestyle / Portrait';
  else if (tokenStr.match(/food|drink|meal|cooking|restaurant|fruit|vegetable|healthy/)) category = 'Food / Drink';
  else if (tokenStr.match(/nature|landscape|travel|outdoor|mountain|tree|forest|sky|sea/)) category = 'Nature / Landscape / Travel';
  else if (tokenStr.match(/home|interior|decor|room|house|furniture|living/)) category = 'Home / Interior / Decor';
  else if (tokenStr.match(/tech|device|digital|computer|phone|electronics|software/)) category = 'Technology / Devices / Digital';
  else if (tokenStr.match(/health|wellness|fitness|medical|doctor|hospital|care/)) category = 'Health / Wellness / Fitness';
  else if (tokenStr.match(/beauty|fashion|makeup|style|cosmetic/)) category = 'Beauty / Fashion';
  else if (tokenStr.match(/education|study|school|student|learning|book/)) category = 'Education / Work / Study';

  // 6. Keywords v8: Sharpened Top 10
  const top10 = Array.from(new Set([
    subject,
    ...subject.split(' '),
    descriptor.styleClass,
    descriptor.backgroundClass,
    descriptor.contextClass,
    descriptor.layoutClass
  ])).filter(k => k && k.length > 2 && k.length < 30);
  
  const sanitizedTokens = sanitizeTokens(rawTokens);
  
  let allKeywords = Array.from(new Set([
    ...top10,
    ...sanitizedTokens,
    'isolated', 'background', 'texture', 'pattern', 'color', 'shape'
  ])).filter(k => k && k.length > 2 && k.length < 30);
  
  const weakGenerics = new Set(['design', 'concept', 'visual', 'element', 'modern', 'clean', 'simple', 'creative', 'stock', 'premium', 'professional', 'commercial', 'asset', 'image', 'photo', 'illustration', 'vector', 'art', 'graphic', 'picture', 'background', 'isolated', 'white']);
  
  const strongKeywords = allKeywords.filter(k => !weakGenerics.has(k.toLowerCase()));
  const weakKeywords = allKeywords.filter(k => weakGenerics.has(k.toLowerCase()));
  
  allKeywords = [...strongKeywords, ...weakKeywords];
  
  const seed = img.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const count = 25 + (seed % 16); // Strictly 25-40: 25 + [0-15]
  const finalKeywords = Array.from(new Set(allKeywords)).slice(0, count);

  return {
    title: finalTitle,
    exportFilename,
    keywords: finalKeywords,
    category,
    safetyNote: img.safe && img.safe >= 90 ? 'High commercial safety. Verified stock-ready.' : 'Standard commercial safety. Review recommended.',
    platformRecommendation: img.qcScore && img.qcScore >= 85 ? 'Strong for Adobe Stock + Shutterstock' : 'Adobe Stock preferred',
    approvalReason: img.approvalReason || 'Approved after manual review and ranking',
    dailyBatch: 1,
    exportReady: true
  };
};

const generateXmpSidecar = (item: UploadedImageItem): string => {
  const title = item.title || '';
  const keywords = item.keywords || [];
  const description = item.title || ''; // Often description matches title in stock
  
  return `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Adobe XMP Core 5.6-c140 79.160451, 2017/05/06-01:08:21        ">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"
    xmlns:xmp="http://ns.adobe.com/xap/1.0/"
    photoshop:Category="${item.category || ''}"
    xmp:Rating="5">
   <dc:title>
    <rdf:Alt>
     <rdf:li xml:lang="x-default">${title}</rdf:li>
    </rdf:Alt>
   </dc:title>
   <dc:description>
    <rdf:Alt>
     <rdf:li xml:lang="x-default">${description}</rdf:li>
    </rdf:Alt>
   </dc:description>
   <dc:subject>
    <rdf:Bag>
     ${keywords.map(kw => `<rdf:li>${kw}</rdf:li>`).join('\n     ')}
    </rdf:Bag>
   </dc:subject>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = error => reject(error);
  });
};

const calculateGroupHealthScore = (group: QuotaIdentityGroup): number => {
  if (!group) return 0;
  let score = 100;
  const total = (group.successCount || 0) + (group.failureCount || 0);
  if (total > 0) {
    const successRate = (group.successCount || 0) / total;
    score = successRate * 100;
  }
  if (group.recent429Count > 0) score -= (group.recent429Count * 25);
  if (group.avgLatencyMs > 3000) {
    const latencyPenalty = Math.min(30, (group.avgLatencyMs - 3000) / 150);
    score -= latencyPenalty;
  }
  if (group.cooldownUntil && new Date(group.cooldownUntil) > new Date()) score = Math.min(score, 5);
  return Math.max(0, Math.min(100, Math.round(score)));
};

const getPacingDelay = (group: QuotaIdentityGroup | undefined): number => {
  if (!group) return 0;
  let delay = 0;
  if (group.minuteRequestLimit && group.minuteRequestLimit > 0) {
    const load = group.minuteRequestUsed / group.minuteRequestLimit;
    if (load > 0.9) delay = 5000;
    else if (load > 0.7) delay = 2000;
    else if (load > 0.5) delay = 1000;
  }
  if (group.recent429Count > 0) delay += group.recent429Count * 2000;
  if (group.healthScore < 40) delay += 3000;
  else if (group.healthScore < 70) delay += 1000;
  return Math.min(delay, 15000);
};

const getRateStatus = (health: number, status: string, recentFailures: number): string => {
  if (status === 'quota_limited') return 'Quota Limited';
  if (recentFailures > 2) return 'Unstable';
  if (health >= 85) return 'Healthy';
  if (health >= 60) return 'Limited';
  if (health >= 30) return 'Quota Risk';
  if (health === 0) return 'Not Enough Data';
  return 'Unstable';
};

const getRoundedThroughput = (avgLatencyMs: number | undefined): string => {
  if (!avgLatencyMs || avgLatencyMs === 0) return 'Belum cukup data';
  const ipm = 60000 / avgLatencyMs;
  if (ipm < 5) return '~5 item/menit';
  const rounded = Math.round(ipm / 10) * 10;
  return `~${rounded || 10} item/menit`;
};

const getRoundedRemainingCapacity = (health: number, status: string): string => {
  if (status === 'quota_limited') return 'Risiko kuota';
  if (health >= 90) return '~100+ sisa item';
  if (health >= 75) return '~50 sisa item';
  if (health >= 50) return '~20 sisa item';
  if (health >= 30) return '~10 sisa item';
  return 'Terbatas';
};

const getProjectsUsingKey = (keyId: string | null, profiles: any[]): number => {
  if (!keyId) return 0;
  return profiles.filter(p => p.preferredKeyId === keyId).length;
};

const calculateHealthScore = (slot: any): number => {
  if (!slot) return 0;
  let score = 100;
  
  // 1. Success Ratio (Weight: 40%)
  const total = (slot.successCount || 0) + (slot.failureCount || 0);
  if (total > 0) {
    const successRate = (slot.successCount || 0) / total;
    // If success rate is low, drop score significantly
    score = successRate * 100;
  }
  
  // 2. Recent 429s (Weight: Heavy Penalty)
  if (slot.recent429Count > 0) {
    score -= (slot.recent429Count * 25);
  }
  
  // 3. Recent Failures (Weight: Penalty)
  if (slot.recentFailures > 0) {
    score -= (slot.recentFailures * 15);
  }
  
  // 4. Latency Penalty (Weight: 20%)
  // Anything over 3s starts to penalize, over 8s is a major penalty
  if (slot.avgLatency > 3000) {
    const latencyPenalty = Math.min(30, (slot.avgLatency - 3000) / 150);
    score -= latencyPenalty;
  }
  
  // 5. Recency Bonus/Penalty
  if (slot.lastSuccessfulUse) {
    const lastUse = new Date(slot.lastSuccessfulUse).getTime();
    const diffSeconds = (Date.now() - lastUse) / 1000;
    
    if (diffSeconds < 30) score += 5; // Very recent success bonus
    if (diffSeconds > 3600 && total > 0) score -= 10; // Stale data penalty
  }

  // 6. Provider State
  if (slot.status === 'quota_limited') score = Math.min(score, 10);
  if (slot.status === 'invalid') score = 0;
  
  return Math.max(0, Math.min(100, Math.round(score)));
};

const estimateCapacityLabel = (health: number, status: string): string => {
  return getRoundedRemainingCapacity(health, status);
};

export const processMetadataForItem = async (
  img: UploadedImageItem, 
  mode: MetadataJobMode, 
  state: any,
  onKeySwitch?: (provider: MetadataProvider, keyId: string, keyLabel: string, reason?: string) => void,
  onKeyFailure?: (provider: MetadataProvider, keyId: string, status: ProviderStatus) => void,
  onKeySuccess?: (provider: MetadataProvider, keyId: string, metrics: { latency: number }) => void
): Promise<{ result: Partial<UploadedImageItem>, provider: MetadataProvider, keyId?: string, keyLabel?: string }> => {
  const activeProfile = state.projectProfiles.find((p: any) => p.id === state.activeProfileId);
  const priority = activeProfile?.fallbackOrder || state.providerPriority || ['groq', 'blackbox', 'gemini', 'local'];
  const preferred = activeProfile?.preferredProvider || state.preferredProvider || 'gemini';

  let providersToTry: MetadataProvider[] = [];

  if (mode === 'local_only') {
    providersToTry = ['local'];
  } else if (mode === 'preferred_only') {
    providersToTry = [preferred];
  } else {
    providersToTry = priority;
  }

  if (mode === 'auto_failover' && !providersToTry.includes('local')) {
    providersToTry = [...providersToTry, 'local'];
  }

  for (const provider of providersToTry) {
    if (provider === 'local') {
      return { result: generateMetadataLogic(img, 'all_strict'), provider: 'local' };
    }

    const config = state.providers[provider];
    if (!config) continue;

    let availableKeys = (config.keyPool || []).filter(k => {
      const isEnabled = k.isEnabled && k.status !== 'invalid' && k.status !== 'quota_limited';
      if (!isEnabled) return false;
      
      if (k.identityGroupId) {
        const group = state.quotaGroups.find((g: any) => g.id === k.identityGroupId);
        if (group && group.cooldownUntil && new Date(group.cooldownUntil) > new Date()) {
          return false;
        }
      }
      return true;
    });

    availableKeys.sort((a, b) => (calculateHealthScore(b)) - (calculateHealthScore(a)));

    const preferredKeyId = activeProfile?.preferredKeyId || config.activeKeyId;
    if (preferredKeyId) {
      const preferredKey = availableKeys.find(k => k.id === preferredKeyId);
      if (preferredKey) {
        availableKeys = [preferredKey, ...availableKeys.filter(k => k.id !== preferredKeyId)];
      }
    }

    if (availableKeys.length === 0) {
      if (config.apiKey && config.status !== 'invalid' && config.status !== 'quota_limited') {
        availableKeys.push({ id: 'legacy', key: config.apiKey, label: 'Default Key', status: config.status, isEnabled: true });
      }
    }

    if (availableKeys.length === 0) continue;

    for (const keySlot of availableKeys) {
      if (!img.file) continue;

      if (onKeySwitch) {
        const reason = keySlot.id === preferredKeyId ? 'Profile Preferred' : 'Health Optimized';
        onKeySwitch(provider, keySlot.id, keySlot.label, reason);
      }

      const startTime = Date.now();
      try {
        const base64 = await fileToBase64(img.file);
        const aiResult = await Providers[provider].analyzeImage(base64, img.type || 'image/jpeg', keySlot.key);
        const latency = Date.now() - startTime;
        const polished = polishProviderResult(img, aiResult);
        if (onKeySuccess) onKeySuccess(provider, keySlot.id, { latency });
        return { result: polished, provider, keyId: keySlot.id, keyLabel: keySlot.label };
      } catch (err: any) {
        const errStr = err.message.toLowerCase();
        let newStatus: ProviderStatus = 'error';
        const isQuota = errStr.includes('quota') || errStr.includes('429') || errStr.includes('rate limit');
        if (isQuota) newStatus = 'quota_limited';
        if (errStr.includes('invalid') || errStr.includes('key')) newStatus = 'invalid';
        if (onKeyFailure) onKeyFailure(provider, keySlot.id, newStatus);
        
        if (isQuota && keySlot.identityGroupId) break; 
      }
    }
  }

  if (mode === 'auto_failover' || mode === 'local_only') {
    return { result: generateMetadataLogic(img, 'all_strict'), provider: 'local' };
  }
  throw new Error(`Exhausted all providers in ${mode} mode.`);
};

const QuotaGroupManager = () => {
  const { state, addQuotaGroup, removeQuotaGroup, updateQuotaGroup, assignKeyToGroup, showToast } = useAppContext();
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<MetadataProvider>('groq');

  const handleAddGroup = () => {
    if (!newGroupName) return;
    addQuotaGroup({
      provider: selectedProvider,
      identityLabel: newGroupName,
      groupType: 'account_scope',
      enabled: true,
      cooldownUntil: null,
      groupRateStatus: 'Healthy',
      dailyRequestLimit: 1500,
      minuteRequestLimit: 60,
      dailyRequestUsed: 0,
      minuteRequestUsed: 0,
      projectsUsingGroup: 0,
      last429At: null,
      lastSuccessAt: null,
      estimatedThroughput: 'Belum cukup data',
      estimatedRemainingBatchCapacity: 'Estimasi belum tersedia',
      successCount: 0,
      failureCount: 0,
      recent429Count: 0,
      avgLatencyMs: 0,
      healthScore: 100
    });
    setNewGroupName('');
    showToast(`✅ Group "${newGroupName}" created`);
  };

  return (
    <div className="mt-6 pt-6 border-t border-slate-800">
       <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-emerald-400" />
            <span className="font-mono text-xs font-bold text-slate-200 uppercase">Quota Identity Groups</span>
          </div>
          <div className="text-[10px] text-slate-500 italic">Group keys by shared quota identity for smarter pacing.</div>
        </div>

        <div className="flex gap-2 mb-4">
          <select 
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value as MetadataProvider)}
            className="bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-300 outline-none"
          >
            <option value="groq">GROQ</option>
            <option value="blackbox">BLACKBOX</option>
            <option value="gemini">GEMINI</option>
          </select>
          <input 
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="Identity Group Name (e.g. Personal Account 1)"
            className="flex-1 bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-300 focus:border-emerald-500 outline-none transition-colors"
          />
          <button 
            onClick={handleAddGroup}
            disabled={!newGroupName}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-1.5 rounded text-[10px] font-bold transition-all disabled:opacity-50"
          >
            Create Group
          </button>
        </div>

        <div className="space-y-3">
          {state.quotaGroups.map(group => (
            <div key={group.id} className="bg-slate-950 border border-slate-800 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-200">{group.identityLabel}</span>
                  <span className="text-[8px] font-mono text-slate-500 uppercase">{group.provider}</span>
                  <div className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                    group.groupRateStatus === 'Healthy' ? 'bg-emerald-500/10 text-emerald-400' :
                    group.groupRateStatus === 'Quota Limited' ? 'bg-red-500/10 text-red-400' :
                    'bg-slate-800 text-slate-500'
                  }`}>
                    {group.groupRateStatus}
                  </div>
                </div>
                <button 
                  onClick={() => removeQuotaGroup(group.id)}
                  className="text-slate-600 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-3">
                <div className="flex flex-col">
                  <span className="text-[7px] text-slate-600 uppercase font-bold">Daily Used</span>
                  <span className="text-[10px] font-mono text-slate-300">{group.dailyRequestUsed} / {group.dailyRequestLimit || '∞'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[7px] text-slate-600 uppercase font-bold">Minute Load</span>
                  <span className="text-[10px] font-mono text-slate-300">{group.minuteRequestUsed} / {group.minuteRequestLimit || '∞'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[7px] text-slate-600 uppercase font-bold">Cooldown</span>
                  <span className="text-[10px] font-mono text-slate-300">
                    {group.cooldownUntil && new Date(group.cooldownUntil) > new Date() 
                      ? `${Math.round((new Date(group.cooldownUntil).getTime() - Date.now()) / 1000 / 60)}m left`
                      : 'Inactive'}
                  </span>
                </div>
              </div>

              <div className="text-[8px] text-slate-500 uppercase font-bold mb-2">Assigned Keys</div>
              <div className="flex flex-wrap gap-2">
                {state.providers[group.provider].keyPool.filter(k => k.identityGroupId === group.id).map(k => (
                  <div key={k.id} className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900 border border-slate-800">
                    <span className="text-[9px] text-slate-300">{k.label}</span>
                    <button 
                      onClick={() => assignKeyToGroup(group.provider, k.id, null)}
                      className="text-slate-600 hover:text-red-400"
                    >
                      <XCircle size={10} />
                    </button>
                  </div>
                ))}
                {state.providers[group.provider].keyPool.filter(k => !k.identityGroupId).length > 0 && (
                  <select 
                    className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[9px] text-slate-400 outline-none"
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val !== 'none') assignKeyToGroup(group.provider, val, group.id);
                    }}
                    value="none"
                  >
                    <option value="none">+ Assign Key</option>
                    {state.providers[group.provider].keyPool.filter(k => !k.identityGroupId).map(k => (
                      <option key={k.id} value={k.id}>{k.label}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          ))}
          {state.quotaGroups.length === 0 && (
            <div className="text-center py-6 border border-dashed border-slate-800 rounded-lg">
              <div className="text-[10px] text-slate-600 uppercase font-bold">No Quota Groups Defined</div>
              <div className="text-[9px] text-slate-700 mt-1">Create a group above to manage shared quotas across multiple keys.</div>
            </div>
          )}
        </div>
    </div>
  );
};

export const MetadataSEOView = () => {
  const { 
    state, 
    setState, 
    addLog, 
    showToast, 
    updateMetadataJob, 
    updateProviderConfig,
    addKeyToPool,
    removeKeyFromPool,
    toggleKeyInPool,
    updateKeyInPool,
    addProjectProfile,
    removeProjectProfile,
    setActiveProfile,
    updateProjectProfile,
    addQuotaGroup,
    removeQuotaGroup,
    updateQuotaGroup,
    assignKeyToGroup,
    replaceKeyPool,
    clearAllKeys
  } = useAppContext();
  const [tempKeys, setTempKeys] = useState<Record<string, string>>({
    groq: '',
    blackbox: '',
    gemini: ''
  });
  const [validatingProvider, setValidatingProvider] = useState<MetadataProvider | null>(null);
  const [newProfileName, setNewProfileName] = useState('');
  const [showProfileCreator, setShowProfileCreator] = useState(false);
  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const jobRef = useRef<boolean>(false);

  const parseAndAddKeys = (provider: MetadataProvider, input: string) => {
    if (!input) return;
    const keys = input.split(/[\n,]+/).map(k => k.trim()).filter(k => k.length > 10);
    const uniqueKeys = Array.from(new Set(keys));
    uniqueKeys.forEach(key => addKeyToPool(provider, key));
    if (uniqueKeys.length > 0) {
      showToast(`✅ Added ${uniqueKeys.length} keys to ${provider.toUpperCase()} pool`);
      setTempKeys(prev => ({ ...prev, [provider]: '' }));
    }
  };

  const handleValidateKeySlot = async (provider: MetadataProvider, keyId: string, key: string) => {
    setValidatingProvider(provider);
    const status = await Providers[provider as Exclude<MetadataProvider, 'local'>].validateKey(key);
    setValidatingProvider(null);
    updateKeyInPool(provider, keyId, { status, lastValidated: new Date().toISOString() });
    
    if (status === 'connected') {
      showToast(`✅ Key validated`);
    } else {
      showToast(`❌ Validation failed: ${status}`);
    }
  };

  const exportMaskedSummary = () => {
    let content = 'MICROSTOCK AI AGENT PRO - MASKED KEY SUMMARY\n';
    content += `Created: ${new Date().toLocaleString()}\n\n`;

    (['groq', 'blackbox', 'gemini', 'local'] as const).forEach(provider => {
      const pool = state.providers[provider].keyPool;
      if (pool.length > 0) {
        content += `[${provider === 'gemini' ? 'GEMINI' : provider}]\n`;
        pool.forEach(slot => {
          content += `${slot.label} = ${maskKey(slot.key)} (${slot.isEnabled ? 'enabled' : 'disabled'})\n`;
        });
        content += '\n';
      }
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `microstock_masked_summary_${slugDate()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    addLog('info', 'Masked key summary exported');
    showToast('⬇ Masked Summary Downloaded');
  };

  const exportEncryptedBackup = async () => {
    const passphrase = window.prompt('Enter a strong passphrase to encrypt your API keys:');
    if (!passphrase) return;

    try {
      const dataToEncrypt = JSON.stringify({
        providers: state.providers,
        quotaGroups: state.quotaGroups,
        timestamp: new Date().toISOString()
      });

      const encrypted = await encryptData(dataToEncrypt, passphrase);
      
      let content = 'MICROSTOCK AI AGENT PRO - ENCRYPTED KEY BACKUP\n';
      content += 'version=1\n';
      content += `created=${new Date().toISOString()}\n`;
      content += `salt=${encrypted.salt}\n`;
      content += `iv=${encrypted.iv}\n`;
      content += `ciphertext=${encrypted.ciphertext}\n`;

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `microstock_encrypted_backup_${slugDate()}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      addLog('pass', 'Encrypted API key backup exported');
      showToast('⬇ Encrypted Backup Downloaded');
    } catch (err) {
      console.error('Encryption error:', err);
      showToast('❌ Failed to encrypt backup');
    }
  };

  const importKeysFromTxt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      try {
        if (text.includes('ENCRYPTED KEY BACKUP')) {
          const passphrase = window.prompt('Enter the passphrase to decrypt your backup:');
          if (!passphrase) return;

          const lines = text.split('\n');
          const encrypted: any = {};
          lines.forEach(line => {
            if (line.startsWith('salt=')) encrypted.salt = line.split('=')[1].trim();
            if (line.startsWith('iv=')) encrypted.iv = line.split('=')[1].trim();
            if (line.startsWith('ciphertext=')) encrypted.ciphertext = line.split('=')[1].trim();
          });

          if (!encrypted.salt || !encrypted.iv || !encrypted.ciphertext) {
            throw new Error('Invalid encrypted backup format');
          }

          const decryptedData = await decryptData(encrypted, passphrase);
          const parsed = JSON.parse(decryptedData);
          
          const mode = window.confirm('Encrypted backup decrypted successfully.\n\nClick OK to MERGE with existing keys.\nClick CANCEL to REPLACE existing keys.') ? 'merge' : 'replace';

          if (mode === 'replace') {
            setState(s => ({
              ...s,
              providers: parsed.providers,
              quotaGroups: parsed.quotaGroups || []
            }));
            showToast('✅ Key pool replaced from backup');
          } else {
            (['groq', 'blackbox', 'gemini', 'local'] as const).forEach(p => {
              const importedPool = parsed.providers[p].keyPool || [];
              importedPool.forEach((k: any) => {
                const exists = state.providers[p].keyPool.some(ex => ex.key === k.key);
                if (!exists) {
                  addKeyToPool(p, k.key, k.label);
                }
              });
            });
            showToast('✅ Keys merged from backup');
          }
          addLog('pass', 'Encrypted backup imported successfully');
        } else if (text.includes('MASKED KEY SUMMARY')) {
          showToast('ℹ Masked summaries are for viewing only and cannot be used for restore.');
        } else {
          const lines = text.split('\n');
        let currentProvider: MetadataProvider | null = null;
        const importedKeys: Record<MetadataProvider, { key: string, label: string, isEnabled: boolean }[]> = {
          groq: [],
          blackbox: [],
          gemini: [],
          local: []
        };

        lines.forEach(line => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('MICROSTOCK') || trimmed.startsWith('Generated:')) return;

          const sectionMatch = trimmed.match(/^\[(.*)\]$/);
          if (sectionMatch) {
            let section = sectionMatch[1].toLowerCase();
            if (section === 'visual_insight_core' || section === 'gemini') section = 'gemini';
            if (['groq', 'blackbox', 'gemini'].includes(section)) {
              currentProvider = section as MetadataProvider;
            } else {
              currentProvider = null;
            }
            return;
          }

          if (currentProvider && trimmed.includes('=')) {
            const parts = trimmed.split('=');
            const label = parts[0].trim();
            let rest = parts.slice(1).join('=').trim();
            
            let isEnabled = true;
            if (rest.endsWith('(disabled)')) {
              isEnabled = false;
              rest = rest.replace('(disabled)', '').trim();
            } else if (rest.endsWith('(enabled)')) {
              isEnabled = true;
              rest = rest.replace('(enabled)', '').trim();
            }

            const key = rest;
            if (key.length > 10) {
              importedKeys[currentProvider].push({ key, label, isEnabled });
            }
          }
        });

          const totalImported = Object.values(importedKeys).reduce((acc, val) => acc + val.length, 0);
          if (totalImported === 0) {
            showToast('⚠ No valid keys found in file');
            return;
          }

          const mode = window.confirm(`Found ${totalImported} keys in legacy format. \n\nClick OK to MERGE.\nClick CANCEL to REPLACE.`) ? 'merge' : 'replace';

          if (mode === 'merge') {
            let mergedCount = 0;
            (['groq', 'blackbox', 'gemini', 'local'] as const).forEach(p => {
              importedKeys[p].forEach(k => {
                const exists = state.providers[p].keyPool.some(ex => ex.key === k.key);
                if (!exists) {
                  addKeyToPool(p, k.key, k.label);
                  mergedCount++;
                }
              });
            });
            showToast(`✅ Merged ${mergedCount} keys`);
          } else {
            (['groq', 'blackbox', 'gemini', 'local'] as const).forEach(p => {
              if (importedKeys[p].length > 0) {
                replaceKeyPool(p, importedKeys[p]);
              }
            });
            showToast(`✅ Replaced key pools`);
          }
        }
      } catch (err) {
        console.error('Import error:', err);
        showToast('❌ Failed to import backup');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleValidateAllKeys = async (provider: MetadataProvider) => {
    const config = state.providers[provider];
    if (!config.keyPool || config.keyPool.length === 0) return;
    
    showToast(`🔍 Validating all ${provider.toUpperCase()} keys...`);
    for (const slot of config.keyPool) {
      await handleValidateKeySlot(provider, slot.id, slot.key);
    }
  };

  const handleValidateKey = async (provider: Exclude<MetadataProvider, 'local'>) => {
    const key = tempKeys[provider];
    if (!key) return;
    
    // If it looks like multiple keys, parse them
    if (key.includes('\n') || key.includes(',')) {
      parseAndAddKeys(provider, key);
      return;
    }

    setValidatingProvider(provider);
    const status = await Providers[provider].validateKey(key);
    setValidatingProvider(null);
    
    updateProviderConfig(provider, { apiKey: key, status });
    
    if (status === 'connected') {
      showToast(`✅ ${provider.toUpperCase()} connected`);
      addLog('pass', `${provider.toUpperCase()} API key validated and saved for session`);
    } else {
      showToast(`❌ ${provider.toUpperCase()} validation failed: ${status}`);
      addLog('error', `${provider.toUpperCase()} API key validation failed: ${status}`);
    }
  };

  const handleClearKey = (provider: Exclude<MetadataProvider, 'local'>) => {
    setTempKeys(prev => ({ ...prev, [provider]: '' }));
    updateProviderConfig(provider, { apiKey: null, status: 'missing' });
    showToast(`🗑 ${provider.toUpperCase()} key cleared`);
  };

  const movePriority = (index: number, direction: 'up' | 'down') => {
    const newPriority = [...state.providerPriority];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newPriority.length) return;
    
    const temp = newPriority[index];
    newPriority[index] = newPriority[targetIndex];
    newPriority[targetIndex] = temp;
    
    setState(s => ({ ...s, providerPriority: newPriority }));
  };

  const runMetadataJob = async (resume = false) => {
    if (state.approval.metaReady === 0) {
      showToast('⚠ No approved assets — run pipeline first');
      return;
    }

    const eligibleItems = state.uploadedItems.filter(i => i.metaReady);
    if (eligibleItems.length === 0) {
      showToast('⚠ No eligible assets for metadata generation');
      return;
    }

    // Sort items for priority
    eligibleItems.sort((a, b) => {
      if (a.bucket === 'approved_now' && b.bucket !== 'approved_now') return -1;
      if (a.bucket !== 'approved_now' && b.bucket === 'approved_now') return 1;
      return (b.finalScore || 0) - (a.finalScore || 0);
    });

    const startIndex = resume ? state.metadataJob.resumeFromIndex : 0;
    const itemsToProcess = eligibleItems.slice(startIndex);

    if (itemsToProcess.length === 0) {
      showToast('✅ All items already processed');
      return;
    }

    updateMetadataJob({
      status: 'running',
      totalItems: eligibleItems.length,
      currentIndex: startIndex,
      lastError: null,
      startedAt: resume ? state.metadataJob.startedAt : new Date().toISOString()
    });

    jobRef.current = true;
    addLog('info', `${resume ? 'Resuming' : 'Starting'} Metadata SEO Job (${state.metadataJob.mode})...`);

    let completedCount = resume ? state.metadataJob.completedItems : 0;
    let failCount = resume ? state.metadataJob.failedItems : 0;
    let successCounts = { ...state.metadataJob.providerSuccessCounts };
    let usageHistory = resume ? [...state.metadataJob.usageHistory] : [];

    for (let i = 0; i < itemsToProcess.length; i++) {
      if (!jobRef.current) {
        updateMetadataJob({ status: 'paused', resumeFromIndex: startIndex + i });
        addLog('warn', `Metadata job paused at item ${startIndex + i + 1}`);
        return;
      }

      const item = itemsToProcess[i];
      const absoluteIndex = startIndex + i;

      // Dynamic Pacing / Throttling
      const currentActiveProvider = state.metadataJob.activeProvider;
      const currentActiveKeyId = state.metadataJob.activeKeyId;
      if (currentActiveProvider && currentActiveKeyId) {
        const activeKey = state.providers[currentActiveProvider]?.keyPool.find((k: any) => k.id === currentActiveKeyId);
        const group = activeKey?.identityGroupId ? state.quotaGroups.find((g: any) => g.id === activeKey.identityGroupId) : undefined;
        const delay = getPacingDelay(group);
        if (delay > 0) {
          updateMetadataJob({ lastError: `Throttling active: ${delay}ms delay to protect quota` });
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      updateMetadataJob({
        currentIndex: absoluteIndex,
        currentItemName: item.name,
        percentComplete: Math.round(((absoluteIndex + 1) / eligibleItems.length) * 100)
      });

      try {
        const { result, provider, keyId, keyLabel } = await processMetadataForItem(
          item, 
          state.metadataJob.mode, 
          state,
          (p, kid, label, reason) => {
            updateMetadataJob({ activeProvider: p, activeKeyId: kid, activeKeyLabel: label });
            
            const existing = usageHistory.find(h => h.keyId === kid);
            if (existing) {
              existing.count++;
            } else {
              usageHistory.push({ provider: p, keyId: kid, keyLabel: label, count: 1, reason });
            }
          },
          (p, kid, status) => {
            if (kid === 'legacy') {
              updateProviderConfig(p, { status });
            } else {
              const slot = state.providers[p].keyPool.find((k: any) => k.id === kid);
              const failures = (slot?.recentFailures || 0) + 1;
              const totalFailures = (slot?.failureCount || 0) + 1;
              const q429 = status === 'quota_limited' ? (slot?.recent429Count || 0) + 1 : (slot?.recent429Count || 0);
              
              const updatedSlot = { 
                ...slot, 
                status, 
                recentFailures: failures, 
                failureCount: totalFailures,
                recent429Count: q429,
                lastFailure: new Date().toISOString()
              };
              const health = calculateHealthScore(updatedSlot);
              updateKeyInPool(p, kid, { 
                ...updatedSlot, 
                healthScore: health,
                estimatedCapacityLabel: estimateCapacityLabel(health, status)
              });

              // Group level update
              if (slot?.identityGroupId) {
                const group = state.quotaGroups.find((g: any) => g.id === slot.identityGroupId);
                if (group) {
                  const isQuota = status === 'quota_limited';
                  const cooldownUntil = isQuota ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : group.cooldownUntil;
                  updateQuotaGroup(group.id, {
                    failureCount: group.failureCount + 1,
                    recent429Count: isQuota ? group.recent429Count + 1 : group.recent429Count,
                    last429At: isQuota ? new Date().toISOString() : group.last429At,
                    cooldownUntil,
                    groupRateStatus: isQuota ? 'Quota Limited' : group.groupRateStatus
                  });
                }
              }
            }
            addLog('warn', `${p.toUpperCase()} key "${kid}" marked as ${status}`);
          },
          (p, kid, metrics) => {
            if (kid !== 'legacy') {
              const slot = state.providers[p].keyPool.find((k: any) => k.id === kid);
              const oldLatency = slot?.avgLatency || metrics.latency;
              const newLatency = Math.round((oldLatency * 0.7) + (metrics.latency * 0.3));
              const successes = (slot?.successCount || 0) + 1;
              
              const updatedSlot = {
                ...slot,
                status: 'connected' as const, 
                lastSuccessfulUse: new Date().toISOString(),
                avgLatency: newLatency,
                recentFailures: 0,
                successCount: successes
              };
              const health = calculateHealthScore(updatedSlot);
              updateKeyInPool(p, kid, { 
                ...updatedSlot, 
                healthScore: health,
                estimatedCapacityLabel: estimateCapacityLabel(health, 'connected')
              });

              // Group level update
              if (slot?.identityGroupId) {
                const group = state.quotaGroups.find((g: any) => g.id === slot.identityGroupId);
                if (group) {
                  const gOldLatency = group.avgLatencyMs || metrics.latency;
                  const gNewLatency = Math.round((gOldLatency * 0.7) + (metrics.latency * 0.3));
                  updateQuotaGroup(group.id, {
                    successCount: group.successCount + 1,
                    lastSuccessAt: new Date().toISOString(),
                    avgLatencyMs: gNewLatency,
                    minuteRequestUsed: group.minuteRequestUsed + 1,
                    dailyRequestUsed: group.dailyRequestUsed + 1,
                    healthScore: calculateGroupHealthScore({ ...group, successCount: group.successCount + 1, avgLatencyMs: gNewLatency })
                  });
                }
              }
            }
          }
        );
        
        // Update item in state
        setState(s => {
          const newUploadedItems = [...s.uploadedItems];
          const idx = newUploadedItems.findIndex(img => img.id === item.id);
          if (idx !== -1) {
            newUploadedItems[idx] = { ...newUploadedItems[idx], ...result, metaReady: true };
          }

          const existingMetaItems = [...s.metadata.items];
          const metaIdx = existingMetaItems.findIndex(img => img.id === item.id);
          const updatedItem = { ...item, ...result, metaReady: true };
          
          if (metaIdx !== -1) existingMetaItems[metaIdx] = updatedItem;
          else existingMetaItems.push(updatedItem);

          return {
            ...s,
            uploadedItems: newUploadedItems,
            metadata: {
              ...s.metadata,
              generated: existingMetaItems.length,
              items: existingMetaItems,
              dailyUsed: existingMetaItems.length
            }
          };
        });

        completedCount++;
        if (provider) {
          successCounts[provider] = (successCounts[provider] || 0) + 1;
        }

        const elapsed = (Date.now() - new Date(state.metadataJob.startedAt || new Date()).getTime()) / 1000;
        
        // Trustworthy Throughput Calculation
        const activeConfig = state.providers[provider];
        const activeKey = activeConfig?.keyPool.find(k => k.id === keyId);
        
        let ipm = 0;
        if (activeKey?.avgLatency && activeKey.avgLatency > 0) {
          ipm = Math.round(60000 / activeKey.avgLatency);
        } else if (elapsed > 10) {
          ipm = Math.round((completedCount / elapsed) * 60);
        }
        
        // Round to nearest 10 for user-facing simplicity if > 5
        if (ipm > 5) {
          ipm = Math.round(ipm / 10) * 10;
        }
        
        const remaining = eligibleItems.length - completedCount;
        const estTime = ipm > 0 ? Math.round((remaining / ipm) * 60) : 0;

        updateMetadataJob({
          completedItems: completedCount,
          providerSuccessCounts: successCounts,
          activeProvider: provider,
          activeKeyId: keyId || null,
          activeKeyLabel: keyLabel || null,
          itemsPerMinute: ipm,
          estimatedRemainingTime: estTime,
          usageHistory
        });

      } catch (err: any) {
        console.error(`Error processing ${item.name}:`, err);
        
        failCount++;
        updateMetadataJob({ 
          failedItems: failCount,
          lastError: `Failed ${item.name}: ${err.message}`
        });
        addLog('error', `Failed to process ${item.name}: ${err.message}`);
        
        if (state.metadataJob.mode === 'preferred_only') {
          updateMetadataJob({ status: 'paused', resumeFromIndex: absoluteIndex });
          addLog('warn', `Job paused due to failure in Preferred Provider mode`);
          jobRef.current = false;
          return;
        }
      }
    }

    updateMetadataJob({ 
      status: 'completed', 
      percentComplete: 100,
      finishedAt: new Date().toISOString()
    });
    addLog('pass', `Metadata job completed: ${completedCount} items processed`);
    showToast('✅ Metadata generation complete');
    jobRef.current = false;
  };

  const pauseJob = () => {
    jobRef.current = false;
    updateMetadataJob({ status: 'paused' });
  };

  return (
    <div className="animate-in fade-in duration-300">
      {/* Header Section */}
      <div className="mb-6 flex justify-between items-start">
        <div>
          <div className="font-mono text-lg font-bold text-slate-100 flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center text-cyan-400"><Tag size={18} /></div>
            Metadata SEO
          </div>
          <div className="text-sm text-slate-400">GEMINI · 25–40 Keywords · Multi-mode Generation</div>
        </div>
      </div>

      {/* API Key Management Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Key size={16} className="text-cyan-400" />
            <span className="font-mono text-xs font-bold text-slate-200 uppercase">AI Provider Settings</span>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-bold uppercase transition-all ${
                showAdvanced 
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
                  : 'bg-slate-800 border border-slate-700 text-slate-500 hover:text-slate-300'
              }`}
            >
              <Settings size={10} className={showAdvanced ? 'animate-spin-slow' : ''} />
              {showAdvanced ? 'Advanced Mode: ON' : 'Advanced Mode: OFF'}
            </button>
            <div className="text-[10px] text-slate-500 italic hidden sm:block">Secure Backup & Import.</div>
            <div className="flex gap-2">
              <button 
                onClick={exportMaskedSummary}
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 text-[9px] font-bold uppercase transition-colors"
                title="Export masked summary (safe for sharing)"
              >
                <Eye size={10} /> Masked Summary
              </button>
              <button 
                onClick={exportEncryptedBackup}
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 text-[9px] font-bold uppercase transition-colors"
                title="Export encrypted backup (requires passphrase to restore)"
              >
                <Shield size={10} /> Encrypted Backup
              </button>
              <label className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 text-[9px] font-bold uppercase transition-colors cursor-pointer">
                <Upload size={10} /> Import Backup
                <input type="file" accept=".txt" onChange={importKeysFromTxt} className="hidden" />
              </label>
              {showAdvanced && (
                <button 
                  onClick={() => {
                    if (window.confirm('Are you sure you want to clear all saved API keys? This cannot be undone.')) {
                      clearAllKeys();
                    }
                  }}
                  className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-[9px] font-bold uppercase transition-colors"
                >
                  <Trash2 size={10} /> Clear All
                </button>
              )}
            </div>
          </div>
        </div>
        
        <div className="space-y-6">
          {(['groq', 'blackbox', 'gemini'] as const).map((provider) => {
            const config = state.providers[provider];
            const pool = config.keyPool || [];
            
            return (
              <div key={provider} className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-slate-200 uppercase">{provider === 'gemini' ? 'GEMINI' : provider}</span>
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        config.status === 'connected' ? 'bg-emerald-400' :
                        config.status === 'quota_limited' ? 'bg-amber-400' :
                        config.status === 'invalid' ? 'bg-red-400' : 'bg-slate-600'
                      }`}></div>
                      <span className="font-mono text-[9px] text-slate-400 uppercase">{pool.length} Keys</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {showAdvanced && (
                      <button 
                        onClick={() => handleValidateAllKeys(provider)}
                        disabled={pool.length === 0 || validatingProvider !== null}
                        className="text-[9px] font-bold uppercase px-2 py-1 rounded bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-30"
                      >
                        Validate All
                      </button>
                    )}
                    <button 
                      onClick={() => setState(s => ({ ...s, preferredProvider: provider }))}
                      className={`text-[9px] font-bold uppercase px-2 py-1 rounded transition-colors ${
                        state.preferredProvider === provider ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20' : 'bg-slate-800 text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {state.preferredProvider === provider ? 'Preferred' : 'Set Preferred'}
                    </button>
                  </div>
                </div>

                {/* Key Pool List (Advanced Only) */}
                {showAdvanced && pool.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {pool.map((slot) => (
                      <div key={slot.id} className="flex items-center gap-3 bg-slate-900/50 border border-slate-800/50 rounded-md p-2 hover:border-slate-700 transition-colors group">
                        <button 
                          onClick={() => toggleKeyInPool(provider, slot.id)}
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                            slot.isEnabled ? 'bg-cyan-500 border-cyan-500 text-white' : 'bg-slate-800 border-slate-700 text-transparent'
                          }`}
                        >
                          <CheckCircle size={10} />
                        </button>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] font-bold text-slate-300 truncate">{slot.label}</span>
                            <div className={`w-1 h-1 rounded-full ${
                              slot.status === 'connected' ? 'bg-emerald-400' :
                              slot.status === 'quota_limited' ? 'bg-amber-400' :
                              slot.status === 'invalid' ? 'bg-red-400' : 'bg-slate-600'
                            }`}></div>
                            <span className="text-[8px] font-mono text-slate-500 uppercase">{slot.status.replace('_', ' ')}</span>
                            {slot.healthScore !== undefined && (
                              <span className={`text-[8px] font-mono font-bold px-1 rounded ${
                                slot.healthScore > 70 ? 'text-emerald-400 bg-emerald-400/10' : 
                                slot.healthScore > 40 ? 'text-amber-400 bg-amber-400/10' : 
                                'text-red-400 bg-red-400/10'
                              }`}>
                                {slot.healthScore}% Health
                              </span>
                            )}
                          </div>
                          <div className="text-[9px] font-mono text-slate-500 truncate">
                            {maskKey(slot.key)}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {slot.lastSuccessfulUse && (
                              <span className="text-[7px] text-emerald-500/70 font-mono">Last Success: {new Date(slot.lastSuccessfulUse).toLocaleTimeString()}</span>
                            )}
                            {slot.lastFailure && (
                              <span className="text-[7px] text-red-500/70 font-mono">Last Failure: {new Date(slot.lastFailure).toLocaleTimeString()}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleValidateKeySlot(provider, slot.id, slot.key)}
                            disabled={validatingProvider !== null}
                            className="p-1.5 text-slate-500 hover:text-cyan-400 transition-colors"
                            title="Validate Key"
                          >
                            <RefreshCw size={12} className={validatingProvider === provider ? 'animate-spin' : ''} />
                          </button>
                          <button 
                            onClick={() => removeKeyFromPool(provider, slot.id)}
                            className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                            title="Remove Key"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input 
                      type="text"
                      value={tempKeys[provider]}
                      onChange={(e) => setTempKeys(prev => ({ ...prev, [provider]: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && handleValidateKey(provider)}
                      placeholder={`Paste ${provider.toUpperCase()} key(s) here...`}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs font-mono text-slate-300 focus:border-cyan-500 outline-none transition-colors"
                    />
                    {tempKeys[provider] && (tempKeys[provider].includes('\n') || tempKeys[provider].includes(',')) && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 text-[8px] font-bold rounded border border-cyan-500/30">
                        MULTI-PASTE DETECTED
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => handleValidateKey(provider)}
                    disabled={validatingProvider === provider || !tempKeys[provider]}
                    className="bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded text-[10px] font-bold transition-all shadow-lg shadow-cyan-500/10 disabled:opacity-50"
                  >
                    {validatingProvider === provider ? <RefreshCw size={14} className="animate-spin" /> : (tempKeys[provider]?.includes('\n') || tempKeys[provider]?.includes(',') ? 'Add All' : 'Add Key')}
                  </button>
                </div>
              </div>
            );
          })}
          {showAdvanced && <QuotaGroupManager />}

          <div className="mt-4 pt-4 border-t border-slate-800/50">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-2">
                <Shield size={14} className="text-emerald-400 mt-0.5" />
                <div className="text-[10px] text-slate-500 leading-relaxed">
                  <span className="text-slate-300 font-bold">Security First:</span> Raw API keys are never exported in plain text. 
                  Masked summaries are for human review and cannot restore full keys.
                </div>
              </div>
              <div className="flex items-start gap-2">
                <RefreshCw size={14} className="text-cyan-400 mt-0.5" />
                <div className="text-[10px] text-slate-500 leading-relaxed">
                  <span className="text-slate-300 font-bold">Persistence:</span> Saved keys remain available after reload. 
                  Encrypted backups require your passphrase to restore.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Provider Priority & Mode Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="font-mono text-[10px] text-slate-500 uppercase font-bold mb-4 flex items-center gap-2">
              <Settings size={12} /> Generation Mode
            </div>
            <div className="space-y-2">
              {[
                { id: 'preferred_only', label: 'Preferred Only', desc: 'Use only selected provider' },
                { id: 'auto_failover', label: 'Auto Failover', desc: 'Try all, then fallback' },
                { id: 'local_only', label: 'Local Only', desc: 'No API, local logic only' }
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => updateMetadataJob({ mode: m.id as MetadataJobMode })}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    state.metadataJob.mode === m.id 
                      ? 'bg-cyan-400/10 border-cyan-500/50' 
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className={`text-xs font-bold mb-0.5 ${state.metadataJob.mode === m.id ? 'text-cyan-400' : 'text-slate-300'}`}>{m.label}</div>
                  <div className="text-[10px] text-slate-500">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {showAdvanced && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="font-mono text-[10px] text-slate-500 uppercase font-bold">Project Profiles</div>
                <button 
                  onClick={() => setShowProfileCreator(!showProfileCreator)}
                  className="text-[9px] font-bold text-cyan-400 hover:text-cyan-300 transition-colors uppercase"
                >
                  {showProfileCreator ? 'Cancel' : '+ New Profile'}
                </button>
              </div>

              {showProfileCreator && (
                <div className="bg-slate-950 border border-slate-800 rounded p-3 mb-4 animate-in slide-in-from-top-2 duration-200">
                  <input 
                    type="text"
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    placeholder="Profile Name (e.g. Adobe Stock High Priority)"
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-300 mb-2 focus:border-cyan-500 outline-none"
                  />
                  
                  <div className="mb-2">
                    <div className="text-[8px] text-slate-500 uppercase font-bold mb-1">Preferred Key (Optional)</div>
                    <select 
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[10px] text-slate-300 outline-none"
                      onChange={(e) => {
                        const val = e.target.value;
                        updateProjectProfile(state.activeProfileId || '', { preferredKeyId: val === 'none' ? null : val });
                      }}
                    >
                      <option value="none">Auto-select healthiest key</option>
                      {state.providers[state.preferredProvider].keyPool.map(k => (
                        <option key={k.id} value={k.id}>{k.label}</option>
                      ))}
                    </select>
                  </div>

                  <button 
                    onClick={() => {
                      if (!newProfileName) return;
                      addProjectProfile({
                        name: newProfileName,
                        preferredProvider: state.preferredProvider,
                        preferredKeyId: null, // Initial creation uses current preferred
                        fallbackOrder: state.providerPriority,
                        generationMode: state.metadataJob.mode
                      });
                      setNewProfileName('');
                      setShowProfileCreator(false);
                    }}
                    className="w-full bg-cyan-500 hover:bg-cyan-600 text-white py-1.5 rounded text-[10px] font-bold uppercase transition-colors"
                  >
                    Create Profile
                  </button>
                </div>
              )}

              <div className="space-y-2 mb-6">
                {state.projectProfiles.map((p) => (
                  <div 
                    key={p.id} 
                    onClick={() => setActiveProfile(p.id)}
                    className={`cursor-pointer flex items-center justify-between p-2 rounded border transition-all ${
                      state.activeProfileId === p.id 
                        ? 'bg-cyan-500/10 border-cyan-500/50' 
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className={`text-xs font-bold ${state.activeProfileId === p.id ? 'text-cyan-400' : 'text-slate-300'}`}>{p.name}</span>
                      <span className="text-[8px] text-slate-500 uppercase font-mono">{p.preferredProvider} · {p.generationMode.replace('_', ' ')}</span>
                    </div>
                    {state.activeProfileId === p.id && <CheckCircle size={12} className="text-cyan-400" />}
                  </div>
                ))}
              </div>

              <div className="font-mono text-[10px] text-slate-500 uppercase font-bold mb-4">Capacity & Health</div>
              <div className="space-y-3">
                {(['groq', 'blackbox', 'gemini'] as const).map(p => {
                  const config = state.providers[p];
                  const activeKey = config.keyPool.find(k => k.id === config.activeKeyId) || config.keyPool[0];
                  const group = activeKey?.identityGroupId ? state.quotaGroups.find(g => g.id === activeKey.identityGroupId) : undefined;
                  
                  const health = group ? group.healthScore : (activeKey ? calculateHealthScore(activeKey) : 0);
                  const rateStatus = group ? group.groupRateStatus : (activeKey ? getRateStatus(health, activeKey.status, activeKey.recentFailures || 0) : 'Not Enough Data');
                  const capacityLabel = group ? group.estimatedRemainingBatchCapacity : (activeKey ? estimateCapacityLabel(health, activeKey.status) : 'Estimasi belum tersedia');
                  const throughput = group ? group.estimatedThroughput : getRoundedThroughput(activeKey?.avgLatency);
                  
                  const projectCount = getProjectsUsingKey(activeKey?.id || null, state.projectProfiles);
                  const isExpanded = expandedProviders[p];

                  return (
                    <div key={p} className="bg-slate-950 border border-slate-800 rounded p-2 transition-all">
                      <div 
                        className="flex items-center justify-between mb-1.5 cursor-pointer"
                        onClick={() => setExpandedProviders(prev => ({ ...prev, [p]: !prev[p] }))}
                      >
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">{p === 'gemini' ? 'GEMINI' : p}</span>
                          {group && <span className="text-[7px] text-emerald-500 font-mono uppercase">Group: {group.identityLabel}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                            rateStatus === 'Healthy' ? 'bg-emerald-500/10 text-emerald-400' :
                            rateStatus === 'Quota Limited' ? 'bg-red-500/10 text-red-400' :
                            rateStatus === 'Unstable' ? 'bg-amber-500/10 text-amber-400' :
                            'bg-slate-800 text-slate-500'
                          }`}>
                            {rateStatus}
                          </div>
                          <ChevronDown size={10} className={`text-slate-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div className="flex flex-col">
                          <span className="text-[7px] text-slate-600 uppercase font-bold">Throughput</span>
                          <span className="text-[10px] font-mono text-slate-300">
                            {throughput}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[7px] text-slate-600 uppercase font-bold">Est. Remaining</span>
                          <span className={`text-[10px] font-mono font-bold ${health > 70 ? 'text-emerald-400' : health > 40 ? 'text-amber-400' : 'text-red-400'}`}>
                            {capacityLabel}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[7px] text-slate-500 uppercase font-bold border-t border-slate-900 pt-1.5 mt-1">
                        <span>Active Key: {activeKey?.label || 'None'}</span>
                        <span>Used by {projectCount} project{projectCount !== 1 ? 's' : ''}</span>
                      </div>

                      {isExpanded && (
                        <div className="mt-2 pt-2 border-t border-slate-900 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                          {group && (
                            <div className="grid grid-cols-2 gap-2 border-b border-slate-900 pb-2 mb-2">
                              <div className="flex flex-col">
                                <span className="text-[7px] text-slate-600 uppercase font-bold">Daily Used</span>
                                <span className="text-[10px] font-mono text-slate-300">{group.dailyRequestUsed} / {group.dailyRequestLimit || '∞'}</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[7px] text-slate-600 uppercase font-bold">Minute Load</span>
                                <span className="text-[10px] font-mono text-slate-300">{group.minuteRequestUsed} / {group.minuteRequestLimit || '∞'}</span>
                              </div>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col">
                              <span className="text-[7px] text-slate-600 uppercase font-bold">Health Score</span>
                              <span className="text-[10px] font-mono text-slate-300">{health}%</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[7px] text-slate-600 uppercase font-bold">Success Ratio</span>
                              <span className="text-[10px] font-mono text-slate-300">
                                {activeKey ? Math.round(((activeKey.successCount || 0) / Math.max(1, (activeKey.successCount || 0) + (activeKey.failureCount || 0))) * 100) : 0}%
                              </span>
                            </div>
                          </div>
                          {activeKey?.lastSuccessfulUse && (
                            <div className="text-[7px] text-emerald-400/60 font-mono">Last Success: {new Date(activeKey.lastSuccessfulUse).toLocaleTimeString()}</div>
                          )}
                          {activeKey?.lastFailure && (
                            <div className="text-[7px] text-red-400/60 font-mono">Last Failure: {new Date(activeKey.lastFailure).toLocaleTimeString()}</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex justify-between items-center mb-4">
            <div className="flex flex-col">
              <div className="font-mono text-[10px] text-slate-500 uppercase font-bold">Job Progress</div>
              <div className="text-[9px] text-slate-600 font-mono uppercase">Profile: {state.metadataJob.activeProfileName || 'None'}</div>
            </div>
            <div className="flex gap-2">
              {state.metadataJob.status === 'running' ? (
                <button onClick={pauseJob} className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/50 text-amber-400 px-3 py-1.5 rounded text-[10px] font-bold uppercase">
                  <Pause size={12} /> Pause Job
                </button>
              ) : (
                <button 
                  onClick={() => runMetadataJob(state.metadataJob.status === 'paused' || state.metadataJob.status === 'partial')}
                  disabled={state.approval.metaReady === 0}
                  className="flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/50 text-cyan-400 px-3 py-1.5 rounded text-[10px] font-bold uppercase disabled:opacity-50"
                >
                  <Play size={12} /> {state.metadataJob.status === 'paused' || state.metadataJob.status === 'partial' ? 'Resume Job' : 'Start Job'}
                </button>
              )}
            </div>
          </div>

          {state.metadataJob.status !== 'idle' && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1 h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                    style={{ width: `${state.metadataJob.percentComplete}%` }}
                  ></div>
                </div>
                <div className="font-mono text-sm font-bold text-cyan-400 w-12 text-right">{state.metadataJob.percentComplete}%</div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <div className="text-[8px] text-slate-500 uppercase font-bold mb-1">Processed</div>
                  <div className="text-xs font-mono text-slate-200">{state.metadataJob.completedItems} / {state.metadataJob.totalItems}</div>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <div className="text-[8px] text-slate-500 uppercase font-bold mb-1">Speed</div>
                  <div className="text-xs font-mono text-cyan-400">{state.metadataJob.itemsPerMinute ? `~${state.metadataJob.itemsPerMinute}` : 0} items/min</div>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <div className="text-[8px] text-slate-500 uppercase font-bold mb-1">Time Left</div>
                  <div className="text-xs font-mono text-slate-200">
                    {state.metadataJob.estimatedRemainingTime ? `${Math.floor(state.metadataJob.estimatedRemainingTime / 60)}m ${state.metadataJob.estimatedRemainingTime % 60}s` : 'Calculating...'}
                  </div>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <div className="text-[8px] text-slate-500 uppercase font-bold mb-1">Active Key</div>
                  <div className="text-xs font-mono text-cyan-400 uppercase flex items-center gap-1 truncate">
                    {state.metadataJob.activeKeyLabel || 'None'}
                  </div>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <div className="text-[8px] text-slate-500 uppercase font-bold mb-1">Active Provider</div>
                  <div className="text-xs font-mono text-cyan-400 uppercase flex items-center gap-1">
                    {state.metadataJob.activeProvider === 'gemini' ? 'GEMINI' : (state.metadataJob.activeProvider || 'Idle')}
                  </div>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <div className="text-[8px] text-red-500 uppercase font-bold mb-1">Failed</div>
                  <div className="text-xs font-mono text-red-400">{state.metadataJob.failedItems}</div>
                </div>
              </div>

              {state.metadataJob.status === 'running' && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3 text-[10px] text-slate-400 animate-pulse">
                    <RefreshCw size={10} className="animate-spin" />
                    Processing: <span className="text-slate-200 font-mono">{state.metadataJob.currentItemName}</span>
                  </div>
                </div>
              )}

              {state.metadataJob.lastError && (
                <div className="flex items-center gap-2 text-[10px] text-red-400 bg-red-400/5 border border-red-400/20 p-2 rounded">
                  <AlertCircle size={12} />
                  <span className="truncate">Error: {state.metadataJob.lastError}</span>
                </div>
              )}
            </div>
          )}

          {state.metadataJob.status === 'idle' && (
            <div className="h-48 flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-800 rounded-lg">
              <Sparkles size={24} className="mb-2 opacity-20" />
              <div className="text-xs font-mono mb-1">Select mode and start metadata generation</div>
              <div className="text-[10px] text-slate-600">Priority: {state.providerPriority.join(' → ')}</div>
            </div>
          )}
        </div>
      </div>

      {/* Metadata List Section */}
      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 no-scrollbar">
        {state.metadata.items.length === 0 ? (
          <div className="text-center p-10 text-slate-500 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-4xl mb-3">🏷</div>
            <div className="font-mono text-xs">Send approved assets from Approval Queue to generate metadata</div>
          </div>
        ) : (
          state.metadata.items.map((item: any) => (
            <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-cyan-500/30 transition-colors">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-16 h-16 rounded bg-slate-800 overflow-hidden flex-shrink-0">
                  <img src={item.previewUrl} alt={item.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-xs font-bold text-slate-200 mb-1 truncate" title={item.title}>{item.title}</div>
                  <div className="font-mono text-[10px] text-slate-500 truncate">{item.exportFilename}</div>
                </div>
                <div className="flex flex-col gap-1 items-end flex-shrink-0">
                  <span className="px-2 py-0.5 rounded-full font-mono text-[9px] font-bold uppercase border bg-emerald-400/10 text-emerald-400 border-emerald-400/25">metadata_ready</span>
                  <span className="px-2 py-0.5 rounded-full font-mono text-[9px] font-bold uppercase border bg-purple-500/10 text-purple-400 border-purple-500/25">{item.platformRecommendation}</span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="flex flex-col gap-1"><div className="font-mono text-[9px] text-slate-500 uppercase font-bold">Category</div><div className="text-xs text-slate-300">{item.category}</div></div>
                <div className="flex flex-col gap-1"><div className="font-mono text-[9px] text-slate-500 uppercase font-bold">Safety Note</div><div className="text-[10px] text-emerald-400">{item.safetyNote}</div></div>
                <div className="flex flex-col gap-1"><div className="font-mono text-[9px] text-slate-500 uppercase font-bold">Bucket</div><div className="text-[10px] text-slate-400">{item.bucket?.replace('_', ' ')}</div></div>
                <div className="flex flex-col gap-1"><div className="font-mono text-[9px] text-slate-500 uppercase font-bold">Reason</div><div className="text-[10px] text-slate-400">{item.approvalReason}</div></div>
              </div>
              <div className="font-mono text-[10px] text-slate-500 uppercase font-bold mb-2">Keywords ({item.keywords?.length || 0})</div>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {item.keywords?.slice(0, 10).map((k: string, idx: number) => <span key={`kw-top-${k}-${idx}`} className="bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 px-2 py-0.5 rounded-full font-mono text-[9px]">{k}</span>)}
                {item.keywords?.slice(10, 25).map((k: string, idx: number) => <span key={`kw-supp-${k}-${idx}`} className="bg-slate-800 border border-slate-700 text-slate-400 px-2 py-0.5 rounded-full font-mono text-[9px]">{k}</span>)}
                {item.keywords?.length > 25 && <span className="text-slate-500 text-[10px] ml-1">+{item.keywords.length - 25} more</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const escapeCsv = (value: string | number | null | undefined) => {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

// --- Encryption Helpers ---
const deriveKey = async (passphrase: string, salt: Uint8Array) => {
  const encoder = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
};

const encryptData = async (data: string, passphrase: string) => {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(data)
  );
  
  return {
    salt: btoa(String.fromCharCode(...salt)),
    iv: btoa(String.fromCharCode(...iv)),
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext)))
  };
};

const decryptData = async (encrypted: { salt: string, iv: string, ciphertext: string }, passphrase: string) => {
  const salt = new Uint8Array(atob(encrypted.salt).split('').map(c => c.charCodeAt(0)));
  const iv = new Uint8Array(atob(encrypted.iv).split('').map(c => c.charCodeAt(0)));
  const ciphertext = new Uint8Array(atob(encrypted.ciphertext).split('').map(c => c.charCodeAt(0)));
  
  const key = await deriveKey(passphrase, salt);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  
  return new TextDecoder().decode(decrypted);
};

const maskKey = (key: string) => {
  if (!key) return '';
  if (key.length <= 12) return '••••••••';
  return `${key.substring(0, 8)}••••••${key.substring(key.length - 4)}`;
};

const slugDate = (d = new Date()) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}_${mm}_${dd}`;
};

const buildAdobeCsvFilename = () => {
  return `Adobe_Stock_Metadata_Batch_${slugDate()}_001.csv`;
};

const mapCategoryToAdobeCode = (category?: string): number => {
  const c = (category || '').toLowerCase();

  if (c.includes('business') || c.includes('office') || c.includes('corporate')) return 3;
  if (c.includes('people') || c.includes('portrait') || c.includes('lifestyle')) return 13;
  if (c.includes('food') || c.includes('drink')) return 7;
  if (c.includes('nature') || c.includes('landscape') || c.includes('travel')) return 11;
  if (c.includes('home') || c.includes('interior') || c.includes('decor')) return 2;
  if (c.includes('technology') || c.includes('device') || c.includes('digital')) return 19;
  if (c.includes('health') || c.includes('wellness') || c.includes('fitness')) return 16;
  if (c.includes('beauty') || c.includes('fashion')) return 8;
  if (c.includes('education') || c.includes('study') || c.includes('school')) return 20;
  if (c.includes('object') || c.includes('product') || c.includes('commercial')) return 10;

  return 1;
};

const getActiveAdobeCsvItems = (items: any[]) => {
  return items
    .filter(item => item.exportReady !== false)
    .filter(item => (item.dailyBatch ?? 1) === 1);
};

export const DailyExportView = () => {
  const { state, setState, addLog, showToast } = useAppContext();
  const [isBuilding, setIsBuilding] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const buildExport = () => {
    if (state.metadata.generated === 0) { 
      showToast('⚠ Generate metadata first'); 
      return; 
    }
    
    setIsBuilding(true);
    
    setState(s => ({
      ...s,
      export: { built: true, count: s.metadata.generated }
    }));
    
    setIsBuilding(false);
    addLog('pass', `Export package built: ${state.metadata.generated} records`);
    showToast(`📦 Export package ready · ${state.metadata.generated} metadata records`);
  };

  const downloadCSV = () => {
    const items = getActiveAdobeCsvItems(state.metadata.items);
    if (!items.length) { showToast('⚠ No export-ready metadata items found'); return; }

    const rows = [
      'Filename,Title,Keywords,Category,Releases',
      ...items.map(item => {
        const filename = item.exportFilename || item.name || `${item.id}.jpg`;
        const title = item.title || '';
        const keywords = Array.isArray(item.keywords) ? item.keywords.join(', ') : '';
        const categoryCode = mapCategoryToAdobeCode(item.category);
        return [escapeCsv(filename), escapeCsv(title), escapeCsv(keywords), categoryCode, ''].join(',');
      }),
    ];

    const csvContent = '\uFEFF' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = buildAdobeCsvFilename();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    addLog('info', `Adobe CSV export downloaded: ${items.length} rows`);
    showToast(`⬇ CSV Downloaded · ${buildAdobeCsvFilename()}`);
  };

  const downloadJSON = () => {
    const items = state.metadata.items.map(item => ({
      id: item.id,
      originalName: item.name,
      exportFilename: item.exportFilename,
      title: item.title,
      keywords: item.keywords,
      category: item.category,
      safetyNote: item.safetyNote,
      platformRecommendation: item.platformRecommendation,
      reasonForApproval: item.approvalReason,
      assetFamily: item.assetFamily,
      dailyBatch: item.dailyBatch,
      exportReady: item.exportReady
    }));

    const jsonContent = JSON.stringify({ batchId: state.batchId, timestamp: new Date().toISOString(), count: items.length, items }, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${state.batchId}_Metadata.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    addLog('info', 'JSON metadata exported');
    showToast('⬇ JSON Downloaded');
  };

  const downloadFullPackage = async () => {
    const items = state.metadata.items.filter(i => i.exportReady);
    if (!items.length) { showToast('⚠ No items ready for export'); return; }

    setIsExporting(true);
    addLog('info', `Preparing full metadata package for ${items.length} items...`);

    try {
      const zip = new JSZip();
      
      // 1. Add Renamed Images
      const imgFolder = zip.folder("images");
      for (const item of items) {
        if (item.file) {
          const ext = item.name.split('.').pop() || 'jpg';
          const filename = item.exportFilename || `${item.id}.${ext}`;
          imgFolder?.file(filename, item.file);
        }
      }

      // 2. Add XMP Sidecars
      const xmpFolder = zip.folder("sidecars");
      for (const item of items) {
        const xmpContent = generateXmpSidecar(item);
        const basename = (item.exportFilename || item.name).replace(/\.[^/.]+$/, "");
        xmpFolder?.file(`${basename}.xmp`, xmpContent);
      }

      // 3. Add Adobe CSV
      const csvRows = [
        'Filename,Title,Keywords,Category,Releases',
        ...items.map(item => {
          const filename = item.exportFilename || item.name || `${item.id}.jpg`;
          const title = item.title || '';
          const keywords = Array.isArray(item.keywords) ? item.keywords.join(', ') : '';
          const categoryCode = mapCategoryToAdobeCode(item.category);
          return [escapeCsv(filename), escapeCsv(title), escapeCsv(keywords), categoryCode, ''].join(',');
        }),
      ];
      zip.file(buildAdobeCsvFilename(), '\uFEFF' + csvRows.join('\n'));

      // 4. Add JSON Metadata
      const jsonContent = JSON.stringify({ batchId: state.batchId, timestamp: new Date().toISOString(), count: items.length, items }, null, 2);
      zip.file(`${state.batchId}_Metadata.json`, jsonContent);

      // 5. Add Report
      const reportContent = `MICROSTOCK AI AGENT PRO - BATCH REPORT\nBatch ID: ${state.batchId}\nTimestamp: ${new Date().toISOString()}\nItems: ${items.length}`;
      zip.file(`${state.batchId}_Report.txt`, reportContent);

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${state.batchId}_Full_Package.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      addLog('pass', `Full metadata package exported: ${items.length} items`);
      showToast('✅ Full Package Downloaded');
    } catch (err) {
      console.error(err);
      addLog('error', 'Failed to build ZIP package');
      showToast('❌ Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <div className="font-mono text-lg font-bold text-slate-100 flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center text-emerald-400"><Download size={18} /></div>
            Daily Export
          </div>
          <div className="text-sm text-slate-400">Format approved output · CSV · JSON · XMP · Renamed Images · ZIP Package</div>
        </div>
        <button onClick={buildExport} disabled={isBuilding || state.metadata.generated === 0} className="bg-cyan-400/10 border border-cyan-500 text-cyan-400 hover:bg-cyan-400/20 rounded px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {isBuilding ? '📦 Building...' : '📦 Build Export Package'}
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
        <div className="flex items-center gap-4 mb-2">
          <div className="font-mono text-[10px] text-slate-500 uppercase font-bold w-24">Today's Batch</div>
          <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-500" style={{width: `${(state.export.count / 500) * 100}%`}}></div></div>
          <div className="font-mono text-[10px] font-bold text-cyan-400 w-12 text-right">{state.export.count}/500</div>
        </div>
        <div className="font-mono text-[10px] text-slate-500 text-right">Next queue: <span className="text-amber-400">{state.metadata.dailyUsed >= 500 ? 'dayBatch02 pending' : `${500 - state.metadata.dailyUsed} slots remaining`}</span></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-900 border-t-2 border-t-emerald-400 border border-slate-800 rounded-xl p-5">
          <div className="font-mono text-[10px] text-slate-500 tracking-widest uppercase font-bold mb-4">Export Package Contents</div>
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center"><div className="font-mono text-[10px] text-slate-500 uppercase font-bold">Metadata CSV</div><div className="text-xs text-slate-300">{state.export.built ? <span className="text-emerald-400">Adobe_Stock_Batch.csv</span> : 'Not ready'}</div></div>
            <div className="flex justify-between items-center"><div className="font-mono text-[10px] text-slate-500 uppercase font-bold">XMP Sidecars</div><div className="text-xs text-slate-300">{state.export.built ? <span className="text-emerald-400">Included in ZIP</span> : 'Not ready'}</div></div>
            <div className="flex justify-between items-center"><div className="font-mono text-[10px] text-slate-500 uppercase font-bold">Renamed Images</div><div className="text-xs text-slate-300">{state.export.built ? <span className="text-emerald-400">Included in ZIP</span> : 'Not ready'}</div></div>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="font-mono text-[10px] text-slate-500 tracking-widest uppercase font-bold mb-4">Export Actions</div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={downloadCSV} disabled={!state.export.built} className="flex items-center justify-center gap-2 bg-slate-800 border border-slate-700 text-slate-300 hover:text-white p-2 rounded text-[10px] font-mono uppercase transition-colors disabled:opacity-50">
              <FileText size={12} /> CSV
            </button>
            <button onClick={downloadJSON} disabled={!state.export.built} className="flex items-center justify-center gap-2 bg-slate-800 border border-slate-700 text-slate-300 hover:text-white p-2 rounded text-[10px] font-mono uppercase transition-colors disabled:opacity-50">
              <FileJson size={12} /> JSON
            </button>
            <button onClick={downloadFullPackage} disabled={!state.export.built || isExporting} className="col-span-2 flex items-center justify-center gap-2 bg-emerald-500/10 border border-emerald-500 text-emerald-400 hover:bg-emerald-500/20 p-2 rounded text-[10px] font-mono uppercase transition-colors disabled:opacity-50">
              <Package size={14} /> {isExporting ? 'Packaging...' : 'Download Full ZIP Package'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="font-mono text-[10px] text-slate-500 tracking-widest uppercase font-bold mb-3">Export Rules</div>
        <div className="space-y-2">
          <div className="flex items-start gap-3 bg-slate-800/50 p-2 rounded"><div className="font-mono text-[9px] text-cyan-400 font-bold w-12">EXP-01</div><div className="text-[10px] text-slate-400">Images renamed to match metadata filenames</div></div>
          <div className="flex items-start gap-3 bg-slate-800/50 p-2 rounded"><div className="font-mono text-[9px] text-cyan-400 font-bold w-12">EXP-02</div><div className="text-[10px] text-slate-400">XMP sidecars synchronized with CSV/JSON</div></div>
          <div className="flex items-start gap-3 bg-slate-800/50 p-2 rounded"><div className="font-mono text-[9px] text-cyan-400 font-bold w-12">EXP-03</div><div className="text-[10px] text-slate-400">ZIP package includes images, sidecars, and CSV</div></div>
        </div>
      </div>
    </div>
  );
};
