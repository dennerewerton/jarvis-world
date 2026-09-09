import React, {useContext, useEffect, useRef, useState} from 'react';
import {AppContext} from '../../.webaverse-runtime/src/components/app';
import {activityApi} from '../../.webaverse-runtime/src/jarvis-compat/activity-api.mjs';
import {JarvisIdentityContext} from '../../.webaverse-runtime/src/jarvis-compat/ActivityShell.jsx';
import ioManager from '../../.webaverse-runtime/io-manager.js';
import game from '../../.webaverse-runtime/game.js';
import cameraManager from '../../.webaverse-runtime/camera-manager.js';
import {getSavedGraphicsQuality, setGraphicsQuality, teleportToLocation} from '../../.webaverse-runtime/jarvis-world-actions-proxy.js';

const I = ({name, size = 24}) => {
  const p = {width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true};
  const d = {
    map: <><path d="M3 6l5-3 8 3 5-3v15l-5 3-8-3-5 3z"/><path d="M8 3v15M16 6v15"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3 19c.5-3.5 2.5-5.5 6-5.5s5.5 2 6 5.5"/><circle cx="17.5" cy="9" r="2"/></>,
    daily: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 10h18"/><path d="m8 15 2 2 5-5"/></>,
    shop: <><path d="M4 10h16l-1-5H5z"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>,
    compass: <><circle cx="12" cy="12" r="9"/><path d="m16 8-3 6-6 3 3-6z"/></>,
    gear: <><circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/></>,
    event: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 10h18"/><path d="m12 12 1 2 2 .3-1.5 1.5.4 2.2-1.9-1-1.9 1 .4-2.2L9 14.3l2-.3z"/></>,
    chat: <><path d="M4 5h16v12H9l-5 3z"/><path d="M8 11h.1M12 11h.1M16 11h.1"/></>,
    smile: <><circle cx="12" cy="12" r="9"/><path d="M8 14c1 2 2.4 3 4 3s3-1 4-3M8.5 9h.1M15.5 9h.1"/></>,
    run: <><circle cx="15" cy="4" r="2"/><path d="m13 8-3 4 4 2 1 6M13 8l4 2 3-1M10 12l-3 5-3 1M14 14l-4 5"/></>,
    jump: <><path d="M12 20V5m-6 6 6-6 6 6M5 20h14"/></>,
    crown: <><path d="m4 8 4 3 4-6 4 6 4-3-2 10H6zM6 18h12"/></>,
    coin: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="6"/><path d="M15 9c-1-.8-5-1.2-5 1 0 2 5 1 5 4 0 2-4 2-6 1M12 7v10"/></>,
  };
  return <svg {...p}>{d[name] || d.compass}</svg>;
};

const avatarProxySource = value => {
  if (!value || typeof window === 'undefined') return '';
  try {
    const url = new URL(String(value), window.location.href);
    if (url.origin === window.location.origin) return url.href;
    if (url.protocol === 'https:' && (url.hostname === 'cdn.discordapp.com' || url.hostname === 'media.discordapp.net')) {
      return `/__jarvis/avatar?url=${encodeURIComponent(url.href)}`;
    }
  } catch {}
  return '';
};

const ProfileAvatar = ({url, name}) => {
  const source = avatarProxySource(url);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [source]);
  if (!source || failed) return <span className="avatar-fallback">{name.trim().slice(0, 1).toUpperCase() || 'J'}</span>;
  return <img src={source} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)}/>;
};

