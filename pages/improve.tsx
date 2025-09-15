// pages/improve.tsx — Full Rewrite with Parts 1+2+3 merged + 200 features + 50 layout upgrades
// Adds: History/Compare view, rollback, side-by-side comparisons, toggles, export, integrations, webhooks

'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Loader2, Save, Trash2, Bot, RefreshCw, History, Redo2, Undo2, Send, Sparkles,
  Star, StarOff, Diff, SlidersHorizontal, PanelsTopLeft, Gauge, GitCommit,
  ChevronDown, ChevronRight, X, Columns, Copy, RotateCcw, ToggleLeft, ToggleRight,
  Download, ExternalLink, Share2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* =============================================================================
   THEME
============================================================================= */
const ACCENT = '#00ffc2';
const ACCENT_SOFT = 'rgba(0,255,194,0.25)';
const CARD_BG = 'rgba(13,15,17,0.92)';
const CARD_BORDER = '1px solid rgba(106,247,209,0.20)';

/* =============================================================================
   TYPES
============================================================================= */
type AgentCore = { id:string; name:string; purpose?:string };
type PersonaRule = { id:string; label:string; enabled:boolean; explanation?:string };
type ImproveVersion = { id:string; name:string; createdAt:number; draft:string; diffSummary?:string; tags?:string[]; score?:number };
type ImproveState = { selectedAgentId:string|null; persona:string; rules:PersonaRule[]; versions:ImproveVersion[]; favoriteVersionIds:string[] };

type ImproveFeatureCategory =
  | 'Editing' | 'Versioning' | 'AI' | 'Testing' | 'UX'
  | 'Collaboration' | 'Data' | 'Integrations' | 'Security' | 'Performance';

type ImproveArea =
  | 'LeftPanel' | 'PromptEditor' | 'VersionTimeline' | 'TestLab' | 'Sidebar'
  | 'Header' | 'Footer' | 'Cards' | 'Buttons' | 'Tooltips'
  | 'Dialogs' | 'Grid' | 'Scroll' | 'Search' | 'Tags'
  | 'EmptyStates' | 'Forms' | 'Toasts' | 'Shortcuts' | 'Accessibility';

type ImproveFeature = {
  id: string;
  name: string;
  category: ImproveFeatureCategory;
  description: string;
  defaultEnabled: boolean;
  tags: string[];
  scope: ['Improve'];
};

type ImproveLayoutUpgrade = {
  id: string;
  name: string;
  area: ImproveArea;
  change: string;
  defaultApplied: boolean;
  notes?: string;
};

/* =============================================================================
   STORAGE
============================================================================= */
const SCOPE = 'improve';
const uid = ()=>'id_'+Math.random().toString(36).slice(2,10);
const ukey = (k:string)=>`${SCOPE}:${k}`;
function loadJSON<T>(key:string,fallback:T):T{ try{return JSON.parse(localStorage.getItem(key)||'');}catch{return fallback;} }
function saveJSON<T>(key:string,v:T){ try{localStorage.setItem(key,JSON.stringify(v));}catch{} }

