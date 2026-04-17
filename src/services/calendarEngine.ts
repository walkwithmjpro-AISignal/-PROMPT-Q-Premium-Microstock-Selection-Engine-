import { CalendarEvent, AssetFormat, GeneratedPrompt, MarketPriority } from '../types';

export const CALENDAR_EVENTS: CalendarEvent[] = [
  // ---------------- SPRING (North America/Europe) ----------------
  {
    id: 'valentines_day',
    dateStart: '02-01',
    dateEnd: '02-14',
    eventName: "Valentine's Day",
    eventType: 'global holiday',
    regions: ['GLOBAL', 'US', 'GB', 'CA', 'FR'],
    priorityScore: 9,
    commercialStrength: 9,
    assetFamilySuitability: ['Sticker', 'Icon', 'Vector', 'Photorealistic', 'Sticker - Grid 3x3', 'Icon - Grid 4x4'],
    notes: 'High demand for romance, dating, hearts, pink/red gradients, greeting card designs.',
    tags: ['love', 'romance', 'heart', 'greeting', 'couple', 'gift']
  },
  {
    id: 'st_patricks_day',
    dateStart: '03-01',
    dateEnd: '03-17',
    eventName: "St. Patrick's Day",
    eventType: 'regional holiday',
    regions: ['US', 'GB', 'CA'],
    priorityScore: 7,
    commercialStrength: 7,
    assetFamilySuitability: ['Vector', 'Sticker', 'Icon', 'Sticker - Grid 3x3'],
    notes: 'Green, clover, luck, celebration, beer, irish theme.',
    tags: ['green', 'clover', 'luck', 'celebration', 'party', 'spring']
  },
  {
    id: 'easter',
    dateStart: '03-15',
    dateEnd: '04-15', // Moves, so broad block
    eventName: "Easter & Spring Break",
    eventType: 'global holiday',
    regions: ['GLOBAL', 'US', 'GB', 'CA', 'DE', 'FR', 'AU'],
    priorityScore: 8,
    commercialStrength: 8,
    assetFamilySuitability: ['Sticker', 'Icon', 'Vector', 'Photorealistic', 'Object', 'Sticker - Grid 4x4'],
    notes: 'Spring, renewal, eggs, bunnies, pastel colors, family, religion.',
    tags: ['spring', 'easter', 'bunny', 'eggs', 'pastel', 'family', 'holiday', 'religion']
  },
  {
    id: 'mothers_day',
    dateStart: '04-15',
    dateEnd: '05-15', // Second Sunday in May (US), varies globally
    eventName: "Mother's Day",
    eventType: 'global holiday',
    regions: ['GLOBAL', 'US', 'GB', 'CA', 'AU'],
    priorityScore: 9,
    commercialStrength: 9,
    assetFamilySuitability: ['Sticker', 'Icon', 'Vector', 'Photorealistic', 'Sticker - Grid 3x3'],
    notes: 'Moms, gifts, appreciation, floral, family, warm pastel aesthetics.',
    tags: ['mother', 'family', 'gift', 'appreciation', 'floral', 'love', 'women']
  },

  // ---------------- SUMMER ----------------
  {
    id: 'summer_vacation',
    dateStart: '06-01',
    dateEnd: '08-31',
    eventName: "Summer Season & Travel",
    eventType: 'seasonal event',
    regions: ['GLOBAL', 'US', 'GB', 'CA', 'FR', 'DE', 'JP'],
    priorityScore: 8,
    commercialStrength: 8,
    assetFamilySuitability: ['Photorealistic', 'Icon', 'Sticker', 'Vector', 'Icon - Grid 4x4'],
    notes: 'Travel, tourism, beach, sun, cocktails, vacation, heat.',
    tags: ['summer', 'vacation', 'travel', 'beach', 'sun', 'bright', 'leisure', 'tourism']
  },
  {
    id: 'fathers_day',
    dateStart: '05-20',
    dateEnd: '06-20',
    eventName: "Father's Day",
    eventType: 'global holiday',
    regions: ['GLOBAL', 'US', 'GB', 'CA', 'AU'],
    priorityScore: 8,
    commercialStrength: 8,
    assetFamilySuitability: ['Sticker', 'Icon', 'Vector', 'Object', 'Photorealistic'],
    notes: 'Dads, tools, grilling, outdoor, masculine aesthetics, gifts, family.',
    tags: ['father', 'family', 'gift', 'dad', 'masculine', 'tools', 'celebration']
  },
  {
    id: 'us_independence_day',
    dateStart: '06-25',
    dateEnd: '07-04',
    eventName: "US Independence Day (4th of July)",
    eventType: 'regional holiday',
    regions: ['US'],
    priorityScore: 7,
    commercialStrength: 7,
    assetFamilySuitability: ['Icon', 'Vector', 'Sticker', 'Sticker - Grid 3x3'],
    notes: 'Patriotic, USA, fireworks, summer, red white blue, bbq.',
    tags: ['usa', 'independence', 'fireworks', 'summer', 'patriotic', 'party', 'bbq']
  },

  // ---------------- AUTUMN / FALL ----------------
  {
    id: 'back_to_school',
    dateStart: '07-15',
    dateEnd: '09-15',
    eventName: "Back to School",
    eventType: 'seasonal event',
    regions: ['GLOBAL', 'US', 'GB', 'CA', 'FR', 'DE'],
    priorityScore: 9,
    commercialStrength: 9,
    assetFamilySuitability: ['Icon', 'Sticker', 'Vector', 'Photorealistic', 'Icon - Grid 4x4', 'Sticker - Grid 3x3'],
    notes: 'Education, learning, kids, backpack, autumn, school bus, stationery.',
    tags: ['school', 'education', 'learning', 'kids', 'student', 'autumn']
  },
  {
    id: 'halloween',
    dateStart: '09-15',
    dateEnd: '10-31',
    eventName: "Halloween",
    eventType: 'global holiday',
    regions: ['GLOBAL', 'US', 'GB', 'CA'],
    priorityScore: 8,
    commercialStrength: 8,
    assetFamilySuitability: ['Sticker', 'Vector', 'Icon', 'Sticker - Grid 4x4', 'Photorealistic'],
    notes: 'Spooky, horror, pumpkin, trick or treat, costume, autumn, orange/black.',
    tags: ['halloween', 'spooky', 'pumpkin', 'costume', 'autumn', 'scary', 'party']
  },
  {
    id: 'thanksgiving_black_friday',
    dateStart: '11-01',
    dateEnd: '11-30',
    eventName: "Thanksgiving & Black Friday",
    eventType: 'commercial shopping',
    regions: ['US', 'CA', 'GLOBAL'], // BF is global now
    priorityScore: 10,
    commercialStrength: 10,
    assetFamilySuitability: ['Vector', 'Object', 'Icon', 'Sticker', 'Icon - Grid 3x3'],
    notes: 'Cyber Monday, sales, discounts, turkey, gratitude, family feast.',
    tags: ['sale', 'discount', 'black friday', 'shopping', 'thanksgiving', 'family', 'food', 'autumn']
  },

  // ---------------- WINTER ----------------
  {
    id: 'christmas_holiday',
    dateStart: '11-15',
    dateEnd: '12-25',
    eventName: "Christmas & Winter Holidays",
    eventType: 'global holiday',
    regions: ['GLOBAL'],
    priorityScore: 10,
    commercialStrength: 10,
    assetFamilySuitability: ['Sticker', 'Vector', 'Icon', 'Photorealistic', 'Object', 'Sticker - Grid 4x4', 'Icon - Grid 4x4'],
    notes: 'High commercial volume. Snow, gifts, santa, tree, red/green, cozy, winter.',
    tags: ['christmas', 'winter', 'holiday', 'gift', 'snow', 'tree', 'festive']
  },
  {
    id: 'new_year',
    dateStart: '12-20',
    dateEnd: '01-10',
    eventName: "New Year's Eve & Resolutions",
    eventType: 'global holiday',
    regions: ['GLOBAL'],
    priorityScore: 9,
    commercialStrength: 8,
    assetFamilySuitability: ['Vector', 'Icon', 'Sticker', 'Photorealistic'],
    notes: 'Party, fireworks, champagne, fitness goals, fresh start, calendars.',
    tags: ['new year', 'party', 'fireworks', 'resolution', 'fitness', 'celebration']
  },
  {
    id: 'lunar_new_year',
    dateStart: '01-15',
    dateEnd: '02-15',
    eventName: "Lunar New Year",
    eventType: 'global holiday',
    regions: ['GLOBAL', 'JP', 'KR', 'AU'], // East Asia, but globally bought
    priorityScore: 8,
    commercialStrength: 8,
    assetFamilySuitability: ['Vector', 'Icon', 'Sticker', 'Sticker - Grid 3x3'],
    notes: 'Red envelopes, zodiac animal, lanterns, gold, oriental tradition.',
    tags: ['lunar', 'new year', 'chinese', 'asian', 'tradition', 'red', 'gold', 'celebration']
  },

  // ---------------- EVERGREEN THEMES ----------------
  {
    id: 'evergreen_business',
    dateStart: '01-01',
    dateEnd: '12-31',
    eventName: "Corporate & Business",
    eventType: 'evergreen',
    regions: ['GLOBAL'],
    priorityScore: 5,
    commercialStrength: 10, // Always sells
    assetFamilySuitability: ['Photorealistic', 'Object', 'Vector', 'Icon', 'Icon - Grid 4x4'],
    notes: 'Meetings, teamwork, finance, start-up, leadership, modern office.',
    tags: ['business', 'corporate', 'office', 'finance', 'teamwork', 'leadership', 'modern']
  },
  {
    id: 'evergreen_health_medical',
    dateStart: '01-01',
    dateEnd: '12-31',
    eventName: "Healthcare & Medical",
    eventType: 'evergreen',
    regions: ['GLOBAL'],
    priorityScore: 5,
    commercialStrength: 9,
    assetFamilySuitability: ['Photorealistic', 'Object', 'Icon', 'Vector', 'Icon - Grid 3x3'],
    notes: 'Doctors, hospitals, wellness, pills, stethoscope, patient care, mental health.',
    tags: ['health', 'medical', 'doctor', 'hospital', 'wellness', 'care', 'medicine']
  },
  {
    id: 'evergreen_technology',
    dateStart: '01-01',
    dateEnd: '12-31',
    eventName: "Technology & AI",
    eventType: 'evergreen',
    regions: ['GLOBAL'],
    priorityScore: 6,
    commercialStrength: 9,
    assetFamilySuitability: ['Photorealistic', 'Vector', 'Icon', 'Object'],
    notes: 'AI, coding, network, server, futuristic, abstract tech background, UI/UX.',
    tags: ['technology', 'tech', 'ai', 'computer', 'network', 'future', 'digital']
  },
  {
    id: 'evergreen_sustainability',
    dateStart: '01-01',
    dateEnd: '12-31',
    eventName: "Eco & Sustainability",
    eventType: 'evergreen',
    regions: ['GLOBAL'],
    priorityScore: 5,
    commercialStrength: 8,
    assetFamilySuitability: ['Vector', 'Icon', 'Sticker', 'Photorealistic'],
    notes: 'Green energy, recycling, nature, eco-friendly, earth, leaves, wind turbines.',
    tags: ['ecology', 'sustainability', 'green', 'environment', 'nature', 'recycling', 'eco']
  }
];

