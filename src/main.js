import plugin from "../plugin.json";
import {
  ReconnectingWebSocket,
  formatUrl,
  unFormatUrl,
  getFolderName,
  getCodeLens
} from "./utils.js";

import * as converters from "./ace-linters/src/type-converters/lsp-converters";
import {
  fromPoint,
  fromRange,
  toRange
} from "./ace-linters/src/type-converters/lsp-converters";
import { BaseService } from "./ace-linters/src/services/base-service";
import { LanguageClient } from "./ace-linters/src/services/language-client.ts";


/**
 * @typedef {object} EditorManager
 * @property {import("ace-code").Ace.Editor} editor
 */

/** @type {EditorManager} */
let { editor } = editorManager;

let defaultServices = {};
var Range = ace.require("ace/range").Range;
let commandId = "acodeLsExecuteCodeLens";

let symbolKindToClass = {
  1: "file",
  2: "module",
  3: "module",
  4: "module",
  5: "class",
  6: "method",
  7: "property",
  8: "field",
  9: "method",
  10: "enum",
  11: "interface",
  12: "function",
  13: "variable",
  14: "variable",
  20: "attribute",
  24: "event",
  25: "typeparameter"
};

class CustomService extends BaseService {
  constructor(...args) {
    super(...args);
    this.$handlers = {};
  }

  async doComplete(document, position) {
    let handlers = this.$handlers["completion"];
    let allCompletions = [];
    if (handlers) {
      for (let handler of handlers) {
        let completions = await handler.bind(this)(document, position);
        if (completions) {
          completions.map(item => allCompletions.push(item));
        }
      }
    }
    return allCompletions;
  }

  async doValidation(document) {
    let handlers = this.$handlers["validation"];
    let allValidations = [];
    if (handlers) {
      for (let handler of handlers) {
        let completions = await handler.bind(this)(document);
        if (completions) {
          completions.map(item => allValidations.push(item));
        }
      }
    }
    return allValidations;
  }

  async doHover(document) {
    let handlers = this.$handlers["hover"];
    if (handlers) {
      let allHovers = [];
      for (let handler of handlers) {
        let completions = await handler.bind(this)(document);
        if (completions) {
          completions.map(item => allHovers.push(item));
        }
      }
    }
    return allHovers;
  }

  async doCodeLens() {
    let handlers = this.$handlers["codeLens"];
    let allCodeLens = [];
    if (handlers) {
      for (let handler of handlers) {
        let completions = await handler.bind(this)();
        if (completions) {
          completions.map(item => {
            item.command && (iten.command.id = commandId);
            allCodeLens.push(item);
          });
        }
      }
    }
    return allCodeLens;
  }

  addHandler(target, handler) {
    (this.$handlers[target] ??= []).push(handler);
    return handler;
  }
}

/**
 * @param {string} mode
 * @returns {CustomService}
 */
function get(mode) {
  return (s[mode] ??= new CustomService(mode));
}

let defaultService = new CustomService("any");

export class AcodeLanguageServerPlugin {
  $rootUri;
  $folders;
  $progressNodes;
  $breadcrumbsTree;
  $breadcrumbsNodes;

  async init($page, justInstalled) {
    this.$page = $page;
    this.$logs = [];
    this.$sockets = {};
    this.$currentSymbols = null;
    this.$serverInfos = new Map();
    this.$progressNodes = new Map();

    document.head.appendChild(
      tag("link", {
        rel: "stylesheet",
        href: this.baseUrl + "style.css"
      })
    );

    let pty = window.acode?.require("pty");
    if (typeof pty !== "undefined") {
      let commandPath = await pty.host.getCommandPath("acode-ls", "acode-ls");
      if (justInstalled && !commandPath) {
        let installLoader = acode.require("loader").create(
          "Installing acode language server",
          `Running 'npm install -g acode-lsp'`
        );
        installLoader.show();

        try {
          await pty.host.run("npm", ["install", "-g", "acode-lsp"], {
            background: false,
            sessionAction: 0
          });
          installLoader.setMessage("Server sucessfully installed");
        } catch (error) {
          alert(
            "PtyError",
            "Server install failed. Try manually in termux."
          );
          console.error(error?.toString?.() || error);
        } finally {
          setTimeout(() => installLoader.destroy(), 2000);
        }
      }

      this.$conn = await pty.host.run({ command: "acode-ls" });
    }

    await this.setup();
  }

