<script lang="ts">
  import { AlertCircle, Check, CircleHelp, Clipboard, Cpu, FileCode2, GitCompareArrows, LoaderCircle, LockKeyhole, Play, Search, Settings2, ShieldCheck, Terminal, X, Zap } from '@lucide/svelte';
  import { analyzeConfig, applySafeFixes, detectConfigType } from '../lib/diagnostics';
  import { examples, samples } from '../lib/samples';
  import { askWebLLM, loadWebLLM } from '../lib/webllm';
  import MonacoEditor from '../lib/components/MonacoEditor.svelte';
  import type { Analysis, ConfigExample, ConfigType, Diagnostic } from '../lib/types';

  const tabs: Array<{ id: ConfigType; label: string; short: string; glyph: string }> = [
    { id: 'kubernetes', label: 'Kubernetes / K3s', short: 'K8s / K3s', glyph: 'K' },
    { id: 'compose', label: 'Docker Compose', short: 'Compose', glyph: '▦' },
    { id: 'nixos', label: 'NixOS / Nix', short: 'Nix', glyph: 'N' },
    { id: 'nginx', label: 'Nginx proxy', short: 'Nginx', glyph: 'G' },
  ];

  let source = samples.kubernetes.code;
  let manualType: ConfigType | null = null;
  let activeSurface: 'source' | 'diff' = 'source';
  let bottomPanel: 'problems' | 'output' = 'problems';
  let analysis: Analysis | null = null;
  let isAnalyzing = false;
  let modelStatus: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
  let modelMessage = 'Local AI is off';
  let notice = '';
  let copied = false;

  $: detection = detectConfigType(source);
  $: effectiveType = manualType || detection.configType || 'kubernetes';
  $: currentTab = tabs.find((tab) => tab.id === effectiveType) || tabs[0];
  $: filename = effectiveType === 'kubernetes' ? 'deployment.yaml' : effectiveType === 'compose' ? 'compose.yaml' : effectiveType === 'nixos' ? 'configuration.nix' : 'default.conf';
  $: diagnostics = analysis?.diagnostics || analyzeConfig(source, effectiveType);
  $: errorCount = diagnostics.filter((item: Diagnostic) => item.severity === 'error').length;
  $: warningCount = diagnostics.filter((item: Diagnostic) => item.severity === 'warning').length;
  $: score = analysis?.score ?? Math.max(35, 100 - errorCount * 24 - warningCount * 9);

  function loadExample(example: ConfigExample) {
    source = example.code;
    manualType = null;
    analysis = null;
    activeSurface = 'source';
    bottomPanel = 'output';
    notice = `Loaded ${example.label}.`;
  }

  function loadExampleById(id: string) {
    const example = examples.find((item) => item.id === id);
    if (example) loadExample(example);
  }

  function chooseType(type: ConfigType) {
    manualType = type;
    analysis = null;
    activeSurface = 'source';
    notice = `Format set to ${tabs.find((tab) => tab.id === type)?.label}.`;
  }

  function useAutoDetect() {
    manualType = null;
    analysis = null;
    notice = detection.configType ? `Auto-detected ${detection.label}.` : 'Auto-detection is on.';
  }

  async function loadModel() {
    modelStatus = 'loading';
    modelMessage = 'Loading local model…';
    try {
      const session = await loadWebLLM((message: string) => (modelMessage = message));
      modelStatus = 'ready';
      modelMessage = session.model.replace(/-q4f16_1-MLC$/, '');
    } catch (error) {
      modelStatus = 'error';
      modelMessage = error instanceof Error ? error.message : 'Could not load local model.';
    }
  }

  async function runAnalysis() {
    if (!source.trim()) {
      notice = 'The editor is empty.';
      bottomPanel = 'problems';
      return;
    }
    isAnalyzing = true;
    notice = '';
    const localDiagnostics = analyzeConfig(source, effectiveType);
    const corrected = applySafeFixes(source, effectiveType, localDiagnostics);
    analysis = {
      configType: effectiveType,
      diagnostics: localDiagnostics,
      score: Math.max(35, 100 - localDiagnostics.filter((item: Diagnostic) => item.severity === 'error').length * 24 - localDiagnostics.filter((item: Diagnostic) => item.severity === 'warning').length * 9),
      corrected,
      summary: localDiagnostics.length ? 'Problems were found in this file.' : 'No problems were found in this file.',
      usedModel: false,
    };
    if (modelStatus === 'ready') {
      try {
        modelMessage = 'Reviewing locally…';
        const result = await askWebLLM(source, effectiveType, localDiagnostics, (message: string) => (modelMessage = message));
        const merged = [...localDiagnostics, ...result.diagnostics];
        analysis = {
          configType: effectiveType,
          diagnostics: merged,
          score: Math.max(15, 100 - merged.filter((item: Diagnostic) => item.severity === 'error').length * 20 - merged.filter((item: Diagnostic) => item.severity === 'warning').length * 7),
          corrected: result.corrected,
          summary: result.summary,
          usedModel: true,
        };
        modelMessage = result.model.replace(/-q4f16_1-MLC$/, '');
      } catch (error) {
        notice = error instanceof Error ? `${error.message} Built-in checks are shown.` : 'Local review failed. Built-in checks are shown.';
      }
    }
    bottomPanel = 'problems';
    activeSurface = 'source';
    isAnalyzing = false;
  }

  async function copyCorrected() {
    await navigator.clipboard?.writeText(analysis?.corrected || source);
    copied = true;
    setTimeout(() => (copied = false), 1600);
  }

  function languageFor(type: ConfigType) {
    return type === 'nixos' ? 'shell' : type === 'nginx' ? 'plaintext' : 'yaml';
  }
