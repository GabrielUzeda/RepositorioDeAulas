export type ThemeKey = 'default' | 'dark' | 'light'

export const THEME_KEYS = ['default', 'dark', 'light'] as const

export const THEME_LABELS: Record<ThemeKey, string> = {
  default: 'Default',
  dark: 'Dark',
  light: 'Light',
}

export const NEXT_THEME: Record<ThemeKey, ThemeKey> = {
  default: 'dark',
  dark: 'light',
  light: 'default',
}

export function normalizeTheme(input: string | undefined | null): ThemeKey {
  if (input === 'high-contrast') return 'default'
  if (input === 'dark' || input === 'light') return input
  return 'default'
}

export interface MermaidThemeVariables {
  fontFamily: string;
  fontSize: string;
  primaryColor: string;
  primaryBorderColor: string;
  primaryTextColor: string;
  lineColor: string;
  edgeLabelBackground: string;
  secondaryColor: string;
  secondaryBorderColor: string;
  tertiaryColor: string;
  actorBkg: string;
  actorBorder: string;
  actorTextColor: string;
  actorLineColor: string;
  signalColor: string;
  signalTextColor: string;
  labelBoxBkgColor: string;
  labelBoxBorderColor: string;
  labelTextColor: string;
  noteBkgColor: string;
  noteBorderColor: string;
  noteTextColor: string;
  activationBorderColor: string;
  activationBkgColor: string;
  pieTitleTextColor: string;
  pieTitleTextSize: string;
  pieStrokeColor: string;
  pieStrokeWidth: string;
  pieLegendTextColor: string;
  pieSectionTextColor: string;
  pie1: string;
  pie2: string;
  pie3: string;
  pie4: string;
  attributeColorOdd: string;
  attributeColorEven: string;
  gridColor: string;
  sectionBkgColor: string;
  sectionBkgColor2: string;
  todayLineColor: string;
  taskBorderColor: string;
  taskBkgColor: string;
  taskTextColor: string;
  taskTextLightColor: string;
  activeTaskBorderColor: string;
  activeTaskBkgColor: string;
  doneTaskBkgColor: string;
  doneTaskBorderColor: string;
  [key: string]: string;
}

