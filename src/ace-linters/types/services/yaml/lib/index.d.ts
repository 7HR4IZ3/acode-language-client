export var SettingsState: {
    new (): {
        formatterRegistration: any;
        specificValidatorPaths: any[];
        schemaConfigurationSettings: any[];
        yamlShouldValidate: boolean;
        yamlFormatterSettings: {
            singleQuote: boolean;
            bracketSpacing: boolean;
            proseWrap: string;
            printWidth: number;
            enable: boolean;
        };
        yamlShouldHover: boolean;
        yamlShouldCompletion: boolean;
        schemaStoreSettings: any[];
        customTags: any[];
        schemaStoreEnabled: boolean;
        schemaStoreUrl: string;
        disableAdditionalProperties: boolean;
        disableDefaultProperties: boolean;
        suggest: {
            parentSkeletonSelectedFirst: boolean;
        };
        keyOrdering: boolean;
        maxItemsComputed: number;
        pendingValidationRequests: {};
        validationDelayMs: number;
        documents: any;
        workspaceRoot: any;
        workspaceFolders: any[];
        clientDynamicRegisterSupport: boolean;
        hierarchicalDocumentSymbolSupport: boolean;
        hasWorkspaceFolderCapability: boolean;
        hasConfigurationCapability: boolean;
        useVSCodeContentRequest: boolean;
        yamlVersion: string;
        useSchemaSelectionRequests: boolean;
        hasWsChangeWatchedFileDynamicRegistration: boolean;
        fileExtensions: string[];
    };
};
export var YAMLSchemaService: {
    new (requestService: any, contextService: any, promiseConstructor: any): {
        schemaUriToNameAndDescription: Map<any, any>;
        requestService: any;
        schemaPriorityMapping: Map<any, any>;
        registerCustomSchemaProvider(customSchemaProvider: any): void;
        customSchemaProvider: any;
        getAllSchemas(): {
            uri: any;
            fromStore: boolean;
            usedForCurrentFile: boolean;
        }[];
        resolveSchemaContent(schemaToResolve: any, schemaURL: any, dependencies: any): Promise<any>;
        getSchemaForResource(resource: any, doc: any): any;
        addSchemaPriority(uri: any, priority: any): void;
        /**
         * Search through all the schemas and find the ones with the highest priority
         */
        highestPrioritySchemas(schemas2: any): any;
        resolveCustomSchema(schemaUri: any, doc: any): Promise<any>;
        /**
         * Save a schema with schema ID and schema content.
         * Overrides previous schemas set for that schema ID.
         */
        saveSchema(schemaId: any, schemaContent: any): Promise<undefined>;
        /**
         * Delete schemas on specific path
         */
        deleteSchemas(deletions: any): Promise<undefined>;
        /**
         * Delete a schema with schema ID.
         */
        deleteSchema(schemaId: any): Promise<undefined>;
        /**
         * Add content to a specified schema at a specified path
         */
        addContent(additions: any): Promise<void>;
        /**
         * Delete content in a specified schema at a specified path
         */
        deleteContent(deletions: any): Promise<void>;
        /**
         * Take a JSON Schema and the path that you would like to get to
         * @returns the JSON Schema resolved at that specific path
         */
        resolveJSONSchemaToSection(schema4: any, paths: any): any;
        /**
         * Resolve the next Object if they have compatible types
         * @param object a location in the JSON Schema
         * @param token the next token that you want to search for
         */
        resolveNext(object: any, token: any): void;
        /**
         * Everything below here is needed because we're importing from vscode-json-languageservice umd and we need
         * to provide a wrapper around the javascript methods we are calling since they have no type
         */
        normalizeId(id: any): any;
        getOrAddSchemaHandle(id: any, unresolvedSchemaContent: any): any;
        loadSchema(schemaUri: any): any;
        registerExternalSchema(uri: any, filePatterns: any, unresolvedSchema: any, name: any, description: any, versions: any): any;
        clearExternalSchemas(): void;
        setSchemaContributions(schemaContributions2: any): void;
        getRegisteredSchemaIds(filter: any): any;
        getResolvedSchema(schemaId: any): any;
        onResourceChange(uri: any): any;
    };
};
export var YAMLValidation: {
    new (schemaService: any, telemetry: any): {
        telemetry: any;
        validators: any[];
        MATCHES_MULTIPLE: string;
        validationEnabled: boolean;
        jsonValidation: any;
        configure(settings: any): void;
        customTags: any;
        disableAdditionalProperties: any;
        yamlVersion: any;
        doValidation(textDocument: any, isKubernetes?: boolean): Promise<any[]>;
        runAdditionalValidators(document2: any, yarnDoc: any): any[];
    };
};
export function getLanguageService(params: any): {
    configure: (settings: any) => void;
    registerCustomSchemaProvider: (schemaProvider: any) => void;
    findLinks: any;
    doComplete: any;
    doValidation: any;
    doHover: any;
    findDocumentSymbols: any;
    findDocumentSymbols2: any;
    doDefinition: any;
    resetSchema: (uri: any) => any;
    doFormat: any;
    doDocumentOnTypeFormatting: typeof doDocumentOnTypeFormatting;
    addSchema: (schemaID: any, schema4: any) => Promise<undefined>;
    deleteSchema: (schemaID: any) => Promise<undefined>;
    modifySchemaContent: (schemaAdditions: any) => Promise<void>;
    deleteSchemaContent: (schemaDeletions: any) => Promise<void>;
    deleteSchemasWhole: (schemaDeletions: any) => Promise<undefined>;
    getFoldingRanges: typeof getFoldingRanges2;
    getSelectionRanges: typeof getSelectionRanges2;
    getCodeAction: (document2: any, params2: any) => any[] | undefined;
    getCodeLens: (document2: any) => Promise<any[]>;
    resolveCodeLens: (param: any) => any;
};
declare function doDocumentOnTypeFormatting(document2: any, params: any): any[] | undefined;
declare function getFoldingRanges2(document2: any, context: any): any[] | undefined;
declare function getSelectionRanges2(document2: any, positions: any): any;
export {};