const css = `
.jh{position:fixed;inset:0;z-index:1000;pointer-events:none;color:#f7fdff;font-family:Inter,Muli,system-ui,sans-serif;text-shadow:0 1px 2px #00152b}.jh *{box-sizing:border-box}.jh button{pointer-events:auto;color:inherit;font:inherit;cursor:pointer}.jh svg{display:block}
.jp{background:linear-gradient(135deg,rgba(5,22,50,.96),rgba(8,72,116,.91));border:2px solid rgba(68,221,255,.84);box-shadow:0 12px 28px rgba(0,0,0,.4),inset 0 0 22px rgba(61,216,255,.1)}
.prof{position:fixed;left:16px;top:16px;width:310px;height:78px;border-radius:18px 18px 32px 18px;padding:9px 30px 9px 72px;display:flex;align-items:center}.av{position:absolute;left:-2px;width:66px;height:66px;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:radial-gradient(circle at 35% 30%,#a66cff,#164d9b 70%);border:4px solid #84efff;box-shadow:0 0 0 4px rgba(144,83,255,.7),0 0 18px #43dfff;font-size:24px;font-weight:900}.av img{width:100%;height:100%;object-fit:cover}.pc{display:grid;min-width:0}.pc strong{font-size:18px;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pc span{font-size:11px;color:#b7dbf4}.pc em{font-style:normal;color:#7feaff;font-size:8px;font-weight:900;letter-spacing:.12em;margin-top:3px}
.top{position:fixed;right:16px;top:16px;display:flex;gap:8px}.wallet{height:48px;min-width:165px;border-radius:18px;display:flex;align-items:center;gap:8px;padding:0 12px;background:linear-gradient(135deg,#071a32,#075b51);border:2px solid #38e7ad}.coin{display:grid;place-items:center;width:32px;height:32px;border-radius:50%;background:linear-gradient(145deg,#fff47c,#ffb000);box-shadow:inset 0 0 0 3px #d97d00;color:#fff3a0}.wallet strong{margin-left:auto;font-size:17px}.wallet small{font-size:9px;color:#8effd1;font-weight:900}.top button{width:46px;height:46px;border-radius:14px;border:1px solid #46d8ff;background:linear-gradient(145deg,#0a315d,#075a8a);display:grid;place-items:center}
.rail{position:fixed;left:16px;top:112px;display:grid;gap:8px}.rail button{width:62px;height:62px;border-radius:15px;border:1px solid #43d8ff;background:linear-gradient(145deg,#061d3d,#0a5279);display:grid;place-items:center;padding:5px;position:relative}.rail button:hover,.rail button.on{border-color:#c071ff;background:linear-gradient(145deg,#173b75,#682f9f);transform:translateX(3px)}.rail span{height:27px;color:#8beeff}.rail strong{font-size:9px}.rail kbd{position:absolute;right:-7px;bottom:5px;background:#06172b;border:1px solid #5e7892;border-radius:4px;padding:1px 4px;font-size:7px}
.missions{position:fixed;right:16px;top:82px;width:300px;border-radius:18px;padding:10px 13px}.missions header{display:flex;align-items:center;gap:8px;padding-bottom:8px;border-bottom:1px solid rgba(91,215,255,.3)}.missions header span{display:grid;place-items:center;width:27px;height:27px;border-radius:50%;background:#61eaff;color:#05365b}.missions header strong{font-size:12px}.missions p{display:grid;grid-template-columns:18px 1fr auto;align-items:center;gap:7px;margin:0;min-height:34px;border-bottom:1px solid rgba(104,202,235,.18);font-size:10px}.missions p:last-child{border:0}.ck{width:14px;height:14px;border:1px solid #5edfff;border-radius:4px}.ck.ok{background:#42e7ad;box-shadow:0 0 8px rgba(66,231,173,.5)}.missions b{font-size:8px;color:#72eaff}
.features{position:fixed;right:16px;top:247px;width:300px;display:grid;gap:8px}.feature{height:58px;border-radius:16px;border:1px solid #5edaff;display:grid;grid-template-columns:40px 1fr 12px;align-items:center;gap:9px;padding:7px 11px;text-align:left;background:linear-gradient(100deg,#172d60,#432680)}.feature.shop{border-color:#c262ff;background:linear-gradient(100deg,#351869,#81298e)}.feature.explore{border-color:#47efb2;background:linear-gradient(100deg,#074a57,#147b63)}.feature>span{height:38px;border-radius:11px;display:grid;place-items:center;color:#ffe16c;background:rgba(255,255,255,.08)}.feature strong{display:grid;font-size:12px}.feature small{font-size:8px;color:#c5dcea;margin-top:3px}.feature>b{font-size:21px}
.brand{position:fixed;left:22px;bottom:91px;width:225px;padding:10px 12px 11px 48px;background:linear-gradient(105deg,rgba(20,90,165,.88),rgba(38,111,188,.25),transparent);clip-path:polygon(0 0,86% 0,100% 50%,86% 100%,0 100%);display:grid}.brand>span{position:absolute;left:12px;top:12px;color:#8ceeff}.brand strong{font-size:15px}.brand small{font-size:9px;color:#6de9ff;font-weight:900}.brand em{font-size:6px;font-style:normal;color:#bad7e9;letter-spacing:.08em}
.dock{position:fixed;left:16px;bottom:14px;display:flex;gap:8px}.dock button{min-width:72px;height:66px;border-radius:16px;border:2px solid #42dcff;background:linear-gradient(145deg,#06224a,#0b668f);display:grid;place-items:center;padding:5px 8px;position:relative}.dock button:nth-child(2){border-color:#bb68ff;background:linear-gradient(145deg,#2c145b,#743196)}.dock button:nth-child(3){border-color:#51ecaa;background:linear-gradient(145deg,#073f43,#147d5d)}.dock span{height:27px;color:#a0efff}.dock strong{font-size:10px}.dock kbd{position:absolute;right:5px;bottom:4px;font-size:7px}
.chat{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);width:min(380px,calc(100vw - 590px));height:46px;border:2px solid #44d0ff;border-radius:17px;background:rgba(6,27,55,.94);display:grid;grid-template-columns:25px 1fr 18px;align-items:center;padding:0 12px;text-align:left}.chat span{color:#76eaff}.chat em{font-style:normal;color:#afc6d7;font-size:10px}.move{position:fixed;right:20px;bottom:45px;display:flex;gap:10px}.move div{width:72px;height:72px;border-radius:50%;border:2px solid #4cd9ff;background:radial-gradient(circle at 35% 25%,#1c5488,#05162f);display:grid;place-items:center;padding:6px}.move span{height:28px}.move strong{font-size:9px}.move kbd{font-size:7px;background:#07172a;border-radius:4px;padding:2px 4px}
.j-scrim{position:fixed;inset:0;border:0;background:rgba(0,8,20,.52);pointer-events:auto;backdrop-filter:blur(2px)}.modal{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(560px,calc(100vw - 30px));max-height:min(82vh,620px);overflow:auto;min-height:210px;border-radius:22px;padding:20px;pointer-events:auto}.modal>.panel-close{position:absolute;right:12px;top:12px;width:32px;height:32px;border-radius:9px;border:1px solid #5fcde9;background:#0c4669}.modal>small{color:#68e8ff;font-size:8px;font-weight:900;letter-spacing:.15em}.modal h2{margin:4px 40px 14px 0;font-size:22px}.guide{display:grid;grid-template-columns:1fr 1fr;gap:8px}.guide span{padding:8px;border:1px solid rgba(89,210,245,.22);border-radius:9px;background:rgba(30,102,137,.13);font-size:10px}.guide kbd{color:#86edff;margin-right:7px}
.panel-body{display:grid;gap:12px}.panel-copy,.panel-state{margin:0;color:#d2e9f4;font-size:11px;line-height:1.55}.panel-state{padding:13px;border:1px solid rgba(89,210,245,.23);border-radius:12px;background:rgba(27,96,133,.17)}.panel-state.error{border-color:rgba(255,111,133,.42);color:#ffb5c1}.panel-state.success{border-color:rgba(72,238,177,.45);color:#9dffd8}.panel-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.panel-card{display:grid;gap:5px;min-width:0;padding:12px;border:1px solid rgba(89,210,245,.25);border-radius:12px;background:rgba(18,74,112,.22)}.panel-card strong{font-size:12px}.panel-card span,.panel-card small{overflow-wrap:anywhere;color:#bad6e6;font-size:9px;line-height:1.4}.panel-card b{color:#ffe176;font-size:10px}.panel-card .panel-action,.panel-action{position:static;width:auto;height:auto;margin-top:5px;padding:8px 10px;border:1px solid #55ddff;border-radius:9px;background:linear-gradient(145deg,#0a3c69,#087da1);font-size:9px;font-weight:900;text-align:center}.panel-action:hover,.panel-action:focus-visible{outline:2px solid #a6f5ff}.panel-action:disabled{cursor:wait;filter:saturate(.4);opacity:.65}.panel-map{position:relative;min-height:220px;overflow:hidden;border:1px solid rgba(83,225,255,.38);border-radius:15px;background:radial-gradient(circle at 50% 38%,rgba(37,202,204,.28),transparent 31%),linear-gradient(135deg,#0c496f,#071f39)}.panel-map:before,.panel-map:after{position:absolute;background:rgba(189,233,239,.19);content:""}.panel-map:before{left:0;right:0;top:45%;height:21px}.panel-map:after{top:0;bottom:0;left:47%;width:21px}.map-actions{position:relative;z-index:1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:13px}.map-actions .panel-action{display:grid;gap:3px;margin:0;background:rgba(5,52,82,.88)}.map-actions small{color:#a9ccdd;font-size:7px}.quality-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.quality-grid .panel-action{margin:0}.quality-grid .panel-action.on{border-color:#76f3bb;background:linear-gradient(145deg,#07534c,#13916e);box-shadow:0 0 12px rgba(73,236,178,.25)}.shop-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.empty-state{padding:20px;text-align:center;color:#b8d4e3;font-size:11px}

.jm{position:fixed;inset:0;z-index:1000;overflow:hidden;pointer-events:none;color:#f7fdff;font-family:Inter,Muli,system-ui,sans-serif;text-shadow:0 1px 3px #001326;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}.jm *{box-sizing:border-box}.jm button{color:inherit;font:inherit}.jm-surface{background:linear-gradient(145deg,rgba(4,19,44,.94),rgba(7,75,116,.88));border:1px solid rgba(82,224,255,.82);box-shadow:0 8px 24px rgba(0,0,0,.42),inset 0 0 18px rgba(76,216,255,.12);backdrop-filter:blur(7px)}
.jm-profile{position:fixed;top:max(9px,env(safe-area-inset-top));left:max(10px,env(safe-area-inset-left));z-index:8;display:flex;align-items:center;gap:9px;width:min(218px,36vw);height:55px;padding:6px 12px 6px 51px;border-radius:15px 15px 24px 15px}.jm-avatar{position:absolute;left:-2px;display:grid;place-items:center;width:48px;height:48px;overflow:hidden;border:3px solid #7deaff;border-radius:50%;background:radial-gradient(circle at 35% 30%,#a56cff,#164b96 70%);box-shadow:0 0 0 3px rgba(138,81,255,.62),0 0 13px rgba(67,223,255,.8);font-size:18px;font-weight:900}.jm-avatar img{width:100%;height:100%;object-fit:cover}.jm-profile-copy{display:grid;min-width:0}.jm-profile-copy strong{overflow:hidden;font-size:12px;line-height:1.15;text-overflow:ellipsis;text-transform:uppercase;white-space:nowrap}.jm-profile-copy span{overflow:hidden;color:#9ccbe5;font-size:8px;text-overflow:ellipsis;white-space:nowrap}.jm-profile-copy em{margin-top:2px;color:#6ff0c1;font-size:6px;font-style:normal;font-weight:900;letter-spacing:.1em}
.jm-wallet{position:fixed;top:max(9px,env(safe-area-inset-top));right:max(10px,env(safe-area-inset-right));z-index:8;display:flex;align-items:center;gap:7px;height:43px;min-width:105px;padding:0 10px;border-color:#43eab2;border-radius:15px;background:linear-gradient(135deg,rgba(5,24,45,.95),rgba(6,85,70,.91))}.jm-wallet .coin{width:28px;height:28px}.jm-wallet strong{margin-left:auto;font-size:13px}.jm-wallet small{color:#82f6cf;font-size:7px;font-weight:900}
.jm-quick{position:fixed;top:max(70px,calc(env(safe-area-inset-top) + 61px));left:max(10px,env(safe-area-inset-left));z-index:8;display:flex;gap:6px;pointer-events:auto}.jm-quick button{display:grid;place-items:center;width:43px;height:43px;padding:0;border:1px solid #49dfff;border-radius:13px;background:linear-gradient(145deg,rgba(5,29,61,.95),rgba(8,92,128,.92));box-shadow:0 6px 15px rgba(0,0,0,.3)}.jm-quick button:active,.jm-quick button.on{border-color:#c978ff;background:linear-gradient(145deg,#203c7b,#7433a4);transform:scale(.94)}
.jm-look{position:fixed;z-index:1;top:17%;right:0;bottom:22%;left:34%;pointer-events:auto;touch-action:none}.jm-look-hint{position:absolute;top:50%;right:8%;display:flex;align-items:center;gap:6px;padding:5px 9px;transform:translateY(-50%);border:1px solid rgba(113,226,255,.22);border-radius:14px;background:rgba(3,20,40,.27);color:rgba(215,247,255,.48);font-size:7px;font-weight:800;letter-spacing:.08em;opacity:1;transition:opacity .25s}.jm-look[data-used="true"] .jm-look-hint{opacity:0}
.jm-joystick{position:fixed;z-index:9;left:max(22px,calc(env(safe-area-inset-left) + 13px));bottom:max(24px,calc(env(safe-area-inset-bottom) + 15px));width:126px;height:126px;border:0;border-radius:50%;pointer-events:auto;touch-action:none;background:radial-gradient(circle,rgba(25,110,160,.18) 0 29%,rgba(7,34,68,.62) 30% 64%,rgba(62,212,255,.4) 65% 67%,rgba(2,16,35,.35) 68%);box-shadow:inset 0 0 24px rgba(50,213,255,.18),0 6px 22px rgba(0,0,0,.28)}.jm-joystick:before,.jm-joystick:after{content:"";position:absolute;inset:17px;border:1px solid rgba(102,229,255,.16);border-radius:50%}.jm-joystick:after{inset:29px}.jm-stick{position:absolute;top:50%;left:50%;display:grid;place-items:center;width:58px;height:58px;transform:translate(-50%,-50%);border:2px solid rgba(132,239,255,.92);border-radius:50%;background:radial-gradient(circle at 35% 28%,rgba(66,180,235,.95),rgba(7,49,91,.96));box-shadow:0 6px 14px rgba(0,0,0,.35),inset 0 0 11px rgba(176,247,255,.22);will-change:transform}.jm-stick:before{content:"";width:17px;height:17px;transform:rotate(45deg);border-top:2px solid #d9faff;border-left:2px solid #d9faff;opacity:.72}.jm-joystick[data-active="true"] .jm-stick{border-color:#aef8ff;box-shadow:0 0 0 4px rgba(62,221,255,.16),0 7px 17px rgba(0,0,0,.4)}
.jm-actions{position:fixed;z-index:9;right:max(18px,calc(env(safe-area-inset-right) + 11px));bottom:max(23px,calc(env(safe-area-inset-bottom) + 14px));width:164px;height:142px;pointer-events:none}.jm-action{position:absolute;display:grid;place-items:center;padding:0;border-radius:50%;pointer-events:auto;touch-action:none;text-shadow:none}.jm-action span{display:grid;place-items:center}.jm-action strong{font-size:8px;text-transform:uppercase}.jm-jump{right:0;bottom:0;width:78px;height:78px;border:2px solid #64edff;background:radial-gradient(circle at 32% 25%,rgba(34,151,211,.97),rgba(5,42,82,.97));box-shadow:0 7px 18px rgba(0,0,0,.4),inset 0 0 15px rgba(124,239,255,.22)}.jm-run{left:8px;top:0;width:65px;height:65px;border:2px solid #c071ff;background:radial-gradient(circle at 32% 25%,rgba(127,73,204,.97),rgba(41,17,84,.97));box-shadow:0 7px 18px rgba(0,0,0,.4),inset 0 0 15px rgba(216,166,255,.18)}.jm-action:active,.jm-action[data-active="true"]{transform:scale(.91);filter:brightness(1.25)}
.jm-social{position:fixed;z-index:9;bottom:max(13px,calc(env(safe-area-inset-bottom) + 6px));left:50%;display:flex;gap:7px;transform:translateX(-50%);pointer-events:auto}.jm-social button{display:flex;align-items:center;gap:5px;min-width:68px;height:39px;padding:0 9px;border:1px solid #48dfff;border-radius:13px;background:linear-gradient(145deg,rgba(5,31,65,.95),rgba(8,87,125,.94));box-shadow:0 6px 16px rgba(0,0,0,.36);font-size:8px;font-weight:900}.jm-social button:nth-child(2){border-color:#bd72ff;background:linear-gradient(145deg,rgba(45,20,91,.96),rgba(111,45,147,.94))}.jm-social button:active{transform:scale(.94)}
.jm-status{position:fixed;z-index:7;right:max(11px,env(safe-area-inset-right));bottom:max(7px,env(safe-area-inset-bottom));color:rgba(194,234,247,.58);font-size:6px;font-weight:900;letter-spacing:.13em;pointer-events:none}
.jm-scrim{position:fixed;inset:0;z-index:20;border:0;background:rgba(0,8,20,.6);pointer-events:auto;backdrop-filter:blur(3px)}.jm-modal{position:fixed;z-index:21;top:50%;left:50%;width:min(520px,calc(100vw - 32px));max-height:min(84vh,560px);overflow:auto;padding:17px;transform:translate(-50%,-50%);border-radius:20px;pointer-events:auto;touch-action:pan-y}.jm-modal>.panel-close{position:absolute;top:10px;right:10px;width:32px;height:32px;border:1px solid #65daf8;border-radius:10px;background:#0a4368;font-size:20px}.jm-modal>small{color:#6ceaff;font-size:7px;font-weight:900;letter-spacing:.15em}.jm-modal h2{margin:4px 38px 12px 0;font-size:20px}.jm-guide{display:grid;grid-template-columns:1fr 1fr;gap:7px}.jm-guide span{display:flex;align-items:center;gap:7px;padding:8px;border:1px solid rgba(89,210,245,.25);border-radius:10px;background:rgba(30,102,137,.18);font-size:9px}.jm-guide b{display:grid;place-items:center;min-width:27px;height:27px;border-radius:50%;background:#0b628c;color:#8eefff}.jm-panel-copy{color:#d2e9f4;font-size:10px;line-height:1.5}
@media(max-width:900px){.prof{width:250px}.missions,.features{width:236px}.brand,.move{display:none}.chat{left:auto;right:12px;transform:none;width:270px}.dock button{min-width:62px}}
@media(max-width:620px){.missions,.features{display:none}.prof{width:200px}.pc span{display:none}.wallet{min-width:100px}.rail{top:auto;bottom:78px;grid-template-columns:repeat(5,1fr)}.rail button{width:47px;height:45px}.rail strong,.rail kbd,.chat{display:none}}
@media(orientation:portrait){.jm-profile{width:min(210px,55vw)}.jm-quick{top:max(71px,calc(env(safe-area-inset-top) + 62px));display:grid;grid-template-columns:repeat(2,43px)}.jm-look{top:15%;bottom:29%;left:24%}.jm-joystick{width:120px;height:120px}.jm-social{bottom:max(158px,calc(env(safe-area-inset-bottom) + 150px))}.jm-status{display:none}}
@media(max-height:390px) and (orientation:landscape){.jm-profile{height:48px;width:190px;padding-left:45px}.jm-avatar{width:42px;height:42px}.jm-profile-copy strong{font-size:10px}.jm-quick{top:max(59px,calc(env(safe-area-inset-top) + 51px))}.jm-quick button{width:38px;height:38px}.jm-joystick{width:112px;height:112px}.jm-stick{width:52px;height:52px}.jm-actions{width:150px;height:122px}.jm-jump{width:70px;height:70px}.jm-run{width:58px;height:58px}.jm-social button{height:35px}.jm-status{display:none}}
@media(max-width:520px){.panel-grid,.shop-list{grid-template-columns:1fr}.quality-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.map-actions{grid-template-columns:repeat(2,minmax(0,1fr))}.panel-map{min-height:250px}}
@media(prefers-reduced-motion:reduce){.jm *{transition:none!important}}
`;

