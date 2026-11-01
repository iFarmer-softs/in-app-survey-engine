import type { ReusableQuestionGroup, GroupQuestionTemplate, GroupCategory } from '../types/group';

const STORAGE_KEY = 'ifarmer_reusable_question_groups';

export const DEFAULT_QUESTION_GROUPS: ReusableQuestionGroup[] = [
  {
    id: 'grp-kyc-basic',
    name: 'Farmer Identity & KYC',
    nameBn: 'কৃষকের পরিচয় ও কেওয়াইসি (KYC)',
    description: 'Core farmer biometric, identity, and contact verification questions.',
    category: 'kyc',
    color: '#0284c7',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    questions: [
      {
        question: 'Farmer Full Name',
        question_bn: 'কৃষকের পূর্ণ নাম',
        answer_type: 'string',
        mandatory: true,
        placeholder: 'জাতীয় পরিচয়পত্র অনুযায়ী নাম লিখুন',
        hint: 'NID অনুযায়ী সঠিক বানান লিখুন',
      },
      {
        question: 'Mobile Phone Number',
        question_bn: 'মোবাইল ফোন নম্বর',
        answer_type: 'phone',
        mandatory: true,
        placeholder: '০১৭১XXXXXXX',
        hint: '১১ ডিজিটের সক্রিয় নম্বর লিখুন',
      },
      {
        question: 'National ID (NID) Number',
        question_bn: 'জাতীয় পরিচয়পত্র নম্বর (NID)',
        answer_type: 'string',
        mandatory: true,
        placeholder: '১০ বা ১৭ সংখ্যার নম্বর',
      },
      {
        question: 'Farmer Profile Photo',
        question_bn: 'কৃষকের ছবি',
        answer_type: 'image',
        mandatory: false,
        hint: 'ক্যামেরা দিয়ে সরাসরি ছবি তুলুন',
      },
    ],
  },
  {
    id: 'grp-land-cultivation',
    name: 'Land & Cultivation Assessment',
    nameBn: 'আবাদি জমি ও চাষাবাদ তথ্য',
    description: 'Landholding size, ownership structure, and plot details.',
    category: 'land',
    color: '#10b981',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    questions: [
      {
        question: 'Do you own cultivating land?',
        question_bn: 'আপনার কি নিজস্ব আবাদি জমি আছে?',
        answer_type: 'select_one',
        mandatory: true,
        options: 'হ্যাঁ (Yes), না (No)',
      },
      {
        question: 'Total Land Size (Decimals)',
        question_bn: 'মোট আবাদযোগ্য জমির পরিমাণ (শতাংশ)',
        answer_type: 'integer',
        mandatory: true,
        placeholder: 'যেমন: ৫০',
        hint: 'শতাংশে মোট পরিমাণ লিখুন',
      },
      {
        question: 'Land Ownership Type',
        question_bn: 'জমির মালিকানার ধরন',
        answer_type: 'dropdown',
        mandatory: true,
        options: 'নিজস্ব, বর্গা, লিজকৃত, যৌথ মালিকানা',
      },
    ],
  },
  {
    id: 'grp-crop-production',
    name: 'Crop & Production Details',
    nameBn: 'ফসল উৎপাদন ও মৌসুম তথ্য',
    description: 'Crop variety, harvest forecast, and cultivation cycle.',
    category: 'crop',
    color: '#f59e0b',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    questions: [
      {
        question: 'Primary Crop Variety',
        question_bn: 'প্রধান ফসলের ধরন',
        answer_type: 'dropdown',
        mandatory: true,
        options: 'আমন ধান, বোরো ধান, ভুট্টা, আলু, পেঁয়াজ, সবজি, মাছ চাষ',
      },
      {
        question: 'Current Sowing Date',
        question_bn: 'বীজ বপন / রোপণের তারিখ',
        answer_type: 'calendar',
        mandatory: true,
      },
      {
        question: 'Expected Production Yield (Maunds)',
        question_bn: 'প্রত্যাশিত মোট ফলন (মণ)',
        answer_type: 'integer',
        mandatory: true,
        placeholder: 'যেমন: ৪০',
      },
    ],
  },
  {
    id: 'grp-financial-income',
    name: 'Farm Financials & Income',
    nameBn: 'কৃষি আয় ও আর্থিক অবস্থা',
    description: 'Monthly income, secondary livelihood sources, and bank details.',
    category: 'financial',
    color: '#8b5cf6',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    questions: [
      {
        question: 'Estimated Monthly Farm Income (BDT)',
        question_bn: 'গড় মাসিক কৃষি আয় (টাকা)',
        answer_type: 'integer',
        mandatory: true,
        placeholder: 'যেমন: ২৫০০০',
      },
      {
        question: 'Other Secondary Income Source',
        question_bn: 'অন্যান্য আয়ের উৎস',
        answer_type: 'string',
        mandatory: false,
        placeholder: 'যেমন: ব্যবসা, দিনমজুরি, চাকরি',
      },
      {
        question: 'Do you have an active Bank/MFS Account?',
        question_bn: 'আপনার কি ব্যাংক বা বিকাশ/নগদ একাউন্ট আছে?',
        answer_type: 'select_one',
        mandatory: true,
        options: 'হ্যাঁ (Yes), না (No)',
      },
    ],
  },
  {
    id: 'grp-geo-verification',
    name: 'Geo-Verification & Field Visit',
    nameBn: 'খামারের জিও-লোকেশন ও মাঠ পরিদর্শন',
    description: 'Field photo with GPS coordinates and facilitator remarks.',
    category: 'verification',
    color: '#ec4899',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    questions: [
      {
        question: 'Farm Geo-tagged Picture',
        question_bn: 'খামারের ছবি (লোকেশনসহ)',
        answer_type: 'image',
        mandatory: true,
        hint: 'ক্যামেরা দিয়ে সরাসরি খামার বা ফসলের ছবি তুলুন',
      },
      {
        question: 'Facilitator Observation Remarks',
        question_bn: 'মাঠ কর্মকর্তার পর্যবেক্ষণ ও মন্তব্য',
        answer_type: 'text',
        mandatory: false,
        placeholder: 'ফসল বা খামারের অবস্থা বিস্তারিত লিখুন...',
      },
    ],
  },
];

