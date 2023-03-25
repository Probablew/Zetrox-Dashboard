// My modules
const ftpd = require("./my_modules/ftpd_new");
const updater = require("./my_modules/updater");
const statsCollector = require("./my_modules/statistics");
const config = require("./my_modules/config");
const translator = require("./my_modules/translator");
const zetrox = require("./my_modules/zetrox");
const additional = require("./my_modules/additional");
const serverController = require("./my_modules/servers");
const auth_manager = require("./my_modules/auth_manager");

// Express initialization
const express = require('express');
const app = express();
const port = 3000;
const updatesInterval = 3600000; // 5 hours
const fileUpload = require('express-fileupload');
const cookieParser = require("cookie-parser");

// Routers
var auth_router = require("./routers/auth");
var server_router = require("./routers/server");
var zetrox_router = require("./routers/zetrox");
var plugins_router = require("./routers/plugins");
var cores_router = require("./routers/cores");
var tasks_router = require("./routers/tasks");
var downloader_router = require("./routers/downloader");
var upload_router = require("./routers/upload");
var fmapi_router = require("./routers/fmapi");
var forgeInstaller_router = require("./routers/forgeInstaller");
var backups_router = require("./routers/backups");

// Other modules init
var mime = require('mime');
const path = require('path');
const fs = require('fs');
var colors = require('colors');

// Rate limiter init
const rateLimit = require('express-rate-limit');
const authLimiter = rateLimit({
  windowMs: 5000,
  max: 1,
  standardHeaders: true,
  legacyHeaders: false,
})
const authLimiter2 = rateLimit({
  windowMs: 1000,
  max: 1,
  standardHeaders: true,
  legacyHeaders: false,
})
const authLimiter3 = rateLimit({
  windowMs: 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
})

// Config loading
global.cfg = config.readConfig();

// Socket.io initialization
var socket_options;
if (cfg['internet-access'] == true) {
  origin = "*";
} else {
  origin = "http://localhost:3000";
}
socket_options = {
  cors: {
    origin: origin
  }
};

global.io = require("socket.io")(3001, socket_options);

io.on("connection", (socket) => {
  socket.emit("handshake", socket.id);
  socket.on("update", (arg) => {
    switch (arg.type) {
      case "usage":
        zetrox.getUsage(function (usage) {
          socket.emit("handleUpdate", {
            type: "usage",
            data: usage
          });
        });
        break;
      case "servers":
        socket.emit("handleUpdate", {
          type: "servers",
          data: serverController.getStatuses()
        });
        break;
      case "query":
        serverController.queryServer(arg.server, function (data) {
          socket.emit("handleUpdate", {
            type: "query",
            data: data
          });
        });
        break;
      case "console":
        serverController.queryServer(arg.server, function (data) {
          socket.emit("handleUpdate", {
            type: "console",
            data: {
              server: arg.server,
              data: servers_logs[arg.server]
            }
          });
        });
        break;
    }
  });
  socket.on("startFileWrite", (arg) => { // Start file upload after edit (FM)
    currentFileWritings[arg.randCode] = "./servers/" + arg.path;
    currentFileWritingsText[arg.randCode] = "";
  });
  socket.on("addFileWrite", (arg) => { // Add fragment to file upload (FM)
    if (typeof currentFileWritingsText[arg.randCode] !== "undefined") {
      if (currentFileWritingsText[arg.randCode] == "") {
        currentFileWritingsText[arg.randCode] = arg.add;
      } else {
        currentFileWritingsText[arg.randCode] = currentFileWritingsText[arg.randCode] + "\n" + arg.add;
      }

    }
  });
  socket.on("finishFileWrite", (arg) => { // Finish write to file (FM)
    if (typeof currentFileWritingsText[arg.randCode] !== "undefined") {
      fs.writeFileSync(currentFileWritings[arg.randCode], currentFileWritingsText[arg.randCode]);
      delete currentFileWritings[arg.randCode];
      delete currentFileWritingsText[arg.randCode];
    }
  });
});

// Custom vars initialization
global.pendingTasks = {};
global.serDeletes = {};
global.servers_logs = [];
global.servers_instances = [];
global.updatesByIntArray = {};
global.forgesIns = [];
global.currentFileWritings = [];
global.currentFileWritingsText = [];
global.ftpserver;

// Zetrox version
global.zetrox_version = "v1.0.4";

app.use(fileUpload());
app.use(cookieParser());
app.use('/auth/login', authLimiter);
app.use('/upload', authLimiter2);
app.use('/zetrox/saveConfig', authLimiter2);
app.use('/downloader/download', authLimiter3);

app.use('/plugins/delete', authLimiter3);
app.use('/plugins/deleteMod', authLimiter3);

global.configjson = config.readServersJSON();
for (var i in configjson) {
  configjson[i]['status'] = 'stopped';
}
if (fs.existsSync("./servers/servers.json")) {
  fs.writeFileSync("./servers/servers.json", JSON.stringify(configjson));
}