export const MERMAID_THEME_VARIABLES: Record<ThemeKey, MermaidThemeVariables> = {
  default: {
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    primaryColor: '#ffffff',
    primaryBorderColor: '#1a3a6e',
    primaryTextColor: '#1a3a6e',
    lineColor: '#1a3a6e',
    edgeLabelBackground: '#ffffff',
    secondaryColor: '#f8fafc',
    secondaryBorderColor: '#cbd5e1',
    tertiaryColor: '#f1f5f9',

    actorBkg: '#ffffff',
    actorBorder: '#1a3a6e',
    actorTextColor: '#1a3a6e',
    actorLineColor: '#1a3a6e',
    signalColor: '#1a3a6e',
    signalTextColor: '#1a3a6e',
    labelBoxBkgColor: '#f8fafc',
    labelBoxBorderColor: '#cbd5e1',
    labelTextColor: '#1e293b',
    noteBkgColor: '#f8fafc',
    noteBorderColor: '#1a3a6e',
    noteTextColor: '#1a3a6e',
    activationBorderColor: '#1a3a6e',
    activationBkgColor: '#e2e8f0',

    pieTitleTextColor: '#1a3a6e',
    pieTitleTextSize: '16px',
    pieStrokeColor: '#ffffff',
    pieStrokeWidth: '2px',
    pieLegendTextColor: '#2b2b2b',
    pieSectionTextColor: '#ffffff',
    pie1: '#1a3a6e',
    pie2: '#047857',
    pie3: '#b45309',
    pie4: '#6d28d9',

    attributeColorOdd: '#ffffff',
    attributeColorEven: '#f8fafc',

    gridColor: '#cbd5e1',
    sectionBkgColor: '#f8fafc',
    sectionBkgColor2: '#ffffff',
    todayLineColor: '#d62828',
    taskBorderColor: '#cbd5e1',
    taskBkgColor: '#e2e8f0',
    taskTextColor: '#1a3a6e',
    taskTextLightColor: '#1a3a6e',
    activeTaskBorderColor: '#1a3a6e',
    activeTaskBkgColor: '#dbeafe',
    doneTaskBkgColor: '#e2e8f0',
    doneTaskBorderColor: '#94a3b8',
  },
  light: {
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    primaryColor: '#ffffff',
    primaryBorderColor: '#cbd5e1',
    primaryTextColor: '#0f172a',
    lineColor: '#64748b',
    edgeLabelBackground: '#ffffff',
    secondaryColor: '#f8fafc',
    secondaryBorderColor: '#e2e8f0',
    tertiaryColor: '#f1f5f9',

    actorBkg: '#ffffff',
    actorBorder: '#cbd5e1',
    actorTextColor: '#0f172a',
    actorLineColor: '#94a3b8',
    signalColor: '#334155',
    signalTextColor: '#0f172a',
    labelBoxBkgColor: '#f8fafc',
    labelBoxBorderColor: '#e2e8f0',
    labelTextColor: '#1e293b',
    noteBkgColor: '#f8fafc',
    noteBorderColor: '#cbd5e1',
    noteTextColor: '#334155',
    activationBorderColor: '#94a3b8',
    activationBkgColor: '#e2e8f0',

    pieTitleTextColor: '#0f172a',
    pieTitleTextSize: '16px',
    pieStrokeColor: '#ffffff',
    pieStrokeWidth: '2px',
    pieLegendTextColor: '#475569',
    pieSectionTextColor: '#ffffff',
    pie1: '#1d4ed8',
    pie2: '#059669',
    pie3: '#d97706',
    pie4: '#7c3aed',

    attributeColorOdd: '#ffffff',
    attributeColorEven: '#f8fafc',

    gridColor: '#e2e8f0',
    sectionBkgColor: '#f8fafc',
    sectionBkgColor2: '#ffffff',
    todayLineColor: '#dc2626',
    taskBorderColor: '#cbd5e1',
    taskBkgColor: '#e2e8f0',
    taskTextColor: '#0f172a',
    taskTextLightColor: '#0f172a',
    activeTaskBorderColor: '#1d4ed8',
    activeTaskBkgColor: '#dbeafe',
    doneTaskBkgColor: '#e2e8f0',
    doneTaskBorderColor: '#94a3b8',
  },
  dark: {
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    primaryColor: '#1e293b',
    primaryBorderColor: '#475569',
    primaryTextColor: '#f8fafc',
    lineColor: '#94a3b8',
    edgeLabelBackground: '#1e293b',
    secondaryColor: '#0f172a',
    secondaryBorderColor: '#334155',
    tertiaryColor: '#1e293b',

    actorBkg: '#1e293b',
    actorBorder: '#475569',
    actorTextColor: '#f8fafc',
    actorLineColor: '#64748b',
    signalColor: '#cbd5e1',
    signalTextColor: '#f8fafc',
    labelBoxBkgColor: '#1e293b',
    labelBoxBorderColor: '#334155',
    labelTextColor: '#cbd5e1',
    noteBkgColor: '#1e293b',
    noteBorderColor: '#475569',
    noteTextColor: '#e2e8f0',
    activationBorderColor: '#64748b',
    activationBkgColor: '#334155',

    pieTitleTextColor: '#f8fafc',
    pieTitleTextSize: '16px',
    pieStrokeColor: '#1e293b',
    pieStrokeWidth: '2px',
    pieLegendTextColor: '#cbd5e1',
    pieSectionTextColor: '#ffffff',
    pie1: '#3b82f6',
    pie2: '#10b981',
    pie3: '#f59e0b',
    pie4: '#a855f7',

    attributeColorOdd: '#1e293b',
    attributeColorEven: '#151f30',

    gridColor: '#334155',
    sectionBkgColor: '#0f172a',
    sectionBkgColor2: '#1e293b',
    todayLineColor: '#ef4444',
    taskBorderColor: '#475569',
    taskBkgColor: '#334155',
    taskTextColor: '#f8fafc',
    taskTextLightColor: '#f8fafc',
    activeTaskBorderColor: '#60a5fa',
    activeTaskBkgColor: '#1d4ed8',
    doneTaskBkgColor: '#334155',
    doneTaskBorderColor: '#64748b',
  },
};

export function getMermaidThemeVariables(input: string | undefined | null): MermaidThemeVariables {
  const key = normalizeTheme(input);
  return MERMAID_THEME_VARIABLES[key] || MERMAID_THEME_VARIABLES.default;
}