export function loadAllGroups(): ReusableQuestionGroup[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      saveAllGroups(DEFAULT_QUESTION_GROUPS);
      return DEFAULT_QUESTION_GROUPS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    saveAllGroups(DEFAULT_QUESTION_GROUPS);
    return DEFAULT_QUESTION_GROUPS;
  } catch {
    return DEFAULT_QUESTION_GROUPS;
  }
}

export function saveAllGroups(groups: ReusableQuestionGroup[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
  } catch (err) {
    console.error('Failed to save reusable question groups to storage', err);
  }
}

export function createNewQuestionGroup(
  name: string,
  nameBn: string,
  description: string,
  category: GroupCategory,
  color: string,
  questions: GroupQuestionTemplate[]
): ReusableQuestionGroup {
  const newGroup: ReusableQuestionGroup = {
    id: `grp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    nameBn: nameBn || name,
    description: description || 'Custom reusable question group.',
    category: category || 'custom',
    color: color || '#0284c7',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    questions,
  };

  const groups = loadAllGroups();
  const updated = [newGroup, ...groups];
  saveAllGroups(updated);
  return newGroup;
}

export function updateQuestionGroup(
  id: string,
  updates: Partial<ReusableQuestionGroup>
): ReusableQuestionGroup[] {
  const groups = loadAllGroups();
  const updated = groups.map((g) => {
    if (g.id === id) {
      return {
        ...g,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
    }
    return g;
  });
  saveAllGroups(updated);
  return updated;
}

export function deleteQuestionGroup(id: string): ReusableQuestionGroup[] {
  const groups = loadAllGroups();
  const updated = groups.filter((g) => g.id !== id);
  saveAllGroups(updated);
  return updated;
}