const nav = [['map', 'map', 'Mapa', 'M'], ['social', 'users', 'Social', 'P'], ['daily', 'daily', 'Daily', 'D'], ['shop', 'shop', 'Loja', 'L'], ['guide', 'compass', 'Guia', 'G']];
const mobileNav = [['map', 'map', 'Mapa'], ['daily', 'daily', 'Daily'], ['shop', 'shop', 'Loja'], ['guide', 'compass', 'Guia']];

const detectMobile = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const uaMobile = navigator.userAgentData?.mobile === true || /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const ipad = /iPad/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  const touch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches === true;
  const noHover = window.matchMedia?.('(hover: none)').matches === true;
  return touch && (uaMobile || ipad || (coarse && noHover));
};

const useMobileDevice = () => {
  const [mobile, setMobile] = useState(detectMobile);
  useEffect(() => {
    const update = () => setMobile(detectMobile());
    const coarse = window.matchMedia?.('(pointer: coarse)');
    coarse?.addEventListener?.('change', update);
    window.addEventListener('orientationchange', update);
    window.addEventListener('resize', update);
    return () => {
      coarse?.removeEventListener?.('change', update);
      window.removeEventListener('orientationchange', update);
      window.removeEventListener('resize', update);
    };
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('jarvis-mobile', mobile);
    document.documentElement.dataset.jarvisInput = mobile ? 'mobile' : 'desktop';
    return () => {
      document.documentElement.classList.remove('jarvis-mobile');
      delete document.documentElement.dataset.jarvisInput;
    };
  }, [mobile]);
  return mobile;
};