</script>

<svelte:head>
  <title>{filename} — ConfigMedic</title>
  <meta name="description" content="A local-first configuration debugger for Kubernetes, Compose, NixOS, and Nginx." />
</svelte:head>

<div class="app-shell">
  <header class="window-bar">
    <a href="/" class="window-brand" aria-label="ConfigMedic home"><span class="brand-mark"><ShieldCheck size={17} /></span><strong>ConfigMedic</strong><span class="brand-context">local workspace</span></a>
    <div class="window-title"><span class="file-dot"></span>{filename} <span class="title-separator">—</span> ConfigMedic</div>
    <div class="window-actions"><span class="privacy-note"><LockKeyhole size={13} /> local only</span><button class:ready={modelStatus === 'ready'} class:error={modelStatus === 'error'} class="model-button" on:click={loadModel} disabled={modelStatus === 'loading'}>{#if modelStatus === 'loading'}<LoaderCircle class="spin" size={13} />{:else}<Cpu size={13} />{/if}{modelStatus === 'ready' ? 'AI ready' : modelStatus === 'loading' ? 'Loading' : 'Load AI'}</button><button class="window-icon" aria-label="Settings"><Settings2 size={15} /></button></div>
  </header>

  <main class="ide-layout" data-ui>
    <nav class="activity-bar" aria-label="Workspace tools"><button class="activity-icon active" aria-label="Explorer"><FileCode2 size={19} /></button><button class="activity-icon" aria-label="Search"><Search size={19} /></button><button class="activity-icon" aria-label="Run checks" on:click={runAnalysis}><Play size={19} /></button><div class="activity-spacer"></div><button class="activity-icon" aria-label="Settings"><Settings2 size={18} /></button></nav>

    <aside class="explorer-panel" data-ui>
      <div class="explorer-heading"><span>Explorer</span><button class="panel-icon" aria-label="More explorer actions">···</button></div>
      <div class="explorer-section"><div class="explorer-section-title">Open editors <span>1</span></div><button class="file-row active"><FileCode2 size={14} /><span>{filename}</span><span class="file-close">×</span></button></div>
      <div class="explorer-section"><div class="explorer-section-title">Workspace</div><button class="file-row"><span class="chevron">⌄</span><span class="folder-glyph">▰</span><span>configmedic</span></button><button class="file-row nested active"><FileCode2 size={14} /><span>{filename}</span></button></div>
      <div class="explorer-section format-section"><div class="explorer-section-title">Config type</div>{#each tabs as tab}<button class:chosen={effectiveType === tab.id && !manualType} class:manual={manualType === tab.id} class="format-row" on:click={() => chooseType(tab.id)}><span class="format-glyph">{tab.glyph}</span><span>{tab.label}</span>{#if effectiveType === tab.id}<span class="format-check">{manualType ? '·' : '*'}</span>{/if}</button>{/each}{#if manualType}<button class="auto-row" on:click={useAutoDetect}>↺ use auto-detect</button>{/if}</div>
      <div class="explorer-section examples-section"><div class="explorer-section-title">Try examples <span>{examples.length}</span></div><div class="example-list">{#each examples as example}<button class:current={source === example.code} class="example-row" title={example.description} on:click={() => loadExample(example)}><span class:example-kubernetes={example.type === 'kubernetes'} class:example-compose={example.type === 'compose'} class:example-nixos={example.type === 'nixos'} class:example-nginx={example.type === 'nginx'} class="example-type-marker">{example.type === 'kubernetes' ? 'K' : example.type === 'compose' ? 'C' : example.type === 'nixos' ? 'N' : 'G'}</span><span class="example-copy"><span class="example-label">{example.label}</span><span class="example-description">{example.description}</span></span></button>{/each}</div></div>
      <div class="explorer-note"><div class="note-heading"><LockKeyhole size={13} /> Privacy</div><p>Your config is inspected in this tab. WebLLM is optional and runs on your device.</p></div>
      <div class="explorer-footer"><span>ConfigMedic</span><span>v0.1</span></div>
    </aside>

    <section class="workbench" data-ui>
      <div class="editor-tabs"><button class:active={activeSurface === 'source'} on:click={() => (activeSurface = 'source')}><FileCode2 size={14} />{filename}<span class="tab-dirty"></span><span class="tab-close">×</span></button><button class:active={activeSurface === 'diff'} on:click={() => (activeSurface = 'diff')}><GitCompareArrows size={14} />Suggested diff</button><div class="editor-tabs-spacer"></div><label class="example-picker"><span>Try</span><select aria-label="Load an example configuration" on:change={(event) => loadExampleById((event.currentTarget as HTMLSelectElement).value)}><option value="">examples…</option>{#each tabs as tab}<optgroup label={tab.label}>{#each examples.filter((example) => example.type === tab.id) as example}<option value={example.id}>{example.label}</option>{/each}</optgroup>{/each}</select></label><button class="editor-action" on:click={runAnalysis} disabled={isAnalyzing}>{#if isAnalyzing}<LoaderCircle class="spin" size={13} />{:else}<Play size={13} />{/if} {isAnalyzing ? 'Checking…' : 'Analyze'}</button></div>
      <div class="breadcrumbs"><span>{currentTab.label}</span><span>/</span><strong>{filename}</strong><span>/</span><span>{activeSurface === 'diff' ? 'proposed changes' : 'document'}</span><span class="detected-status"><span class="status-dot"></span>{manualType ? 'manual format' : detection.label}</span></div>
      <div class="editor-surface" data-ui>{#if activeSurface === 'source'}<MonacoEditor value={source} language={languageFor(effectiveType)} onChange={(next: string) => { source = next; analysis = null; }} />{:else}<div class="diff-heading"><span><GitCompareArrows size={14} /> {analysis ? 'Review the proposed replacement' : 'Run Analyze to generate a diff'}</span><button on:click={copyCorrected}>{#if copied}<Check size={13} /> copied{:else}<Clipboard size={13} /> copy corrected{/if}</button></div><MonacoEditor mode="diff" language={languageFor(effectiveType)} original={source} modified={analysis?.corrected || source} />{/if}</div>
      <section class="bottom-panel" data-ui><div class="bottom-tabs"><button class:active={bottomPanel === 'problems'} on:click={() => (bottomPanel = 'problems')}><AlertCircle size={14} />Problems <span class:error-text={errorCount > 0}>{errorCount + warningCount}</span></button><button class:active={bottomPanel === 'output'} on:click={() => (bottomPanel = 'output')}><Terminal size={14} />Output</button><div class="bottom-spacer"></div><span class="bottom-summary">{warningCount} warnings · {modelStatus === 'ready' ? 'local AI enabled' : 'built-in checks'}</span></div>{#if bottomPanel === 'problems'}<div class="problems-list">{#if diagnostics.length === 0}<div class="problem-empty"><Check size={15} /> No problems found.</div>{:else}{#each diagnostics as diagnostic}<div class="problem-row"><div class:danger={diagnostic.severity === 'error'} class:warn={diagnostic.severity === 'warning'} class:info={diagnostic.severity === 'info'} class="problem-icon">{#if diagnostic.severity === 'error'}<AlertCircle size={14} />{:else if diagnostic.severity === 'warning'}<CircleHelp size={14} />{:else}<Zap size={14} />{/if}</div><div class="problem-content"><div class="problem-title">{diagnostic.title}<span class="problem-location">{filename}:{diagnostic.line}</span></div><div class="problem-detail">{diagnostic.detail}</div><div class="problem-fix">Fix: {diagnostic.fix}</div></div><span class="problem-source">{diagnostic.source === 'webllm' ? 'AI' : diagnostic.source === 'schema' ? 'Schema' : 'Rule'}</span></div>{/each}{/if}</div>{:else}<div class="output-panel"><div class="output-line"><span class="output-time">now</span><span>{notice || (analysis ? analysis.summary : 'Ready. Run Analyze to check the current file.')}</span></div><div class="output-line"><span class="output-time">status</span><span>{modelMessage}</span></div></div>{/if}</section>
      <div class="status-bar" data-ui><span>Ln 1, Col 1</span><span>Spaces: 2</span><span>{languageFor(effectiveType).toUpperCase()}</span><span class="status-spacer"></span><span class="health-score"><span class="score-dot"></span> health {score}/100</span><span>ConfigMedic</span></div>
    </section>
  </main>
</div>
