// Pair a send-only memory source. No Agent Server or model credentials are used.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import dns from "node:dns";
import https from "node:https";
import http from "node:http";
import { execFileSync, spawn } from "node:child_process";
import { publishSkills, updateSkillInstructions, writePeerIndex } from './skills.mjs';
const flags = Object.fromEntries(
  process.argv.slice(2).reduce((a, v, i, xs) => {
    if (v.startsWith("--")) a.push([v.slice(2), xs[i + 1]]);
    return a;
  }, []),
);
const privateIP = (value) =>
  /^100\.(\d+)\.\d+\.\d+$/.test(value) &&
  +value.split(".")[1] >= 64 &&
  +value.split(".")[1] < 128;
const origin = new URL(flags.gateway || "");
if (
  origin.protocol !== "https:" ||
  origin.username ||
  origin.password ||
  origin.pathname !== "/" ||
  origin.search ||
  origin.hash
)
  throw Error("Use a private HTTPS gateway origin");
const ident = flags.id || "desktop";
if (!/^[a-z][a-z0-9-]{0,31}$/.test(ident))
  throw Error("Invalid memory source ID");
const base = path.resolve(
  flags["codex-home"] ||
    process.env.CODEX_HOME ||
    path.join(os.homedir(), ".codex"),
);
const source = path.join(base, "memories_v2");
if (
  !fs.lstatSync(source).isDirectory() ||
  fs.lstatSync(source).isSymbolicLink()
)
  throw Error("Expected an existing native memories_v2 directory");
const state = path.resolve(
  flags.state ||
    path.join(os.homedir(), ".local/share/agent-node-memory-device"),
);
fs.mkdirSync(state, { recursive: true, mode: 0o700 });
const metadataPath = path.join(state, 'device.json');
const savedSettings = fs.existsSync(metadataPath) ? JSON.parse(fs.readFileSync(metadataPath, 'utf8')) : {};
const skillsRoot = flags['skills-root'] || savedSettings.skills_root;
const peerSkills = flags['peer-skills'] || savedSettings.peer_skills || (skillsRoot ? path.join(path.dirname(skillsRoot), 'peer_skills') : null);
const instructionPeerSkills = flags['peer-skills-instructions'] || savedSettings.peer_skills_instructions || (peerSkills?.replace(/^\\\\wsl(?:\.localhost|\$)\\[^\\]+\\/i, '/').replaceAll('\\', '/'));
if (savedSettings.skills_root && skillsRoot !== savedSettings.skills_root) throw Error('Skill source already configured; explicit migration required');
if (skillsRoot && (!path.isAbsolute(skillsRoot) || !path.isAbsolute(peerSkills) || !fs.statSync(skillsRoot).isDirectory())) throw Error('Expected existing Skill source and absolute peer path');
const binary = flags.syncthing || "syncthing";
const ts = flags.tailscale || "tailscale";
const ip = execFileSync(ts, ["ip", "-4"], {
  encoding: "utf8",
  windowsHide: true,
})
  .trim()
  .split(/\r?\n/)
  .find(privateIP);
if (!ip) throw Error("Join the gateway owner’s Tailscale network first");
const stHome = path.join(state, "syncthing");
const xmlFile = path.join(stHome, "config.xml");
const help = execFileSync(binary, ["--help"], {
  encoding: "utf8",
  windowsHide: true,
});
const modern = /^\s+serve\s/m.test(help);
if (!fs.existsSync(xmlFile)) {
  const command = /^\s+generate\s/m.test(help)
    ? ["generate", "--home=" + stHome, "--no-default-folder"]
    : ["--generate=" + stHome];
  execFileSync(binary, command, {
    stdio: "ignore",
    windowsHide: true,
    env: { ...process.env, STNODEFAULTFOLDER: "1" },
  });
}
const savedDevice = path.join(state, "device.json");
if (fs.existsSync(savedDevice)) {
  const saved = JSON.parse(fs.readFileSync(savedDevice, "utf8"));
  if (
    saved.id !== ident ||
    saved.source !== source ||
    saved.gateway !== origin.origin
  )
    throw Error(
      "Dedicated device already belongs to another source or gateway",
    );
}
let xml = fs.readFileSync(xmlFile, "utf8");
const apiKey = xml.match(/<apikey>([^<]+)<\/apikey>/)?.[1];
const gui = "127.0.0.1:18485";
const api = (endpoint, method = "GET", value) =>
  new Promise((resolve, reject) => {
    const req = http.request(
      "http://" + gui + "/rest/" + endpoint,
      {
        method,
        agent: false, // Exporting WSL files can outlive the REST server's idle timeout.
        headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
        timeout: 15000,
      },
      (r) => {
        let text = "";
        r.on("data", (x) => (text += x));
        r.on("end", () => {
          if (r.statusCode >= 300)
            return reject(Error("Syncthing HTTP " + r.statusCode));
          try {
            resolve(text ? JSON.parse(text) : null);
          } catch (e) {
            reject(e);
          }
        });
      },
    );
    req.on("timeout", () => req.destroy(Error("Syncthing request timed out")));
    req.on("error", error => reject(Error('Syncthing '+endpoint+': '+(error.code || 'connection failed'))));
    req.end(value ? JSON.stringify(value) : undefined);
  });