const stopPointer = event => {
  event.preventDefault();
  event.stopPropagation();
};

const MobileJoystick = () => {
  const baseRef = useRef(null);
  const stickRef = useRef(null);
  const pointerRef = useRef(null);

  const release = event => {
    if (event && pointerRef.current !== event.pointerId) return;
    ioManager.keys.up = false;
    ioManager.keys.down = false;
    ioManager.keys.left = false;
    ioManager.keys.right = false;
    pointerRef.current = null;
    if (baseRef.current) baseRef.current.dataset.active = 'false';
    if (stickRef.current) stickRef.current.style.transform = 'translate(-50%, -50%)';
  };

  const move = event => {
    if (pointerRef.current !== event.pointerId || !baseRef.current) return;
    stopPointer(event);
    const rect = baseRef.current.getBoundingClientRect();
    const radius = rect.width * .34;
    let dx = event.clientX - (rect.left + rect.width / 2);
    let dy = event.clientY - (rect.top + rect.height / 2);
    const length = Math.hypot(dx, dy);
    if (length > radius) {
      dx = dx / length * radius;
      dy = dy / length * radius;
    }
    const nx = dx / radius;
    const ny = dy / radius;
    const deadzone = .22;
    ioManager.keys.left = nx < -deadzone;
    ioManager.keys.right = nx > deadzone;
    ioManager.keys.up = ny < -deadzone;
    ioManager.keys.down = ny > deadzone;
    if (stickRef.current) stickRef.current.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  };

  const down = event => {
    if (pointerRef.current !== null) return;
    stopPointer(event);
    pointerRef.current = event.pointerId;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.currentTarget.dataset.active = 'true';
    move(event);
  };

  useEffect(() => () => release(), []);
  return <div ref={baseRef} className="jm-joystick" data-active="false" role="group" aria-label="Controle de movimento" onPointerDown={down} onPointerMove={move} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}><span ref={stickRef} className="jm-stick" aria-hidden="true"/></div>;
};

