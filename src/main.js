import plugin from "../plugin.json";
import {
  ReconnectingWebSocket,
  formatUrl,
  unFormatUrl,
  getFolderName
} from "./utils.js";

import * as converters from "./ace-linters/src/type-converters/lsp-converters";
import {
  fromPoint,
  fromRange,
  toRange
} from "./ace-linters/src/type-converters/lsp-converters";
import { BaseService } from "./ace-linters/src/services/base-service";
import { LanguageClient } from "./ace-linters/src/services/language-client.ts";

import { SymbolKind } from "vscode-languageserver-types";

// import "./style.css"

/**
 * @typedef {object} EditorManager
 * @property {import("ace-code").Ace.Editor} editor
 */

/** @type {EditorManager} */
let { editor } = editorManager;
// const LINTERS = ["pylint", "pyflakes", "mypy"];

let defaultServices = {};
var Range = ace.require("ace/range").Range;

class CustomService extends BaseService {
  constructor(...args) {
    super(...args);
    this.$handlers = {};
  }

  async doComplete(document, position) {
    let handlers = this.$handlers["completion"];
    if (handlers) {
      let allCompletions = [];
      for (let handler of handlers) {
        let completions = await handler.bind(this)(document, position);
        if (completions) {
          completions.map(item => allCompletions.push(item));
        }
      }
    }
    return null;
  }

  async doValidation(document) {
    let handlers = this.$handlers["validation"];
    if (handlers) {
      let allValidations = [];
      for (let handler of handlers) {
        let completions = await handler.bind(this)(document);
        if (completions) {
          completions.map(item => allValidations.push(item));
        }
      }
    }
    return null;
  }

  async doHover(document) {
    let handlers = this.$handlers["hover"];
    if (handlers) {
      let allValidations = [];
      for (let handler of handlers) {
        let completions = await handler.bind(this)(document);
        if (completions) {
          completions.map(item => allValidations.push(item));
        }
      }
    }
    return null;
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
function getDefaultService(mode) {
  return (defaultServices[mode] ??= new CustomService(mode));
}

export class AcodeLanguageServerPlugin {
  $rootUri;
  $folders;

  async init($page) {
    this.$page = $page;
    this.$logs = [];
    this.$sockets = {};
    this.$currentSymbols = null;

    document.head.appendChild(
      tag("link", {
        rel: "stylesheet",
        href: this.baseUrl + "style.css"
      })
    );

    if (window.system?.execute) {
      system
        .execute("acode-ls", {
          background: true
        })
        .then(console.log)
        .catch(console.error);
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
      }
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
      works6paceFolders: () => this.#getFolders()
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

    // this.$manager.registerService("javascript", {
    //   features: { signatureHelp: false, documentHighlight: false },
    //   module: () =>
    //     import("./ace-linters/src/services/javascript/javascript-service.ts"),
    //   rootUri: () => this.#getRootUri(),
    //   className: "JavascriptService",
    //   modes: "javascript",
    //   workspaceFolders: () => this.#getFolders()
    // });

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

    // this.$manager.registerServer("python", {
    //   modes: "python",
    //   type: "socket",
    //   rootUri: () => this.#getRootUri(),
    //   workspaceFolders: () => this.#getFolders(),
    //   module: () => import("./ace-linters/src/services/language-client.ts"),
    //   socket: new ReconnectingWebSocket(this.settings.url + "server/python")
    //   // socket: new ReconnectingWebSocket("ws://localhost:3031"),
    // });

    // this.$manager.registerServer("cpp", {
    //   modes: "c_cpp",
    //   type: "socket",
    //   rootUri: () => this.#getRootUri(),
    //   workspaceFolders: () => this.#getFolders(),
    //   module: () => import("./ace-linters/src/services/language-client.ts"),
    //   socket: new ReconnectingWebSocket(this.settings.url + "server/cpp")
    // });

    // this.$manager.registerServer("vue", {
    //   modes: "html",
    //   type: "socket",
    //   rootUri: () => this.#getRootUri(),
    //   workspaceFolders: () => this.#getFolders(),
    //   initializationOptions: { cleanPendingValidation: true },
    //   module: () => import("./ace-linters/src/services/language-client.ts"),
    //   socket: new ReconnectingWebSocket(this.settings.url + "server/vue")
    // });

    // this.$manager.registerServer("java", {
    //   modes: "java",
    //   type: "socket",
    //   rootUri: () => this.#getRootUri(),
    //   workspaceFolders: () => this.#getFolders(),
    //   module: () => import("./ace-linters/src/services/language-client.ts"),
    //   socket: new ReconnectingWebSocket(this.settings.url + "server/java")
    // });

    // this.$manager.registerServer("typescript", {
    //   type: "socket",
    //   modes: "typescript|javascript|tsx|jsx",
    //   rootUri: () => this.#getRootUri(),
    //   workspaceFolders: () => this.#getFolders(),
    //   module: () => import("./ace-linters/src/services/language-client.ts"),
    //   initializationOptions: { cancellationPipeName: "typescript" },
    //   socket: new ReconnectingWebSocket(this.settings.url + "server/typescript")
    // });

    // this.$manager.registerServer("rust", {
    //   type: "socket",
    //   modes: "rust",
    //   rootUri: () => this.#getRootUri(),
    //   workspaceFolders: () => this.#getFolders(),
    //   module: () => import("./ace-linters/src/services/language-client.ts"),
    //   initializationOptions: { cancellationPipeName: "rust" },
    //   socket: new ReconnectingWebSocket(
    //     this.settings.url + "auto/rust-analyzer"
    //   )
    // });

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
        "Acode Language Servers",
        [
          "html",
          "css",
          "scss",
          "less",
          "js",
          "ts",
          "jsx",
          "tsx",
          "lua",
          "xml",
          "yaml",
          "json",
          "json5",
          "py"
        ],
        () => {
          this.$client.format();
        }
      );
    }

    // this.$client.setGlobalOptions("typescript", {
    //   parserOptions: { sourceType: "module" },
    //   errorCodesToIgnore: [
    //     "2304",
    //     "2732",
    //     "2554",
    //     "2339",
    //     "2580",
    //     "2307",
    //     "2540"
    //   ],
    //   ...(this.settings.options?.typescript || {})
    // });

    this.$client.setGlobalOptions("", {
      ...(this.settings.options?.global || {})
    });

    this.#setupSidebar();
    this.#setupCommands();
    this.#setupAcodeEvents();
    // this.#setupFooter();
    this.#setupBreadcrumbs();

    this.$client.registerEditor(editor);

    if (this.settings.replaceCompleters) {
      this.$completers = editor.completers.splice(1, 2);
    }

    this.$exports = {
      BaseService,
      LanguageClient,
      LanguageProvider,
      ReconnectingWebSocket,

      utils: {
        converters
      },

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
              client.connection.onNotification("language/details", params => {
                console.log(params);
              });
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
          return new ReconnectingWebSocket(this.settings.url + url);
        }
        throw new Error(
          "Invalid url. Use ReconnectingWebSocket directly instead."
        );
      },

