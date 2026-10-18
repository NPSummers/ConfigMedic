export type ConfigType = 'kubernetes' | 'compose' | 'nixos' | 'nginx';

export type Severity = 'error' | 'warning' | 'info';

export type Diagnostic = {
  id: string;
  line: number;
  column?: number;
  severity: Severity;
  title: string;
  detail: string;
  fix: string;
  source: 'schema' | 'heuristic' | 'webllm';
};

export type Analysis = {
  configType: ConfigType;
  diagnostics: Diagnostic[];
  score: number;
  corrected: string;
  summary: string;
  usedModel: boolean;
};

export type Detection = {
  configType: ConfigType | null;
  confidence: 'high' | 'medium' | 'low';
  label: string;
  reason: string;
};