const MobileLookZone = () => {
  const pointerRef = useRef(null);
  const lastRef = useRef({x: 0, y: 0});
  const down = event => {
    if (pointerRef.current !== null) return;
    stopPointer(event);
    pointerRef.current = event.pointerId;
    lastRef.current = {x: event.clientX, y: event.clientY};
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.currentTarget.dataset.used = 'true';
  };
  const move = event => {
    if (pointerRef.current !== event.pointerId) return;
    stopPointer(event);
    const dx = event.clientX - lastRef.current.x;
    const dy = event.clientY - lastRef.current.y;
    lastRef.current = {x: event.clientX, y: event.clientY};
    if (dx || dy) cameraManager.handleMouseMove({movementX: dx * 1.15, movementY: dy * 1.15});
  };
  const release = event => {
    if (event && pointerRef.current !== event.pointerId) return;
    pointerRef.current = null;
  };
  return <div className="jm-look" data-used="false" aria-label="Área de controle da câmera" onPointerDown={down} onPointerMove={move} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}><span className="jm-look-hint"><I name="compass" size={14}/> ARRASTE PARA OLHAR</span></div>;
};

const MobileActions = () => {
  const [running, setRunning] = useState(false);
  const releaseRun = event => {
    if (event) stopPointer(event);
    ioManager.keys.shift = false;
    setRunning(false);
  };
  const pressRun = event => {
    stopPointer(event);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    ioManager.keys.shift = true;
    setRunning(true);
  };
  const pressJump = event => {
    stopPointer(event);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    ioManager.keys.space = true;
    if (!game.isJumping()) game.jump('jump');
    else if (!game.isDoubleJumping()) game.doubleJump();
    navigator.vibrate?.(8);
  };
  const releaseJump = event => {
    if (event) stopPointer(event);
    ioManager.keys.space = false;
  };
  useEffect(() => () => {
    ioManager.keys.shift = false;
    ioManager.keys.space = false;
  }, []);
  return <section className="jm-actions" aria-label="Ações do personagem">
    <button type="button" className="jm-action jm-run" data-active={running} aria-label="Segure para correr" onPointerDown={pressRun} onPointerUp={releaseRun} onPointerCancel={releaseRun} onLostPointerCapture={releaseRun}><span><I name="run" size={27}/></span><strong>Correr</strong></button>
    <button type="button" className="jm-action jm-jump" aria-label="Pular" onPointerDown={pressJump} onPointerUp={releaseJump} onPointerCancel={releaseJump} onLostPointerCapture={releaseJump}><span><I name="jump" size={32}/></span><strong>Pular</strong></button>
  </section>;
};

