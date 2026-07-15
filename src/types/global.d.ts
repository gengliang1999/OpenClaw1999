
interface OpenClawAPI {
  apiToken: string;
  apiCall: (url: string, options?: any) => Promise<any>;
  apiCallStream: (payload: any) => Promise<any>;
  abortStream: () => Promise<any>;
  onChatChunk: (callback: (data: any) => void) => void;
  offChatChunk: () => void;
  apiOptimizeStream: (payload: any) => Promise<any>;
  onOptimizeChunk: (callback: (data: any) => void) => void;
  offOptimizeChunk: () => void;
  onCoreManagerLog: (callback: (data: any) => void) => void;
  offCoreManagerLog: () => void;
  onShortcutCaptureScreen: (callback: () => void) => void;
  offShortcutCaptureScreen: () => void;
  system: {
    captureScreenArea: () => Promise<any>;
    getInfo: () => Promise<any>;
    openExternal: (url: string) => Promise<any>;
    selectFile: (options?: any) => Promise<any>;
    selectDirectory: () => Promise<any>;
    minimize: () => Promise<any>;
    hide: () => Promise<any>;
    show: () => Promise<any>;
    maximize: () => Promise<any>;
    getScreenCapture: () => Promise<any>;
    finishScreenCapture: (dataUrl: string) => void;
    onScreenshotStart: (callback: (dataUrl: string) => void) => void;
    close: () => Promise<any>;
    restart: () => Promise<any>;
    toggleMain: () => Promise<any>;
    dragStartFloat: () => void;
    dragEndFloat: () => void;
    moveFloatBy: (dx: number, dy: number) => void;
    resizeFloat: (bounds: any) => void;
    onFloatStatus: (callback: (side: string) => void) => void;
    offFloatStatus: () => void;
    sendQuickPrompt: (text: string) => void;
    onQuickPrompt: (callback: (text: string) => void) => void;
    offQuickPrompt: () => void;
  };
}

interface ToastAPI {
  success: (msg: string, duration?: number) => void;
  error: (msg: string, duration?: number) => void;
  warning: (msg: string, duration?: number) => void;
  warn: (msg: string, duration?: number) => void;
  info: (msg: string, duration?: number) => void;
}

interface Window {
  openClaw: OpenClawAPI;
  __toast: ToastAPI;
  showModal: any;
  hideModal: any;
  marked: any;
  __onConvDeleted: any;
  refreshSidebarConversations: any;
  _deleteMemory: any;
  _installPlugin: any;
  _uninstallPlugin: any;
  _installSkill: any;
  _uninstallSkill: any;
  __createNewChat: any;
  __loadChatHistory: any;
  __setPendingConv: any;
  handleQuote: any;
  handleCopy: any;
  sessionConfig: any;
  html2pdf: any;
  html2canvas: any;
  docx: any;
  navigateTo: any;
}

declare var html2pdf: any;
declare var html2canvas: any;
declare var docx: any;