  async setup() {
    const { ServiceManager } = await import(
      "./ace-linters/src/services/service-manager.ts"
    );
    const { LanguageProvider } = await import(
      "./ace-linters/src/language-provider.ts"
    );

    this.$options = {
      functionality: {
        hover: this.settings.hover,
        format: this.settings.format,
        completion: {
          overwriteCompleters: false
        },
        completionResolve: this.settings.completionResolve
      }
    };

    let serviceTarget = new EventTarget();
    let providerTarget = new EventTarget();

    this.$manager = new ServiceManager({
      addEventListener: (...args) => providerTarget.addEventListener(...args),
      postMessage(message) {
        serviceTarget.dispatchEvent(
          new MessageEvent("message", { data: message })
        );
      },
      dispatchEvent: (event, data) =>
        providerTarget.dispatchEvent(
          new CustomEvent(event, {
            detail: data
          })
        )
    });

    this.$manager.registerService("html", {
      features: { signatureHelp: false },
      rootUri: () => this.#getRootUri(),
      className: "HtmlService",
      modes: "html",
      workspaceFolders: () => this.#getFolders(),
      module: () => import("./ace-linters/src/services/html/html-service.ts")
    });

    this.$manager.registerService("css", {
      features: { signatureHelp: false },
      module: () => import("./ace-linters/src/services/css/css-service.ts"),
      className: "CssService",
      modes: "css",
      rootUri: () => this.#getRootUri(),
      workspaceFolders: () => this.#getFolders()
    });

    this.$manager.registerService("less", {
      features: { signatureHelp: false },
      rootUri: () => this.#getRootUri(),
      className: "CssService",
      modes: "less",
      workspaceFolders: () => this.#getFolders(),
      module: () => import("./ace-linters/src/services/css/css-service.ts")
    });

    this.$manager.registerService("scss", {
      features: { signatureHelp: false },
      rootUri: () => this.#getRootUri(),
      className: "CssService",
      modes: "scss",
      workspaceFolders: () => this.#getFolders(),
      module: () => import("./ace-linters/src/services/css/css-service.ts")
    });

    this.$manager.registerService("json", {
      rootUri: () => this.#getRootUri(),
      className: "JsonService",
      modes: "json",
      workspaceFolders: () => this.#getFolders(),
      features: { signatureHelp: false, documentHighlight: false },
      module: () => import("./ace-linters/src/services/json/json-service.ts")
    });

    this.$manager.registerService("json5", {
      features: { signatureHelp: false, documentHighlight: false },
      module: () => import("./ace-linters/src/services/json/json-service.ts"),
      rootUri: () => this.#getRootUri(),
      className: "JsonService",
      modes: "json5",
      workspaceFolders: () => this.#getFolders()
    });

    this.$manager.registerService("yaml", {
      features: { signatureHelp: false, documentHighlight: false },
      module: () => import("./ace-linters/src/services/yaml/yaml-service.ts"),
      rootUri: () => this.#getRootUri(),
      className: "YamlService",
      modes: "yaml",
      workspaceFolders: () => this.#getFolders()
    });

    this.$manager.registerService("lua", {
      features: { signatureHelp: false, documentHighlight: false },
      module: () => import("./ace-linters/src/services/lua/lua-service.ts"),
      rootUri: () => this.#getRootUri(),
      className: "LuaService",
      modes: "lua",
      workspaceFolders: () => this.#getFolders()
    });

    this.$manager.registerService("php", {
      features: { signatureHelp: false, documentHighlight: false },
      module: () => import("./ace-linters/src/services/php/php-service.ts"),
      rootUri: () => this.#getRootUri(),
      className: "PhpService",
      modes: "php",
      workspaceFolders: () => this.#getFolders()
    });

    this.$client = LanguageProvider.create({
      addEventListener: (...args) => serviceTarget.addEventListener(...args),
      postMessage(message) {
        providerTarget.dispatchEvent(
          new MessageEvent("message", { data: message })
        );
      }
    });

    if (window.acode && this.settings.format) {
      acode.registerFormatter(
        "Acode Language Client",
        ["html", "css", "scss", "less", "lua", "xml", "yaml", "json", "json5"],
        () => this.$client.format()
      );
    }

    this.$client.setGlobalOptions("", {
      ...(this.settings.options?.global || {})
    });

    this.#setupSidebar();
    this.#setupCommands();
    if (this.settings.codelens) {
      this.#setupCodelens();
    }
    this.#setupAcodeEvents();
    this.#setupFooter();
    if (this.settings.breadcrumbs) {
      this.#setupBreadcrumbs();
    }

    this.$client.registerEditor(editor);

    if (this.settings.replaceCompleters) {
      this.$completers = editor.completers.splice(1, 2);
    }

    let wrap = (mode, callback) => {
      return async (...args) => {
        let activeMode = editor.session.$modeId.substring(9);
        if (mode.split("|").includes(activeMode)) {
          return await callback(...args);
        }
        return [];
      };
    };

    this.$exports = {
      BaseService,
      LanguageClient,
      LanguageProvider,
      ReconnectingWebSocket,

      utils: {
        converters
      },

      format: () => this.$client.format(),
      dispatchEvent: (name, data) =>
        providerTarget.dispatchEvent(new CustomEvent(name, { detail: data })),

      registerService: (mode, client, options) => {
        if (Array.isArray(mode)) {
          mode = mode.join("|");
        }

        if (client instanceof BaseService || client instanceof LanguageClient) {
          options = options || {};
          client.ctx = this.$manager.ctx;

          client.serviceData.modes = mode;
          client.serviceData.options = options;
          client.serviceData.rootUri = () => this.#getRootUri();
          client.serviceData.workspaceFolders = () => this.#getFolders();

          // console.log("Registering service for: " + mode);

          this.$manager.registerService(options.alias || mode.split("|")[0], {
            options: options,
            serviceInstance: client,
            rootUri: () => this.#getRootUri(),
            workspaceFolders: () => this.#getFolders(),
            modes: mode,
            features: (client.serviceData.features =
              this.setDefaultFeaturesState(client.serviceData.features || {}))
          });

          if (client instanceof LanguageClient) {
            client.enqueueIfNotConnected(() => {
              client.connection.onNotification(
                "$/typescriptVersion",
                params => {
                  let serverInfo = {
                    name: "typescript",
                    version: params.version
                  };
                  this.$serverInfos.set(mode, serverInfo);
                  this.#setServerInfo(serverInfo);
                }
              );
            });
          }

          this.$client.setGlobalOptions(mode, options);
        } else {
          throw new Error("Invalid client.");
        }
      },
      registerEditor: editor => {
        this.$client.registerEditor(editor);
      },

      getSocket: url => {
        if (url.startsWith("server") || url.startsWith("auto")) {
          return new ReconnectingWebSocket(
            this.settings.url + url,
            null,
            false,
            true,
            this.settings.reconnectDelay,
            this.settings.closeTimeout
          );
        }
        throw new Error(
          "Invalid url. Use ReconnectingWebSocket directly instead."
        );
      },

      getSocketForCommand: (command, args = []) => {
        let url =
          "auto/" +
          encodeURIComponent(command) +
          "?args=" +
          JSON.stringify(args);
        return new ReconnectingWebSocket(
          this.settings.url + url,
          null,
          false,
          true,
          this.settings.reconnectDelay,
          this.settings.closeTimeout
        );
      },

      provideHover(mode, callback) {
        return defaultService.addHandler("hover", wrap(mode, callback));
      },
      provideCodeLens(mode, callback) {
        return defaultService.addHandler("codeLens", wrap(mode, callback));
      },
      provideCompletion(mode, callback) {
        return defaultService.addHandler("completion", wrap(mode, callback));
      },
      provideCodeAction(mode, callback) {
        return defaultService.addHandler("codeAction", wrap(mode, callback));
      },
      provideValidation(mode, callback) {
        return defaultService.addHandler("validation", wrap(mode, callback));
      }
    };

    window.acode?.define("acode-language-client", this.$exports);

    providerTarget.addEventListener("initialized", ({ detail }) => {
      // console.log("Initialized:", detail);
      let mode =
        detail.lsp.serviceData.options?.alias ||
        detail.lsp.serviceData.modes.split("|")[0];

      if (!detail.params.serverInfo) return;

      this.$serverInfos.set(mode, detail.params.serverInfo);
      this.#setServerInfo(detail.params.serverInfo);
    });

    editorManager.on("switch-file", async () => {
      let mode = editorManager.editor.session.$modeId.substring(9);
      let serverInfo = this.$serverInfos.get(mode);
      if (!serverInfo) {
        for (let [key, value] of this.$serverInfos) {
          if (key.split("|").includes(mode)) {
            serverInfo = value;
            break;
          }
        }
      }

      if (serverInfo) {
        this.#setServerInfo(serverInfo);
      } else {
        let node = this.$footer.querySelector(".server-info");
        node.style.display = "none";
      }
    });

    let titles = new Map();
    providerTarget.addEventListener("progress", ({ detail }) => {
      let progress = this.#getProgress(detail.token);
      if (progress) {
        if (detail.value.kind === "begin") {
          titles.set(detail.token, detail.title);
        } else if (detail.value.kind === "report") {
          progress.show();
        } else if (detail.value.kind === "end") {
          titles.delete(detail.token);
          return progress.remove();
        }

        progress.setTitle(titles.get(detail.token));

        if (detail.value.message) {
          let percentage = detail.value.percentage;
          progress.setMessage(
            detail.value.message +
            (percentage ? " <br/>(" + String(percentage) + "%)" : "")
          );
        }
      }
    });

    // providerTarget.addEventListener("create/progress", ({ detail }) => {});
    // providerTarget.addEventListener("initialized", ({ detail }) => {})
  }