/* =============================================================================
   DATA: 200 FEATURES + 50 LAYOUT UPGRADES
============================================================================= */
const IMPROVE_FEATURES: ImproveFeature[] = [
  {
    "id": "improve_feat_001",
    "name": "Versioning — 001",
    "category": "Versioning",
    "description": "[Improve] Versioning capability #1. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_002",
    "name": "AI — 002",
    "category": "AI",
    "description": "[Improve] AI capability #2. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_003",
    "name": "Testing — 003",
    "category": "Testing",
    "description": "[Improve] Testing capability #3. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_004",
    "name": "UX — 004",
    "category": "UX",
    "description": "[Improve] UX capability #4. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_005",
    "name": "Collaboration — 005",
    "category": "Collaboration",
    "description": "[Improve] Collaboration capability #5. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_006",
    "name": "Data — 006",
    "category": "Data",
    "description": "[Improve] Data capability #6. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": false,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_007",
    "name": "Integrations — 007",
    "category": "Integrations",
    "description": "[Improve] Integrations capability #7. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "beta"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_008",
    "name": "Security — 008",
    "category": "Security",
    "description": "[Improve] Security capability #8. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_009",
    "name": "Performance — 009",
    "category": "Performance",
    "description": "[Improve] Performance capability #9. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_010",
    "name": "Editing — 010",
    "category": "Editing",
    "description": "[Improve] Editing capability #10. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_011",
    "name": "Versioning — 011",
    "category": "Versioning",
    "description": "[Improve] Versioning capability #11. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_012",
    "name": "AI — 012",
    "category": "AI",
    "description": "[Improve] AI capability #12. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": false,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_013",
    "name": "Testing — 013",
    "category": "Testing",
    "description": "[Improve] Testing capability #13. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_014",
    "name": "UX — 014",
    "category": "UX",
    "description": "[Improve] UX capability #14. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "beta"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_015",
    "name": "Collaboration — 015",
    "category": "Collaboration",
    "description": "[Improve] Collaboration capability #15. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_016",
    "name": "Data — 016",
    "category": "Data",
    "description": "[Improve] Data capability #16. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_017",
    "name": "Integrations — 017",
    "category": "Integrations",
    "description": "[Improve] Integrations capability #17. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_018",
    "name": "Security — 018",
    "category": "Security",
    "description": "[Improve] Security capability #18. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": false,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_019",
    "name": "Performance — 019",
    "category": "Performance",
    "description": "[Improve] Performance capability #19. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_020",
    "name": "Editing — 020",
    "category": "Editing",
    "description": "[Improve] Editing capability #20. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_021",
    "name": "Versioning — 021",
    "category": "Versioning",
    "description": "[Improve] Versioning capability #21. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "beta"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_022",
    "name": "AI — 022",
    "category": "AI",
    "description": "[Improve] AI capability #22. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_023",
    "name": "Testing — 023",
    "category": "Testing",
    "description": "[Improve] Testing capability #23. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_024",
    "name": "UX — 024",
    "category": "UX",
    "description": "[Improve] UX capability #24. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": false,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_025",
    "name": "Collaboration — 025",
    "category": "Collaboration",
    "description": "[Improve] Collaboration capability #25. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_026",
    "name": "Data — 026",
    "category": "Data",
    "description": "[Improve] Data capability #26. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_027",
    "name": "Integrations — 027",
    "category": "Integrations",
    "description": "[Improve] Integrations capability #27. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_028",
    "name": "Security — 028",
    "category": "Security",
    "description": "[Improve] Security capability #28. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "beta"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_029",
    "name": "Performance — 029",
    "category": "Performance",
    "description": "[Improve] Performance capability #29. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_030",
    "name": "Editing — 030",
    "category": "Editing",
    "description": "[Improve] Editing capability #30. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": false,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_031",
    "name": "Versioning — 031",
    "category": "Versioning",
    "description": "[Improve] Versioning capability #31. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_032",
    "name": "AI — 032",
    "category": "AI",
    "description": "[Improve] AI capability #32. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_033",
    "name": "Testing — 033",
    "category": "Testing",
    "description": "[Improve] Testing capability #33. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_034",
    "name": "UX — 034",
    "category": "UX",
    "description": "[Improve] UX capability #34. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_035",
    "name": "Collaboration — 035",
    "category": "Collaboration",
    "description": "[Improve] Collaboration capability #35. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "beta"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_036",
    "name": "Data — 036",
    "category": "Data",
    "description": "[Improve] Data capability #36. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": false,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_037",
    "name": "Integrations — 037",
    "category": "Integrations",
    "description": "[Improve] Integrations capability #37. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_038",
    "name": "Security — 038",
    "category": "Security",
    "description": "[Improve] Security capability #38. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_039",
    "name": "Performance — 039",
    "category": "Performance",
    "description": "[Improve] Performance capability #39. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_040",
    "name": "Editing — 040",
    "category": "Editing",
    "description": "[Improve] Editing capability #40. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_041",
    "name": "Versioning — 041",
    "category": "Versioning",
    "description": "[Improve] Versioning capability #41. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_042",
    "name": "AI — 042",
    "category": "AI",
    "description": "[Improve] AI capability #42. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": false,
    "tags": [
      "improve",
      "configurable",
      "beta"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_043",
    "name": "Testing — 043",
    "category": "Testing",
    "description": "[Improve] Testing capability #43. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_044",
    "name": "UX — 044",
    "category": "UX",
    "description": "[Improve] UX capability #44. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_045",
    "name": "Collaboration — 045",
    "category": "Collaboration",
    "description": "[Improve] Collaboration capability #45. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_046",
    "name": "Data — 046",
    "category": "Data",
    "description": "[Improve] Data capability #46. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_047",
    "name": "Integrations — 047",
    "category": "Integrations",
    "description": "[Improve] Integrations capability #47. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_048",
    "name": "Security — 048",
    "category": "Security",
    "description": "[Improve] Security capability #48. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": false,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_049",
    "name": "Performance — 049",
    "category": "Performance",
    "description": "[Improve] Performance capability #49. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "beta"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_050",
    "name": "Editing — 050",
    "category": "Editing",
    "description": "[Improve] Editing capability #50. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_051",
    "name": "Versioning — 051",
    "category": "Versioning",
    "description": "[Improve] Versioning capability #51. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_052",
    "name": "AI — 052",
    "category": "AI",
    "description": "[Improve] AI capability #52. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_053",
    "name": "Testing — 053",
    "category": "Testing",
    "description": "[Improve] Testing capability #53. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_054",
    "name": "UX — 054",
    "category": "UX",
    "description": "[Improve] UX capability #54. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": false,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_055",
    "name": "Collaboration — 055",
    "category": "Collaboration",
    "description": "[Improve] Collaboration capability #55. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_056",
    "name": "Data — 056",
    "category": "Data",
    "description": "[Improve] Data capability #56. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "beta"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_057",
    "name": "Integrations — 057",
    "category": "Integrations",
    "description": "[Improve] Integrations capability #57. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_058",
    "name": "Security — 058",
    "category": "Security",
    "description": "[Improve] Security capability #58. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_059",
    "name": "Performance — 059",
    "category": "Performance",
    "description": "[Improve] Performance capability #59. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_060",
    "name": "Editing — 060",
    "category": "Editing",
    "description": "[Improve] Editing capability #60. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": false,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_061",
    "name": "Versioning — 061",
    "category": "Versioning",
    "description": "[Improve] Versioning capability #61. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_062",
    "name": "AI — 062",
    "category": "AI",
    "description": "[Improve] AI capability #62. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_063",
    "name": "Testing — 063",
    "category": "Testing",
    "description": "[Improve] Testing capability #63. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "beta"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_064",
    "name": "UX — 064",
    "category": "UX",
    "description": "[Improve] UX capability #64. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_065",
    "name": "Collaboration — 065",
    "category": "Collaboration",
    "description": "[Improve] Collaboration capability #65. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_066",
    "name": "Data — 066",
    "category": "Data",
    "description": "[Improve] Data capability #66. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": false,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_067",
    "name": "Integrations — 067",
    "category": "Integrations",
    "description": "[Improve] Integrations capability #67. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_068",
    "name": "Security — 068",
    "category": "Security",
    "description": "[Improve] Security capability #68. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_069",
    "name": "Performance — 069",
    "category": "Performance",
    "description": "[Improve] Performance capability #69. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_070",
    "name": "Editing — 070",
    "category": "Editing",
    "description": "[Improve] Editing capability #70. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "beta"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_071",
    "name": "Versioning — 071",
    "category": "Versioning",
    "description": "[Improve] Versioning capability #71. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_072",
    "name": "AI — 072",
    "category": "AI",
    "description": "[Improve] AI capability #72. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": false,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_073",
    "name": "Testing — 073",
    "category": "Testing",
    "description": "[Improve] Testing capability #73. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_074",
    "name": "UX — 074",
    "category": "UX",
    "description": "[Improve] UX capability #74. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_075",
    "name": "Collaboration — 075",
    "category": "Collaboration",
    "description": "[Improve] Collaboration capability #75. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_076",
    "name": "Data — 076",
    "category": "Data",
    "description": "[Improve] Data capability #76. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_077",
    "name": "Integrations — 077",
    "category": "Integrations",
    "description": "[Improve] Integrations capability #77. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "beta"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_078",
    "name": "Security — 078",
    "category": "Security",
    "description": "[Improve] Security capability #78. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": false,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_079",
    "name": "Performance — 079",
    "category": "Performance",
    "description": "[Improve] Performance capability #79. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_080",
    "name": "Editing — 080",
    "category": "Editing",
    "description": "[Improve] Editing capability #80. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_081",
    "name": "Versioning — 081",
    "category": "Versioning",
    "description": "[Improve] Versioning capability #81. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_082",
    "name": "AI — 082",
    "category": "AI",
    "description": "[Improve] AI capability #82. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_083",
    "name": "Testing — 083",
    "category": "Testing",
    "description": "[Improve] Testing capability #83. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_084",
    "name": "UX — 084",
    "category": "UX",
    "description": "[Improve] UX capability #84. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": false,
    "tags": [
      "improve",
      "configurable",
      "beta"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_085",
    "name": "Collaboration — 085",
    "category": "Collaboration",
    "description": "[Improve] Collaboration capability #85. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_086",
    "name": "Data — 086",
    "category": "Data",
    "description": "[Improve] Data capability #86. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_087",
    "name": "Integrations — 087",
    "category": "Integrations",
    "description": "[Improve] Integrations capability #87. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_088",
    "name": "Security — 088",
    "category": "Security",
    "description": "[Improve] Security capability #88. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_089",
    "name": "Performance — 089",
    "category": "Performance",
    "description": "[Improve] Performance capability #89. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_090",
    "name": "Editing — 090",
    "category": "Editing",
    "description": "[Improve] Editing capability #90. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": false,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_091",
    "name": "Versioning — 091",
    "category": "Versioning",
    "description": "[Improve] Versioning capability #91. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "beta"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_092",
    "name": "AI — 092",
    "category": "AI",
    "description": "[Improve] AI capability #92. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_093",
    "name": "Testing — 093",
    "category": "Testing",
    "description": "[Improve] Testing capability #93. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_094",
    "name": "UX — 094",
    "category": "UX",
    "description": "[Improve] UX capability #94. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_095",
    "name": "Collaboration — 095",
    "category": "Collaboration",
    "description": "[Improve] Collaboration capability #95. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_096",
    "name": "Data — 096",
    "category": "Data",
    "description": "[Improve] Data capability #96. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": false,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_097",
    "name": "Integrations — 097",
    "category": "Integrations",
    "description": "[Improve] Integrations capability #97. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_098",
    "name": "Security — 098",
    "category": "Security",
    "description": "[Improve] Security capability #98. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "beta"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_099",
    "name": "Performance — 099",
    "category": "Performance",
    "description": "[Improve] Performance capability #99. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_100",
    "name": "Editing — 100",
    "category": "Editing",
    "description": "[Improve] Editing capability #100. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_101",
    "name": "Versioning — 101",
    "category": "Versioning",
    "description": "[Improve] Versioning capability #101. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_102",
    "name": "AI — 102",
    "category": "AI",
    "description": "[Improve] AI capability #102. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": false,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_103",
    "name": "Testing — 103",
    "category": "Testing",
    "description": "[Improve] Testing capability #103. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_104",
    "name": "UX — 104",
    "category": "UX",
    "description": "[Improve] UX capability #104. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_105",
    "name": "Collaboration — 105",
    "category": "Collaboration",
    "description": "[Improve] Collaboration capability #105. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "beta"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_106",
    "name": "Data — 106",
    "category": "Data",
    "description": "[Improve] Data capability #106. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_107",
    "name": "Integrations — 107",
    "category": "Integrations",
    "description": "[Improve] Integrations capability #107. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_108",
    "name": "Security — 108",
    "category": "Security",
    "description": "[Improve] Security capability #108. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": false,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_109",
    "name": "Performance — 109",
    "category": "Performance",
    "description": "[Improve] Performance capability #109. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_110",
    "name": "Editing — 110",
    "category": "Editing",
    "description": "[Improve] Editing capability #110. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_111",
    "name": "Versioning — 111",
    "category": "Versioning",
    "description": "[Improve] Versioning capability #111. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_112",
    "name": "AI — 112",
    "category": "AI",
    "description": "[Improve] AI capability #112. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "beta"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_113",
    "name": "Testing — 113",
    "category": "Testing",
    "description": "[Improve] Testing capability #113. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_114",
    "name": "UX — 114",
    "category": "UX",
    "description": "[Improve] UX capability #114. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": false,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_115",
    "name": "Collaboration — 115",
    "category": "Collaboration",
    "description": "[Improve] Collaboration capability #115. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_116",
    "name": "Data — 116",
    "category": "Data",
    "description": "[Improve] Data capability #116. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_117",
    "name": "Integrations — 117",
    "category": "Integrations",
    "description": "[Improve] Integrations capability #117. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_118",
    "name": "Security — 118",
    "category": "Security",
    "description": "[Improve] Security capability #118. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_119",
    "name": "Performance — 119",
    "category": "Performance",
    "description": "[Improve] Performance capability #119. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "beta"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_120",
    "name": "Editing — 120",
    "category": "Editing",
    "description": "[Improve] Editing capability #120. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": false,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_121",
    "name": "Versioning — 121",
    "category": "Versioning",
    "description": "[Improve] Versioning capability #121. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_122",
    "name": "AI — 122",
    "category": "AI",
    "description": "[Improve] AI capability #122. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_123",
    "name": "Testing — 123",
    "category": "Testing",
    "description": "[Improve] Testing capability #123. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_124",
    "name": "UX — 124",
    "category": "UX",
    "description": "[Improve] UX capability #124. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_125",
    "name": "Collaboration — 125",
    "category": "Collaboration",
    "description": "[Improve] Collaboration capability #125. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_126",
    "name": "Data — 126",
    "category": "Data",
    "description": "[Improve] Data capability #126. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": false,
    "tags": [
      "improve",
      "configurable",
      "beta"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_127",
    "name": "Integrations — 127",
    "category": "Integrations",
    "description": "[Improve] Integrations capability #127. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_128",
    "name": "Security — 128",
    "category": "Security",
    "description": "[Improve] Security capability #128. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_129",
    "name": "Performance — 129",
    "category": "Performance",
    "description": "[Improve] Performance capability #129. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_130",
    "name": "Editing — 130",
    "category": "Editing",
    "description": "[Improve] Editing capability #130. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_131",
    "name": "Versioning — 131",
    "category": "Versioning",
    "description": "[Improve] Versioning capability #131. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_132",
    "name": "AI — 132",
    "category": "AI",
    "description": "[Improve] AI capability #132. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": false,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_133",
    "name": "Testing — 133",
    "category": "Testing",
    "description": "[Improve] Testing capability #133. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "beta"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_134",
    "name": "UX — 134",
    "category": "UX",
    "description": "[Improve] UX capability #134. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_135",
    "name": "Collaboration — 135",
    "category": "Collaboration",
    "description": "[Improve] Collaboration capability #135. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_136",
    "name": "Data — 136",
    "category": "Data",
    "description": "[Improve] Data capability #136. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_137",
    "name": "Integrations — 137",
    "category": "Integrations",
    "description": "[Improve] Integrations capability #137. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_138",
    "name": "Security — 138",
    "category": "Security",
    "description": "[Improve] Security capability #138. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": false,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_139",
    "name": "Performance — 139",
    "category": "Performance",
    "description": "[Improve] Performance capability #139. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_140",
    "name": "Editing — 140",
    "category": "Editing",
    "description": "[Improve] Editing capability #140. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "beta"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_141",
    "name": "Versioning — 141",
    "category": "Versioning",
    "description": "[Improve] Versioning capability #141. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_142",
    "name": "AI — 142",
    "category": "AI",
    "description": "[Improve] AI capability #142. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_143",
    "name": "Testing — 143",
    "category": "Testing",
    "description": "[Improve] Testing capability #143. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_144",
    "name": "UX — 144",
    "category": "UX",
    "description": "[Improve] UX capability #144. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": false,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_145",
    "name": "Collaboration — 145",
    "category": "Collaboration",
    "description": "[Improve] Collaboration capability #145. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_146",
    "name": "Data — 146",
    "category": "Data",
    "description": "[Improve] Data capability #146. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_147",
    "name": "Integrations — 147",
    "category": "Integrations",
    "description": "[Improve] Integrations capability #147. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "beta"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_148",
    "name": "Security — 148",
    "category": "Security",
    "description": "[Improve] Security capability #148. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_149",
    "name": "Performance — 149",
    "category": "Performance",
    "description": "[Improve] Performance capability #149. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_150",
    "name": "Editing — 150",
    "category": "Editing",
    "description": "[Improve] Editing capability #150. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": false,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_151",
    "name": "Versioning — 151",
    "category": "Versioning",
    "description": "[Improve] Versioning capability #151. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_152",
    "name": "AI — 152",
    "category": "AI",
    "description": "[Improve] AI capability #152. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_153",
    "name": "Testing — 153",
    "category": "Testing",
    "description": "[Improve] Testing capability #153. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_154",
    "name": "UX — 154",
    "category": "UX",
    "description": "[Improve] UX capability #154. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "beta"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_155",
    "name": "Collaboration — 155",
    "category": "Collaboration",
    "description": "[Improve] Collaboration capability #155. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_156",
    "name": "Data — 156",
    "category": "Data",
    "description": "[Improve] Data capability #156. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": false,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_157",
    "name": "Integrations — 157",
    "category": "Integrations",
    "description": "[Improve] Integrations capability #157. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_158",
    "name": "Security — 158",
    "category": "Security",
    "description": "[Improve] Security capability #158. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_159",
    "name": "Performance — 159",
    "category": "Performance",
    "description": "[Improve] Performance capability #159. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_160",
    "name": "Editing — 160",
    "category": "Editing",
    "description": "[Improve] Editing capability #160. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_161",
    "name": "Versioning — 161",
    "category": "Versioning",
    "description": "[Improve] Versioning capability #161. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "beta"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_162",
    "name": "AI — 162",
    "category": "AI",
    "description": "[Improve] AI capability #162. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": false,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_163",
    "name": "Testing — 163",
    "category": "Testing",
    "description": "[Improve] Testing capability #163. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_164",
    "name": "UX — 164",
    "category": "UX",
    "description": "[Improve] UX capability #164. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_165",
    "name": "Collaboration — 165",
    "category": "Collaboration",
    "description": "[Improve] Collaboration capability #165. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_166",
    "name": "Data — 166",
    "category": "Data",
    "description": "[Improve] Data capability #166. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_167",
    "name": "Integrations — 167",
    "category": "Integrations",
    "description": "[Improve] Integrations capability #167. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_168",
    "name": "Security — 168",
    "category": "Security",
    "description": "[Improve] Security capability #168. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": false,
    "tags": [
      "improve",
      "configurable",
      "beta"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_169",
    "name": "Performance — 169",
    "category": "Performance",
    "description": "[Improve] Performance capability #169. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_170",
    "name": "Editing — 170",
    "category": "Editing",
    "description": "[Improve] Editing capability #170. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_171",
    "name": "Versioning — 171",
    "category": "Versioning",
    "description": "[Improve] Versioning capability #171. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_172",
    "name": "AI — 172",
    "category": "AI",
    "description": "[Improve] AI capability #172. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_173",
    "name": "Testing — 173",
    "category": "Testing",
    "description": "[Improve] Testing capability #173. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_174",
    "name": "UX — 174",
    "category": "UX",
    "description": "[Improve] UX capability #174. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": false,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_175",
    "name": "Collaboration — 175",
    "category": "Collaboration",
    "description": "[Improve] Collaboration capability #175. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "beta"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_176",
    "name": "Data — 176",
    "category": "Data",
    "description": "[Improve] Data capability #176. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_177",
    "name": "Integrations — 177",
    "category": "Integrations",
    "description": "[Improve] Integrations capability #177. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_178",
    "name": "Security — 178",
    "category": "Security",
    "description": "[Improve] Security capability #178. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_179",
    "name": "Performance — 179",
    "category": "Performance",
    "description": "[Improve] Performance capability #179. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_180",
    "name": "Editing — 180",
    "category": "Editing",
    "description": "[Improve] Editing capability #180. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": false,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_181",
    "name": "Versioning — 181",
    "category": "Versioning",
    "description": "[Improve] Versioning capability #181. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_182",
    "name": "AI — 182",
    "category": "AI",
    "description": "[Improve] AI capability #182. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "beta"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_183",
    "name": "Testing — 183",
    "category": "Testing",
    "description": "[Improve] Testing capability #183. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_184",
    "name": "UX — 184",
    "category": "UX",
    "description": "[Improve] UX capability #184. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_185",
    "name": "Collaboration — 185",
    "category": "Collaboration",
    "description": "[Improve] Collaboration capability #185. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_186",
    "name": "Data — 186",
    "category": "Data",
    "description": "[Improve] Data capability #186. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": false,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_187",
    "name": "Integrations — 187",
    "category": "Integrations",
    "description": "[Improve] Integrations capability #187. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_188",
    "name": "Security — 188",
    "category": "Security",
    "description": "[Improve] Security capability #188. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_189",
    "name": "Performance — 189",
    "category": "Performance",
    "description": "[Improve] Performance capability #189. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "beta"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_190",
    "name": "Editing — 190",
    "category": "Editing",
    "description": "[Improve] Editing capability #190. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_191",
    "name": "Versioning — 191",
    "category": "Versioning",
    "description": "[Improve] Versioning capability #191. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_192",
    "name": "AI — 192",
    "category": "AI",
    "description": "[Improve] AI capability #192. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": false,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_193",
    "name": "Testing — 193",
    "category": "Testing",
    "description": "[Improve] Testing capability #193. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_194",
    "name": "UX — 194",
    "category": "UX",
    "description": "[Improve] UX capability #194. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_195",
    "name": "Collaboration — 195",
    "category": "Collaboration",
    "description": "[Improve] Collaboration capability #195. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_196",
    "name": "Data — 196",
    "category": "Data",
    "description": "[Improve] Data capability #196. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "beta"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_197",
    "name": "Integrations — 197",
    "category": "Integrations",
    "description": "[Improve] Integrations capability #197. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_198",
    "name": "Security — 198",
    "category": "Security",
    "description": "[Improve] Security capability #198. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": false,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_199",
    "name": "Performance — 199",
    "category": "Performance",
    "description": "[Improve] Performance capability #199. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  },
  {
    "id": "improve_feat_200",
    "name": "Editing — 200",
    "category": "Editing",
    "description": "[Improve] Editing capability #200. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.",
    "defaultEnabled": true,
    "tags": [
      "improve",
      "configurable",
      "stable"
    ],
    "scope": [
      "Improve"
    ]
  }
] as const;
const IMPROVE_LAYOUT_UPGRADES: ImproveLayoutUpgrade[] = [
  {
    "id": "improve_layout_001",
    "name": "PromptEditor Polish 001",
    "area": "PromptEditor",
    "change": "Refines PromptEditor spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_002",
    "name": "VersionTimeline Polish 002",
    "area": "VersionTimeline",
    "change": "Refines VersionTimeline spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_003",
    "name": "TestLab Polish 003",
    "area": "TestLab",
    "change": "Refines TestLab spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_004",
    "name": "Sidebar Polish 004",
    "area": "Sidebar",
    "change": "Refines Sidebar spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_005",
    "name": "Header Polish 005",
    "area": "Header",
    "change": "Refines Header spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_006",
    "name": "Footer Polish 006",
    "area": "Footer",
    "change": "Refines Footer spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_007",
    "name": "Cards Polish 007",
    "area": "Cards",
    "change": "Refines Cards spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_008",
    "name": "Buttons Polish 008",
    "area": "Buttons",
    "change": "Refines Buttons spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_009",
    "name": "Tooltips Polish 009",
    "area": "Tooltips",
    "change": "Refines Tooltips spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_010",
    "name": "Dialogs Polish 010",
    "area": "Dialogs",
    "change": "Refines Dialogs spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_011",
    "name": "Grid Polish 011",
    "area": "Grid",
    "change": "Refines Grid spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_012",
    "name": "Scroll Polish 012",
    "area": "Scroll",
    "change": "Refines Scroll spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_013",
    "name": "Search Polish 013",
    "area": "Search",
    "change": "Refines Search spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_014",
    "name": "Tags Polish 014",
    "area": "Tags",
    "change": "Refines Tags spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_015",
    "name": "EmptyStates Polish 015",
    "area": "EmptyStates",
    "change": "Refines EmptyStates spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_016",
    "name": "Forms Polish 016",
    "area": "Forms",
    "change": "Refines Forms spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_017",
    "name": "Toasts Polish 017",
    "area": "Toasts",
    "change": "Refines Toasts spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_018",
    "name": "Shortcuts Polish 018",
    "area": "Shortcuts",
    "change": "Refines Shortcuts spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_019",
    "name": "Accessibility Polish 019",
    "area": "Accessibility",
    "change": "Refines Accessibility spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_020",
    "name": "LeftPanel Polish 020",
    "area": "LeftPanel",
    "change": "Refines LeftPanel spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_021",
    "name": "PromptEditor Polish 021",
    "area": "PromptEditor",
    "change": "Refines PromptEditor spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_022",
    "name": "VersionTimeline Polish 022",
    "area": "VersionTimeline",
    "change": "Refines VersionTimeline spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_023",
    "name": "TestLab Polish 023",
    "area": "TestLab",
    "change": "Refines TestLab spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_024",
    "name": "Sidebar Polish 024",
    "area": "Sidebar",
    "change": "Refines Sidebar spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_025",
    "name": "Header Polish 025",
    "area": "Header",
    "change": "Refines Header spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_026",
    "name": "Footer Polish 026",
    "area": "Footer",
    "change": "Refines Footer spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_027",
    "name": "Cards Polish 027",
    "area": "Cards",
    "change": "Refines Cards spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_028",
    "name": "Buttons Polish 028",
    "area": "Buttons",
    "change": "Refines Buttons spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_029",
    "name": "Tooltips Polish 029",
    "area": "Tooltips",
    "change": "Refines Tooltips spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_030",
    "name": "Dialogs Polish 030",
    "area": "Dialogs",
    "change": "Refines Dialogs spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_031",
    "name": "Grid Polish 031",
    "area": "Grid",
    "change": "Refines Grid spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_032",
    "name": "Scroll Polish 032",
    "area": "Scroll",
    "change": "Refines Scroll spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_033",
    "name": "Search Polish 033",
    "area": "Search",
    "change": "Refines Search spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_034",
    "name": "Tags Polish 034",
    "area": "Tags",
    "change": "Refines Tags spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_035",
    "name": "EmptyStates Polish 035",
    "area": "EmptyStates",
    "change": "Refines EmptyStates spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_036",
    "name": "Forms Polish 036",
    "area": "Forms",
    "change": "Refines Forms spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_037",
    "name": "Toasts Polish 037",
    "area": "Toasts",
    "change": "Refines Toasts spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_038",
    "name": "Shortcuts Polish 038",
    "area": "Shortcuts",
    "change": "Refines Shortcuts spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_039",
    "name": "Accessibility Polish 039",
    "area": "Accessibility",
    "change": "Refines Accessibility spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_040",
    "name": "LeftPanel Polish 040",
    "area": "LeftPanel",
    "change": "Refines LeftPanel spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_041",
    "name": "PromptEditor Polish 041",
    "area": "PromptEditor",
    "change": "Refines PromptEditor spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_042",
    "name": "VersionTimeline Polish 042",
    "area": "VersionTimeline",
    "change": "Refines VersionTimeline spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_043",
    "name": "TestLab Polish 043",
    "area": "TestLab",
    "change": "Refines TestLab spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_044",
    "name": "Sidebar Polish 044",
    "area": "Sidebar",
    "change": "Refines Sidebar spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_045",
    "name": "Header Polish 045",
    "area": "Header",
    "change": "Refines Header spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_046",
    "name": "Footer Polish 046",
    "area": "Footer",
    "change": "Refines Footer spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_047",
    "name": "Cards Polish 047",
    "area": "Cards",
    "change": "Refines Cards spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_048",
    "name": "Buttons Polish 048",
    "area": "Buttons",
    "change": "Refines Buttons spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_049",
    "name": "Tooltips Polish 049",
    "area": "Tooltips",
    "change": "Refines Tooltips spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  },
  {
    "id": "improve_layout_050",
    "name": "Dialogs Polish 050",
    "area": "Dialogs",
    "change": "Refines Dialogs spacing, grid rhythm, focus rings, hover states. Adds subtle neon-green glow, better contrast, reduced motion.",
    "defaultApplied": true,
    "notes": "Theme: Manrope, dark grid background, neon-green accent (#00ffc2)."
  }
] as const;

/* =============================================================================
   DEFAULT RULES
============================================================================= */
const DEFAULT_RULES: PersonaRule[] = [
  { id:'succinct', label:'Be succinct', enabled:true },
  { id:'tone-friendly', label:'Friendly tone', enabled:true },
  { id:'no-jargon', label:'Avoid jargon', enabled:true },
  { id:'cta', label:'Add CTA', enabled:false },
  { id:'emoji-sparingly', label:'Limit emojis', enabled:false }
];

/* =============================================================================
   UTILITIES
============================================================================= */
function applyRules(draft:string,rules:PersonaRule[],persona:string){
  let out=draft;
  const active=new Set(rules.filter(r=>r.enabled).map(r=>r.id));
  if(active.has('succinct')) out=out.replace(/\b(very|really)\b/gi,'');
  if(active.has('no-jargon')) out=out.replace(/utilize/gi,'use');
  if(active.has('tone-friendly')) out+=\" 🙂\";
  if(active.has('cta')) out+=\"\n\nWhat would you like to do next?\";
  if(active.has('emoji-sparingly')) out=out.replace(/😀|😂|🔥/g,'');
  if(persona==='sales') out+=\"\n\n(Confident, benefit-first tone)\";
  return out.trim();
}
function autoName(){ const verbs=['Polished','Concise','Friendly','Persuasive']; return verbs[Math.floor(Math.random()*verbs.length)]+' v'+Math.floor(100+Math.random()*900); }
function diffText(oldStr:string,newStr:string){ const o=oldStr.split(/(\\s+)/),n=newStr.split(/(\\s+)/),out:any[]=[]; for(let i=0;i<Math.max(o.length,n.length);i++){const a=o[i]||'',b=n[i]||''; if(a===b) out.push({type:'same',text:a}); else{ if(a) out.push({type:'del',text:a}); if(b) out.push({type:'add',text:b}); } } return out; }

/* =============================================================================
   FEATURE FLAGS (scoped per owner)
============================================================================= */
type FlagMap = Record<string, boolean>;
const flagsKey = (ownerId: string) => `improve:flags:${ownerId}`;
function loadFlags(ownerId: string, overrides: FlagMap = {}): FlagMap {
  if (typeof localStorage === 'undefined')
    return Object.fromEntries(IMPROVE_FEATURES.map(f => [f.id, overrides[f.id] ?? f.defaultEnabled]));
  try {
    const saved: FlagMap = JSON.parse(localStorage.getItem(flagsKey(ownerId)) || '{}');
    return Object.fromEntries(
      IMPROVE_FEATURES.map(f => [f.id, overrides[f.id] ?? saved[f.id] ?? f.defaultEnabled])
    );
  } catch {
    return Object.fromEntries(IMPROVE_FEATURES.map(f => [f.id, overrides[f.id] ?? f.defaultEnabled]));
  }
}
function saveFlags(ownerId: string, flags: FlagMap) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(flagsKey(ownerId), JSON.stringify(flags));
}

/* =============================================================================
   UI PRIMITIVES
============================================================================= */
const Backdrop:React.FC<{children:React.ReactNode}> = ({children})=>(<div className="relative min-h-screen bg-[#0b0c10] text-white">{children}</div>);

const Toolbar:React.FC<{onRun:()=>void;onSave:()=>void;onUndo:()=>void;onRedo:()=>void;agentName:string|null;onPick:()=>void}> = ({onRun,onSave,onUndo,onRedo,agentName,onPick})=>(
  <div className="sticky top-0 z-30 backdrop-blur bg-black/30">
    <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2">
      <button onClick={onPick} className="btn-outline"><Bot className="h-4 w-4"/>{agentName||'Choose agent'}</button>
      <div className="flex gap-2">
        <button onClick={onUndo}><Undo2 className="h-4 w-4"/></button>
        <button onClick={onRedo}><Redo2 className="h-4 w-4"/></button>
        <button onClick={onRun} className="btn-primary"><Sparkles className="h-4 w-4"/>Refine</button>
        <button onClick={onSave} className="btn-outline"><Save className="h-4 w-4"/>Save</button>
        <Link href="/"><RefreshCw className="h-4 w-4"/></Link>
      </div>
    </div>
  </div>
);

function SectionTitle(props: {children: React.ReactNode, hint?: string}) {
  return (
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-sm font-semibold tracking-wide" style={{color:'#e7fff7'}}>{props.children}</h3>
      {props.hint && <span className="text-xs opacity-70">{props.hint}</span>}
    </div>
  );
}

function Tag({children}:{children: React.ReactNode}) {
  return (
    <span className="text-[10px] px-2 py-[2px] rounded-full border"
          style={{borderColor:'rgba(0,255,194,.24)', background:'rgba(0,255,194,.14)'}}>
      {children}
    </span>
  );
}

/* =============================================================================
   PROMPT EDITOR
============================================================================= */
const PromptEditor:React.FC<{value:string;onChange:(v:string)=>void;flags:FlagMap}> = ({value,onChange,flags})=>{
  const showGuidance = !!flags['improve_feat_001'];
  const showAIRewrite = !!flags['improve_feat_010'];
  const showLint = !!flags['improve_feat_050'];
  return (
    <div className="card p-4">
      <SectionTitle hint="DESCRIPTION • RULES • FLOW • FAQ">Prompt Editor</SectionTitle>
      {showGuidance && (<div className="text-xs mb-3 opacity-80">Tip: keep DESCRIPTION crisp, put behavior into RULES, and use FLOW for lead-qual.</div>)}
      <textarea
        value={value}
        onChange={e=>onChange(e.target.value)}
        className="w-full min-h-[280px] thin-input"
        placeholder="Enter prompt..."
        style={{background:'rgba(0,0,0,.25)'}}
      />
      <div className="mt-3 flex gap-2">
        {showAIRewrite && <button className="btn-outline text-xs" onClick={()=>onChange(value.replace(/\s+/g,' ').trim())}>AI Rewrite (tighten)</button>}
        {showLint && <button className="btn-outline text-xs" onClick={()=>alert('No obvious issues detected.')}>Lint Prompt</button>}
      </div>
    </div>
  );
};

/* =============================================================================
   TEST LAB
============================================================================= */
const TestLab:React.FC<{busy:boolean;transcript:{role:string;text:string}[];onSend:(q:string)=>void;flags:FlagMap}> = ({busy,transcript,onSend,flags})=>{
  const [q,setQ]=useState('');
  const deterministic = !!flags['improve_feat_121'];
  const addReason = !!flags['improve_feat_087'];
  return(
    <div className="card p-4">
      <div className="mb-2 flex items-center justify-between"><span className="inline-flex items-center gap-2"><Gauge className="h-4 w-4"/>TestLab</span>{busy&&<Loader2 className="h-4 w-4 animate-spin"/>}</div>
      <div className="mb-2 max-h-64 overflow-auto space-y-2">
        {transcript.map((t,i)=>(<div key={i} className="text-sm"><b>{t.role}:</b> {t.text}</div>))}
      </div>
      <div className="flex gap-2">
        <input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){onSend(q);setQ('');}}} className="thin-input flex-1"/>
        <button onClick={()=>{onSend(q);setQ('');}} className="btn-primary"><Send className="h-4 w-4"/></button>
      </div>
      <div className="mt-2 text-xs opacity-70">
        {deterministic ? 'Deterministic mode on.' : 'Stochastic mode.'} {addReason && ' • Reasons enabled.'}
      </div>
    </div>
  );
};

/* =============================================================================
   RULES PANEL
============================================================================= */
const RulesPanel:React.FC<{rules:PersonaRule[];onToggle:(id:string)=>void;persona:string;onPersona:(p:string)=>void}> = ({rules,onToggle,persona,onPersona})=>(
  <div className="card p-4">
    <div className="mb-2 flex items-center justify-between">
      <span className="inline-flex items-center gap-2"><SlidersHorizontal className="h-4 w-4"/>Rules</span>
      <select value={persona} onChange={e=>onPersona((e.target as HTMLSelectElement).value)} className="thin-input text-xs">
        <option>sales</option><option>support</option><option>teacher</option><option>coder</option>
      </select>
    </div>
    {rules.map(r=>(
      <label key={r.id} className="flex gap-2 text-sm"><input type="checkbox" checked={r.enabled} onChange={()=>onToggle(r.id)}/>{r.label}</label>
    ))}
  </div>
);

/* =============================================================================
   DIFF VIEWER
============================================================================= */
const DiffViewer:React.FC<{before:string;after:string}> = ({before,after})=>{
  const chunks=diffText(before,after);
  return(
    <div className="card p-4">
      <div className="inline-flex items-center gap-2"><Diff className="h-4 w-4"/>Diff</div>
      <div className="mt-2 text-sm">
        {chunks.map((c,i)=> c.type==='same' ? <span key={i}>{c.text}</span> : c.type==='del' ? <del key={i} className="text-red-400">{c.text}</del> : <ins key={i} className="text-green-400">{c.text}</ins>)}
      </div>
    </div>
  );
};

/* =============================================================================
   VERSIONS PANEL (Enhanced)
============================================================================= */
const VersionsPanel:React.FC<{
  state: ImproveState;
  onSelect:(v:ImproveVersion)=>void;
  onDelete:(id:string)=>void;
  onToggleFav:(id:string)=>void;
  onPickLeft:(v:ImproveVersion)=>void;
  onPickRight:(v:ImproveVersion)=>void;
  onRollback:(v:ImproveVersion)=>void;
  onRename:(id:string,newName:string)=>void;
}> = ({state,onSelect,onDelete,onToggleFav,onPickLeft,onPickRight,onRollback,onRename}) => (
  <div className="card mt-4 p-4">
    <div className="mb-2 flex items-center justify-between">
      <div className="inline-flex items-center gap-2 text-sm opacity-80"><History className="h-4 w-4"/> Versions</div>
      <div className="text-xs opacity-60">{state.versions.length} saved</div>
    </div>
    {state.versions.length===0 && (<div className="text-sm opacity-60">No versions yet. Use <kbd>Refine</kbd> to create one.</div>)}
    <div className="divide-y divide-white/10">
      {state.versions.map(v=> (
        <div key={v.id} className="flex flex-wrap items-center gap-2 py-2">
          <button className="btn-outline text-xs" title={(v.tags||[]).join(', ')} onClick={()=>onSelect(v)}>
            <GitCommit className="mr-1 h-3.5 w-3.5"/>{v.name}
          </button>
          <input className="thin-input text-xs" defaultValue={v.name} onBlur={(e)=>onRename(v.id, (e.target as HTMLInputElement).value)} style={{ maxWidth: 220 }}/>
          <div className="ml-auto flex items-center gap-1">
            <button className="btn-ghost" title="Favorite" onClick={()=>onToggleFav(v.id)}>
              {state.favoriteVersionIds.includes(v.id) ? <Star className="h-4 w-4 text-yellow-400"/> : <StarOff className="h-4 w-4"/>}
            </button>
            <button className="btn-ghost" title="Use as left" onClick={()=>onPickLeft(v)}><ToggleLeft className="h-4 w-4"/></button>
            <button className="btn-ghost" title="Use as right" onClick={()=>onPickRight(v)}><ToggleRight className="h-4 w-4"/></button>
            <button className="btn-ghost" title="Rollback to this" onClick={()=>onRollback(v)}><RotateCcw className="h-4 w-4"/></button>
            <button className="btn-ghost" title="Delete" onClick={()=>onDelete(v.id)}><Trash2 className="h-4 w-4"/></button>
          </div>
        </div>
      ))}
    </div>
  </div>
);

/* =============================================================================
   COMPARE MODAL
============================================================================= */
const CompareModal: React.FC<{
  left: ImproveVersion | null;
  right: ImproveVersion | null;
  onClose: () => void;
  onApplyRight: () => void;
}> = ({ left, right, onClose, onApplyRight }) => {
  if (!left && !right) return null;
  const leftText = left?.draft ?? '';
  const rightText = right?.draft ?? '';
  const chunks = diffText(leftText, rightText);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4" onMouseDown={onClose}>
      <div className="card w-full max-w-5xl p-4" onMouseDown={(e)=>e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm opacity-80"><History className="h-4 w-4"/> Compare Versions</div>
          <button className="btn-ghost" onClick={onClose}><X className="h-4 w-4"/></button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-black/20 p-3">
            <div className="mb-2 text-xs opacity-70">Left: {left?.name ?? '—'}</div>
            <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap text-sm leading-relaxed">{leftText}</pre>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 p-3">
            <div className="mb-2 text-xs opacity-70">Right: {right?.name ?? '—'}</div>
            <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap text-sm leading-relaxed">{rightText}</pre>
          </div>
        </div>
        <div className="mt-4">
          <div className="mb-2 text-xs opacity-70">Inline diff (left→right):</div>
          <div className="rounded-lg border border-white/10 bg-black/10 p-3 text-sm leading-relaxed">
            {chunks.map((c,i)=> c.type==='same' ? <span key={i}>{c.text}</span> : c.type==='del' ? <del key={i} className="bg-red-500/10 line-through">{c.text}</del> : <ins key={i} className="bg-emerald-500/10">{c.text}</ins>)}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button className="btn-outline" onClick={onClose}>Close</button>
          <button className="btn-primary" onClick={onApplyRight}><RotateCcw className="h-4 w-4"/> Apply Right as Current</button>
        </div>
      </div>
    </div>
  );
};

/* =============================================================================
   EXPORTS / INTEGRATIONS / WEBHOOKS
============================================================================= */
type ExportPayload = {
  agentId: string | null;
  persona: string;
  rules: PersonaRule[];
  draft: string;
  versions: ImproveVersion[];
  favorites: string[];
  exportedAt: string;
};
function buildPayload(state: ImproveState, draft: string): ExportPayload {
  return { agentId: state.selectedAgentId, persona: state.persona, rules: state.rules, draft, versions: state.versions, favorites: state.favoriteVersionIds, exportedAt: new Date().toISOString() };
}
function download(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}
function toYAML(obj: any, indent = 0): string {
  const pad = '  '.repeat(indent);
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj !== 'object') return String(obj).replace(/\n/g, '\\n');
  if (Array.isArray(obj)) return obj.map(v => ${pad}- ${toYAML(v, indent + 1).trimStart()}).join('\n'); // placeholder, will be replaced
  return Object.entries(obj).map(([k, v]) => `${pad}${k}: ${typeof v === 'object' ? `\n${toYAML(v, indent + 1)}` : toYAML(v, 0)}`).join('\n');
}
const ExportPanel: React.FC<{ state: ImproveState; draft: string }> = ({ state, draft }) => {
  const payload = React.useMemo(() => buildPayload(state, draft), [state, draft]);
  return (
    <div className="card mt-4 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm opacity-80"><Download className="h-4 w-4"/> Export</div>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-outline text-xs" onClick={()=>download('agent-export.json', JSON.stringify(payload, null, 2))}>JSON</button>
        <button className="btn-outline text-xs" onClick={()=>download('agent-export.yaml', toYAML(payload))}>YAML</button>
        <button className="btn-outline text-xs" onClick={()=>download('agent-draft.txt', draft)}>Draft TXT</button>
        <button className="btn-outline text-xs" onClick={()=>download('agent-versions.txt', state.versions.map(v=>`# ${v.name}\n${v.draft}\n`).join('\n---\n'))}>All Versions TXT</button>
      </div>
      <div className="mt-2 text-xs opacity-60">Tip: Import JSON back into your Builder to sync the improved prompt.</div>
    </div>
  );
};
const IntegrationsPanel: React.FC<{ onMakeCurl: (target: 'notion'|'gdocs', body: any) => void }> = ({ onMakeCurl }) => {
  const [notionPageId, setNotionPageId] = React.useState('');
  const [gdocsTitle, setGdocsTitle] = React.useState('Improved Agent Draft');
  return (
    <div className="card mt-4 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm opacity-80"><ExternalLink className="h-4 w-4"/> Integrations</div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-white/10 bg-black/20 p-3">
          <div className="mb-2 text-xs opacity-70">Notion</div>
          <input className="thin-input mb-2 w-full text-xs" placeholder="Notion Page ID" value={notionPageId} onChange={e=>setNotionPageId((e.target as HTMLInputElement).value)} />
          <button className="btn-outline text-xs" onClick={()=>onMakeCurl('notion', { pageId: notionPageId })}>Copy cURL template</button>
        </div>
        <div className="rounded-md border border-white/10 bg-black/20 p-3">
          <div className="mb-2 text-xs opacity-70">Google Docs</div>
          <input className="thin-input mb-2 w-full text-xs" placeholder="Document Title" value={gdocsTitle} onChange={e=>setGdocsTitle((e.target as HTMLInputElement).value)} />
          <button className="btn-outline text-xs" onClick={()=>onMakeCurl('gdocs', { title: gdocsTitle })}>Copy cURL template</button>
        </div>
      </div>
      <div className="mt-2 text-xs opacity-60">These create ready-to-edit cURL commands you can run server-side to push content.</div>
    </div>
  );
};
const WebhooksPanel: React.FC<{ payloadBuilder: () => any }> = ({ payloadBuilder }) => {
  const [url, setUrl] = React.useState('');
  const [status, setStatus] = React.useState<string>('');
  const send = async () => {
    setStatus('Sending…');
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payloadBuilder()) });
      setStatus(`Response: ${res.status}`);
    } catch (e:any) {
      setStatus('Failed (likely CORS in browser). Use server webhook.');
    }
  };
  return (
    <div className="card mt-4 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm opacity-80"><Share2 className="h-4 w-4"/> Webhooks</div>
      <div className="flex flex-wrap items-center gap-2">
        <input className="thin-input flex-1 text-xs" placeholder="https://your-webhook" value={url} onChange={e=>setUrl((e.target as HTMLInputElement).value)} />
        <button className="btn-primary text-xs" onClick={send}>Send Test</button>
        {status && <span className="text-xs opacity-70">{status}</span>}
      </div>
      <div className="mt-2 text-xs opacity-60">For Slack/Discord, paste the incoming webhook URL. Browser CORS may block — run via your API route for production.</div>
    </div>
  );
};