if (typeof (configjson) !== "undefined") {
  for (t in configjson) {
    servers_logs[t] = "";
    servers_instances[t] = "";
  }
}

statsCollector.collectStats(cfg, zetrox_version, function (stats) {
  statsCollector.sendStats(stats);
});

console.log(" ");
console.log(colors.magenta(additional.zetroxLogo));
console.log(" ");
kl_oneline = additional.zetroxLogo.split("\n")[0];
kv = zetrox_version;
textpad = (kl_oneline.length / 2) - (kv.length / 2);
for (i = 0; i < textpad; i++) {
  kv = " " + kv;
}

console.log(colors.inverse('https://github.com/Seeroy/kubek-minecraft-dashboard'));
console.log(kv);
console.log(" ");

updater.checkForUpdates(function (upd, body) {
  if (upd != 0 && zetrox_version != upd) {
    console.log(additional.getTimeFormatted(), colors.yellow(translator.translateHTML("{{consolemsg-yesupd}}", cfg['lang'])));
    console.log(additional.getTimeFormatted(), colors.yellow("https://github.com/Seeroy/kubek-minecraft-dashboard/releases/tag/" + upd));

    assets = body[0].assets;
    downloaded = false;
    assets.forEach(function (asset) {
      platform = process.platform.replace(/32/gm, "");
      if (asset.name.match(platform) != null) {
        url = asset.browser_download_url;
        if (fs.existsSync(url.split("/").pop())) {
          downloaded = true;
        }
      }
    });

    updatesByIntArray = {
      found: true,
      url: "https://github.com/Seeroy/kubek-minecraft-dashboard/releases/tag/" + upd,
      downloaded: downloaded
    };
  } else {
    console.log(additional.getTimeFormatted(), colors.green(translator.translateHTML("{{consolemsg-noupd}}", cfg['lang'])));
    updatesByIntArray = {
      found: false
    };
  }

  app.use(function (req, res, next) {
    var authsucc = false;
    cfg = config.readConfig();
    if (req["_parsedUrl"].pathname == "/login.html") {
      authsucc = true;
    } else {
      authsucc = auth_manager.authorize(req.cookies["kbk__hash"], req.cookies["kbk__login"]);
    }
    if (authsucc == true || path.extname(req["_parsedUrl"].pathname).match(/.*\.(jpg|jpeg|png|js|css|html|eot|ttf|woff|woff2|eot)/gmi) != null) {
      if (req["_parsedUrl"].pathname == "/") {
        req["_parsedUrl"].pathname = "/index.html";
      }
      if (fs.existsSync(path.join(__dirname, "./www/" + req["_parsedUrl"].pathname)) && path.extname(req["_parsedUrl"].pathname) != "") {
        file = fs.readFileSync(path.join(__dirname, "./www/" + req["_parsedUrl"].pathname));
        cfg = config.readConfig();
        res.set('content-type', mime.getType(path.join(__dirname, "./www/" + req["_parsedUrl"].pathname)));
        if (path.extname(req["_parsedUrl"].pathname) != ".js" && path.extname(req["_parsedUrl"].pathname) != ".png" && path.extname(req["_parsedUrl"].pathname) != ".css") {
          additional.showRequestInLogs(req, res);
        }
        ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        ip = ip.replace("::ffff:", "").replace("::1", "127.0.0.1");
        if (cfg['internet-access'] == false && ip != "127.0.0.1") {
          res.send("Cannot be accessed from the internet");
        } else {
          res.send(translator.translateHTML(file, cfg.lang));
        }
      }
    } else {
      res.redirect("/login.html");
    }
    next();
  });
  app.listen(port, () => {
    console.log(additional.getTimeFormatted(), "Webserver", translator.translateHTML("{{consolemsg-usingport}}", cfg['lang']), port);
  });
  console.log(additional.getTimeFormatted(), "Socket.io", translator.translateHTML("{{consolemsg-usingport}}", cfg['lang']), 3001);
  if (cfg.ftpd == true) {
    var options = {
      host: '127.0.0.1',
      port: 21,
      tls: null
    }
    ftpserver = ftpd.startFTPD(options, cfg['ftpd-user'], cfg['ftpd-password']);
  }
  console.log(additional.getTimeFormatted(), translator.translateHTML("{{consolemsg-viewurl-start}}", cfg['lang']), 'http://localhost:' + port);
});

updater.setCheckingForUpdatesByInterval(updatesInterval);
app.use("/auth", auth_router);
app.use("/server", server_router);
app.use("/zetrox", zetrox_router);
app.use("/plugins", plugins_router);
app.use("/tasks", tasks_router);
app.use("/downloader", downloader_router);
app.use("/cores", cores_router);
app.use("/fmapi", fmapi_router);
app.use("/upload", upload_router);
app.use("/forgeInstaller", forgeInstaller_router);
app.use("/backups", backups_router);