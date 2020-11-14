//var fs = require("fs");
var path = require("path");
var progress = require("progress-stream");
var fs = require("fs");
const { promisify } = require("util");
const { resolve } = require("path");

const fsPromise = require("fs").promises;
function copyFile(source, target, skip = 0, cb) {
  var position = 0;
  return new Promise((resolve, reject) => {
    fs.stat(source, function (err, stat) {
      const filesize = stat.size;
      let bytesCopied = 0;

      const readStream = fs.createReadStream(source);

      readStream.on("data", function (buffer) {
        bytesCopied += buffer.length;
        let porcentage = ((bytesCopied / filesize) * 100).toFixed(2);
        console.log(porcentage + "%"); // run once with this and later with this line commented
      });
      readStream.on("end", function () {
        resolve();
      });
      readStream.pipe(fs.createWriteStream(target));
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readSafeFile(source, cb = () => {}, finishCb = () => {}) {
  return new Promise(async (resolve, reject) => {
    var position = 0;
    const STEP = 500;
    var data = "";
    var isReading = true;
    var hasError = false;
    var retries = 0;
    while (isReading) {
      if (retries == 0 || hasError) {
        hasError = false;
        retries++;
        readFile(
          source,
          position,
          STEP,
          (chunk, currentPosition) => {
            cb(chunk);
            position = currentPosition;
            //console.log('data ***** ',data);
          },
          (error) => {
            hasError = true;
          },
          async () => {
            isReading = false;
            //console.log('finish ***** ',data);
          }
        );
      }

      await sleep(1000);
    }
    finishCb();
  });
}

function readFile(
  source,
  position,
  step,
  readCallback = () => {},
  errorCallback = () => {},
  endCallback = () => {}
) {
  var position = 0;
  // Use fs.createReadStream() method
  // to read the file

  reader = fs.createReadStream(source, {
    start: position,
    highWaterMark: step,
  });
  // Read and disply the file data on console
  reader.on("data", function (chunk) {
    position += chunk.length;
    // console.log('data&&',chunk.length,chunk)
    readCallback(chunk, position);
  });
  reader.on("error", function (error) {
    if (error.code == "ENOENT") {
      console.log(source, "is missing - waiting...");
    } else {
      console.log("error", error);
    }
    errorCallback(error);
  });
  reader.on("end", async function () {
    await Promise.resolve(endCallback());
  });
}

function copyFile(source, target) {
  return new Promise(async (resolve, reject) => {
    var isFolderVerify = false;
    while (!isFolderVerify) {
      try {
        ensureDirectoryExistence(target);
        isFolderVerify = true;
      } catch (error) {
        console.log("error", error);
        await sleep(1000);
      }
    }

    var writeStream = fs.createWriteStream(target);
    console.log("start transfer source ", source, " to ", target);
    readSafeFile(
      source,
      (chunk) => {
        writeStream.write(chunk);
      },
      () => {
        writeStream.close();
        console.log("finish transfer source", source, " to ", target);
        resolve();
      }
    );
  });
}
function ensureDirectoryExistence(filePath) {
  var dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
}

async function copy(source, target) {
  var copyMap = [];
  if (await isDir(source)) {
    console.log("source is dir ", source);
    var list = await getFiles(source);
    for (var i = 0; i < list.length; i++) {
      var t = list[i].replace(source, target);
      copyMap.push({
        from: list[i],
        to: t,
      });
    }
    console.log("list", list);
    console.log("copyMap", copyMap);
    //return;
  } else {
    copyMap.push({
      from: source,
      to: target,
    });
    console.log("source is file ", source);
  }
  for (var i = 0; i < copyMap.length; i++) {
    await copyFile(copyMap[i].from, copyMap[i].to);
  }
}
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

async function getFiles(dir) {
  const dirents = await fsPromise.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    dirents.map((dirent) => {
      const res = resolve(dir, dirent.name);
      return dirent.isDirectory() ? getFiles(res) : res;
    })
  );
  return Array.prototype.concat(...files);
}

async function isDir(path) {
  try {
    const stats = await fsPromise.lstat(path);
    /*  console.log(`Is file: ${stats.isFile()}`);
    console.log(`Is directory: ${stats.isDirectory()}`);
    console.log(`Is symbolic link: ${stats.isSymbolicLink()}`);
    console.log(`Is FIFO: ${stats.isFIFO()}`);
    console.log(`Is socket: ${stats.isSocket()}`);
    console.log(`Is character device: ${stats.isCharacterDevice()}`);
    console.log(`Is block device: ${stats.isBlockDevice()}`); */
    return stats.isDirectory();
  } catch (error) {
    console.log("error", error);
    await sleep(1000);
    return isDir(path);
  }
}

var args = process.argv.slice(2);

if (args.length == 2) {
  var source = args[0];
  var target = args[1];

  copy(source, target);
} else {
  console.log("missing source and target params");
}