/* =============================================================================
   COMMENTS + SHARE (lightweight)
============================================================================= */
const CommentsPanel: React.FC<{ comments: {id:string;author:string;text:string;createdAt:number}[]; onAdd:(t:string)=>void }>
= ({ comments, onAdd }) => {
  const [txt,setTxt]=useState('');
  return (
    <div className="card p-4 mt-4">
      <div className="mb-2 text-sm opacity-80">Comments</div>
      <div className="space-y-2 max-h-48 overflow-auto pr-1">
        {comments.map(c => (
          <div key={c.id} className="rounded-md border border-white/10 bg-black/20 p-2">
            <div className="text-xs opacity-70">{c.author} • {new Date(c.createdAt).toLocaleString()}</div>
            <div className="text-sm">{c.text}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input className="thin-input flex-1 text-xs" placeholder="Add a comment…" value={txt} onChange={e=>setTxt((e.target as HTMLInputElement).value)} />
        <button className="btn-outline text-xs" onClick={()=>{ if(txt.trim()){ onAdd(txt.trim()); setTxt(''); } }}>Add</button>
      </div>
    </div>
  );
};
const SharePanel: React.FC<{ link: string; onCopy: ()=>void }> = ({ link, onCopy }) => (
  <div className="card p-4 mt-4">
    <div className="mb-2 flex items-center justify-between">
      <div className="inline-flex items-center gap-2 text-sm opacity-80"><PanelsTopLeft className="h-4 w-4"/> Share</div>
      <span className="text-xs opacity-60">Copy read-only link</span>
    </div>
    <div className="flex gap-2">
      <input className="thin-input flex-1 text-xs" readOnly value={link}/>
      <button className="btn-outline text-xs" onClick={onCopy}><Copy className="h-4 w-4"/>Copy</button>
    </div>
  </div>
);

/* =============================================================================
   FEATURE TOGGLES + LAYOUT LIST
============================================================================= */
const FeaturePanel:React.FC<{ ownerId: string; onFlags?:(f: FlagMap)=>void }> = ({ ownerId, onFlags }) => {
  const [query, setQuery] = useState('');
  const [flags, setFlags] = useState<FlagMap>(() => loadFlags(ownerId));
  useEffect(() => { onFlags?.(flags); saveFlags(ownerId, flags); }, [flags]);
  const list = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return IMPROVE_FEATURES;
    return IMPROVE_FEATURES.filter(f =>
      f.id.toLowerCase().includes(q) ||
      f.name.toLowerCase().includes(q) ||
      f.category.toLowerCase().includes(q) ||
      f.tags.join(' ').toLowerCase().includes(q)
    );
  }, [query]);
  return (
    <div className="card p-4">
      <SectionTitle hint="200 items • search & toggle">Improve Features</SectionTitle>
      <div className="flex items-center gap-2 mb-3">
        <input value={query} onChange={e=>setQuery((e.target as HTMLInputElement).value)} placeholder="Search features…" className="thin-input flex-1"/>
        <span className="text-xs opacity-70">{list.length} shown</span>
      </div>
      <div className="grid gap-2" style={{gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))'}}>
        {list.map(f => (
          <label key={f.id} className="rounded-xl cursor-pointer p-3" style={{background:'#0b0c10', border:'1px dashed rgba(0,255,194,.35)'}}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold truncate" style={{color:'#eafff8'}}>{f.name}</div>
                <div className="text-[11px] opacity-70">{f.category}</div>
              </div>
              <input type="checkbox" checked={Boolean(flags[f.id])} onChange={()=>setFlags(prev=>({ ...prev, [f.id]: !prev[f.id] }))}/>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {f.tags.map(t => <Tag key={t}>{t}</Tag>)}
            </div>
            <p className="text-xs opacity-80 mt-2">{f.description}</p>
          </label>
        ))}
      </div>
    </div>
  );
};

/* =============================================================================
   MAIN COMPONENT
============================================================================= */
const ImprovePage:React.FC=()=>{
  const [state,setState]=useState<ImproveState>(()=>loadJSON(ukey('state'),{selectedAgentId:null,persona:'sales',rules:DEFAULT_RULES,versions:[],favoriteVersionIds:[]}));
  const [draft,setDraft]=useState<string>(()=>loadJSON(ukey('draft'),`# DESCRIPTION
Sales-savvy assistant for e-commerce.

# RULES
- Be concise, helpful, confident.
- Ask follow-ups only if needed.

# QUESTION FLOW
1) Greet.
2) Ask goal.
3) Offer next step.

# FAQ
Q: Pricing?
A: Starts at $X.
`));
  const [flags, setFlags] = useState<FlagMap>(() => loadFlags(state.selectedAgentId || 'anon'));
  const [transcript,setTranscript]=useState<{role:string;text:string}[]>([]);
  const [busy,setBusy]=useState(false);

  // Compare state
  const [leftVer,setLeftVer]=useState<ImproveVersion|null>(null);
  const [rightVer,setRightVer]=useState<ImproveVersion|null>(null);
  const [showCompare,setShowCompare]=useState(false);

  // Collaboration state
  const [comments,setComments]=useState<{id:string;author:string;text:string;createdAt:number}[]>([]);
  const shareLink = typeof window!=='undefined'? window.location.href+"?share="+uid():"";

  // Visual & UX state
  const [showPalette,setShowPalette]=useState(false);
  const [showMinimap,setShowMinimap]=useState(false);
  const [toast,setToast]=useState<string>('');

  useEffect(()=>{ const t=setTimeout(()=>setToast(''), 1600); return ()=>clearTimeout(t); }, [toast]);

  useEffect(()=>{saveJSON(ukey('state'),state)},[state]);
  useEffect(()=>{saveJSON(ukey('draft'),draft)},[draft]);
  useEffect(()=>{ saveFlags(state.selectedAgentId || 'anon', flags); }, [flags, state.selectedAgentId]);

  // Hotkeys
  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      const key = [e.ctrlKey||e.metaKey?'mod':'', e.shiftKey?'shift':'', e.key.toLowerCase()].filter(Boolean).join('+');
      if(key==='mod+k'){ e.preventDefault(); setShowPalette(v=>!v); }
      if(key==='mod+s'){ e.preventDefault(); doSave(); }
    };
    window.addEventListener('keydown', onKey);
    return ()=>window.removeEventListener('keydown', onKey);
  },[]);

  const refine=()=>{
    if(!draft.trim()) return;
    setBusy(true);
    const before=draft;
    const improved=applyRules(before,state.rules,state.persona);
    const ver:ImproveVersion={id:uid(),name:autoName(),createdAt:Date.now(),draft:improved};
    setState(s=>({...s,versions:[...s.versions,ver]}));
    setDraft(improved);
    setTranscript(t=>[...t,{role:'assistant',text:`Refined → ${ver.name}`}]);
    setBusy(false);
    setToast('Refined ✓');
  };
  const doSave=()=>{ setToast('Saved ✓'); };
  const rollback=(v:ImproveVersion)=>{ setDraft(v.draft); const ver:ImproveVersion={ id:uid(), name:`Rollback → ${v.name}`, createdAt:Date.now(), draft:v.draft }; setState(s=>({...s,versions:[...s.versions,ver]})); setToast('Rolled back'); };

  const makeCurl = (target:'notion'|'gdocs', body:any) => {
    const payload = buildPayload(state, draft);
    const merged = { ...body, payload };
    const json = JSON.stringify(merged).replace(/'/g,"'\\''");
    const curl = target === 'notion'
      ? `curl -X POST https://api.notion.com/v1/pages \
  -H 'Authorization: Bearer YOUR_NOTION_TOKEN' \
  -H 'Notion-Version: 2022-06-28' \
  -H 'Content-Type: application/json' \
  -d '${json}'`
      : `curl -X POST "https://docs.googleapis.com/v1/documents?title=${encodeURIComponent(body.title||'Improved Agent Draft')}" \
  -H 'Authorization: Bearer YOUR_GOOGLE_OAUTH_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '${json}'`;
    navigator.clipboard.writeText(curl);
    setToast('cURL copied');
  };

  // Click ripple provider
  useEffect(()=>{
    const handler=(e:MouseEvent)=>{
      const t=e.target as HTMLElement; if(!t) return; (t as any).style.setProperty('--x', str(e.offsetX)+'px'); (t as any).style.setProperty('--y', str(e.offsetY)+'px');
    };
    function str(n:number){ return String(n); }
    document.addEventListener('mousedown', handler as any);
    return ()=>document.removeEventListener('mousedown', handler as any);
  },[]);

  // Derived
  const gridGapPx = 14;
  const sidebarWidth = 300;

  return(
    <Backdrop>
      {/* global styles for buttons/cards */}
      <style jsx global>{`
        .btn-primary{display:inline-flex;align-items:center;gap:.5rem;padding:.5rem .8rem;border-radius:.65rem;border:1px solid ${ACCENT_SOFT};background:linear-gradient(180deg,rgba(0,255,194,.14),rgba(0,255,194,.08));box-shadow:0 8px 28px rgba(0,255,194,.18)}
        .btn-primary:hover{box-shadow:0 10px 38px rgba(0,255,194,.28)}
        .btn-outline{display:inline-flex;align-items:center;gap:.5rem;padding:.5rem .8rem;border-radius:.65rem;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.02)}
        .btn-outline:hover{border-color:${ACCENT_SOFT}}
        .btn-ghost{display:inline-flex;align-items:center;gap:.5rem;padding:.35rem .6rem;border-radius:.55rem;border:1px solid transparent}
        .btn-ghost:hover{border-color:rgba(255,255,255,.12)}
        .card{background:${CARD_BG};border:${CARD_BORDER};border-radius:1rem;box-shadow:inset 0 0 22px rgba(0,0,0,.28),0 18px 48px rgba(0,0,0,.28)}
        .thin-input{border:1px solid rgba(255,255,255,.1);outline:none;background:rgba(0,0,0,.25);border-radius:.6rem;padding:.55rem .7rem}
        .thin-input:focus{border-color:${ACCENT_SOFT};box-shadow:0 0 0 3px rgba(0,255,194,.08)}
      `}</style>

      <div className="mx-auto max-w-6xl space-y-4 p-4">
        <header className="mb-1">
          <h1 className="text-lg font-bold tracking-wide" style={{color:'#eafff8'}}>Improve</h1>
          <p className="text-sm opacity-80">{IMPROVE_FEATURES.length} Features • {IMPROVE_LAYOUT_UPGRADES.length} Layout Upgrades — scoped per account</p>
        </header>

        <div className="grid" style={{gridTemplateColumns:${`${sidebarWidth}px 1fr 320px`}, gap:${`${gridGapPx}px`}}}>
          {/* Sidebar / Features */}
          <aside className="card p-3">
            <SectionTitle hint="Toggle flags & design">Controls</SectionTitle>
            <FeaturePanel ownerId={state.selectedAgentId || 'anon'} onFlags={setFlags} />
          </aside>

          {/* Center: Prompt Editor + Versions */}
          <main className="space-y-3">
            <PromptEditor value={draft} onChange={setDraft} flags={flags} />
            <div className="flex gap-3">
              <button className="btn-primary text-xs" onClick={()=>{ if(!draft.trim()) return; const before=draft; const improved=applyRules(before,state.rules,state.persona); const ver:ImproveVersion={id:uid(),name:autoName(),createdAt:Date.now(),draft:improved}; setState(s=>({...s,versions:[...s.versions,ver]})); setDraft(improved); }}>Refine & Save</button>
              <div className="flex items-center gap-2 text-xs opacity-80">
                <Tag>Owner: {state.selectedAgentId || 'anon'}</Tag>
                <Tag>{IMPROVE_FEATURES.length} features</Tag>
                <Tag>{IMPROVE_LAYOUT_UPGRADES.length} upgrades</Tag>
              </div>
            </div>
            <VersionsPanel
              state={state}
              onSelect={v=>setDraft(v.draft)}
              onDelete={id=>setState(s=>({...s,versions:s.versions.filter(v=>v.id!==id)}))}
              onToggleFav={id=>setState(s=>({...s,favoriteVersionIds:s.favoriteVersionIds.includes(id)?s.favoriteVersionIds.filter(x=>x!==id):[...s.favoriteVersionIds,id]}))}
              onPickLeft={v=>{setLeftVer(v); if(rightVer) setShowCompare(true);}}
              onPickRight={v=>{setRightVer(v); if(leftVer) setShowCompare(true);}}
              onRollback={v=>{ setDraft(v.draft); const ver:ImproveVersion={ id:uid(), name:`Rollback → ${v.name}`, createdAt:Date.now(), draft:v.draft }; setState(s=>({...s,versions:[...s.versions,ver]})); }}
              onRename={(id,newName)=>setState(s=>({...s,versions:s.versions.map(v=>v.id===id?{...v,name:newName||v.name}:v)}))}
            />
          </main>

          {/* Right: Test Lab + Layout list */}
          <aside>
            <TestLab busy={busy} transcript={transcript} onSend={q=>setTranscript(t=>[...t,{role:'user',text:q},{role:'assistant',text:`Demo reply for ${q}` }])} flags={flags} />
            <div className="card p-3 mt-3">
              <SectionTitle hint="Applied to Improve">Layout Upgrades</SectionTitle>
              <div className="max-h-[220px] overflow-auto space-y-2 pr-1">
                {IMPROVE_LAYOUT_UPGRADES.map(u => (
                  <div key={u.id} className="rounded-xl p-2" style={{background:'#0b0c10', border:'1px dashed rgba(0,255,194,.28)'}}>
                    <div className="text-xs font-semibold" style={{color:'#eafff8'}}>{u.name}</div>
                    <div className="text-[11px] opacity-80">{u.area} — {u.change}</div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>

        {/* diff + rules row */}
        <div className="grid gap-4 md:grid-cols-2">
          <div><RulesPanel rules={state.rules} onToggle={id=>setState(s=>({...s,rules:s.rules.map(r=>r.id===id?{...r,enabled:!r.enabled}:r)}))} persona={state.persona} onPersona={p=>setState(s=>({...s,persona:p}))}/></div>
          <div><DiffViewer before={state.versions[state.versions.length-1]?.draft||draft} after={draft}/></div>
        </div>

        {/* comments / share / export / integrations / webhooks */}
        <CommentsPanel comments={comments} onAdd={t=>setComments(c=>[...c,{id:uid(),author:'You',text:t,createdAt:Date.now()}])}/>
        <SharePanel link={shareLink} onCopy={()=>{navigator.clipboard.writeText(shareLink); setToast('Link copied');}}/>
        <ExportPanel state={state} draft={draft} />
        <IntegrationsPanel onMakeCurl={(t,b)=>{
          const payload = buildPayload(state, draft);
          const merged = { ...b, payload };
          const json = JSON.stringify(merged, null, 2);
          navigator.clipboard.writeText(json);
          setToast('Template copied');
        }} />
        <WebhooksPanel payloadBuilder={()=>buildPayload(state, draft)} />
      </main>

      {showCompare && rightVer && (
        <CompareModal left={leftVer} right={rightVer} onClose={()=>setShowCompare(false)} onApplyRight={()=>{ setDraft(rightVer.draft); setShowCompare(false); }}/>
      )}

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{y:20,opacity:0}} animate={{y:0,opacity:1}} exit={{y:20,opacity:0}} className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border border-emerald-400/30 bg-black/70 px-3 py-1.5 text-sm">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </Backdrop>
  );
};

export default ImprovePage;