const locations = [
  ['plaza', 'Jarvis Plaza', 'Ponto central'],
  ['shop', 'Loja', 'Skins e itens'],
  ['daily', 'Daily', 'Recompensa diária'],
  ['events', 'Eventos', 'Centro de eventos'],
  ['arcade', 'Arcade', 'Minijogos'],
  ['casino', 'Cassino', 'Jogos Jarvis'],
  ['arena', 'Arena', 'Competições'],
];
const qualityOptions = [['auto', 'Auto'], ['low', 'Baixo'], ['medium', 'Médio'], ['high', 'Alto']];
const getShopItems = remote => Array.isArray(remote?.data?.shop?.items) ? remote.data.shop.items : [];
const itemName = (item, index) => item?.name || item?.title || item?.label || item?.id || `Item ${index + 1}`;
const itemPrice = item => item?.price ?? item?.cost ?? item?.value ?? null;

const PanelBody = ({panel, remote, quality, operation, onQuality, onTravel}) => {
  if (panel === 'map') return <div className="panel-body"><p className="panel-copy">Escolha um destino para viajar dentro da cidade.</p><div className="panel-map"><div className="map-actions">{locations.map(([id, name, description]) => <button type="button" className="panel-action" key={id} disabled={operation.status === 'loading'} onClick={() => onTravel(id)}><strong>{name}</strong><small>{description}</small></button>)}</div></div>{operation.message && <p className={`panel-state ${operation.status}`}>{operation.message}</p>}</div>;
  if (panel === 'guide') return <div className="guide"><span><kbd>WASD</kbd>Mover</span><span><kbd>SHIFT</kbd>Correr</span><span><kbd>ESPAÇO</kbd>Pular</span><span><kbd>Q</kbd>Emotes</span><span><kbd>ENTER</kbd>Chat</span><span><kbd>'</kbd>Câmera</span></div>;
  if (panel === 'settings') return <div className="panel-body"><div className="panel-card"><strong>Qualidade gráfica</strong><span>Reduz a resolução interna e a distância de carregamento da cidade em aparelhos mais fracos.</span><div className="quality-grid">{qualityOptions.map(([id, label]) => <button type="button" key={id} className={`panel-action ${quality === id ? 'on' : ''}`} disabled={operation.status === 'loading'} aria-pressed={quality === id} onClick={() => onQuality(id)}>{label}</button>)}</div></div><div className="panel-card"><strong>Conta protegida</strong><span>Perfil, moedas e permissões são validados pelo backend do Jarvis e pela sessão do Discord.</span></div>{operation.message && <p className={`panel-state ${operation.status}`}>{operation.message}</p>}</div>;
  if (panel === 'events') return <div className="panel-body"><p className="panel-copy">Acesse os locais de temporadas, encontros e competições da comunidade.</p><div className="panel-grid"><div className="panel-card"><strong>Centro de Eventos</strong><span>Ponto oficial de encontros e conteúdos temporários.</span><button type="button" className="panel-action" disabled={operation.status === 'loading'} onClick={() => onTravel('events')}>IR AGORA</button></div><div className="panel-card"><strong>Arena</strong><span>Área reservada para disputas e atividades competitivas.</span><button type="button" className="panel-action" disabled={operation.status === 'loading'} onClick={() => onTravel('arena')}>IR AGORA</button></div></div>{operation.message && <p className={`panel-state ${operation.status}`}>{operation.message}</p>}</div>;
  if (panel === 'daily') {
    if (remote.status === 'loading') return <p className="panel-state">Carregando sua recompensa diária...</p>;
    if (remote.status === 'error') return <p className="panel-state error">{remote.error}</p>;
    const daily = remote.data?.daily;
    return <div className="panel-body"><div className="panel-card"><strong>{daily?.eligible ? 'Recompensa disponível' : 'Daily já coletado'}</strong><span>{daily?.eligible ? 'Vá ao terminal Daily da Jarvis Plaza para resgatar com segurança.' : 'Volte no próximo período para uma nova recompensa.'}</span>{daily?.reward != null && <b>Recompensa: {String(daily.reward)}</b>}<button type="button" className="panel-action" disabled={operation.status === 'loading'} onClick={() => onTravel('daily')}>IR AO TERMINAL DAILY</button></div>{operation.message && <p className={`panel-state ${operation.status}`}>{operation.message}</p>}</div>;
  }
  if (panel === 'shop') {
    if (remote.status === 'loading') return <p className="panel-state">Carregando o catálogo oficial...</p>;
    if (remote.status === 'error') return <p className="panel-state error">{remote.error}</p>;
    const items = getShopItems(remote);
    return <div className="panel-body"><p className="panel-copy">{remote.data?.shop?.total ?? items.length} itens disponíveis. Compras são confirmadas pelo servidor Jarvis.</p>{items.length ? <div className="shop-list">{items.slice(0, 8).map((item, index) => <div className="panel-card" key={item?.id || index}><strong>{itemName(item, index)}</strong>{item?.description && <span>{String(item.description)}</span>}{itemPrice(item) != null && <b>{new Intl.NumberFormat('pt-BR').format(Number(itemPrice(item)) || 0)} JC</b>}</div>)}</div> : <div className="empty-state">O catálogo está vazio neste momento.</div>}<button type="button" className="panel-action" disabled={operation.status === 'loading'} onClick={() => onTravel('shop')}>VISITAR A LOJA</button>{operation.message && <p className={`panel-state ${operation.status}`}>{operation.message}</p>}</div>;
  }
  return <p className="panel-state error">Este painel não está disponível.</p>;
};

