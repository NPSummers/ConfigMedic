import { parseAllDocuments } from 'yaml';
import type { ConfigType, Detection, Diagnostic } from './types';

const issue = (
  id: string,
  line: number,
  severity: Diagnostic['severity'],
  title: string,
  detail: string,
  fix: string,
  source: Diagnostic['source'] = 'heuristic',
): Diagnostic => ({ id, line, severity, title, detail, fix, source });

const lineOf = (source: string, token: string) => {
  const index = source.indexOf(token);
  return index < 0 ? 1 : source.slice(0, index).split('\n').length;
};

export function detectConfigType(source: string): Detection {
  const text = source.trim();
  if (!text) return { configType: null, confidence: 'low', label: 'Nothing pasted yet', reason: 'Paste a file and I will identify the format for you.' };

  const isNix = /\{\s*(config\s*,\s*)?pkgs\b|\b(let|with)\s+pkgs\b|\bboot\.loader\.|\benvironment\.systemPackages\s*=|\bservices\.[\w-]+\.enable\s*=/.test(text);
  const isNginx = /\b(server|upstream)\s*\{|\blocation\s+[^\n{]+\{|\bproxy_pass\s+|\blisten\s+\d+/.test(text);
  const isKubernetes = /(^|\n)\s*(apiVersion|kind):\s*[\w./-]+/.test(text) && /(^|\n)\s*(kind|metadata):\s*/.test(text);
  const isK3s = /\bk3s\b|\bk3d\b|\bK3s\b/.test(text);
  const isCompose = /(^|\n)\s*services:\s*\n/.test(text) || (/\bservices:\s*\n/.test(text) && /\b(image|build|depends_on|ports|volumes):/.test(text));

  if (isKubernetes) return { configType: 'kubernetes', confidence: 'high', label: isK3s ? 'Kubernetes · K3s manifest' : 'Kubernetes · K8s manifest', reason: isK3s ? 'I found Kubernetes resource fields plus a K3s hint.' : 'I found apiVersion, kind, and metadata — the usual Kubernetes shape.' };
  if (isCompose) return { configType: 'compose', confidence: 'high', label: 'Docker Compose', reason: 'A top-level services block and container fields are present.' };
  if (isNix && !isNginx) return { configType: 'nixos', confidence: 'high', label: 'NixOS / Nix', reason: 'I found Nix module syntax or NixOS service declarations.' };
  if (isNginx) return { configType: 'nginx', confidence: 'high', label: 'Nginx reverse proxy', reason: 'I found server/location blocks or reverse-proxy directives.' };
  if (/^\s*[\w-]+:\s*[^\n]+\n/.test(text)) return { configType: 'compose', confidence: 'low', label: 'YAML-like config', reason: 'This looks like YAML, but there is not enough context to identify the schema.' };
  return { configType: null, confidence: 'low', label: 'Format not recognized', reason: 'I can check Kubernetes, Compose, NixOS, and Nginx once the file has a little more structure.' };
}

function parseYamlDiagnostics(source: string, type: ConfigType): Diagnostic[] {
  try {
    const documents = parseAllDocuments(source);
    const syntaxError = documents.flatMap((item) => item.errors)[0];
    if (syntaxError) {
      const line = syntaxError.linePos?.[0]?.line || 1;
      return [issue('yaml-parse', line, 'error', 'YAML syntax error', syntaxError.message.replace(/\s+/g, ' ').slice(0, 180), 'Fix the indentation, quoting, or delimiter near this line and run the check again.', 'schema')];
    }

    const document = documents[0]?.toJS() as Record<string, any> | null | undefined;
    if (document === null || typeof document !== 'object') {
      return [issue('empty-document', 1, 'error', 'No configuration document', 'The editor contains no structured configuration to validate.', 'Paste a YAML document or load a sample.', 'schema')];
    }

    const diagnostics: Diagnostic[] = [];
    if (type === 'kubernetes') {
      if (!document.apiVersion) diagnostics.push(issue('k8s-api-version', 1, 'error', 'Missing apiVersion', 'Kubernetes resources require an apiVersion so the API server knows how to decode them.', 'Add apiVersion: apps/v1 (or the API version for your resource).', 'schema'));
      if (!document.kind) diagnostics.push(issue('k8s-kind', 1, 'error', 'Missing kind', 'There is no resource kind in this document.', 'Add kind: Deployment, Service, ConfigMap, or another resource kind.', 'schema'));
      if (document.kind === 'Deployment') {
        const podLabels = document?.spec?.template?.metadata?.labels;
        const selector = document?.spec?.selector?.matchLabels;
        if (selector && podLabels && Object.entries(selector).some(([key, value]) => podLabels[key] !== value)) {
          diagnostics.push(issue('selector-mismatch', lineOf(source, 'selector:'), 'error', 'Selector does not match pod labels', 'A Deployment selector must match labels on its pod template or the resource will be rejected.', 'Make spec.selector.matchLabels a subset of spec.template.metadata.labels.', 'schema'));
        }
        const containers = document?.spec?.template?.spec?.containers;
        if (Array.isArray(containers)) {
          containers.forEach((container: Record<string, unknown>, index: number) => {
            if (typeof container.image === 'string' && container.image.endsWith(':latest')) {
              diagnostics.push(issue(`latest-image-${index}`, lineOf(source, 'image:'), 'warning', 'Image uses the latest tag', 'A moving tag makes rollbacks and supply-chain verification unpredictable.', 'Pin the image to an immutable version or digest.', 'heuristic'));
            }
            if (!container.resources) {
              diagnostics.push(issue(`resources-${index}`, lineOf(source, 'containers:'), 'warning', 'No resource requests or limits', 'Without resources, scheduling and noisy-neighbor protection are left to cluster defaults.', 'Add resources.requests and resources.limits for CPU and memory.', 'heuristic'));
            }
          });
        }
      }
    }

    if (type === 'compose') {
      if (!document.services) diagnostics.push(issue('compose-services', 1, 'error', 'Missing services block', 'Compose needs a top-level services map to define what should run.', 'Add services: and define each container beneath it.', 'schema'));
      const services = document.services || {};
      Object.entries(services).forEach(([name, service]) => {
        if (typeof service === 'object' && service && 'depends_on' in service) {
          const depends = (service as { depends_on?: unknown }).depends_on;
          const dependencies = Array.isArray(depends) ? depends : Object.keys((depends as object) || {});
          dependencies.forEach((dependency) => {
            if (!(dependency in services)) diagnostics.push(issue(`missing-dependency-${name}`, lineOf(source, `${name}:`), 'error', `Unknown dependency: ${String(dependency)}`, `${name} waits for a service that is not declared in this Compose file.`, `Declare ${String(dependency)} under services or remove it from depends_on.`, 'schema'));
          });
        }
      });
      if (/postgres:\s*latest|redis:\s*latest|mysql:\s*latest/.test(source)) diagnostics.push(issue('compose-latest', lineOf(source, ':latest'), 'warning', 'Database image is not pinned', 'The container image can change between deploys, causing surprise upgrades.', 'Pin the database image to a major/minor version.', 'heuristic'));
    }

    return diagnostics;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid YAML syntax.';
    const match = message.match(/line (\d+)/i);
    const line = match ? Number(match[1]) : 1;
    return [issue('yaml-parse', line, 'error', 'YAML syntax error', message.replace(/\s+/g, ' ').slice(0, 180), 'Fix the indentation, quoting, or delimiter near this line and run the check again.', 'schema')];
  }
}

function nixDiagnostics(source: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  if (!source.includes('{') || !source.includes('}')) diagnostics.push(issue('nix-braces', 1, 'error', 'Incomplete Nix expression', 'The module expression should have a closing attribute set.', 'Wrap the configuration in { ... } and return the set.', 'schema'));
  if (/services\.nginx\.enable\s*=\s*true/.test(source) && !/networking\.firewall\.allowedTCPPorts/.test(source)) diagnostics.push(issue('nix-firewall', lineOf(source, 'services.nginx'), 'warning', 'Nginx is enabled but port 80 is not opened', 'The service may be healthy locally while remaining unreachable through the NixOS firewall.', 'Open port 80 (and 443 when using TLS) in networking.firewall.allowedTCPPorts.', 'heuristic'));
  if (/password\s*=\s*"/.test(source)) diagnostics.push(issue('nix-secret', lineOf(source, 'password'), 'error', 'Secret appears inline', 'Plaintext secrets in a Nix expression end up in source history and the Nix store.', 'Use an environment file, sops-nix, agenix, or another secret manager.', 'heuristic'));
  return diagnostics;
}

function nginxDiagnostics(source: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  if (!/\bserver\s*\{/.test(source)) diagnostics.push(issue('nginx-server', 1, 'error', 'No server block found', 'Nginx needs a server block before it can route traffic.', 'Add a server { ... } block.', 'schema'));
  if (/proxy_pass\s+https?:\/\//.test(source) && !source.includes('proxy_set_header X-Forwarded-Proto')) diagnostics.push(issue('nginx-forwarded-proto', lineOf(source, 'proxy_pass'), 'warning', 'Forwarded protocol is not preserved', 'Upstream applications may build http links behind TLS termination.', 'Forward the original scheme with proxy_set_header X-Forwarded-Proto $scheme.', 'heuristic'));
  if (/listen\s+80/.test(source) && !/return\s+301\s+https/.test(source) && /ssl_certificate/.test(source)) diagnostics.push(issue('nginx-redirect', lineOf(source, 'listen 80'), 'warning', 'HTTP is not redirected to HTTPS', 'The config serves plaintext traffic alongside TLS.', 'Redirect port 80 to the canonical HTTPS host.', 'heuristic'));
  return diagnostics;
}

export function analyzeConfig(source: string, type: ConfigType): Diagnostic[] {
  if (!source.trim()) return [issue('empty', 1, 'info', 'Ready to inspect', 'Paste a configuration or start from a sample to see diagnostics.', 'Choose a sample from the left rail.')];
  if (type === 'nixos') return nixDiagnostics(source);
  if (type === 'nginx') return nginxDiagnostics(source);
  return parseYamlDiagnostics(source, type);
}

export function applySafeFixes(source: string, type: ConfigType, diagnostics: Diagnostic[]): string {
  let corrected = source;
  const ids = new Set(diagnostics.map((diagnostic) => diagnostic.id));
  if (type === 'kubernetes' && [...ids].some((id) => id.startsWith('latest-image-'))) corrected = corrected.replace(/image:\s*([^\s]+):latest/g, 'image: $1:1.0.0');
  if (type === 'compose') corrected = corrected.replace(/image:\s*([^\s]+):(latest)\b/g, 'image: $1:stable');
  if (type === 'nginx' && ids.has('nginx-forwarded-proto') && !corrected.includes('proxy_set_header X-Forwarded-Proto')) corrected = corrected.replace(/(proxy_set_header X-Forwarded-For[^\n]*\n)/, '$1    proxy_set_header X-Forwarded-Proto $scheme;\n');
  return corrected;
}