let running = false;
try {
  await api("system/status");
  running = true;
} catch {}
if (running) {
  // A different Syncthing instance must never receive this configuration.
  const status = await api("system/status");
  if (
    !xml.includes('id="' + status.myID + '"') ||
    !xml.includes("<address>" + gui + "</address>")
  )
    throw Error("Dedicated administration port belongs to another instance");
} else {
  if (flags.refresh) throw Error('Syncthing is not running; waiting for its existing startup task');
  xml = xml.replace(
    /(<gui\b[^>]*>)([\s\S]*?)(<\/gui>)/,
    (_, start, body, end) =>
      start +
      body.replace(
        /<address>[^<]*<\/address>/,
        "<address>" + gui + "</address>",
      ) +
      end,
  );
  xml = xml.replace(/<options>([\s\S]*?)<\/options>/, (_, body) => {
    for (const name of [
      "globalAnnounceEnabled",
      "localAnnounceEnabled",
      "relaysEnabled",
      "natEnabled",
      "startBrowser",
      "crashReportingEnabled",
    ])
      body = body.replace(
        new RegExp("<" + name + ">[^<]*</" + name + ">", "g"),
        "<" + name + ">false</" + name + ">",
      );
    body = body.replace(/<listenAddress>[^<]*<\/listenAddress>/g, "");
    return (
      "<options>" +
      body +
      "<listenAddress>tcp://" +
      ip +
      ":22001</listenAddress></options>"
    );
  });
  const manifestPath = path.join(state, "device.json");
  const saved = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
    : null;
  const ownConfiguration =
    saved?.id === ident &&
    saved?.source === source &&
    saved?.gateway === origin.origin;
  if (
    /<folder\b/.test(xml.replace(/<defaults>[\s\S]*?<\/defaults>/g, "")) &&
    !ownConfiguration
  )
    throw Error("Unconfigured dedicated identity already has shared folders");
  fs.writeFileSync(xmlFile, xml, { mode: 0o600 });
  const log = fs.openSync(path.join(state, "syncthing.log"), "a");
  const child = spawn(
    binary,
    [
      ...(modern ? ["serve"] : []),
      "--home=" + stHome,
      "--no-browser",
      "--no-restart",
    ],
    {
      detached: true,
      windowsHide: true,
      stdio: ["ignore", log, log],
      env: { ...process.env, STNOUPGRADE: "1", STNODEFAULTFOLDER: "1" },
    },
  );
  child.unref();
  fs.closeSync(log);
  for (let i = 0; i < 30; i++) {
    try {
      await api("system/status");
      running = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  if (!running)
    throw Error("Dedicated Syncthing did not start; inspect the local log");
}
const gateway = (method = "GET", value, csrf, endpoint = '/gateway/api/backends') =>
  new Promise((resolve, reject) => {
    const headers = { "Content-Type": "application/json" };
    if (csrf)
      Object.assign(headers, { Origin: origin.origin, "X-Gateway-CSRF": csrf });
    const req = https.request(
      new URL(endpoint, origin),
      {
        method,
        agent: false,
        headers,
        timeout: 30000,
        autoSelectFamily: false,
        lookup: (host, opts, callback) =>
          dns.lookup(host, { family: 4 }, (error, address, family) => {
            if (error) return callback(error);
            if (!privateIP(address))
              return callback(
                Error("Gateway must resolve to a Tailnet address"),
              );
            callback(null, address, family);
          }),
      },
      (r) => {
        let text = "";
        r.on("data", (x) => {
          text += x;
          if (text.length > 1000000)
            req.destroy(Error("Gateway response too large"));
        });
        r.on("end", () => {
          if (r.statusCode !== 200)
            return reject(Error("Gateway HTTP " + r.statusCode));
          try {
            resolve(JSON.parse(text));
          } catch (e) {
            reject(e);
          }
        });
      },
    );
    req.on("timeout", () => req.destroy(Error("Gateway request timed out")));
    req.on("error", error => reject(Error('Gateway '+endpoint+': '+(error.code || 'connection failed'))));
    req.end(value ? JSON.stringify(value) : undefined);
  });
const catalog = await gateway();
const hub = catalog.memory_hub;
if (!hub?.device_id || !/^tcp:\/\/100\.[0-9.]+:22001$/.test(hub.address))
  throw Error("Gateway memory service is unavailable");
const self = await api("system/status");
const reply = await gateway(
  "POST",
  {
    action: "memory-device-add",
    id: ident,
    name: flags.name || savedSettings.name || os.hostname(),
    device_id: self.myID,
    address: "tcp://" + ip + ":22001",
    ...(skillsRoot ? {skills: true} : {}),
    ...(flags['migrate-from'] ? {migrate_from:flags['migrate-from']} : {}),
  },
  catalog.csrf,
);
if (!reply.ok)
  throw Error(reply.message || "Gateway did not enroll the source");
const config = await api("config");
const device = await api("config/defaults/device");
Object.assign(device, {
  deviceID: hub.device_id,
  name: "memory-gateway",
  addresses: [hub.address],
  introducer: false,
  autoAcceptFolders: false,
});
config.devices = [
  ...config.devices.filter((d) => d.deviceID === self.myID),
  device,
];
const folder = await api("config/defaults/folder");
Object.assign(folder, {
  id: "codex-memory-" + ident,
  label: "Codex memory: " + ident,
  path: source,
  type: "sendonly",
  devices: [{ deviceID: self.myID }, { deviceID: hub.device_id }],
  rescanIntervalS: 60,
  fsWatcherEnabled: true,
  fsWatcherDelayS: 2,
  ignorePerms: true,
  paused: false,
});
const ignore = path.join(source, ".stignore");
const patterns = [
  ".git",
  ".codex-baseline",
  ".stversions",
  "*.sqlite*",
  "*.db",
  "*.lock",
  "auth.json",
  "config.toml",
  ".DS_Store",
  "*.sync-conflict-*",
];
if (fs.existsSync(ignore) && fs.lstatSync(ignore).isSymbolicLink())
  throw Error("Refusing a symlinked ignore file");
const previous = fs.existsSync(ignore)
  ? fs.readFileSync(ignore, "utf8").split(/\r?\n/)
  : [];
const ignoreText =
  [...new Set([...patterns, ...previous])].filter(Boolean).join("\n") + "\n";
if (!fs.existsSync(ignore)) fs.writeFileSync(ignore, ignoreText);
else if (fs.readFileSync(ignore, "utf8") !== ignoreText) {
  // Syncthing hides this file on Windows. Opening an existing hidden file
  // with the truncating 'w' flag fails there; retain its attributes with r+.
  const descriptor = fs.openSync(ignore, "r+");
  try {
    const bytes = Buffer.from(ignoreText);
    fs.writeSync(descriptor, bytes, 0, bytes.length, 0);
    fs.ftruncateSync(descriptor, bytes.length);
  } finally {
    fs.closeSync(descriptor);
  }
}
config.folders = [folder];
if (skillsRoot) {
  const topology = await gateway('GET', undefined, undefined, '/gateway/api/skills/topology');
  const own = topology.nodes.find(n => n.id === ident && n.device_id === self.myID);
  const exportRoot = path.join(state, 'skills-export');
  publishSkills({agents:skillsRoot}, exportRoot);
  const authorized = own?.receive_skills ? topology.nodes.filter(n => n.skills && n.id !== ident) : [];
  for (const node of [{id:ident}, ...authorized]) {
    if (!/^[a-z][a-z0-9-]{0,31}$/.test(node.id)) throw Error('Invalid Skill source ID');
    const sourceOwner = node.id === ident;
    const root = sourceOwner ? exportRoot : path.join(peerSkills, node.id);
    if (fs.existsSync(root) && fs.lstatSync(root).isSymbolicLink()) throw Error('Refusing symlinked peer Skill directory');
    fs.mkdirSync(root, {recursive:true});
    const item = await api('config/defaults/folder');
    Object.assign(item, {id:'codex-skills-'+node.id,label:'Peer skills: '+node.id,path:root,
      type:sourceOwner?'sendonly':'receiveonly',devices:[{deviceID:self.myID},{deviceID:hub.device_id}],
      rescanIntervalS:60,fsWatcherEnabled:!root.startsWith('\\\\'),fsWatcherDelayS:2,ignorePerms:true,paused:false,order:'smallestFirst'});
    if (!sourceOwner) item.versioning={type:'simple',params:{keep:'3'},cleanupIntervalS:3600};
    config.folders.push(item);
  }
  updateSkillInstructions(base, peerSkills, instructionPeerSkills);
  writePeerIndex(peerSkills, authorized, ident);
}
Object.assign(config.options, {
  globalAnnounceEnabled: false,
  localAnnounceEnabled: false,
  relaysEnabled: false,
  natEnabled: false,
  startBrowser: false,
  urAccepted: -1,
  autoUpgradeIntervalH: 0,
});
await api("config", "PUT", config);
fs.writeFileSync(
  path.join(state, "device.json"),
  JSON.stringify(
    {
      gateway: origin.origin,
      id: ident,
      name: flags.name || savedSettings.name || os.hostname(),
      source,
      state,
      syncthing: binary,
      device_id: self.myID,
      address: "tcp://" + ip + ":22001",
      ...(skillsRoot ? {skills_root:skillsRoot,peer_skills:peerSkills,peer_skills_instructions:instructionPeerSkills} : {}),
    },
    null,
    2,
  ),
  { mode: 0o600 },
);
console.log(
  JSON.stringify({
    id: ident,
    source,
    device_id: self.myID,
    address: "tcp://" + ip + ":22001",
    pending: !reply.memory_devices.find((n) => n.id === ident)?.enabled,
  }),
);
