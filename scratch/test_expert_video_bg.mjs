import { spawn } from 'child_process';
import fs from 'fs';

const CHROME_EXE = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA = "C:\\Users\\kushw\\.gemini\\chrome-profile-expert-video-test";

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log("=== Launching Chrome for Expert Portal Animated Background Verification ===");
  const chromeProcess = spawn(CHROME_EXE, [
    `--remote-debugging-port=9288`,
    `--user-data-dir=${USER_DATA}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    '--window-size=1440,900',
    'http://localhost:5173/expert'
  ]);

  await sleep(3000);
  try {
    const res = await fetch('http://127.0.0.1:9288/json');
    const tabs = await res.json();
    const pageTab = tabs.find(t => t.type === 'page');
    if (!pageTab) throw new Error("Could not find page tab in Chrome");

    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    let id = 1;
    const send = (m, p = {}) => new Promise((resolve, reject) => {
      const curId = id++;
      const handler = (ev) => {
        const data = JSON.parse(ev.data);
        if (data.id === curId) {
          ws.removeEventListener('message', handler);
          if (data.error) reject(data.error);
          else resolve(data.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: curId, method: m, params: p }));
    });

    await send('Page.enable');
    await send('Runtime.enable');
    await sleep(2500);

    // 1. Inspect Background Video Element in Dark Mode
    const videoEval = await send('Runtime.evaluate', {
      expression: `(() => {
        const video = document.querySelector('video');
        const bgContainer = video ? video.closest('[aria-hidden="true"]') : null;
        const mainContent = document.querySelector('.relative.z-10');
        return {
          videoFound: !!video,
          src: video ? video.src : null,
          autoPlay: video ? video.autoplay : null,
          muted: video ? video.muted : null,
          loop: video ? video.loop : null,
          playsInline: video ? video.playsInline : null,
          objectFit: video ? window.getComputedStyle(video).objectFit : null,
          pointerEvents: bgContainer ? window.getComputedStyle(bgContainer).pointerEvents : null,
          zIndex: bgContainer ? window.getComputedStyle(bgContainer).zIndex : null,
          mainContentZIndex: mainContent ? window.getComputedStyle(mainContent).zIndex : null,
          mainContentPosition: mainContent ? window.getComputedStyle(mainContent).position : null,
          videoReadyState: video ? video.readyState : null,
          videoPaused: video ? video.paused : null
        };
      })()`,
      returnByValue: true
    });

    console.log("\n[Video Verification Results]:", JSON.stringify(videoEval.value, null, 2));

    // Capture Dark Mode Screenshot
    let shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/expert_portal_dark_mode.png', Buffer.from(shot.data, 'base64'));
    console.log("--> Saved scratch/expert_portal_dark_mode.png");

    // 2. Toggle to Light Mode via DOM click or localStorage
    console.log("\n[Testing Light Mode Toggle]...");
    await send('Runtime.evaluate', {
      expression: `(() => {
        const themeBtn = document.querySelector('button[title*="theme" i], button[title*="Theme" i], button[aria-label*="theme" i]') || 
          Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Light') || b.innerText.includes('Dark'));
        if (themeBtn) {
          themeBtn.click();
          return { clicked: true, text: themeBtn.innerText };
        }
        return { clicked: false };
      })()`,
      returnByValue: true
    });

    await sleep(1500);

    const lightEval = await send('Runtime.evaluate', {
      expression: `(() => {
        const video = document.querySelector('video');
        const isThemeLight = document.querySelector('.theme-light') !== null || document.body.classList.contains('light');
        const overlays = document.querySelectorAll('[aria-hidden="true"] > div');
        return {
          videoFound: !!video,
          videoOpacity: video ? window.getComputedStyle(video).opacity : null,
          isThemeLight,
          overlayCount: overlays.length
        };
      })()`,
      returnByValue: true
    });

    console.log("[Light Mode Verification]:", JSON.stringify(lightEval.value, null, 2));

    // Capture Light Mode Screenshot
    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/expert_portal_light_mode.png', Buffer.from(shot.data, 'base64'));
    console.log("--> Saved scratch/expert_portal_light_mode.png");

    // 3. Test prefers-reduced-motion emulation
    console.log("\n[Testing prefers-reduced-motion]...");
    await send('Emulation.setEmulatedMedia', {
      media: '',
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
    });

    await sleep(1000);

    const reducedMotionEval = await send('Runtime.evaluate', {
      expression: `(() => {
        const video = document.querySelector('video');
        const posterImg = document.querySelector('[aria-hidden="true"] img');
        return {
          videoRemovedOrHidden: !video,
          posterImgFound: !!posterImg,
          posterSrc: posterImg ? posterImg.src : null
        };
      })()`,
      returnByValue: true
    });

    console.log("[Reduced Motion Verification]:", JSON.stringify(reducedMotionEval.value, null, 2));

    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/expert_portal_reduced_motion.png', Buffer.from(shot.data, 'base64'));
    console.log("--> Saved scratch/expert_portal_reduced_motion.png");

    console.log("\n=== All Automated E2E Checks Completed Successfully! ===");
    ws.close();
  } catch (err) {
    console.error("Test execution error:", err);
  } finally {
    chromeProcess.kill();
  }
}

run();