  #getProgress(token) {
    let node = this.$footer.querySelector("div#token-" /*+ token*/);
    if (!node) {
      node = this.$footer.appendChild(
        tag("div", {
          id: "token-" /* + token*/,
          children: [
            tag("span", {
              className: "title",
              textContent: ""
            })
          ]
        })
      );
    }

    return {
      show: () => {
        node.style.display = "block";
      },
      remove: () => {
        node.style.display = "none";
      },
      setTitle: title => {
        if (!title) return;
        node.querySelector("span.title").innerHTML = title;
      },
      setMessage: message => {
        if (!message) return;
        node.querySelector("span.title").innerHTML = message;
      }
    };
  }

  #setServerInfo({ name, version }) {
    let node = this.$footer.querySelector(".server-info");
    switch (name) {
      case "gopls":
        version = JSON.parse(version).GoVersion;
        break

    }
    node.innerHTML = `${name} (${version})`;
    node.style.display = "block";
  }

  setDefaultFeaturesState(serviceFeatures) {
    let features = serviceFeatures ?? {};
    features.hover ??= true;
    features.completion ??= true;
    features.completionResolve ??= true;
    features.format ??= true;
    features.diagnostics ??= true;
    features.signatureHelp ??= true;
    features.documentHighlight ??= true;
    return features;
  }

  log(message, type = "debug") {
    if (!this.$logger) {
      this.$logger = window.acode?.require("acode.sdk")?.getLogger(plugin.id);
      if (this.$logger) {
        this.$logs.map(i => this.$logger.info(i));
      }
    }
    if (this.$logger) {
      this.$logger.log(type, message);
    } else {
      this.$logs.push(message);
    }
  }

  destroy() { }

  async #openFile(uri, range) {
    let url = acode.require("url");
    let helpers = acode.require("helpers");
    let file = acode.require("editorfile");
    let filename = url.basename(uri);

    uri = unFormatUrl(uri);

    let activeFile = editorManager.getFile(uri, "uri");

    if (!activeFile) {
      activeFile = new file(filename, { uri });
      let promise = new Promise(cb => activeFile.on("loadend", cb));
      await promise;
    }

    activeFile.makeActive();
    if (range) {
      let cursor = toRange(range);
      activeFile.session.selection.moveCursorTo(
        cursor.start.row,
        cursor.start.column
      );
      editorManager.editor.focus();
    }
    return activeFile;
  }

  #applyEdits(fileEdits, session) {
    for (let edit of fileEdits.reverse()) {
      session.replace(toRange(edit.range), edit.newText);
    }
  }

  #getRootUri() {
    if (editorManager.activeFile?.uri) {
      let openfolder = acode.require("openfolder");
      let folder = openfolder.find(editorManager.activeFile.uri);
      if (folder?.url) {
        return "file://" + formatUrl(folder.url, false);
      }
    }

    // if (this.$rootUri) return this.$rootUri;

    let folders = this.#getFolders();

    if (folders?.length) {
      return folders[0].url;
    } else {
      // For testing in browser on pc
      return "C:/Users/HP/Desktop_Files/files/programming/javascript/acode plugins/acode-language-client";
    }
    return null;
  }

  get workspaceFolders() {
    return this.#getFolders();
  }

  #getFolders() {
    const folders = JSON.parse(localStorage.folders || "[]");
    if (!window.acode && !folders.length) {
      return null;
    }

    this.$folders = folders.map(item => ({
      name: item.opts.name,
      uri: "file://" + formatUrl(item.url, false),
      url: "file://" + formatUrl(item.url, false)
    }));
    return this.$folders;
  }

  #getServices(session) {
    return this.$manager.findServicesByMode(
      (session || editor.session).$modeId.substring(9)
    );
  }

  #filterService(validate, services) {
    services = services || this.#getServices();
    return services.filter(service => {
      let instance = service.serviceInstance;
      if (!instance) return false;

      let capabilities = instance.serviceCapabilities;
      if (validate(capabilities)) {
        return true;
      }
      return false;
    });
  }

  #setupBreadcrumbs() {
    this.$breadcrumbsNode = tag("ul", {
      className: "breadcrumbs ace_autocomplete"
    });
    let mainElement = document.querySelector("#root ul.open-file-list");
    if (!mainElement) {
      mainElement = document.body;
    }
    mainElement.after(this.$breadcrumbsNode);

    document.addEventListener("click", ({ target }) => {
      if (
        !target.matches(
          ".breadcrumbs, .breadcrumb-dropdown, .breadcrumb-item *, " +
          ".breadcrumb-name, .dropdown-item, .dropdown-name *"
        )
      ) {
        if (this.$mainNode?.classList.contains("visible")) {
          this.$mainNode?.classList.remove("visible");
        }
      } else {
        this.$mainNode?.classList.add("visible");
      }
    });

    editor.on("focus", () => {
      if (this.$mainNode?.classList.contains("visible")) {
        this.$mainNode?.classList.remove("visible");
      }
      if (this.$currentRange !== undefined) {
        editor.session.removeMarker(this.$currentRange);
      }
    });
  }

  #setupAcodeEvents() {
    if (!window.acode) return;

    editorManager.on("remove-file", file => {
      if (!file.session) return;
      let services = this.#getServices(file.session);
      try {
        services.map(service => {
          service.serviceInstance?.removeDocument({
            uri: this.$client.$getFileName(file.session)
          });
        });
      } catch (e) {
        console.error(e);
      }
    });

    editorManager.on("rename-file", file => {
      let services = this.#getServices(file.session);
      try {
        services.map(service => {
          service.serviceInstance?.removeDocument({
            uri: this.$client.$getFileName(file.session)
          });
        });
      } catch (e) {
        console.error(e);
      }

      this.$client.$registerSession(file.session, editorManager.editor);
    });

    editorManager.on("remove-folder", folder => {
      let allServices = Object.values(this.$manager.$services);
      let services = this.#filterService(capabilities => {
        return capabilities.workspace?.workspaceFolders?.changeNotifications;
      }, allServices);
      try {
        services.map(service => {
          service.serviceInstance.connection.sendRequest(
            "workspace/didChangeWorkspaceFolders",
            {
              event: {
                added: [],
                removed: [
                  {
                    name: folder.opts?.name,
                    uri: "file://" + formatUrl(folder.url, false),
                    url: "file://" + formatUrl(folder.url, false)
                  }
                ]
              }
            }
          );
        });
      } catch (e) {
        console.error(e);
      }
    });

    editorManager.on("add-folder", folder => {
      let allServices = Object.values(this.$manager.$services);
      let services = this.#filterService(capabilities => {
        return capabilities.workspace?.workspaceFolders?.changeNotifications;
      }, allServices);
      try {
        services.map(service => {
          service.serviceInstance.connection.sendRequest(
            "workspace/didChangeWorkspaceFolders",
            {
              event: {
                removed: [],
                added: [
                  {
                    name: folder.opts?.name,
                    uri: "file://" + formatUrl(folder.url, false),
                    url: "file://" + formatUrl(folder.url, false)
                  }
                ]
              }
            }
          );
        });
      } catch (e) {
        console.error(e);
      }
    });

    if (this.settings.breadcrumbs) {
      let timeout;
      this.$func = async () => {
        if (timeout) {
          clearTimeout(timeout);
        }
        timeout = setTimeout(async () => {
          await this.$buildBreadcrumbs();
          timeout = null;
        }, 2000);
      };

      editor.on("change", this.$func);
      editorManager.on("switch-file", async () =>
        setTimeout(
          this.$buildBreadcrumbs.bind(this),
          this.settings.breadcrumbTimeout
        )
      );
      this.$func();
    }
  }

  #setupCodelens() {
    return new Promise((resolve, reject) => {
      getCodeLens(codeLens => {
        if (!codeLens) return reject("CodeLens not available.");

        editor.commands.addCommand({
          name: commandId,
          exec: (editor, args) => {
            console.log("Executing:", args);
            let item = args[0];
            if (item.exec) {
              item.exec();
            }
          }
        });

        editor.commands.addCommand({
          name: "acodeLsClearCodeLenses",
          exec: (editor, args) => {
            codeLens.clear(editor.session);
          }
        });
        editor.setOption("enableCodeLens", true);

        codeLens.registerCodeLensProvider(editor, {
          provideCodeLenses: async (session, callback) => {
            let services = this.#filterService(
              capabilities => capabilities.codeLensProvider
            ).map(service => service.serviceInstance);
            let uri = this.$client.$getFileName(editor.session);
            let result = [...(await defaultService.doCodeLens())];

            let promises = services.map(async service => {
              if (service.connection) {
                let response = await service.connection.sendRequest(
                  "textDocument/codeLens",
                  { textDocument: { uri } }
                );
                // console.log("CodeLens:", response);
                if (!response) return;
                for (let item of response) {
                  if (!item.command && !item.data) continue;

                  result.push({
                    ...toRange(item.range),
                    command: {
                      id: commandId,
                      title:
                        item.command?.tooltip ||
                        item.command?.title ||
                        (item.data || [])[2] ||
                        "Unknown Action",
                      arguments: [item]
                    }
                  });
                }
              } else {
                let response = await service.doCodeLens?.({ uri });
                if (response) {
                  response.map(i => result.push(i));
                }
              }
            });
            await Promise.all(promises);

            callback(null, result);
          }
        });
        resolve(codeLens);
      });
    });
  }

  #setupFooter() {
    let footer = document.querySelector("#root footer");

    this.$footer = footer.appendChild(
      tag("div", {
        className: "button-container",
        style: {
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-around",
          alignItems: "center"
        },
        children: [
          tag("span", {
            className: "server-info"
          })
        ]
      })
    );
  }

  #setupSidebar() {
    this.$node = tag("div", { className: "refBody" });
    this.$page?.body.appendChild(this.$node);
  }

  #showReferences(references) {
    let helpers = acode.require("helpers");
    this.$page?.settitle("References");
    this.$node.innerHTML = "";

    for (let ref of references) {
      let node = this.$node.appendChild(
        tag("div", {
          className: "refChild",
          children: [
            tag("span", {
              className: "icon " + helpers.getIconForFile(ref.uri)
            }),
            tag("h5", {
              className: "refTitle",
              textContent:
                ref.uri + `(${ref.range.start.line}:${ref.range.end.line})`,
              onclick: () => this.#openFile(ref.uri, ref.range)
            })
          ]
        })
      );
    }

    this.$page?.show();
  }

  #setupCommands() {
    let commands = [
      {
        name: "Go To Declaration",
        exec: () => this.#goToDeclaration()
      },
      {
        name: "Go To Definition",
        exec: () => this.#goToDefinition()
      },
      {
        name: "Go To Type Definition",
        exec: () => this.#goToDefinition(true)
      },
      {
        name: "Go To Implementations",
        exec: () => this.#findImplementations()
      },
      {
        name: "Show References",
        exec: () => this.#findReferences()
      },
      {
        name: "Show Code Actions",
        exec: () => this.#codeActions()
      },
      {
        name: "Rename Symbol",
        exec: () => this.#renameSymbol()
      },
      {
        name: "Format Code",
        exec: () => this.$client.format()
      }
    ];

    let selection = window.acode?.require("selectionMenu");
    selection?.add(
      async () => {
        let action = await acode.select(
          "Select Action",
          commands.map((command, index) => [index, command.name])
        );
        if (action) {
          return commands[action]?.exec();
        }
      },
      tag("span", {
        className: "icon edit"
      }),
      "all",
      false
    );

    editor.commands.addCommands(commands);
  }

  #goToDefinition(type = false) {
    let services = this.#filterService(capabilities => {
      if (type) return capabilities.typeDefinitionProvider;
      return capabilities.definitionProvider;
    }).map(service => service.serviceInstance);
    let cursor = editor.getCursorPosition();
    let position = fromPoint(cursor);

    services.map(service => {
      if (service.connection) {
        service.connection
          .sendRequest(
            "textDocument/" + (type ? "typeDefinition" : "definition"),
            {
              textDocument: {
                uri: this.$client.$getFileName(editor.session)
              },
              position
            }
          )
          .then(response => {
            console.log("Definition:", response);
            if (response) {
              if (!Array.isArray(response)) {
                response = [response];
              }

              response.map(item => {
                this.#openFile(item.uri, item.range);
              });
            }
          });
      }
    });
  }

  #goToDeclaration() {
    let services = this.#filterService(
      capabilities => capabilities.declarationProvider
    ).map(service => service.serviceInstance);
    let cursor = editor.getCursorPosition();
    let position = fromPoint(cursor);

    services.map(async service => {
      if (service.connection) {
        service.connection
          .sendRequest("textDocument/declaration", {
            textDocument: {
              uri: this.$client.$getFileName(editor.session)
            },
            position
          })
          .then(response => {
            console.log("Declaration:", response);
            if (!Array.isArray(response)) {
              response = [response];
            }

            response.map(item => {
              this.#openFile(item.uri, item.range);
            });
          });
      } else {
        let response = await service.findCodeLens?.({ uri });
        if (response) {
          response.map(item => {
            this.#openFile(item.uri, item.range);
          });
        }
      }
    });
  }

  #findReferences() {
    let services = this.#filterService(
      capabilities => capabilities.referencesProvider
    ).map(service => service.serviceInstance);
    let cursor = editor.getCursorPosition();
    let position = fromPoint(cursor);

    services.map(async service => {
      if (service.connection) {
        service.connection
          .sendRequest("textDocument/references", {
            textDocument: {
              uri: this.$client.$getFileName(editor.session)
            },
            position,
            context: { includeDeclaration: true }
          })
          .then(response => {
            console.log("References:", response);
            if (!Array.isArray(response)) {
              response = [response];
            }
            this.#showReferences(response);

            // response.map((item) => {
            // this.#openFile(item.uri, item.range);
            // });
          });
      } else {
        let response = await service.findReferences?.({ uri }, position);
        if (response) {
          this.#showReferences(response);
        }
      }
    });
  }

  #findImplementations() {
    let services = this.#filterService(
      capabilities => capabilities.implementationProvider
    ).map(service => service.serviceInstance);
    let cursor = editor.getCursorPosition();
    let position = fromPoint(cursor);

    services.map(async service => {
      if (service.connection) {
        service.connection
          .sendRequest("textDocument/implementation", {
            textDocument: {
              uri: this.$client.$getFileName(editor.session)
            },
            position
          })
          .then(response => {
            console.log("Implementation:", response);
            if (!Array.isArray(response)) {
              response = [response];
            }

            response.map(item => {
              this.#openFile(item.uri, item.range);
            });
          });
      } else if (service.findImplememtations) {
        let response = await service.findImplememtations({ uri }, position);
        if (response) {
          response.map(i => result.push(i));
        }
      }
    });
  }

  #codeActions() {
    let services = this.#filterService(
      capabilities => capabilities.codeActionProvider
    ).map(service => service.serviceInstance);
    let cursor = editor.getCursorPosition();
    let position = fromPoint(cursor);
    let range = fromRange(editor.selection.getRange());

    services.map(service => {
      if (service.connection) {
        service.connection
          .sendRequest("textDocument/codeAction", {
            textDocument: {
              uri: this.$client.$getFileName(editor.session)
            },
            range,
            context: {
              diagnostics: []
            },
            triggerKind: 2
          })
          .then(async actions => {
            console.log("Actions:", actions);
            if (!window.acode) return;

            if (actions?.length) {
              let action = await acode.select(
                "Code Action",
                actions.map((action, index) => [index, action.title])
              );
              if (action) {
                service.connection
                  .sendRequest("codeAction/resolve", actions[action])
                  .then(resolved => {
                    console.log("Resolved:", resolved);
                  });
              }
            }
          });
      }
    });
  }

  async #renameSymbol() {
    let services = this.#filterService(
      capabilities => capabilities.renameProvider
    ).map(service => service.serviceInstance);

    let cursor = editor.getCursorPosition();
    let position = fromPoint(cursor);

    let currentName = editor.getSelectedText();
    let newName = await (window.acode?.prompt || prompt)(
      "New name",
      currentName
    );

    services.map(service => {
      if (service.connection) {
        service.connection
          .sendRequest("textDocument/rename", {
            textDocument: {
              uri: this.$client.$getFileName(editor.session)
            },
            newName,
            position
          })
          .then(async response => {
            console.log("Rename:", response);
            let changes = response.changes || response.documentChanges;
            if (Array.isArray(changes)) {
              for (let change of changes) {
                let efile = await this.#openFile(change.textDocument.uri);
                this.#applyEdits(changes.edits, efile.session);
              }
            } else {
              for (let file in changes) {
                // console.log(file, changes[file])
                let efile = await this.#openFile(file);
                this.#applyEdits(changes[file], efile.session);
              }
            }
          });
      }
    });
  }

  async getDocumentSymbols() {
    let services = this.#filterService(
      capabilities => capabilities.documentSymbolProvider
    );

    if (!services.length) return [];

    try {
      if (services[0].serviceInstance instanceof LanguageClient) {
        return await services[0].serviceInstance.connection.sendRequest(
          "textDocument/documentSymbol",
          {
            textDocument: {
              uri: this.$client.$getFileName(editor.session)
            }
          }
        );
      } else {
        return services[0].serviceInstance.findDocumentSymbols({
          uri: this.$client.$getFileName(editor.session)
        });
      }
    } catch (e) {
      console.error(e);
    }
  }

  async $buildBreadcrumbs() {
    let symbols = await this.getDocumentSymbols();

    if (!symbols?.length) {
      this.$breadcrumbsNode.style.display = "none";
    } else if (symbols !== this.$currentSymbols) {
      this.$currentSymbols = symbols;

      function createTreeObject(objects) {
        // Helper function to find the immediate parent object by name
        function findImmediateParent(name) {
          return objects.find(object => object.name === name);
        }

        // Build the tree recursively
        function buildNode(object) {
          const node = {
            ...object,
            children: []
          };

          const children = objects.filter(
            child => findImmediateParent(child.containerName) === object
          );
          children.forEach(child => node.children.push(buildNode(child)));

          return node;
        }

        // Find the root nodes (objects with no parent)
        let url = acode.require("url");
        let filename = url.basename(editorManager.activeFile.uri);

        const rootNodes = objects.filter(object => {
          if (!object.containerName) {
            return true;
          } else {
            // Java jdtls root node has the containerName set to the filename.
            return object.containerName === filename;
          }
        });

        // Build the tree object and return it
        return rootNodes.map(node => buildNode(node));
      }

      let tree =
        typeof symbols[0]?.children !== "undefined"
          ? symbols
          : createTreeObject(symbols);
      this.$breadcrumbsTree = tree;
      this.$breadcrumbsNode.style.display = "flex";
      this.$buildBreadcrumbsUi(tree);
      return true;
    }
    return false;
  }

  $buildBreadcrumbsUi(tree) {
    let breadcrumbNodes = [];
    let currentIndex = breadcrumbNodes.length ? breadcrumbNodes.length - 1 : 0;

    let buildBreadcrumbNodes = () => {
      this.$breadcrumbsNode.innerHTML = "";
      for (let object of breadcrumbNodes) {
        let node = tag("span", {
          className: "breadcrumb-name",
          children: [
            tag("i", {
              className:
                "ace_completion-icon ace_" +
                (symbolKindToClass[object.kind] || "value")
            }),
            tag("span", {
              textContent: object.name
            }),
            tag("span", { className: "breadcrumb-sep" })
          ]
        });
        node = this.$breadcrumbsNode.appendChild(
          tag("li", {
            className: "breadcrumb-item",
            children: [node]
          })
        );
      }
    };

    let createNode = (object, level = 0) => {
      let dropdown,
        node = tag("span", {
          className: "dropdown-name",
          children: [
            tag("span", { className: "dropdown-toggle" }),
            tag("i", {
              className:
                "ace_completion-icon ace_" +
                (symbolKindToClass[object.kind] || "value")
            }),
            tag("span", {
              textContent: object.name
            })
          ]
        });

      if (object.children?.length) {
        dropdown = tag("ul", {
          className: "dropdown",
          children: object.children.map(child => {
            let [childNode, childDropdown] = createNode(child, level + 1);
            let item = tag("li", {
              className: "dropdown-item",
              children: [
                tag("div", {
                  children: childDropdown
                    ? [childNode, childDropdown]
                    : [childNode]
                })
              ]
            });
            if (!childDropdown) {
              item.classList.add("childless");
            }
            return item;
          })
        });
        node.appendChild(dropdown);
      }

      node.onclick = ({ target }) => {
        if (target === node || target.parentElement === node) {
          if (object.children.length && dropdown) {
            dropdown.classList.toggle("visible");
          }
          breadcrumbNodes[level - 1] = object;
          breadcrumbNodes.splice(level);
          buildBreadcrumbNodes();

          if (!object.location) return;

          let start = object.location.range.start;
          let end = object.location.range.end;

          editor.scrollToLine(start.line - 10);
          editorManager.editor.session.selection.moveCursorTo(
            start.line,
            start.character
          );

          if (this.$currentRange !== undefined) {
            editor.session.removeMarker(this.$currentRange);
          }

          this.$currentRange = editor.session.addMarker(
            new Range(start.line, 0, end.line, 0),
            "ace_selected-word",
            "fullLine"
          );
        }
      };
      return [node, dropdown];
    };

    this.$mainNode?.remove();

    if (tree.length >= 1) {
      if (tree.length === 1) {
        breadcrumbNodes[currentIndex] = tree[0];
      } else {
        breadcrumbNodes[currentIndex] = {
          ...tree[0],
          children: tree
        };
      }
      this.$mainNode = tag("div", {
        children: [createNode(breadcrumbNodes[currentIndex], currentIndex)[1]]
      });
    }
    this.$mainNode?.classList.add("breadcrumb-dropdown");
    this.$mainNode?.classList.add("ace_autocomplete");
    buildBreadcrumbNodes();

    return this.$mainNode ? document.body.appendChild(this.$mainNode) : null;
  }

  getDefaultValue(settingValue, defaultValue = true) {
    if (typeof settingValue === "undefined") {
      return defaultValue;
    }
    return settingValue;
  }

  get settings() {
    if (!window.acode) {
      return this.defaultSettings;
    }

    const AppSettings = acode.require("settings");
    let value = AppSettings.value[plugin.id];
    if (!value) {
      value = AppSettings.value[plugin.id] = this.defaultSettings;
      AppSettings.update();
    }
    return value;
  }

  get defaultSettings() {
    return {
      hover: true,
      format: true,
      completion: true,
      // linter: LINTERS[0],
      completionResolve: true,
      replaceCompleters: true,
      codelens: true,
      breadcrumbs: true,
      reconnectDelay: 1,
      closeTimeout: 60 * 3,
      breadcrumbTimeout: 1000,
      url: "ws://localhost:3030/"
    };
  }

  get settingsObj() {
    const AppSettings = acode.require("settings");
    return {
      list: [
        {
          key: "closeTimeout",
          text: "Disconnect server timeout",
          info: "Disconnect language server after how many seconds?",
          value: this.getDefaultValue(this.settings.closeTimeout, 60 * 3),
          prompt: "Disconnect Server Timeout",
          promptType: "number"
        },
        {
          key: "reconnectDelay",
          text: "Server reconnect delay",
          info: "Try to reconnect to the language server after how many seconds?",
          value: this.getDefaultValue(this.settings.reconnectDelay, 1),
          prompt: "Server Reconnect Delay",
          promptType: "number"
        },
        {
          key: "breadcrumbTimeout",
          text: "Update breadcrumb timeout",
          info: "Update breadcrumb navigation after how many seconds?",
          value: this.getDefaultValue(this.settings.breadcrumbTimeout, 1000),
          prompt: "Update Breadcrumb Timeout",
          promptType: "number"
        },
        {
          key: "url",
          text: "Server Url",
          value: this.getDefaultValue(this.settings.url),
          prompt: "Server URL",
          promptType: "text"
        },
        {
          key: "hover",
          text: "Show Tooltip",
          checkbox: this.getDefaultValue(this.settings.hover),
          info: "Show Tooltip on hover or selection"
        },
        {
          key: "breadcrumbs",
          text: "Breadcrumb Navigation",
          checkbox: this.getDefaultValue(this.settings.breadcrumbs),
          info: "Enable breadcrumb navigation.."
        },
        {
          key: "codelens",
          text: "Code Lens",
          checkbox: this.getDefaultValue(this.settings.codelens),
          info: "Enable codelens."
        },
        {
          key: "completion",
          text: "Code Completion",
          checkbox: this.getDefaultValue(this.settings.completion),
          info: "Enable code completion."
        },
        {
          key: "completionResolve",
          text: "Doc Tooltip",
          checkbox: this.getDefaultValue(this.settings.completionResolve),
          info: "Enable code completion resolve."
        },
        {
          key: "replaceCompleters",
          text: "Replace Completers",
          checkbox: this.getDefaultValue(this.settings.replaceCompleters),
          info: "Disable the default code completers."
        }
      ],
      cb: (key, value) => {
        switch (key) {
          case "url":
            if (!value.endsWith("/")) {
              value = value + "/";
            }
            break;
          case "replaceCompleters":
            if (value) {
              this.$completers = editor.completers.splice(1, 2);
            } else {
              if (this.$completers) {
                editor.completers = [...this.$completers, ...editor.completers];
              }
            }
            break;
          default:
            acode.alert(
              "Acode Language Server",
              "Settings updated. Restart acode app."
            );
        }
        AppSettings.value[plugin.id][key] = value;
        AppSettings.update();
      }
    };
  }
}

if (window.acode) {
  const lsp = new AcodeLanguageServerPlugin();
  window.lsp = lsp;

  acode.setPluginInit(
    plugin.id,
    async (baseUrl, $page, { cacheFileUrl, cacheFile }) => {
      if (!baseUrl.endsWith("/")) {
        baseUrl += "/";
      }
      lsp.baseUrl = baseUrl;
      try {
        await lsp.init($page, cacheFile, cacheFileUrl);
        window.dispatchEvent(
          new CustomEvent("plugin.install", {
            detail: { name: "acode-language-client" }
          })
        );
      } catch (e) {
        window.err = e;
        console.log(e);
      }
    },
    lsp.settingsObj
  );

  acode.setPluginUnmount(plugin.id, () => {
    lsp.destroy();
  });
} else {
  window.AcodeLanguageServerPlugin = AcodeLanguageServerPlugin;
}