const Panel = ({panel, setPanel, mobile, remote, quality, operation, onQuality, onTravel}) => {
  if (!panel) return null;
  const title = {map: 'Mapa da cidade', daily: 'Daily Jarvis', shop: 'Loja Jarvis', guide: 'Como jogar', events: 'Eventos Jarvis', settings: 'Configurações'}[panel];
  const body = <PanelBody panel={panel} remote={remote} quality={quality} operation={operation} onQuality={onQuality} onTravel={onTravel}/>;
  const stopGameInput = event => event.stopPropagation();
  if (!mobile) return <><button type="button" className="j-scrim" aria-label="Fechar painel" onClick={() => setPanel(null)}/><section className="modal jp" aria-live="polite" onPointerDown={stopGameInput}><button type="button" className="panel-close" onClick={() => setPanel(null)} aria-label="Fechar">×</button><small>JARVIS WORLD</small><h2>{title}</h2>{body}</section></>;
  return <><button type="button" className="jm-scrim" aria-label="Fechar painel" onClick={() => setPanel(null)}/><section className="jm-modal jm-surface" aria-live="polite" onPointerDown={stopGameInput}><button type="button" className="panel-close" onClick={() => setPanel(null)} aria-label="Fechar">×</button><small>JARVIS WORLD · MOBILE</small><h2>{title}</h2>{body}</section></>;
};

const MobileHud = ({identity, chat, open, panel, setPanel, remote, quality, operation, onQuality, onTravel}) => {
  const name = identity?.profile?.display_name || identity?.user?.display_name || identity?.user?.username || 'Jogador';
  const username = identity?.user?.username || 'jarvis';
  const avatar = identity?.profile?.avatar_url || identity?.user?.avatar_url || '';
  const coins = new Intl.NumberFormat('pt-BR').format(Number(identity?.wallet?.balance) || 0);
  return <nav className="jm" aria-label="HUD mobile do Jarvis World"><style>{css}</style>
    <section className="jm-profile jm-surface"><div className="jm-avatar"><ProfileAvatar url={avatar} name={name}/></div><div className="jm-profile-copy"><strong>{name}</strong><span>@{username}</span><em>● JARVIS CITY · MOBILE</em></div></section>
    <section className="jm-wallet jm-surface" aria-label={`${coins} Jarvis Coins`}><span className="coin"><I name="coin" size={21}/></span><strong>{coins}</strong><small>JC</small></section>
    <section className="jm-quick" aria-label="Menu rápido">{mobileNav.map(([id, icon, label]) => <button type="button" key={id} className={panel === id ? 'on' : ''} onClick={() => open(id)} aria-label={label} aria-pressed={panel === id}><I name={icon} size={21}/></button>)}</section>
    <MobileLookZone/><MobileJoystick/><MobileActions/>
    <section className="jm-social" aria-label="Ações sociais"><button type="button" onClick={chat}><I name="chat" size={18}/> CHAT</button><button type="button" onClick={() => window.dispatchEvent(new Event('jarvis-open-emotes'))}><I name="smile" size={18}/> EMOTES</button></section>
    <span className="jm-status">JARVIS WORLD · TOUCH</span><Panel panel={panel} setPanel={setPanel} mobile remote={remote} quality={quality} operation={operation} onQuality={onQuality} onTravel={onTravel}/>
  </nav>;
};

