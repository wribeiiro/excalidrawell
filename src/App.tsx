import { useEffect, useState } from 'react';
import { Canvas } from './components/Canvas';
import { ContextMenu } from './components/ContextMenu';
import { ConfirmReset, HelpDialog } from './components/Dialogs';
import { ExportDialog } from './components/ExportDialog';
import { EmptyHint } from './components/EmptyHint';
import { PropertiesPanel } from './components/PropertiesPanel';
import { BottomControls } from './components/BottomControls';
import { TextEditor } from './components/TextEditor';
import { Toolbar } from './components/Toolbar';
import { useStore } from './store/store';

export function App() {
  const theme = useStore((s) => s.theme);
  const dialog = useStore((s) => s.dialog);
  const toast = useStore((s) => s.toast);
  const hydrated = useStore((s) => s.hydrated);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="app">
      <Canvas />
      <TextEditor />
      {hydrated && <EmptyHint />}
      <Toolbar />
      <PropertiesPanel open={panelOpen} onToggle={() => setPanelOpen((v) => !v)} />
      <BottomControls />
      <ContextMenu />
      {dialog === 'help' && <HelpDialog />}
      {dialog === 'export' && <ExportDialog />}
      {dialog === 'reset' && <ConfirmReset />}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
