"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallApp() {
  const [open, setOpen] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const standalone = () => displayMode.matches || !!(navigator as Navigator & { standalone?: boolean }).standalone;
    const detectDisplay = () => setInstalled(standalone());
    detectDisplay();
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

    const capture = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const complete = () => { setInstalled(true); setPrompt(null); setOpen(false); };
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", complete);
    displayMode.addEventListener("change", detectDisplay);

    // Development uses HMR. Keep it outside service-worker control.
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
        // Installation support is optional; the online game keeps working.
      });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", complete);
      displayMode.removeEventListener("change", detectDisplay);
    };
  }, []);

  async function install() {
    if (!prompt || busy) return;
    const currentPrompt = prompt;
    setPrompt(null); // Each browser event can only be used once.
    setBusy(true);
    setMessage("");
    try {
      await currentPrompt.prompt();
      const choice = await currentPrompt.userChoice;
      if (choice.outcome === "accepted") setOpen(false);
      else setMessage("暂不添加也可以继续使用；之后可从浏览器菜单添加。");
    } catch {
      setMessage("这次未能打开安装窗口，请按下方步骤从浏览器菜单添加。");
    } finally {
      setBusy(false);
    }
  }

  if (installed) return null;

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>
      <button className="install-app-button" type="button" aria-label="添加圆桌阿瓦隆到主屏幕">
        <Smartphone size={16} aria-hidden="true" /><span>添加到主屏幕</span>
      </button>
    </DialogTrigger>
    <DialogContent className="install-app-dialog" showCloseButton={false}>
      <div className="install-app-symbol"><Smartphone size={26} aria-hidden="true" /></div>
      <DialogTitle>把圆桌放到主屏幕</DialogTitle>
      <DialogDescription>下次聚会，直接点图标进入。无需应用商店，也不需要订阅。</DialogDescription>
      <p className="install-session-note"><strong>建议入房前添加。</strong>主屏幕应用和浏览器可能使用不同的玩家身份；已经入房时，请继续从原来的入口玩完本局。</p>
      {prompt && <button className="primary-button" type="button" disabled={busy} onClick={() => void install()}>
        <Download size={18} aria-hidden="true" />{busy ? "等待浏览器确认…" : "添加到主屏幕"}
      </button>}
      {ios ? <ol className="install-app-steps">
        <li>在 Safari 中打开圆桌网站。</li>
        <li>点浏览器的「分享」，选择「添加到主屏幕」。若没有看到，向下滚动或编辑操作。</li>
        <li>若显示「作为网页 App 打开」，保持开启，再点「添加」。</li>
      </ol> : <ol className="install-app-steps">
        <li>打开浏览器菜单，选择「安装应用」或「添加到主屏幕」。</li>
        <li>按提示确认，再从主屏幕图标进入圆桌。</li>
        <li>如果没有此选项，可尝试 Chrome、Edge，或在 iPhone 的 Safari 中使用「分享 → 添加到主屏幕」。</li>
      </ol>}
      {message && <p className="install-app-message" role="status">{message}</p>}
      <p className="install-online-note">对局需要联网。断网时请等待恢复，再继续操作。</p>
      <DialogClose asChild><button className="secondary-button wide" type="button">知道了</button></DialogClose>
    </DialogContent>
  </Dialog>;
}