const DesktopHud = ({identity, chat, open, panel, setPanel, remote, quality, operation, onQuality, onTravel}) => {
  const name = identity?.profile?.display_name || identity?.user?.display_name || identity?.user?.username || 'Jogador';
  const username = identity?.user?.username || 'jarvis';
  const avatar = identity?.profile?.avatar_url || identity?.user?.avatar_url || '';
  const coins = new Intl.NumberFormat('pt-BR').format(Number(identity?.wallet?.balance) || 0);
  return <nav className="jh" aria-label="HUD Jarvis World"><style>{css}</style>
    <section className="prof jp"><div className="av"><ProfileAvatar url={avatar} name={name}/></div><div className="pc"><strong>{name}</strong><span>@{username}</span><em>JARVIS CITY · SOCIAL</em></div></section>
    <section className="top"><div className="wallet"><span className="coin"><I name="coin" size={25}/></span><strong>{coins}</strong><small>JC</small></div><button onClick={chat} aria-label="Social"><I name="users"/></button><button onClick={() => open('events')} aria-label="Eventos"><I name="event"/></button><button onClick={() => open('settings')} aria-label="Configurações"><I name="gear"/></button></section>
    <section className="rail">{nav.map(([id, icon, label, key]) => <button key={id} className={panel === id ? 'on' : ''} onClick={() => open(id)}><span><I name={icon} size={23}/></span><strong>{label}</strong><kbd>{key}</kbd></button>)}</section>
    <section className="missions jp"><header><span><I name="compass" size={20}/></span><strong>ATIVIDADES SOCIAIS</strong></header><p><i className="ck ok"/><span>Explore a Jarvis Plaza</span><b>ATIVO</b></p><p><i className="ck"/><span>Converse com outros jogadores</span><b>CHAT</b></p><p><i className="ck"/><span>Descubra os distritos da cidade</span><b>MAPA</b></p></section>
    <section className="features"><button className="feature" onClick={() => open('events')}><span><I name="event" size={28}/></span><strong>EVENTOS<small>Temporadas e encontros</small></strong><b>›</b></button><button className="feature shop" onClick={() => open('shop')}><span><I name="shop" size={28}/></span><strong>LOJA<small>Itens, skins e novidades</small></strong><b>›</b></button><button className="feature explore" onClick={() => open('map')}><span><I name="compass" size={28}/></span><strong>EXPLORAR<small>Landmarks e distritos</small></strong><b>›</b></button></section>
    <section className="brand"><span><I name="crown" size={30}/></span><strong>JARVIS WORLD</strong><small>JARVIS CITY</small><em>JOGUE · EXPLORE · FAÇA AMIGOS</em></section>
    <section className="dock"><button onClick={chat}><span><I name="chat" size={25}/></span><strong>Chat</strong><kbd>T</kbd></button><button onClick={() => window.dispatchEvent(new Event('jarvis-open-emotes'))}><span><I name="smile" size={25}/></span><strong>Emotes</strong><kbd>Q</kbd></button><button onClick={() => open('guide')}><span><I name="map" size={25}/></span><strong>Guia</strong><kbd>G</kbd></button></section>
    <button className="chat" onClick={chat}><span><I name="chat" size={18}/></span><em>Digite uma mensagem...</em><b>›</b></button>
    <section className="move"><div><span><I name="run" size={30}/></span><strong>Correr</strong><kbd>SHIFT</kbd></div><div><span><I name="jump" size={30}/></span><strong>Pular</strong><kbd>ESPAÇO</kbd></div></section><Panel panel={panel} setPanel={setPanel} remote={remote} quality={quality} operation={operation} onQuality={onQuality} onTravel={onTravel}/>
  </nav>;
};

export default function JarvisPremiumHud() {
  const {state, setState} = useContext(AppContext);
  const identity = useContext(JarvisIdentityContext);
  const [panel, setPanel] = useState(null);
  const [remote, setRemote] = useState({panel: null, status: 'idle', data: null, error: ''});
  const [quality, setQuality] = useState(getSavedGraphicsQuality);
  const [operation, setOperation] = useState({status: 'idle', message: ''});
  const mobile = useMobileDevice();
  const chatOpen = state.openedPanel === 'ChatPanel';
  const chat = () => { setPanel(null); setState({openedPanel: chatOpen ? null : 'ChatPanel'}); };
  const open = async id => {
    if (id === 'social') return chat();
    const nextPanel = panel === id ? null : id;
    setPanel(nextPanel);
    setOperation({status: 'idle', message: ''});
    if (nextPanel !== 'daily' && nextPanel !== 'shop') return;
    setRemote({panel: nextPanel, status: 'loading', data: null, error: ''});
    try {
      const data = nextPanel === 'daily' ? await activityApi.daily() : await activityApi.shop();
      setRemote({panel: nextPanel, status: 'ready', data, error: ''});
    } catch (error) {
      setRemote({panel: nextPanel, status: 'error', data: null, error: error?.message || 'Serviço temporariamente indisponível.'});
    }
  };
  const travel = async location => {
    setOperation({status: 'loading', message: 'Preparando viagem rápida...'});
    try {
      const result = await teleportToLocation(location);
      setOperation({status: 'success', message: `Destino definido: ${result.name}.`});
      setPanel(null);
    } catch (error) {
      setOperation({status: 'error', message: error?.message || 'Não foi possível viajar agora.'});
    }
  };
  const changeQuality = async nextQuality => {
    setQuality(nextQuality);
    setOperation({status: 'loading', message: 'Aplicando qualidade gráfica...'});
    try {
      await setGraphicsQuality(nextQuality);
      const label = qualityOptions.find(([id]) => id === nextQuality)?.[1] || nextQuality;
      setOperation({status: 'success', message: `Qualidade ${label} aplicada e salva neste dispositivo.`});
    } catch (error) {
      setOperation({status: 'error', message: error?.message || 'Não foi possível aplicar a qualidade.'});
    }
  };
  useEffect(() => {
    void setGraphicsQuality(quality).catch(error => console.warn('[Jarvis World] saved graphics quality was not applied:', error));
  }, []);
  useEffect(() => {
    if (mobile) return undefined;
    const onKeyDown = event => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      const tag = event.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || event.target?.isContentEditable) return;
      if (event.key === 'Escape' && panel) {
        setPanel(null);
        return;
      }
      const id = {m: 'map', d: 'daily', l: 'shop', g: 'guide', p: 'social'}[event.key.toLowerCase()];
      if (id) void open(id);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobile, panel, chatOpen]);
  useEffect(() => {
    if (!mobile) return undefined;
    const release = () => {
      ioManager.keys.up = false; ioManager.keys.down = false; ioManager.keys.left = false;
      ioManager.keys.right = false; ioManager.keys.shift = false; ioManager.keys.space = false;
    };
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', release);
    return () => { release(); window.removeEventListener('blur', release); document.removeEventListener('visibilitychange', release); };
  }, [mobile]);
  const panelProps = {identity, chat, open, panel, setPanel, remote, quality, operation, onQuality: changeQuality, onTravel: travel};
  return mobile ? <MobileHud {...panelProps}/> : <DesktopHud {...panelProps}/>;
}
