export class ReconnectingWebSocket extends EventTarget {
  onopen;
  onclose;
  onerror;
  onmessage;

  constructor(
    url,
    protocols,
    autoConnect = false,
    autoReconnect = true,
    delay = 1000,
    autoClose = 300000
  ) {
    super();

    this.url = url;
    this.protocols = protocols;
    this.autoReconnect = autoReconnect;
    this.autoClose = autoClose;
    this.delay = delay; // Reconnect delay in milliseconds
    this.connection = null;
    this.eventListeners = {};
    this.sendQueue = new Array();

    this.$closeTimeout = null;
    this.$retries = 0;
    this.$maxRetries = 20;

    autoConnect && this.connect();
  }

  get readyState() {
    if (this.connection) {
      return this.connection.readyState;
    }
    return WebSocket.CLOSED;
  }

  connect(retry = true) {
    this.autoReconnect = true;
    if (this.readyState !== WebSocket.CLOSED) return;
    try {
      this.$retries += 1;
      this.connection = new WebSocket(this.url, this.protocols);

      this.connection.onopen = event => {
        this.dispatchEvent(new Event("open"));
        this.onopen?.(event);

        if (this.sendQueue.length) {
          let newQueue = [...this.sendQueue];
          this.sendQueue = [];
          newQueue.map(data => this.send(data));
        }
        this.$retries = 0;
      };

      this.connection.onmessage = event => {
        this.dispatchEvent(
          new MessageEvent("message", {
            data: event.data
          })
        );
        this.onmessage?.(event);
      };

      this.connection.onclose = event => {
        if (this.autoReconnect && this.$retries < this.$maxRetries) {
          setTimeout(() => this.connect(), this.delay);
        } else {
          this.dispatchEvent(
            new CloseEvent("close", {
              reason: event.reason,
              code: event.code,
              wasClean: event.wasClean
            })
          );
          this.onclose?.(event);
        }
      };

      this.connection.onerror = error => {
        this.dispatchEvent(new ErrorEvent("error"));
        this.onerror?.(error);
      };

      if (autoClose && autoClose > 0) {
        this.$closeTimeout = setTimeout(() => this.close(), this.autoClose);
      }
    } catch {
      if (retry && this.autoReconnect) {
        setTimeout(() => this.connect(), this.delay);
      }
    }
  }

  reconnect() {
    if (this.connection && this.connection.readyState !== WebSocket.CLOSED) {
      this.connection.close();
    }
    this.connect();
  }

  send(data) {
    // console.log("[Sending]", data, this.connection?.readyState);
    if (this.connection) {
      if (this.connection.readyState === WebSocket.OPEN) {
        this.connection.send(data);
      } else {
        this.sendQueue.push(data);
        console.warn("WebSocket not open. Unable to send data.");
      }
    } else {
      this.sendQueue.push(data);
      this.connect();
    }

    if (this.$closeTimeout) {
      clearTimeout(this.$closeTimeout);
      this.$closeTimeout = setTimeout(() => this.close(), this.autoClose);
    }
  }

  close() {
    this.autoReconnect = false;
    if (this.connection) {
      this.connection.close();

      let event = new CloseEvent("close", {
        reason: "Server disconnected.",
        code: 1000,
        wasClean: true
      });
      this.dispatchEvent(event);
      this.onclose?.(event);
    }
  }
}

export function formatUrl(path, formatTermux = false) {
  if (path.startsWith("content://com.termux.documents/tree")) {
    path = path.split("::")[1];
    if (formatTermux) {
      path = path.replace(/^\/data\/data\/com\.termux\/files\/home/, "$HOME");
    }
    return path;
  } else if (path.startsWith("file:///storage/emulated/0/")) {
    let sdcardPath =
      "/sdcard" +
      path
        .substr("file:///storage/emulated/0".length)
        .replace(/\.[^/.]+$/, "")
        .split("/")
        .join("/") +
      "/";
    return sdcardPath;
  } else if (
    path.startsWith(
      "content://com.android.externalstorage.documents/tree/primary"
    )
  ) {
    path = path.split("::primary:")[1];
    let androidPath = "/sdcard/" + path;
    return androidPath;
  } else {
    return;
  }
}

