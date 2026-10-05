import { describe, expect, test } from 'bun:test';
import {
  normalizeTheme,
  NEXT_THEME,
  THEME_LABELS,
  THEME_KEYS,
  getMermaidThemeVariables,
  MERMAID_THEME_VARIABLES,
} from '../src/shared/marpTheme';
import { getMermaidThemeVariables as getMermaidVarsFromUtil } from '../src/shared/utils/mermaidTheme';

describe('themes and marp theme utilities', () => {
  describe('normalizeTheme', () => {
    test('normaliza temas válidos e lida com casos especiais ou nulos', () => {
      expect(normalizeTheme('dark')).toBe('dark');
      expect(normalizeTheme('light')).toBe('light');
      expect(normalizeTheme('default')).toBe('default');
      expect(normalizeTheme('high-contrast')).toBe('default');
      expect(normalizeTheme('unknown')).toBe('default');
      expect(normalizeTheme(null)).toBe('default');
      expect(normalizeTheme(undefined)).toBe('default');
      expect(normalizeTheme('')).toBe('default');
    });
  });

  describe('NEXT_THEME and THEME_LABELS', () => {
    test('ciclo de transição de temas NEXT_THEME está correto', () => {
      expect(NEXT_THEME.default).toBe('dark');
      expect(NEXT_THEME.dark).toBe('light');
      expect(NEXT_THEME.light).toBe('default');
    });

    test('rótulos e chaves de temas são consistentes', () => {
      expect(THEME_KEYS).toEqual(['default', 'dark', 'light']);
      expect(THEME_LABELS.default).toBe('Default');
      expect(THEME_LABELS.dark).toBe('Dark');
      expect(THEME_LABELS.light).toBe('Light');
    });
  });

  describe('Mermaid Theme Variables', () => {
    test('retorna variáveis de tema corretas para default, light e dark', () => {
      const defaultVars = getMermaidThemeVariables('default');
      const lightVars = getMermaidThemeVariables('light');
      const darkVars = getMermaidThemeVariables('dark');

      expect(defaultVars).toBeDefined();
      expect(lightVars).toBeDefined();
      expect(darkVars).toBeDefined();

      expect(defaultVars.fontFamily).toContain('Inter');
      expect(lightVars.primaryTextColor).toBe('#0f172a');
      expect(darkVars.primaryTextColor).toBe('#f8fafc');

      // Test utility wrapper from mermaidTheme.ts
      expect(getMermaidVarsFromUtil('dark')).toEqual(darkVars);
      expect(getMermaidVarsFromUtil('invalid')).toEqual(defaultVars);
    });

    test('preserva propriedades essenciais de contraste e estilo em todos os temas', () => {
      for (const key of THEME_KEYS) {
        const vars = MERMAID_THEME_VARIABLES[key];
        expect(vars.fontSize).toBe('16px');
        expect(vars.primaryColor).toBeDefined();
        expect(vars.primaryTextColor).toBeDefined();
        expect(vars.pie1).toBeDefined();
        expect(vars.pie2).toBeDefined();
        expect(vars.taskBkgColor).toBeDefined();
      }
    });

    test('dark e light divergem no texto primario e convergem na fonte', () => {
      const dark = getMermaidThemeVariables('dark');
      const light = getMermaidThemeVariables('light');
      expect(dark.primaryTextColor).not.toBe(light.primaryTextColor);
      expect(dark.fontFamily).toBe(light.fontFamily);
    });

    test('temas invalidos, numericos e vazios caem para default', () => {
      const def = getMermaidThemeVariables('default');
      for (const input of ['invalid', '', 'DARK', 'Light ', null, undefined] as any[]) {
        expect(getMermaidThemeVariables(input)).toEqual(def);
      }
      expect(getMermaidVarsFromUtil('DARK' as any)).toEqual(def);
    });

    test('normalizeTheme e case-sensitive: maiusculas caem para default', () => {
      expect(normalizeTheme('DARK')).toBe('default');
      expect(normalizeTheme(' dark')).toBe('default');
      expect(normalizeTheme('dark ')).toBe('default');
    });

    test('cada tema tem paleta de pizza, linha e tarefas proprias definidas', () => {
      for (const key of THEME_KEYS) {
        const vars = MERMAID_THEME_VARIABLES[key];
        expect(vars.lineColor).toBeDefined();
        expect(vars.pie3).toBeDefined();
        expect(vars.pieStrokeColor).toBeDefined();
        expect(vars.taskBkgColor).toBeDefined();
        expect(Object.keys(vars).length).toBeGreaterThan(10);
      }
    });
  });
});
