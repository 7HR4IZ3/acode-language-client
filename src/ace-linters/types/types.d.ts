export declare class ReconnectingWebSocket extends EventTarget {
    onopen?: Function;
    onclose?: Function;
    onerror?: Function;
    onmessage?: Function;
    connection?: WebSocket;
    constructor(url: string | URL, protocols?: string | string[], autoConnect?: boolean, autoReconnect?: boolean, delay?: number);
    get readyState(): number;
    connect(retry?: boolean): null;
    reconnect(): null;
    send(data: any): null;
    close(): null;
}