/*export function unFormatUrl(fileUrl) {
  if (fileUrl.startsWith("file://")) {
    let filePath = fileUrl.slice(7);
    
    filePath = filePath.replace("/storage/emulated/0", '/sdcard');
    filePath = filePath.replace('/sdcard', '').slice(1);

    const pathSegments = filePath.split("/");

    // Extract the first folder and encode it
    const firstFolder = encodeURIComponent(pathSegments[0]);

    // Combine the content URI
    const contentUri = `content://com.android.externalstorage.documents/tree/primary%3A${firstFolder}::primary:${filePath}`;
    return contentUri;
  } else {
    return fileUrl;
  }
}*/

export function unFormatUrl(fileUrl) {
  if (!(fileUrl.startsWith("file:///") || fileUrl.startsWith("/"))) {
    return fileUrl;
  }

  // Remove the "file:///" and "/" prefix
  let path = fileUrl.replace(/^file:\/\//, "").slice(1);
  path = path.replace("storage/emulated/0", "sdcard");

  if (
    path.startsWith("$HOME") ||
    path.startsWith("data/data/com.termux/files/home")
  ) {
    let termuxPrefix =
      "content://com.termux.documents/tree/%2Fdata%2Fdata%2Fcom.termux%2Ffiles%2Fhome::/data/data/com.termux/files/home";

    // Remove $HOME or termux default home path and merge the rest
    let termuxPath = path.startsWith("$HOME")
      ? path.substr("$HOME".length)
      : path.substr("data/data/com.termux/files/home".length);
    return termuxPrefix + termuxPath;
  } else if (path.startsWith("sdcard")) {
    let sdcardPrefix =
      "content://com.android.externalstorage.documents/tree/primary%3A";
    let relPath = path.substr("sdcard/".length);

    let sourcesList = JSON.parse(localStorage.storageList || "[]");
    for (let source of sourcesList) {
      if (source.uri.startsWith(sdcardPrefix)) {
        let raw = decodeURIComponent(source.uri.substr(sdcardPrefix.length));
        if (relPath.startsWith(raw)) {
          return source.uri + "::primary:" + relPath;
        }
      }
    }

    // Extract the folder name after sdcard
    let folderName = relPath.split("/")[0];
    // Add the folder name and merge the rest
    let sdcardPath =
      sdcardPrefix + folderName + "::primary:" + path.substr("sdcard/".length);
    return sdcardPath;
  } else {
    return fileUrl;
  }
}
export function getFolderName(sessionId) {
  if (window.acode) {
    let file =
      window.editorManager.files.find(
        file => file.session["id"] == sessionId
      ) || window.editorManager.activeFile;
    if (file?.uri) {
      let formatted = formatUrl(file.uri);
      if (formatted) return formatted;
    }
  }
  return undefined;
}

export function getExtension(fileName) {
  let url = acode.require("url");
  return url.extname(fileName);
}

function addHeaders(data) {
  data = data.trim();
  let length = data.length;
  // console.log(data, data.length)
  return (
    "Content-Length: " +
    String(length) +
    "\r\n" +
    "Content-Type: application/vscode-jsonrpc; charset=utf-8\r\n\r\n" +
    data
  );
}

function stripHeaders(data) {
  return data.toString().split("\r\n\r\n")[1];
}

async function runAcodeTerminal(command, onmessage) {
  let terminal = acode.require("acode.terminal");
  // console.log("0:", acode.require("acode.terminal"));
  if (!terminal) {
    let promise = new Promise((resolve, reject) => {
      // setTimeout(reject, 5000);
      window.addEventListener("plugin.install", ({ detail }) => {
        if (detail.name === "acode.terminal") {
          // console.log("1:", acode.require("acode.terminal"));
          resolve(acode.require("acode.terminal"));
        }
      });
    });
    terminal = await promise;
  }
  return terminal.run(command, onmessage);
}

export function commandAsWorker(command) {
  let backend,
    wrapper,
    chunks = [];

  let createBackend = async () => {
    backend = await runAcodeTerminal(command, message => {
      if (!message) return;
      console.log("[Received]", message);
      wrapper.onmessage?.(
        new MessageEvent("message", {
          data: stripHeaders(message)
        })
      );
    });
  };

  wrapper = {
    addEventListener() {},
    async postMessage(message) {
      console.log("[Sending]", message);
      if (!backend) {
        await createBackend();
      }
      return backend.send(addHeaders(JSON.stringify(message)));
    }
  };
  return wrapper;
}

export function showToast(message) {
  (window.acode?.require("toast") || console.log)(message);
}