      provideHover(mode, callback) {
        let service = getDefaultService(mode);
        return service.addHandler("hover", callback);
      },
      provideCodeLens(mode, callback) {
        let service = getDefaultService(mode);
        return service.addHandler("codeLens", callback);
      },
      provideCompletion(mode, callback) {
        let service = getDefaultService(mode);
        return service.addHandler("completion", callback);
      },
      provideCodeAction(mode, callback) {
        let service = getDefaultService(mode);
        return service.addHandler("codeAction", callback);
      },
      provideValidation(mode, callback) {
        let service = getDefaultService(mode);
        return service.addHandler("validation", callback);
      }
    };

    window.acode?.define("acode-language-client", this.$exports);
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

  destroy() {}

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
        return formatUrl(folder.url, false);
      }
    }

    // if (this.$rootUri) return this.$rootUri;

    let folders = this.#getFolders();

    if (folders?.length) {
      return formatUrl(folders[0].url, false);
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
      uri: formatUrl(item.url, false),
      url: formatUrl(item.url, false)
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
      className: "breadcrumbs"
    });
    let mainElement = document.querySelector("#root ul.open-file-list");
    if (!mainElement) {
      mainElement = document.body;
    }
    mainElement.after(this.$breadcrumbsNode);
  }

  #setupAcodeEvents() {
    if (!window.acode) return;

    editorManager.on("remove-file", file => {
      if (!file.session) return;
      let services = this.#getServices(file.session);
      try {
        services.map(service => {
          service.serviceInstance?.removeDocument(
            service.serviceInstance.getDocument(
              this.$client.$getFileName(file.session)
            )
          );
        });
      } catch (e) {
        console.error(e);
      }
    });

    editorManager.on("rename-file", file => {
      let services = this.#getServices(file.session);
      try {
        services.map(service => {
          service.serviceInstance?.removeDocument(
            service.serviceInstance.getDocument(
              this.$client.$getFileName(file.session)
            )
          );
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
                    uri: formatUrl(folder.url, false),
                    url: formatUrl(folder.url, false)
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
                    uri: formatUrl(folder.url, false),
                    url: formatUrl(folder.url, false)
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
  }

  #setupFooter() {
    let footer = document.querySelector("#root footer");

    this.$footer = footer.appendChild(
      tag("div", {
        className: "button-container"
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

    services.map(service => {
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
      }
    });
  }

  #findReferences() {
    let services = this.#filterService(
      capabilities => capabilities.referencesProvider
    ).map(service => service.serviceInstance);
    let cursor = editor.getCursorPosition();
    let position = fromPoint(cursor);

    services.map(service => {
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
      }
    });
  }

  #findImplementations() {
    let services = this.#filterService(
      capabilities => capabilities.implementationProvider
    ).map(service => service.serviceInstance);
    let cursor = editor.getCursorPosition();
    let position = fromPoint(cursor);

    services.map(service => {
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
      return await services[0].serviceInstance.connection.sendRequest(
        "textDocument/documentSymbol",
        {
          textDocument: {
            uri: this.$client.$getFileName(editor.session)
          }
        }
      );
    } catch (e) {
      console.error(e);
    }
  }

  async $buildBreadcrumbs() {
    let symbols = await this.getDocumentSymbols();

    if (symbols && symbols !== this.$currentSymbols) {
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
        const rootNodes = objects.filter(object => !object.containerName);

        // Build the tree object and return it
        return rootNodes.map(node => buildNode(node));
      }

      let tree = createTreeObject(symbols);
      this.$breadcrumbsTree = tree;
      this.$buildBreadcrumbsUi(tree);
      return tree;
    }
  }

  $buildBreadcrumbsUi(tree) {
    let breadcrumbNodes = [];

    let buildBreadcrumbNodes = () => {
      this.$breadcrumbsNode.innerHTML = "";
      for (let object of breadcrumbNodes) {
        let node = tag("span", {
          textContent: object.name,
          className: "breadcrumb-name"
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
          textContent: object.name
        });

      if (object.children.length) {
        dropdown = tag("ul", {
          className: "dropdown",
          children: object.children.map(child => {
            let childNode = createNode(child, level + 1);
            let item = tag("li", {
              className: "dropdown-item",
              children: [childNode]
            });
            if (!(childNode.children.length >= 1)) {
              item.classList.add("childless");
            }
            return item;
          })
        });
        node.appendChild(dropdown);
      }
      node.onclick = ({ target }) => {
        if (target === node) {
          if (object.children.length && dropdown) {
            dropdown.classList.toggle("visible");
          }
          breadcrumbNodes[level] = object;
          breadcrumbNodes.splice(level + 1);
          buildBreadcrumbNodes();

          editor.scrollToLine(object.location.range.start.line - 10);

          let start = object.location.range.start.line;
          let end = object.location.range.end.line;

          if (this.$currentRange !== undefined) {
            editor.session.removeMarker(this.$currentRange);
          }

          this.$currentRange = editor.session.addMarker(
            new Range(start, 0, end, 0),
            "ace_selected-word",
            "fullLine"
          );
        }
      };
      return node;
    };

    let mainNode;
    if (tree.length >= 1) {
      if (tree.length === 1) {
        breadcrumbNodes[0] = tree[0];
      } else {
        breadcrumbNodes[0] = {
          name: tree[0].name,
          children: tree
        };
      }
      mainNode = createNode(breadcrumbNodes[0]);
    }
    mainNode?.classList.add("breadcrumb-dropdown");
    buildBreadcrumbNodes();

    document.addEventListener("click", ({ target }) => {
      if (
        !target.matches(
          ".breadcrumbs, .breadcrumb-dropdown, .breadcrumb-item, " +
            ".breadcrumb-name, .dropdown-item, .dropdown-name"
        )
      ) {
        if (mainNode?.classList.contains("visible")) {
          mainNode?.classList.remove("visible");
        }
      } else {
        mainNode?.classList.add("visible");
      }
    });

    editor.on("focus", () => {
      if (mainNode?.classList.contains("visible")) {
        mainNode?.classList.remove("visible");
      }
      if (this.$currentRange !== undefined) {
        editor.session.removeMarker(this.$currentRange);
      }
    });

    return mainNode ? document.body.appendChild(mainNode) : null;
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
      url: "ws://localhost:3030/"
    };
  }

  get settingsObj() {
    const AppSettings = acode.require("settings");
    return {
      list: [
        {
          key: "url",
          text: "Server Url",
          value: this.settings.url,
          prompt: "Server URL",
          promptType: "text"
        },
        // {
        //   key: "linter",
        //   text: "Linter (Python)",
        //   value: this.settings.linter,
        //   info: "Linter to use with python type checking.",
        //   select: LINTERS
        // },
        {
          key: "hover",
          text: "Show Tooltip",
          checkbox: this.settings.hover,
          info: "Show Tooltip on hover or selection"
        },
        {
          key: "completion",
          text: "Code Completion",
          checkbox: this.settings.completion,
          info: "Enable code completion."
        },
        {
          key: "completionResolve",
          text: "Doc Tooltip",
          checkbox: this.settings.completionResolve,
          info: "Enable code completion resolve."
        },
        {
          key: "replaceCompleters",
          text: "Replace Completers",
          checkbox: this.settings.replaceCompleters,
          info: "Disable the default code completers."
        }
      ],
      cb: (key, value) => {
        switch (key) {
          case "url":
            if (!value.endsWith("/")) {
              value = value + "/";
            }
          // case "linter":
          //   this.$client.setGlobalOptions("python", {
          //     pylsp: {
          //       configurationSources: ["pycodestyle"],
          //       plugins: {
          //         pycodestyle: {
          //           enabled: true,
          //           ignore: ["E501"],
          //           maxLineLength: 10
          //         },
          //         pyflakes: {
          //           enabled: value === "pyflakes"
          //         },
          //         pylint: {
          //           enabled: value === "pylint"
          //         },
          //         pyls_mypy: {
          //           enabled: value === "mypy"
          //         }
          //       }
          //     }
          //   });
          case "replaceCompleters":
            if (value) {
              this.$completers = editor.completers.splice(1, 2);
            } else {
              if (this.$completers) {
                editor.completers = [...this.$completers, ...editor.completers];
              }
            }
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
