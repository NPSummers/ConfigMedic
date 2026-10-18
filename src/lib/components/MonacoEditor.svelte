<script lang="ts">
  import { onDestroy, onMount } from 'svelte';

  export let value = '';
  export let language = 'yaml';
  export let mode: 'editor' | 'diff' = 'editor';
  export let original = '';
  export let modified = '';
  export let onChange: (next: string) => void = () => {};

  let host: HTMLDivElement;
  let editor: any;
  let currentValue = value;

  onMount(async () => {
    const monaco: any = await import('monaco-editor');
    const workerModule: any = await import('monaco-editor/esm/vs/editor/editor.worker?worker');
    (self as any).MonacoEnvironment = {
      getWorker: () => new workerModule.default(),
    };

    monaco.editor.defineTheme('configmedic-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'string', foreground: 'B5CEA8' },
        { token: 'string.yaml', foreground: 'B5CEA8' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'keyword', foreground: '9CDCFE' },
        { token: 'type', foreground: '4EC9B0' },
        { token: 'comment', foreground: '6A9955' },
      ],
      colors: {
        'editor.background': '#1E1E1E',
        'editor.foreground': '#D4D4D4',
        'editorLineNumber.foreground': '#5A5A5A',
        'editorLineNumber.activeForeground': '#C6C6C6',
        'editor.lineHighlightBackground': '#252526',
        'editorIndentGuide.background': '#2D2D2D',
        'editorIndentGuide.activeBackground': '#454545',
      },
    });

    if (mode === 'diff') {
      editor = monaco.editor.createDiffEditor(host, {
        automaticLayout: true,
        fontSize: 12,
        lineHeight: 20,
        minimap: { enabled: false },
        padding: { top: 14, bottom: 14 },
        renderSideBySide: true,
        scrollBeyondLastLine: false,
        theme: 'configmedic-dark',
        wordWrap: 'on',
        readOnly: true,
      });
      editor.setModel({
        original: monaco.editor.createModel(original, language),
        modified: monaco.editor.createModel(modified, language),
      });
    } else {
      editor = monaco.editor.create(host, {
        value,
        language,
        automaticLayout: true,
        fontSize: 13,
        lineHeight: 21,
        minimap: { enabled: false },
        padding: { top: 16, bottom: 16 },
        scrollBeyondLastLine: false,
        theme: 'configmedic-dark',
        wordWrap: 'on',
        glyphMargin: true,
        renderLineHighlight: 'all',
        smoothScrolling: true,
        cursorBlinking: 'smooth',
      });
      editor.onDidChangeModelContent(() => {
        currentValue = editor.getValue();
        onChange(currentValue);
      });
    }
  });

  $: if (editor && mode === 'editor' && value !== currentValue) {
    currentValue = value;
    editor.setValue(value);
  }

  $: if (editor && mode === 'diff' && editor.getModel()) {
    const models = editor.getModel();
    if (models.original.getValue() !== original) models.original.setValue(original);
    if (models.modified.getValue() !== modified) models.modified.setValue(modified);
  }

  onDestroy(() => editor?.dispose());
</script>

<div class="monaco-host" data-ui bind:this={host}></div>