// Helper to determine if an event is currently "active" or "upcoming" based on date
const parseMonthDay = (md: string) => {
  const [m, d] = md.split('-').map(Number);
  return { m, d };
};

const getDayOfYear = (date: Date) => {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = (date.getTime() - start.getTime()) + ((start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000);
  return Math.floor(diff / 86400000);
};

export const getAllEvents = (): CalendarEvent[] => {
  return [...CALENDAR_EVENTS].sort((a, b) => {
    // Sort by chronological start date (roughly) for display purposes
    const getSortM = (md: string) => { const parts = md.split('-'); return Number(parts[0]) * 100 + Number(parts[1]); };
    const aM = a.eventType === 'evergreen' ? 9999 : getSortM(a.dateStart);
    const bM = b.eventType === 'evergreen' ? 9999 : getSortM(b.dateStart);
    return aM - bM;
  });
};

export const getRelevantEvents = (date: Date, lookaheadDays: number = 30): CalendarEvent[] => {
  const currentY = date.getFullYear();
  const currentDoy = getDayOfYear(date);
  const targetDoy = currentDoy + lookaheadDays;

  return CALENDAR_EVENTS.filter(ev => {
    if (ev.eventType === 'evergreen') return true;

    const start = parseMonthDay(ev.dateStart);
    const end = parseMonthDay(ev.dateEnd);
    
    // Simplistic DOY estimation (assumes non-leap year for roughly checking)
    const startDoy = new Date(currentY, start.m - 1, start.d).getTime();
    const endDoy = new Date(currentY, end.m - 1, end.d).getTime();
    
    const sDoyLocal = getDayOfYear(new Date(currentY, start.m - 1, start.d));
    let eDoyLocal = getDayOfYear(new Date(currentY, end.m - 1, end.d));

    // Wrap around logic for things like DEC-JAN
    if (eDoyLocal < sDoyLocal) {
      if (currentDoy >= sDoyLocal || currentDoy <= eDoyLocal) return true;
      if (targetDoy >= sDoyLocal) return true;
      return false;
    }

    // Is current day inside the window?
    if (currentDoy >= sDoyLocal && currentDoy <= eDoyLocal) return true;
    
    // Is the window coming up within lookaheadDays?
    if (sDoyLocal > currentDoy && sDoyLocal <= targetDoy) return true;

    return false;
  }).sort((a, b) => {
    // Rank by commercial strength and priority
    if (a.eventType !== 'evergreen' && b.eventType === 'evergreen') return -1;
    if (a.eventType === 'evergreen' && b.eventType !== 'evergreen') return 1;
    const scoreA = a.priorityScore + a.commercialStrength;
    const scoreB = b.priorityScore + b.commercialStrength;
    return scoreB - scoreA;
  });
};

export const generatePrompts = (
  theme: CalendarEvent, 
  format: AssetFormat, 
  market: MarketPriority,
  count: number = 10
): GeneratedPrompt[] => {
  const prompts: GeneratedPrompt[] = [];

  const isGridMultiple = format.includes('Grid') && !format.includes('Grid 1x1');
  const isGrid1x1 = format.includes('Grid 1x1');
  const countStr = format.match(/\d+x\d+/)?.[0] || '1x1';
  const gridCount = countStr === '2x2' ? 4 : countStr === '3x3' ? 9 : countStr === '4x4' ? 16 : 1;

  // Grid Quality Rules Requirements
  const grid1x1Rules = "centered composition, full view, square composition, balanced padding / white space, no cropped edges, no touching frame borders, clean isolated presentation, strong silhouette readability";
  const gridMultipleRules = `exact ${gridCount} item count, strict grid layout, equal spacing, equal visual balance, no overlaps, no cropped items, no duplicates, style consistency, consistent scale, all items visually distinct`;

  // Iteration Variations
  const styleVariations = [
    "clean modern", "playful and vibrant", "minimalist", "premium and luxurious", 
    "abstract and geometric", "soft pastel", "bold pop art", "subtle organic", 
    "neon accent", "flat corporate"
  ];
  
  const angles = [
    "Core concept", "Youthful presentation", "Professional presentation", 
    "Trendy lifestyle", "Vintage/Retro twist", "Tech-infused", 
    "Eco-natural", "Elegant/Formal", "High contrast commercial", 
    "Welcoming/Warm"
  ];

  for (let i = 0; i < count; i++) {
    let mainPrompt = '';
    let negativePrompt = '';
    let title = '';

    const variationStyle = styleVariations[i % styleVariations.length];
    const angleText = angles[i % angles.length];
    
    // Mix tags slightly for variety
    const tagList = [...theme.tags].sort(() => 0.5 - Math.random()).slice(0, 4).join(', ');
    const specificAngle = `[${angleText}] ${theme.eventName}`;

    if (format === 'Photorealistic') {
      negativePrompt = 'avoid CGI look, plastic skin, over-sharpened detail, fake lighting, text, logo, watermark';
    } else if (isGridMultiple) {
      negativePrompt = 'avoid duplicate items, overlapping elements, uneven spacing, cropped items, inconsistent style, text, logo, watermark';
    } else {
      negativePrompt = 'avoid crop, cut-off edges, clutter, overlap, text, logo, watermark, duplicate symbols';
    }

    if (format.startsWith('Sticker')) {
      title = isGridMultiple ? `${countStr} Sticker Sheet: ${angleText}` : (isGrid1x1 ? `1x1 Sticker Grid: ${angleText}` : `Single Sticker: ${angleText}`);
      const baseSticker = `cute vector sticker, ${specificAngle}, featuring ${tagList}, thick white die-cut borders, flat illustration style, ${variationStyle} aesthetics, clean solid color background, commercial stock graphic bundle`;
      
      if (isGridMultiple) {
        mainPrompt = `${countStr} grid layout of ${gridCount} distinct ${baseSticker}, ${gridMultipleRules}, playful but commercially clean, clear sticker silhouette, enough spacing, no merged borders.`;
      } else if (isGrid1x1) {
        mainPrompt = `Single ${baseSticker}, ${grid1x1Rules}.`;
      } else {
        mainPrompt = `Single ${baseSticker}.`;
      }

    } else if (format.startsWith('Icon')) {
      title = isGridMultiple ? `${countStr} Icon Set: ${angleText}` : (isGrid1x1 ? `1x1 Icon Grid: ${angleText}` : `Single Icon: ${angleText}`);
      const baseIcon = `minimalist icon, ${specificAngle}, featuring ${tagList}, simple solid colors, clear readability, consistent line weight, flat vector UI style, ${variationStyle} colors, isolated on clean white background, digital stock asset collection`;
      
      if (isGridMultiple) {
        mainPrompt = `${countStr} grid layout of ${gridCount} distinct ${baseIcon}, ${gridMultipleRules}, readable at small size, consistent icon language, unified stroke/style.`;
      } else if (isGrid1x1) {
        mainPrompt = `Single ${baseIcon}, ${grid1x1Rules}.`;
      } else {
        mainPrompt = `Single ${baseIcon}.`;
      }

    } else if (format.startsWith('Vector')) {
      title = isGridMultiple ? `${countStr} Vector Bundle: ${angleText}` : (isGrid1x1 ? `1x1 Vector Grid: ${angleText}` : `Isolated Vector: ${angleText}`);
      const baseVector = `commercial vector illustration of ${specificAngle}, featuring ${tagList}, modern flat graphic design style, ${variationStyle} aesthetics, clean geometric shapes, gradient accents, isolated on clean background`;
      
      if (isGridMultiple) {
        mainPrompt = `${countStr} grid layout of ${gridCount} distinct ${baseVector}, ${gridMultipleRules}, clean commercial vector discipline, balanced negative space, no clutter, no filler symbols.`;
      } else if (isGrid1x1) {
        mainPrompt = `Single ${baseVector}, ${grid1x1Rules}.`;
      } else {
        mainPrompt = `Single ${baseVector}.`;
      }

    } else if (format === 'Object') {
      title = `Object Shot: ${angleText}`;
      mainPrompt = `High quality studio photography of a single object representing ${specificAngle}, featuring ${tagList}, well-lit luxury product shot, clean white seamless background, sharp focus, ${variationStyle} aesthetic, centralized composition`;

    } else if (format === 'Photorealistic') {
      title = `Premium Photo: ${angleText}`;
      mainPrompt = `Premium stock photography of ${specificAngle}, lifestyle aesthetic, people or setting representing ${tagList}, ${variationStyle} mood, natural bright lighting, shallow depth of field (bokeh), shot on 85mm lens, high resolution commercial photography, authentic emotion`;
    }

    prompts.push({
      id: `prompt_${Date.now()}_${i}_${Math.random().toString(36).substring(2,6)}`,
      theme: theme.eventName,
      dateRelevance: theme.eventType === 'evergreen' ? 'Always Relevant' : 'Upcoming Seasonal',
      marketPriority: market,
      assetFormat: format,
      promptTitle: title,
      mainPrompt,
      negativePrompt,
      commercialAngle: `High demand angle (${angleText}) for ${market === 'GLOBAL' ? 'worldwide' : market} marketing.`,
      keywords: [...new Set([theme.eventName.toLowerCase().replace(/[^a-z0-9]/g, ''), ...theme.tags])].slice(0, 7),
      priorityScore: theme.priorityScore + theme.commercialStrength
    });
  }

  return prompts;
};
